"use client";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateRanks,
  exportToCsv,
  saveTeamGroup,
} from "@/lib/store";
import { Student, MeasurementItem, MeasurementRecord } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import {
  FileDown,
  Users,
  Shuffle,
  Loader2,
  Wand2,
  Send,
  PlusCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getScoutingReport } from "@/ai/flows/scouting-report-flow";
import type { ScoutingReportOutput } from "@/ai/flows/scouting-report-flow";

type RankedStudent = {
  rank: number;
  id: string;
  name: string;
  grade: string;
  classNum: string;
  studentNum: string;
  value: string;
};

interface RankingProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
}

export default function Ranking({
  allStudents,
  allItems,
  allRecords,
}: RankingProps) {
  const { school } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [rankedStudents, setRankedStudents] = useState<RankedStudent[]>([]);

  const grades = useMemo(
    () => [...new Set(allStudents.map((s) => s.grade))].sort(),
    [allStudents]
  );

  useEffect(() => {
    if (school && selectedGrade && selectedItem) {
      const ranksByItem = calculateRanks(
        school,
        allItems,
        allRecords,
        allStudents,
        selectedGrade
      );
      const itemRanks = ranksByItem[selectedItem];
      const itemInfo = allItems.find((i) => i.name === selectedItem);

      if (itemRanks && itemInfo) {
        const studentMap = new Map(allStudents.map((s) => [s.id, s]));
        const sortedRankedStudents = itemRanks
          .map((rankInfo) => {
            const student = studentMap.get(rankInfo.studentId);
            if (!student) return null;
            return {
              rank: rankInfo.rank,
              id: student.id,
              name: student.name,
              grade: student.grade,
              classNum: student.classNum,
              studentNum: student.studentNum,
              value:
                itemInfo.recordType === "level"
                  ? rankInfo.value === 1
                    ? "상"
                    : rankInfo.value === 2
                    ? "중"
                    : "하"
                  : `${rankInfo.value}${itemInfo.unit}`,
            };
          })
          .filter((s): s is RankedStudent => s !== null);

        setRankedStudents(sortedRankedStudents);
      } else {
        setRankedStudents([]);
      }
    } else {
      setRankedStudents([]);
    }
  }, [school, selectedGrade, selectedItem, allStudents, allItems, allRecords]);

  if (!school) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>종목별 순위 조회</CardTitle>
          <CardDescription>
            학년과 종목을 선택하여 전체 학생 순위를 확인합니다. 종목별 우수
            학생과 부진 학생을 쉽게 파악할 수 있습니다.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}학년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedItem}
              onValueChange={setSelectedItem}
              disabled={!selectedGrade}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="종목 선택" />
              </SelectTrigger>
              <SelectContent>
                {allItems.map((item) => (
                  <SelectItem key={item.id} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>등수</TableHead>
                <TableHead>학년</TableHead>
                <TableHead>반</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>기록</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedStudents.length > 0 ? (
                rankedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-bold">{student.rank}등</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell>{student.classNum}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.value}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    조회할 학년과 종목을 선택해주세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TeamBalancer
        allStudents={allStudents}
        allItems={allItems}
        allRecords={allRecords}
      />
    </div>
  );
}

function TeamBalancer({ allStudents, allItems, allRecords }: RankingProps) {
  const { school } = useAuth();
  const { toast } = useToast();

  const [analysisScope, setAnalysisScope] = useState<"all" | "grade" | "class">(
    "grade"
  );
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClassNum, setSelectedClassNum] = useState("");
  const [selectedGender, setSelectedGender] = useState<"all" | "남" | "여">(
    "all"
  );
  const [excludeNonParticipants, setExcludeNonParticipants] = useState(true);

  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [membersPerTeam, setMembersPerTeam] = useState(4);
  const [divideBy, setDivideBy] = useState<"teams" | "members">("teams");

  const [teams, setTeams] = useState<Student[][]>([]);
  const [leftoverStudents, setLeftoverStudents] = useState<Student[]>([]);
  const [studentScores, setStudentScores] = useState<
    Map<string, { totalScore: number; scores: { item: string; score: number }[] }>
  >(new Map());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [balanceStrategy, setBalanceStrategy] = useState<"uniform" | "level">(
    "uniform"
  );
  const [balancingSelection, setBalancingSelection] = useState<
    Record<string, boolean>
  >({});

  const [scoutingReport, setScoutingReport] =
    useState<ScoutingReportOutput | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { grades, classNumsByGrade, groupedItems } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort();
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [
        ...new Set(
          allStudents.filter((s) => s.grade === grade).map((s) => s.classNum)
        ),
      ].sort();
    });

    const grouped: Record<string, MeasurementItem[]> = { PAPS: [] };
    allItems.forEach((item) => {
      const category = item.category || (item.isPaps ? "PAPS" : "기타");
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    const orderedGroups: Record<string, MeasurementItem[]> = {
      PAPS: grouped["PAPS"],
    };
    Object.keys(grouped).forEach((key) => {
      if (key !== "PAPS" && key !== "기타") orderedGroups[key] = grouped[key];
    });
    if (grouped["기타"]?.length > 0) orderedGroups["기타"] = grouped["기타"];

    return { grades, classNumsByGrade, groupedItems: orderedGroups };
  }, [allStudents, allItems]);

  const targetStudents = useMemo(() => {
    let students = allStudents;
    switch (analysisScope) {
      case "all":
        students = allStudents;
        break;
      case "grade":
        students = selectedGrade
          ? allStudents.filter((s) => s.grade === selectedGrade)
          : [];
        break;
      case "class":
        students =
          selectedGrade && selectedClassNum
            ? allStudents.filter(
                (s) => s.grade === selectedGrade && s.classNum === selectedClassNum
              )
            : [];
        break;
      default:
        students = [];
    }

    if (selectedGender !== "all") {
      students = students.filter((s) => s.gender === selectedGender);
    }

    return students;
  }, [analysisScope, selectedGrade, selectedClassNum, selectedGender, allStudents]);

  useEffect(() => {
    if (targetStudents.length > 0 && selectedItemNames.length > 0) {
      const studentIdToRawScores = new Map<
        string,
        { totalScore: number; scores: { item: string; score: number }[] }
      >();

      const studentsForAnalysis = targetStudents.filter((student) => {
        if (!excludeNonParticipants) return true;
        return selectedItemNames.some((itemName) =>
          allRecords.some(
            (r) => r.studentId === student.id && r.item === itemName
          )
        );
      });

      const gradeForRanking =
        analysisScope === "all"
          ? undefined
          : analysisScope === "grade"
          ? selectedGrade
          : targetStudents[0]?.grade || "";
      const allRanks = calculateRanks(
        school,
        allItems,
        allRecords,
        allStudents,
        gradeForRanking
      );

      selectedItemNames.forEach((itemName) => {
        const itemInfo = allItems.find((i) => i.name === itemName);
        if (!itemInfo) return;

        const itemRanks = allRanks[itemName];

        if (itemRanks) {
          const totalInRank = itemRanks.length;
          itemRanks.forEach((rankInfo) => {
            if (!studentsForAnalysis.some((s) => s.id === rankInfo.studentId))
              return;

            const score = Math.round(
              (1 - (rankInfo.rank - 1) / totalInRank) * 100
            );
            if (!studentIdToRawScores.has(rankInfo.studentId)) {
              studentIdToRawScores.set(rankInfo.studentId, {
                totalScore: 0,
                scores: [],
              });
            }
            const studentData = studentIdToRawScores.get(rankInfo.studentId)!;
            studentData.scores.push({ item: itemName, score: score });
          });
        }
      });

      studentsForAnalysis.forEach((student) => {
        const studentData = studentIdToRawScores.get(student.id) || {
          totalScore: 0,
          scores: [],
        };

        selectedItemNames.forEach((itemName) => {
          if (!studentData.scores.some((s) => s.item === itemName)) {
            studentData.scores.push({ item: itemName, score: 0 });
          }
        });

        studentData.totalScore = studentData.scores.reduce(
          (acc, s) => acc + s.score,
          0
        );
        studentIdToRawScores.set(student.id, studentData);
      });

      const finalStudentScores = new Map<
        string,
        { totalScore: number; scores: { item: string; score: number }[] }
      >();
      
      const studentsToScore = Array.from(studentIdToRawScores.keys());
      if (studentsToScore.length > 0) {
        const maxRawTotalScore = Math.max(...studentsToScore.map(id => studentIdToRawScores.get(id)!.totalScore));

        studentIdToRawScores.forEach((data, studentId) => {
          const finalScore =
            maxRawTotalScore > 0
              ? Math.round((data.totalScore / maxRawTotalScore) * 100)
              : 0;
          finalStudentScores.set(studentId, { ...data, totalScore: finalScore });
        });
      }

      setStudentScores(finalStudentScores);

      const newSelection: Record<string, boolean> = {};
      finalStudentScores.forEach((_, studentId) => {
        newSelection[studentId] = true;
      });
      setBalancingSelection(newSelection);
    } else {
      setStudentScores(new Map());
      setBalancingSelection({});
    }
    setTeams([]);
    setLeftoverStudents([]);
    setSelectedStudentId(null);
  }, [
    targetStudents,
    selectedItemNames,
    excludeNonParticipants,
    allRecords,
    allItems,
    school,
    allStudents,
    analysisScope,
    selectedGrade,
  ]);

  const handleToggleItem = (itemName: string) => {
    setSelectedItemNames((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const handleToggleCategory = (category: string, checked: boolean) => {
    const categoryItems = groupedItems[category].map((item) => item.name);
    if (checked) {
      setSelectedItemNames((prev) => [...new Set([...prev, ...categoryItems])]);
    } else {
      setSelectedItemNames((prev) =>
        prev.filter((name) => !categoryItems.includes(name))
      );
    }
  };

  const selectedStudentData = useMemo(() => {
    if (!selectedStudentId) return null;
    const scores = studentScores.get(selectedStudentId);
    return scores ? scores.scores : null;
  }, [selectedStudentId, studentScores]);

  useEffect(() => {
    // Clear AI report when student selection changes
    setScoutingReport(null);
  }, [selectedStudentId]);

  const handleAiReport = async () => {
    if (!selectedStudentId || !selectedStudentData) {
      toast({
        variant: "destructive",
        title: "AI 리포트 생성 불가",
        description: "학생을 먼저 선택해주세요.",
      });
      return;
    }
    setIsReportLoading(true);
    setScoutingReport(null);
    try {
      const student = allStudents.find((s) => s.id === selectedStudentId);
      if (!student) return;

      const studentRanks: Record<string, string> = {};
      const gradeForRanking =
        analysisScope === "all"
          ? undefined
          : analysisScope === "grade"
          ? selectedGrade
          : student.grade || "";
      const ranksByItem = calculateRanks(
        school,
        allItems,
        allRecords,
        allStudents,
        gradeForRanking
      );

      selectedItemNames.forEach((item) => {
        const rankInfo = ranksByItem[item]?.find(
          (r) => r.studentId === student.id
        );
        if (rankInfo) {
          studentRanks[item] = `${ranksByItem[item].length}명 중 ${
            rankInfo.rank
          }등`;
        }
      });

      const input = {
        studentName: student.name,
        abilityScores: selectedStudentData.map((s) => {
          const itemInfo = allItems.find((i) => i.name === s.item);
          return {
            item: s.item,
            score: s.score,
            category: itemInfo?.category || (itemInfo?.isPaps ? "PAPS" : "기타"),
          };
        }),
        ranks: studentRanks,
        allItems,
      };
      const result = await getScoutingReport(input);
      setScoutingReport(result);
    } catch (error) {
      console.error("Failed to get AI Scouting Report:", error);
      toast({ variant: "destructive", title: "AI 리포트 생성 실패" });
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleBalanceTeams = () => {
    const selectedStudentIds = Object.entries(balancingSelection)
      .filter(([, isSelected]) => isSelected)
      .map(([studentId]) => studentId);

    if (
      selectedStudentIds.length === 0 ||
      (divideBy === "teams" && numTeams < 2) ||
      (divideBy === "members" && membersPerTeam < 1)
    ) {
      toast({
        variant: "destructive",
        title: "팀 편성 불가",
        description:
          "분석/편성 대상 학생, 종목, 팀 나누기 기준을 올바르게 설정해주세요.",
      });
      return;
    }

    const studentMap = new Map(allStudents.map((s) => [s.id, s]));

    const createTeamsForGroup = (studentGroup: Student[]) => {
      const sortedStudents = studentGroup
        .map((s) => ({ id: s.id, scoreData: studentScores.get(s.id) }))
        .filter((s) => s.scoreData)
        .sort((a, b) => b.scoreData!.totalScore - a.scoreData!.totalScore)
        .map((s) => studentMap.get(s.id)!);

      if (divideBy === "teams") {
        const newTeams: Student[][] = Array.from({ length: numTeams }, () => []);
        sortedStudents.forEach((student, index) => {
          const teamIndex = index % numTeams;
          newTeams[teamIndex].push(student);
        });
        return { teams: newTeams, leftovers: [] };
      } else {
        // divide by members
        const numTeamsForGroup = Math.floor(
          sortedStudents.length / membersPerTeam
        );
        if (numTeamsForGroup === 0) {
          return { teams: [], leftovers: sortedStudents };
        }

        const studentsToDistribute = [...sortedStudents];
        const newTeams: Student[][] = Array.from(
          { length: numTeamsForGroup },
          () => []
        );

        if (balanceStrategy === "uniform") {
          // Zigzag/Snake distribution
          let currentTeam = 0;
          let direction = 1;
          studentsToDistribute.forEach((student) => {
            newTeams[currentTeam].push(student);
            currentTeam += direction;
            if (currentTeam >= numTeamsForGroup || currentTeam < 0) {
              direction *= -1;
              currentTeam += direction;
            }
          });
        } else {
          // Level/Sequential distribution
          for (let i = 0; i < numTeamsForGroup; i++) {
            newTeams[i] = studentsToDistribute.splice(0, membersPerTeam);
          }
        }
        return { teams: newTeams, leftovers: studentsToDistribute };
      }
    };

    if (analysisScope === "grade" && selectedGrade) {
      const classesInGrade = [
        ...new Set(targetStudents.map((s) => s.classNum)),
      ];
      let allNewTeams: Student[][] = [];
      let allLeftovers: Student[] = [];

      classesInGrade.forEach((classNum) => {
        const classStudents = targetStudents.filter(
          (s) => s.classNum === classNum && selectedStudentIds.includes(s.id)
        );
        if (classStudents.length > 0) {
          const { teams: classTeams, leftovers: classLeftovers } =
            createTeamsForGroup(classStudents);
          allNewTeams = [...allNewTeams, ...classTeams];
          allLeftovers = [...allLeftovers, ...classLeftovers];
        }
      });
      setTeams(allNewTeams);
      setLeftoverStudents(allLeftovers);
    } else {
      // 'all' or 'class' scope
      const studentsToBalance = targetStudents.filter((s) =>
        selectedStudentIds.includes(s.id)
      );
      const { teams: newTeams, leftovers } =
        createTeamsForGroup(studentsToBalance);
      setTeams(newTeams);
      setLeftoverStudents(leftovers);
    }

    toast({
      title: "팀 편성 완료",
      description:
        "팀이 자동으로 편성되었습니다. 남은 학생이 있는 경우 수동으로 배정해주세요.",
    });
  };

  const handleAssignLeftover = (studentId: string, teamIndex: number) => {
    const studentToMove = leftoverStudents.find((s) => s.id === studentId);
    if (!studentToMove) return;

    setTeams((prevTeams) => {
      const newTeams = [...prevTeams];
      newTeams[teamIndex] = [...newTeams[teamIndex], studentToMove];
      return newTeams;
    });

    setLeftoverStudents((prevLeftovers) =>
      prevLeftovers.filter((s) => s.id !== studentId)
    );
  };

  const handleDownloadTeams = () => {
    if (teams.length === 0) {
      toast({
        variant: "destructive",
        title: "다운로드 실패",
        description: "먼저 팀을 편성해주세요.",
      });
      return;
    }

    let fileName = `${school}_자동편성팀.csv`;
    if (analysisScope === "grade" && selectedGrade) {
      fileName = `${school}_${selectedGrade}학년_자동편성팀.csv`;
    } else if (analysisScope === "class" && selectedGrade && selectedClassNum) {
      fileName = `${school}_${selectedGrade}-${selectedClassNum}_자동편성팀.csv`;
    }

    const dataToExport = teams.flatMap((team, index) => {
      const firstStudent = team[0];
      const teamName = firstStudent
        ? `${firstStudent.grade}-${firstStudent.classNum}반 ${index + 1}팀`
        : `${index + 1}팀`;
      return team.map((student) => ({
        "팀명": teamName,
        이름: student.name,
        학년: student.grade,
        반: student.classNum,
        번호: student.studentNum,
      }));
    });

    exportToCsv(fileName, dataToExport);
  };

  const handleSendTeams = async () => {
    if (!school || teams.length === 0) {
      toast({
        variant: "destructive",
        title: "전달 실패",
        description: "먼저 팀을 편성해야 합니다.",
      });
      return;
    }
    if (leftoverStudents.length > 0) {
      toast({
        variant: "destructive",
        title: "전달 실패",
        description: "남은 학생을 모두 팀에 배정한 후 전달해주세요.",
      });
      return;
    }
    setIsSending(true);
    try {
      let description = "팀 편성 결과";
      if (analysisScope === "class" && selectedGrade && selectedClassNum) {
        description = `${selectedGrade}학년 ${selectedClassNum}반 팀`;
      } else if (analysisScope === "grade" && selectedGrade) {
        description = `${selectedGrade}학년 팀`;
      }

      const teamData = {
        school,
        description,
        teams: teams.map((team, index) => ({
          teamIndex: index,
          memberIds: team.map((student) => student.id),
        })),
      };
      await saveTeamGroup(teamData);
      toast({
        title: "전달 완료",
        description: "편성된 팀 명단이 학생들에게 전달되었습니다.",
      });
    } catch (error) {
      console.error("Failed to send teams:", error);
      toast({
        variant: "destructive",
        title: "전달 실패",
        description: "오류가 발생했습니다. 다시 시도해주세요.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectAllForBalancing = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
      studentScores.forEach((_, studentId) => {
        newSelection[studentId] = true;
      });
    }
    setBalancingSelection(newSelection);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shuffle /> 팀 자동 편성
        </CardTitle>
        <CardDescription>
          선택한 종목의 기록을 바탕으로 학생별 능력치를 분석하고, 균형잡힌 팀을
          자동으로 편성합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 p-4 border rounded-md">
          <h3 className="font-semibold">1. 분석 대상 설정</h3>
          <p className="text-sm text-muted-foreground">
            편성 범위를 '학년별'로 선택 시, 해당 학년의 각 반별로 팀이
            독립적으로 생성됩니다.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>편성 범위</Label>
              <Select
                value={analysisScope}
                onValueChange={(v) => setAnalysisScope(v as any)}
              >
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="grade">학년별</SelectItem>
                  <SelectItem value="class">학급별</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(analysisScope === "grade" || analysisScope === "class") && (
              <div>
                <Label>학년</Label>
                <Select
                  value={selectedGrade}
                  onValueChange={(v) => {
                    setSelectedGrade(v);
                    setSelectedClassNum("");
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="학년 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}학년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {analysisScope === "class" && (
              <div>
                <Label>학급</Label>
                <Select
                  value={selectedClassNum}
                  onValueChange={setSelectedClassNum}
                  disabled={!selectedGrade}
                >
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="반 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {classNumsByGrade[selectedGrade]?.map((classNum) => (
                      <SelectItem key={classNum} value={classNum}>
                        {classNum}반
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>성별</Label>
              <Select
                value={selectedGender}
                onValueChange={(v) => setSelectedGender(v as any)}
              >
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체(혼성)</SelectItem>
                  <SelectItem value="남">남</SelectItem>
                  <SelectItem value="여">여</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="exclude"
                checked={excludeNonParticipants}
                onCheckedChange={(c) => setExcludeNonParticipants(!!c)}
              />
              <Label htmlFor="exclude">기록 없는 학생 제외</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>종목 선택</Label>
            <div className="space-y-2 p-2 border rounded-md mt-1">
              {Object.entries(groupedItems).map(([category, items]) => {
                if (items.length === 0) return null;
                const categoryItems = items.map((item) => item.name);
                const isAllSelected = categoryItems.every((name) =>
                  selectedItemNames.includes(name)
                );
                const isIndeterminate =
                  categoryItems.some((name) =>
                    selectedItemNames.includes(name)
                  ) && !isAllSelected;

                return (
                  <div key={category}>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={isAllSelected}
                        onCheckedChange={(c) =>
                          handleToggleCategory(category, !!c)
                        }
                        aria-checked={isIndeterminate ? "mixed" : isAllSelected}
                        disabled={targetStudents.length === 0}
                      />
                      <Label
                        htmlFor={`category-${category}`}
                        className="font-semibold"
                      >
                        {category}
                      </Label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2 pl-6">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`item-${item.id}`}
                            checked={selectedItemNames.includes(item.name)}
                            onCheckedChange={() => handleToggleItem(item.name)}
                            disabled={targetStudents.length === 0}
                          />
                          <Label
                            htmlFor={`item-${item.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {item.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {studentScores.size > 0 && (
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-semibold">
              2. 학생별 능력치 확인 및 AI 스카우팅 리포트
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>학생 선택</Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={setSelectedStudentId}
                    value={selectedStudentId || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="학생을 선택하여 능력치 그래프 보기" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...studentScores.keys()].map((studentId) => {
                        const student = allStudents.find(
                          (s) => s.id === studentId
                        );
                        return student ? (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.grade}-{student.classNum}-
                            {student.studentNum})
                          </SelectItem>
                        ) : null;
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAiReport}
                    disabled={!selectedStudentId || isReportLoading}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {isReportLoading ? "분석 중..." : "AI 리포트"}
                  </Button>
                </div>
                {selectedStudentData && (
                  <div className="mt-4 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        data={selectedStudentData}
                      >
                        <PolarGrid />
                        <PolarAngleAxis dataKey="item" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="능력치"
                          dataKey="score"
                          stroke="hsl(var(--chart-1))"
                          fill="hsl(var(--chart-1))"
                          fillOpacity={0.6}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {isReportLoading && (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="animate-spin" />
                  </div>
                )}
                {scoutingReport && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        AI 스카우팅 리포트
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div>
                        <h4 className="font-bold">핵심 강점</h4>
                        <p className="whitespace-pre-wrap">
                          {scoutingReport.strengths}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-bold">보완점</h4>
                        <p className="whitespace-pre-wrap">
                          {scoutingReport.weaknesses}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-bold">종합 평가</h4>
                        <p className="whitespace-pre-wrap">
                          {scoutingReport.assessment}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-bold">추천 포지션</h4>
                        <p className="whitespace-pre-wrap">
                          {scoutingReport.position}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              <div className="max-h-[450px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            studentScores.size > 0 &&
                            Object.keys(balancingSelection).length ===
                              studentScores.size &&
                            Object.values(balancingSelection).every(Boolean)
                          }
                          onCheckedChange={(c) =>
                            handleSelectAllForBalancing(!!c)
                          }
                        />
                      </TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>총점</TableHead>
                      {selectedItemNames.slice(0, 2).map((name) => (
                        <TableHead key={name}>{name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...studentScores.entries()]
                      .sort((a, b) => b[1].totalScore - a[1].totalScore)
                      .map(([studentId, data]) => {
                        const student = allStudents.find(
                          (s) => s.id === studentId
                        );
                        if (!student) return null;
                        return (
                          <TableRow
                            key={studentId}
                            onClick={() => setSelectedStudentId(studentId)}
                            className="cursor-pointer"
                            data-state={
                              selectedStudentId === studentId ? "selected" : ""
                            }
                          >
                            <TableCell>
                              <Checkbox
                                checked={balancingSelection[studentId] || false}
                                onCheckedChange={(c) =>
                                  setBalancingSelection((prev) => ({
                                    ...prev,
                                    [studentId]: !!c,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell>{student.name}</TableCell>
                            <TableCell className="font-bold">
                              {data.totalScore}
                            </TableCell>
                            {selectedItemNames.slice(0, 2).map((itemName) => (
                              <TableCell key={itemName}>
                                {data.scores.find((s) => s.item === itemName)
                                  ?.score || 0}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {studentScores.size > 0 && (
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-semibold">3. 팀 편성</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>팀 나누기 기준</Label>
                <RadioGroup
                  defaultValue="teams"
                  onValueChange={(v) => setDivideBy(v as any)}
                  className="flex items-center gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="teams" id="teams" />
                    <Label htmlFor="teams">팀 수로 나누기</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="members" id="members" />
                    <Label htmlFor="members">팀원 수로 나누기</Label>
                  </div>
                </RadioGroup>
              </div>

              {divideBy === "teams" ? (
                <div>
                  <Label htmlFor="num-teams">팀 수</Label>
                  <Input
                    id="num-teams"
                    type="number"
                    value={numTeams}
                    onChange={(e) =>
                      setNumTeams(Math.max(2, parseInt(e.target.value) || 2))
                    }
                    min="2"
                    className="w-[100px]"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="members-per-team">팀원 수</Label>
                  <Input
                    id="members-per-team"
                    type="number"
                    value={membersPerTeam}
                    onChange={(e) =>
                      setMembersPerTeam(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    min="1"
                    className="w-[100px]"
                  />
                </div>
              )}

              <div>
                <Label>편성 방식</Label>
                <RadioGroup
                  defaultValue="uniform"
                  onValueChange={
                    (value) =>
                      setBalanceStrategy(value as "uniform" | "level")
                  }
                  className="flex items-center gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="uniform" id="uniform" />
                    <Label htmlFor="uniform">균등 편성</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="level" id="level" />
                    <Label htmlFor="level">레벨 편성</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button onClick={handleBalanceTeams}>
                <Shuffle /> 팀 나누기
              </Button>
              <Button
                onClick={handleDownloadTeams}
                variant="outline"
                disabled={teams.length === 0}
              >
                <FileDown /> 팀 명단 다운로드
              </Button>
              <Button
                onClick={handleSendTeams}
                disabled={
                  teams.length === 0 || isSending || leftoverStudents.length > 0
                }
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                학생들에게 전달
              </Button>
            </div>

            {leftoverStudents.length > 0 && (
              <div className="pt-4 space-y-2">
                <h4 className="font-semibold text-orange-600">남은 학생 배정</h4>
                <div className="flex flex-wrap gap-2 p-2 border border-dashed border-orange-400 rounded-md">
                  {leftoverStudents.map((student) => {
                    const studentClassTeams = teams
                      .map((team, index) => ({ team, index }))
                      .filter(({ team }) => 
                        team.length > 0 &&
                        team[0].grade === student.grade &&
                        team[0].classNum === student.classNum
                      )
                      .sort((a,b) => a.team.length - b.team.length);

                    return (
                      <div
                        key={student.id}
                        className="flex items-center gap-2 p-2 bg-secondary rounded"
                      >
                        <span className="font-medium">{student.name}</span>
                        {studentClassTeams.map(({ team, index }) => {
                          const firstStudent = team[0];
                          const teamName = firstStudent
                            ? `${firstStudent.grade}-${firstStudent.classNum}반 ${index + 1}팀`
                            : `${index + 1}팀`;
                          return (
                            <Button
                              key={index}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleAssignLeftover(student.id, index)
                              }
                            >
                              <PlusCircle className="mr-1 h-4 w-4" />
                              {teamName}
                            </Button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {teams.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                {teams.map((team, index) => {
                  const firstStudent = team[0];
                  const teamName = firstStudent
                    ? `${firstStudent.grade}-${firstStudent.classNum}반 ${
                        // Find the relative team index within the class
                        teams.filter(t => t.length > 0 && t[0].grade === firstStudent.grade && t[0].classNum === firstStudent.classNum).findIndex(t => t === team) + 1
                      }팀`
                    : `${index + 1}팀`;
                  
                  return (
                    <div key={index} className="border rounded-md p-3">
                      <h4 className="font-bold mb-2 border-b pb-2">
                        {teamName}
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {team.map((student) => (
                          <li key={student.id}>{student.name}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
