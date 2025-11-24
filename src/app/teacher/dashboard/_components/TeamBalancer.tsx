"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateRanks,
  exportToCsv,
  saveTeamGroup,
  deleteTeamGroup,
  updateTeamGroup,
} from "@/lib/store";
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, Team } from "@/lib/types";
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
  Shuffle,
  Loader2,
  Wand2,
  Send,
  PlusCircle,
  Trash2,
  RefreshCw,
  Move,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getScoutingReport } from "@/ai/flows/scouting-report-flow";
import type { ScoutingReportOutput } from "@/ai/flows/scouting-report-flow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";


interface TeamBalancerProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  teamGroups: TeamGroup[];
  onTeamGroupUpdate: (newGroup: TeamGroup) => void;
  onTeamGroupDelete: (groupId: string) => void;
}

type ClassSelection = {
  [grade: string]: {
    all: boolean;
    classes: {
      [classNum: string]: boolean;
    }
  }
}

type MovingStudentState = {
  studentId: string;
  sourceTeamIndex: number;
} | null;

export default function TeamBalancer({ allStudents, allItems, allRecords, teamGroups, onTeamGroupUpdate, onTeamGroupDelete }: TeamBalancerProps) {
  const { school } = useAuth();
  const { toast } = useToast();

  const [savedTeamGroups, setSavedTeamGroups] = useState<TeamGroup[]>([]);
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState<string>('');

  const [classSelection, setClassSelection] = useState<ClassSelection>({});

  const [selectedGender, setSelectedGender] = useState<"all" | "남" | "여" | "separate">(
    "all"
  );
  const [excludeNonParticipants, setExcludeNonParticipants] = useState(true);

  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [membersPerTeam, setMembersPerTeam] = useState(4);
  const [divideBy, setDivideBy] = useState<"teams" | "members" | "single">("teams");

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
  
  const [teamGroupName, setTeamGroupName] = useState("");
  const [movingStudent, setMovingStudent] = useState<MovingStudentState>(null);

  const [scoutingReport, setScoutingReport] =
    useState<ScoutingReportOutput | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [foundStudentsForSelection, setFoundStudentsForSelection] = useState<Student[]>([]);
  const [isStudentSelectionDialogOpen, setIsStudentSelectionDialogOpen] = useState(false);

  const studentRowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  
  useEffect(() => {
    setSavedTeamGroups(teamGroups);
  }, [teamGroups]);

  const { grades, classNumsByGrade, groupedItems } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    const initialSelection: ClassSelection = {};

    grades.forEach((grade) => {
      const classes = [...new Set(
        allStudents.filter((s) => s.grade === grade).map((s) => s.classNum)
      )].sort((a,b) => parseInt(a) - parseInt(b));
      classNumsByGrade[grade] = classes;
      
      initialSelection[grade] = { all: false, classes: {} };
      classes.forEach(classNum => {
        initialSelection[grade].classes[classNum] = false;
      });
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

  useEffect(() => {
    // Initialize classSelection state based on available grades and classes
    const initialSelection: ClassSelection = {};
     grades.forEach((grade) => {
      initialSelection[grade] = { all: false, classes: {} };
      classNumsByGrade[grade]?.forEach(classNum => {
        initialSelection[grade].classes[classNum] = false;
      });
    });
    setClassSelection(initialSelection);
  }, [grades, classNumsByGrade]);


  const resetToNewTeam = () => {
    setSelectedTeamGroupId('');
    setTeamGroupName('');
    const newSelection: ClassSelection = {};
    Object.keys(classSelection).forEach(grade => {
      newSelection[grade] = { all: false, classes: {} };
      Object.keys(classSelection[grade].classes).forEach(classNum => {
        newSelection[grade].classes[classNum] = false;
      });
    });
    setClassSelection(newSelection);
    setSelectedGender('all');
    setExcludeNonParticipants(true);
    setSelectedItemNames([]);
    setNumTeams(2);
    setMembersPerTeam(4);
    setDivideBy('teams');
    setBalanceStrategy('uniform');
    setTeams([]);
    setLeftoverStudents([]);
    setStudentScores(new Map());
    setBalancingSelection({});
    setSelectedStudentId(null);
  };
  
 const handleLoadTeamGroup = (groupId: string) => {
    setSelectedTeamGroupId(groupId);
    const group = savedTeamGroups.find(g => g.id === groupId);
    if (!group) return;

    setTeamGroupName(group.description);

    const studentMap = new Map(allStudents.map(s => [s.id, s]));

    const teamsWithMembers: Team[] = group.teams.map(team => ({
        ...team,
        members: team.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s)
    }));

    const newSelection: ClassSelection = {};
    grades.forEach(grade => {
        newSelection[grade] = { all: false, classes: {} };
        classNumsByGrade[grade]?.forEach(classNum => {
            const isSelected = teamsWithMembers.some(team => team.members && team.members.some(member => member.grade === grade && member.classNum === classNum));
            newSelection[grade].classes[classNum] = isSelected;
        });
        const allSelected = classNumsByGrade[grade]?.every(cn => newSelection[grade].classes[cn]);
        newSelection[grade].all = !!allSelected;
    });
    setClassSelection(newSelection);
    
    setSelectedGender(group.gender || 'all');
    setSelectedItemNames(group.itemNamesForBalancing || []);
    setDivideBy(group.divideBy || 'teams');
    setNumTeams(group.numTeams || 2);
    setMembersPerTeam(group.membersPerTeam || 4);
    
    setTeams(teamsWithMembers.map(t => t.members || []));
    setLeftoverStudents([]);
    
    toast({ title: "팀 편성 로드 완료", description: `'${group.description}' 정보를 불러왔습니다.`});
  };


  const handleDeleteTeamGroup = async () => {
    if (!school || !selectedTeamGroupId) return;
    try {
      await deleteTeamGroup(school, selectedTeamGroupId);
      onTeamGroupDelete(selectedTeamGroupId);
      resetToNewTeam();
      toast({ title: "삭제 완료", description: "선택한 팀 편성을 삭제했습니다." });
    } catch (error) {
      console.error("Failed to delete team group:", error);
      toast({ variant: 'destructive', title: "삭제 실패" });
    }
  };

  const targetStudents = useMemo(() => {
    const selectedClasses: { grade: string; classNum: string }[] = [];
    Object.entries(classSelection).forEach(([grade, selection]) => {
      Object.entries(selection.classes).forEach(([classNum, isSelected]) => {
        if (isSelected) {
          selectedClasses.push({ grade, classNum });
        }
      });
    });

    if (selectedClasses.length === 0) return [];
    
    let students = allStudents.filter(s => 
      selectedClasses.some(sc => sc.grade === s.grade && sc.classNum === s.classNum)
    );

    if (selectedGender !== "all" && selectedGender !== "separate") {
      students = students.filter((s) => s.gender === selectedGender);
    }

    return students;
  }, [classSelection, selectedGender, allStudents]);

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

      const ranksByGrade = new Map<string, Record<string, { studentId: string; value: number; rank: number; }[]>>();
      
      const uniqueGrades = [...new Set(studentsForAnalysis.map(s => s.grade))];
      uniqueGrades.forEach(grade => {
         ranksByGrade.set(grade, calculateRanks(school, allItems, allRecords, allStudents, grade));
      });
      
      selectedItemNames.forEach((itemName) => {
        const itemInfo = allItems.find((i) => i.name === itemName);
        if (!itemInfo) return;
        
        studentsForAnalysis.forEach(student => {
            const studentRanks = ranksByGrade.get(student.grade);
            const itemRanks = studentRanks ? studentRanks[itemName] : undefined;

            let score = 0;
            if (itemRanks) {
                const rankInfo = itemRanks.find(r => r.studentId === student.id);
                if (rankInfo) {
                    const totalInRank = itemRanks.length;
                    score = Math.round((1 - (rankInfo.rank - 1) / totalInRank) * 100);
                }
            }

            if (!studentIdToRawScores.has(student.id)) {
                studentIdToRawScores.set(student.id, { totalScore: 0, scores: [] });
            }
            const studentData = studentIdToRawScores.get(student.id)!;
            studentData.scores.push({ item: itemName, score: score });
        });
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
    if (!selectedTeamGroupId) { // Don't clear teams if a saved group is loaded
      setTeams([]);
      setLeftoverStudents([]);
    }
    setSelectedStudentId(null);
  }, [
    targetStudents,
    selectedItemNames,
    excludeNonParticipants,
    allRecords,
    allItems,
    school,
    allStudents,
    selectedTeamGroupId,
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
    if (selectedStudentId) {
      const studentRow = studentRowRefs.current.get(selectedStudentId);
      studentRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedStudentId]);

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
      const ranksByItem = calculateRanks(
        school,
        allItems,
        allRecords,
        allStudents,
        student.grade
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
      (divideBy === "teams" && numTeams < 1) || 
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

    const studentsToBalance = targetStudents.filter((s) => selectedStudentIds.includes(s.id));
    
    // Group students by class
    const studentsByClass: Record<string, Student[]> = {};
    studentsToBalance.forEach(student => {
      const classKey = `${student.grade}-${student.classNum}`;
      if (!studentsByClass[classKey]) {
        studentsByClass[classKey] = [];
      }
      studentsByClass[classKey].push(student);
    });

    let finalTeams: Student[][] = [];
    let finalLeftovers: Student[] = [];

    const createTeamsForGroup = (studentGroup: Student[], numTeamsForDivision: number) => {
      const sortedStudents = studentGroup
        .map((s) => ({ student: s, score: studentScores.get(s.id)?.totalScore || 0 }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.student);
      
      const studentsToDistribute = [...sortedStudents];
      
      if (divideBy === "teams") {
        const newTeams: Student[][] = Array.from({ length: numTeamsForDivision }, () => []);
        if (balanceStrategy === 'uniform') { // 균등 편성 (지그재그/snake draft)
            let direction = 1;
            let teamIndex = 0;
            studentsToDistribute.forEach(student => {
                newTeams[teamIndex].push(student);
                teamIndex += direction;
                if (teamIndex < 0 || teamIndex >= numTeamsForDivision) {
                    direction *= -1;
                    teamIndex += direction;
                }
            });
        } else { // 레벨별 편성 (순서대로 그룹핑)
             for(let i=0; i<studentsToDistribute.length; i++) {
                const teamIndex = i % numTeamsForDivision;
                newTeams[teamIndex].push(studentsToDistribute[i]);
            }
        }
        return { teams: newTeams.filter(t => t.length > 0), leftovers: [] };
      } else { // divide by members
        const numTeamsForGroup = Math.floor(
          studentsToDistribute.length / membersPerTeam
        );
        if (numTeamsForGroup === 0) {
          return { teams: [], leftovers: studentsToDistribute };
        }

        const newTeams: Student[][] = Array.from(
          { length: numTeamsForGroup },
          () => []
        );

        const groupToDistribute = studentsToDistribute.splice(0, numTeamsForGroup * membersPerTeam);

        if (balanceStrategy === 'uniform') { // 균등 편성 (지그재그)
            let direction = 1;
            let teamIndex = 0;
            groupToDistribute.forEach(student => {
                newTeams[teamIndex].push(student);
                teamIndex += direction;
                if (teamIndex < 0 || teamIndex >= numTeamsForGroup) {
                    direction *= -1;
                    teamIndex += direction;
                }
            });
        } else { // 레벨별 편성 (순서대로)
            for(let i=0; i<groupToDistribute.length; i++) {
                const teamIndex = i % numTeamsForGroup;
                newTeams[teamIndex].push(groupToDistribute[i]);
            }
        }
        
        return { teams: newTeams, leftovers: studentsToDistribute };
      }
    };
    
    Object.values(studentsByClass).forEach(classStudentGroup => {
        const effectiveNumTeams = divideBy === 'teams' ? numTeams : Math.max(1, Math.floor(classStudentGroup.length / membersPerTeam));
        if (effectiveNumTeams === 0 && divideBy !== 'single') {
            finalLeftovers.push(...classStudentGroup);
            return;
        }

        if (divideBy === 'single') {
            finalTeams.push(classStudentGroup);
            return;
        }

        if (selectedGender === 'separate') {
            const maleStudents = classStudentGroup.filter(s => s.gender === '남');
            const femaleStudents = classStudentGroup.filter(s => s.gender === '여');

            const { teams: maleTeams, leftovers: maleLeftovers } = createTeamsForGroup(maleStudents, effectiveNumTeams);
            const { teams: femaleTeams, leftovers: femaleLeftovers } = createTeamsForGroup(femaleStudents, effectiveNumTeams);

            finalTeams.push(...maleTeams, ...femaleTeams);
            finalLeftovers.push(...maleLeftovers, ...femaleLeftovers);
        } else {
            const { teams: newTeams, leftovers } = createTeamsForGroup(classStudentGroup, effectiveNumTeams);
            finalTeams.push(...newTeams);
            finalLeftovers.push(...leftovers);
        }
    });

    setTeams(finalTeams);
    setLeftoverStudents(finalLeftovers);

    toast({
      title: "팀 편성 완료",
      description:
        "팀이 자동으로 편성되었습니다. 남은 학생이 있는 경우 수동으로 배정해주세요.",
    });
  };

  const handleCreateTeamFromSelection = () => {
    const selectedStudentIds = Object.keys(balancingSelection).filter(id => balancingSelection[id]);
    if (selectedStudentIds.length === 0) {
        toast({ variant: 'destructive', title: '학생 미선택', description: '팀으로 만들 학생을 먼저 선택해주세요.' });
        return;
    }
    const newTeam = allStudents.filter(s => selectedStudentIds.includes(s.id));
    setTeams(prev => [...prev, newTeam]);

    // Uncheck selected students
    const newBalancingSelection = { ...balancingSelection };
    selectedStudentIds.forEach(id => {
        newBalancingSelection[id] = false;
    });
    setBalancingSelection(newBalancingSelection);
  };


  const handleClassSelectionChange = (grade: string, classNum: string, checked: boolean) => {
    setClassSelection(prev => {
      const newSelection = { ...prev };
      newSelection[grade].classes[classNum] = checked;
      const allChecked = Object.values(newSelection[grade].classes).every(Boolean);
      newSelection[grade].all = allChecked;
      return newSelection;
    });
  };

  const handleGradeSelectionChange = (grade: string, checked: boolean) => {
    setClassSelection(prev => {
      const newSelection = { ...prev };
      newSelection[grade].all = checked;
      Object.keys(newSelection[grade].classes).forEach(classNum => {
        newSelection[grade].classes[classNum] = checked;
      });
      return newSelection;
    });
  };


  const sortedTeams = useMemo(() => {
    return [...teams].sort((teamA, teamB) => {
      const studentA = teamA[0];
      const studentB = teamB[0];
      if (!studentA || !studentB) return 0;
      
      const genderOrder = {'남': 1, '여': 2};
      const genderA = genderOrder[studentA.gender] || 3;
      const genderB = genderOrder[studentB.gender] || 3;
      if (genderA !== genderB) return genderA - genderB;

      const gradeA = parseInt(studentA.grade);
      const gradeB = parseInt(studentB.grade);
      if (gradeA !== gradeB) return gradeA - gradeB;

      const classA = parseInt(studentA.classNum);
      const classB = parseInt(studentB.classNum);
      if (classA !== classB) return classA - classB;

      const teamAIndex = teams.indexOf(teamA);
      const teamBIndex = teams.indexOf(teamB);
      
      return teamAIndex - teamBIndex;
    });
  }, [teams]);

  const teamAverageScores = useMemo(() => {
    const averages = new Map<number, { item: string; score: number }[]>();
    if (selectedItemNames.length === 0) return averages;

    sortedTeams.forEach((team, index) => {
        const originalIndex = teams.indexOf(team);
        const teamScores: { [key: string]: number[] } = {};
        selectedItemNames.forEach(name => { teamScores[name] = []; });

        team.forEach(member => {
            const memberScores = studentScores.get(member.id);
            memberScores?.scores.forEach(({ item, score }) => {
                if(teamScores[item]) {
                    teamScores[item].push(score);
                }
            });
        });

        const avgScores = selectedItemNames.map(itemName => {
            const scores = teamScores[itemName];
            const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            return { item: itemName, score: Math.round(average) };
        });
        averages.set(originalIndex, avgScores);
    });

    return averages;
}, [sortedTeams, studentScores, selectedItemNames, teams]);


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
  
    const handleMoveStudent = (studentId: string, fromTeamIndex: number, toTeamIndex: number) => {
        let studentToMove: Student | undefined;

        const newFromTeam = teams[fromTeamIndex].filter(s => {
            if (s.id === studentId) {
                studentToMove = s;
                return false;
            }
            return true;
        });

        if (!studentToMove) return;

        const newToTeam = [...teams[toTeamIndex], studentToMove];

        setTeams(prevTeams => {
            const newTeams = [...prevTeams];
            newTeams[fromTeamIndex] = newFromTeam;
            newTeams[toTeamIndex] = newToTeam;
            return newTeams.filter(team => team.length > 0);
        });

        setMovingStudent(null);
    };

    const handleStudentClick = (studentId: string, teamIndex: number) => {
        if (movingStudent && movingStudent.studentId === studentId) {
            setMovingStudent(null); // Deselect if clicking the same student
        } else {
            setMovingStudent({ studentId, sourceTeamIndex: teamIndex });
        }
    };

    const handleTeamCardClick = (targetTeamIndex: number) => {
        if (movingStudent && movingStudent.sourceTeamIndex !== targetTeamIndex) {
            handleMoveStudent(movingStudent.studentId, movingStudent.sourceTeamIndex, targetTeamIndex);
        } else {
            // Clicking outside or on the same team cancels the move
            setMovingStudent(null);
        }
    };

    const handleSearchStudentForReport = () => {
        if (!studentSearchTerm) {
            toast({ variant: 'destructive', title: '검색어 필요', description: '학생 이름을 입력해주세요.' });
            return;
        }

        const found = [...studentScores.keys()]
            .map(id => allStudents.find(s => s.id === id))
            .filter((s): s is Student => !!s)
            .filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()));

        if (found.length === 0) {
            toast({ variant: 'destructive', title: '검색 결과 없음', description: '분석 대상 목록에 해당 학생이 없습니다.' });
        } else if (found.length === 1) {
            setSelectedStudentId(found[0].id);
        } else {
            setFoundStudentsForSelection(found);
            setIsStudentSelectionDialogOpen(true);
        }
    };

    const handleSelectStudentFromDialog = (studentId: string) => {
        setSelectedStudentId(studentId);
        setIsStudentSelectionDialogOpen(false);
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
    const selectedGrades = Object.keys(classSelection).filter(grade => classSelection[grade].all || Object.values(classSelection[grade].classes).some(Boolean));
    if (selectedGrades.length === 1) {
        fileName = `${school}_${selectedGrades[0]}학년_자동편성팀.csv`;
    }

    const dataToExport = sortedTeams.flatMap((team, index) => {
      const firstStudent = team[0];
       const teamsInClass = sortedTeams.filter(t => t.length > 0 && t[0].grade === firstStudent.grade && t[0].classNum === firstStudent.classNum);
      const relativeIndex = teamsInClass.findIndex(t => t === team);
      const teamName = firstStudent
        ? `${firstStudent.grade}-${firstStudent.classNum}반 ${relativeIndex + 1}팀`
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
     if (!teamGroupName) {
      toast({
        variant: "destructive",
        title: "전달 실패",
        description: "팀 편성 이름을 입력해주세요.",
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
      const teamData: TeamGroupInput = {
        school,
        description: teamGroupName,
        teams: teams.map((team, index) => ({
          id: team[0]?.id ? `team-${team[0].id}-${index}`: `team-empty-${index}`,
          teamIndex: index,
          memberIds: team.map((student) => student.id),
        })),
        itemNamesForBalancing: selectedItemNames,
        gender: selectedGender,
        divideBy,
        numTeams: divideBy === 'teams' ? numTeams : undefined,
        membersPerTeam: divideBy === 'members' ? membersPerTeam : undefined,
      };
      
      let updatedGroup: TeamGroup;

      if(selectedTeamGroupId) {
        updatedGroup = await updateTeamGroup(selectedTeamGroupId, teamData);
         toast({
          title: "업데이트 완료",
          description: "수정된 팀 명단이 학생들에게 업데이트되었습니다.",
        });
      } else {
        updatedGroup = await saveTeamGroup(teamData);
        toast({
          title: "전달 완료",
          description: "편성된 팀 명단이 학생들에게 전달되었습니다.",
        });
      }

      onTeamGroupUpdate(updatedGroup);

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
    <>
     <Dialog open={isStudentSelectionDialogOpen} onOpenChange={setIsStudentSelectionDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>동명이인 학생 선택</DialogTitle>
                <DialogDescription>'{studentSearchTerm}'(으)로 검색된 학생 중 한 명을 선택해주세요.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                 <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>이름</TableHead>
                              <TableHead>학년</TableHead>
                              <TableHead>반</TableHead>
                              <TableHead>번호</TableHead>
                              <TableHead></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                        {foundStudentsForSelection.map(student => (
                            <TableRow key={student.id}>
                                <TableCell>{student.name}</TableCell>
                                <TableCell>{student.grade}</TableCell>
                                <TableCell>{student.classNum}</TableCell>
                                <TableCell>{student.studentNum}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleSelectStudentFromDialog(student.id)}>
                                        선택
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                  </Table>
            </div>
        </DialogContent>
    </Dialog>
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
        <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold">저장된 팀 편성 불러오기</h3>
             <div className="flex flex-wrap gap-2 items-center">
                <Select onValueChange={handleLoadTeamGroup} value={selectedTeamGroupId}>
                    <SelectTrigger className="flex-1 min-w-[200px]">
                        <SelectValue placeholder="저장된 팀 편성을 선택하세요..." />
                    </SelectTrigger>
                    <SelectContent>
                        {teamGroups.length > 0 ? (
                           teamGroups.map(group => (
                             <SelectItem key={group.id} value={group.id}>{group.description}</SelectItem>
                           ))
                        ) : (
                            <SelectItem value="none" disabled>저장된 편성이 없습니다.</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={resetToNewTeam}><RefreshCw className="mr-2 h-4 w-4"/>새 팀 편성</Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="destructive" disabled={!selectedTeamGroupId}>
                            <Trash2 className="mr-2 h-4 w-4"/>
                            편성 삭제
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                            <AlertDialogDescription>
                                이 작업은 되돌릴 수 없습니다. 이 팀 편성 정보가 영구적으로 삭제됩니다.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteTeamGroup}>삭제</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>

        <div className="space-y-4 p-4 border rounded-md">
          <h3 className="font-semibold">1. 분석 대상 설정</h3>
          <div className="flex flex-wrap items-end gap-4">
             <div className="space-y-2">
                <Label>편성 대상 학급</Label>
                <Accordion type="multiple" className="w-full sm:w-[400px] border rounded-md p-2 bg-background">
                    {grades.map(grade => (
                        <AccordionItem value={grade} key={grade}>
                            <div className="flex items-center space-x-2 py-2">
                                <div onClick={(e) => e.stopPropagation()} className="ml-2">
                                    <Checkbox 
                                        id={`grade-all-${grade}`}
                                        checked={classSelection[grade]?.all || false}
                                        onCheckedChange={(checked) => handleGradeSelectionChange(grade, !!checked)}
                                        disabled={!!selectedTeamGroupId}
                                    />
                                </div>
                                <AccordionTrigger className="flex-1 p-0 ml-2">
                                     <Label htmlFor={`grade-all-${grade}`} className="font-semibold cursor-pointer flex-1 text-left">
                                        {grade}학년 전체
                                    </Label>
                                </AccordionTrigger>
                            </div>
                            <AccordionContent className="pt-2 pl-6">
                                <div className="grid grid-cols-3 gap-2">
                                    {classNumsByGrade[grade]?.map(classNum => (
                                        <div key={classNum} className="flex items-center gap-2">
                                            <Checkbox 
                                                id={`class-${grade}-${classNum}`}
                                                checked={classSelection[grade]?.classes[classNum] || false}
                                                onCheckedChange={(checked) => handleClassSelectionChange(grade, classNum, !!checked)}
                                                disabled={!!selectedTeamGroupId}
                                            />
                                            <Label htmlFor={`class-${grade}-${classNum}`}>{classNum}반</Label>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
            <div>
              <Label>성별</Label>
              <Select
                value={selectedGender}
                onValueChange={(v) => setSelectedGender(v as any)}
                disabled={!!selectedTeamGroupId}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체(혼성)</SelectItem>
                  <SelectItem value="separate">성별 분리 편성</SelectItem>
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
                disabled={!!selectedTeamGroupId}
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
                        disabled={targetStudents.length === 0 || !!selectedTeamGroupId}
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
                            disabled={targetStudents.length === 0 || !!selectedTeamGroupId}
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
                  <Input
                    placeholder="학생 이름으로 검색..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchStudentForReport()}
                  />
                   <Button onClick={handleSearchStudentForReport}>
                    <Search className="mr-2 h-4 w-4" /> 검색
                   </Button>
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
                          disabled={!!selectedTeamGroupId}
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
                            ref={(el) => studentRowRefs.current.set(studentId, el)}
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
                                disabled={!!selectedTeamGroupId}
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
            <div className="flex justify-end mt-2">
                <Button onClick={handleCreateTeamFromSelection} disabled={!!selectedTeamGroupId}>
                    <PlusCircle className="mr-2 h-4 w-4" /> 선택 학생으로 팀 만들기
                </Button>
            </div>
          </div>
        )}

        {(studentScores.size > 0 || teams.length > 0) && (
          <div className="space-y-4 p-4 border rounded-md" onClick={(e) => { if (e.target === e.currentTarget) setMovingStudent(null); }}>
            <h3 className="font-semibold">3. 팀 편성</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="team-group-name">팀 편성 이름</Label>
                 <Input
                    id="team-group-name"
                    value={teamGroupName}
                    onChange={(e) => setTeamGroupName(e.target.value)}
                    placeholder="예: 5학년 배구 리그"
                    className="w-full sm:w-[200px]"
                    disabled={!!selectedTeamGroupId}
                  />
              </div>
               <div>
                <Label>팀 나누기 기준</Label>
                <RadioGroup
                  value={divideBy}
                  onValueChange={(v) => setDivideBy(v as any)}
                  className="flex items-center gap-4 mt-2"
                  disabled={!!selectedTeamGroupId}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="teams" id="teams" />
                    <Label htmlFor="teams">팀 수로 나누기</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="members" id="members" />
                    <Label htmlFor="members">팀원 수로 나누기</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single">선택 그룹을 한 팀으로</Label>
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
                      setNumTeams(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    min="1"
                    className="w-[100px]"
                    disabled={!!selectedTeamGroupId}
                  />
                </div>
              ) : divideBy === "members" ? (
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
                    disabled={!!selectedTeamGroupId}
                  />
                </div>
              ) : null}

              {divideBy !== 'single' && (
                <div>
                  <Label>편성 방식</Label>
                  <RadioGroup
                    value={balanceStrategy}
                    onValueChange={
                      (value) =>
                        setBalanceStrategy(value as "uniform" | "level")
                    }
                    className="flex items-center gap-4 mt-2"
                    disabled={!!selectedTeamGroupId}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="uniform" id="uniform" />
                      <Label htmlFor="uniform">균등 편성 (실력 평준화)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="level" id="level" />
                      <Label htmlFor="level">레벨별 편성 (실력 그룹화)</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
             <div className="flex flex-wrap items-end gap-2 pt-2 border-t mt-4">
              <Button onClick={handleBalanceTeams} disabled={!!selectedTeamGroupId}>
                <Shuffle className="mr-2 h-4 w-4" /> 
                {divideBy === 'single' ? '팀 만들기' : '팀 나누기'}
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
                {selectedTeamGroupId ? "수정 내용 전달" : "학생들에게 전달"}
              </Button>
            </div>

            {leftoverStudents.length > 0 && (
              <div className="pt-4 space-y-2">
                <h4 className="font-semibold text-orange-600">남은 학생 배정</h4>
                <div className="flex flex-wrap gap-2 p-2 border border-dashed border-orange-400 rounded-md">
                  {leftoverStudents.map((student) => {
                    const studentClassTeams = sortedTeams
                      .map((team, index) => ({ team, originalIndex: teams.indexOf(team) }))
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
                        {studentClassTeams.map(({ team, originalIndex }) => {
                          const firstStudent = team[0];
                          const teamsInClass = sortedTeams.filter(t => t.length > 0 && t[0].grade === firstStudent.grade && t[0].classNum === firstStudent.classNum);
                          const relativeIndex = teamsInClass.findIndex(t => t === team);
                          const teamName = firstStudent
                            ? `${firstStudent.grade}-${firstStudent.classNum}반 ${relativeIndex + 1}팀`
                            : `${originalIndex + 1}팀`;
                          return (
                            <Button
                              key={originalIndex}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleAssignLeftover(student.id, originalIndex)
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

            {sortedTeams.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {sortedTeams.map((team, index) => {
                  const originalIndex = teams.indexOf(team);
                  if (originalIndex === -1) return null;
                  
                  const firstStudent = team[0];
                  if (!firstStudent) return null;
                  
                  const genderDisplay = selectedGender === 'separate' ? (firstStudent.gender === '남' ? '(남)' : '(여)') : '';
                  
                  const teamsInClass = sortedTeams.filter(t => t.length > 0 && t[0].grade === firstStudent.grade && t[0].classNum === firstStudent.classNum && (selectedGender !== 'separate' || t[0].gender === firstStudent.gender));
                  const relativeIndex = teamsInClass.findIndex(t => t === team);

                  const teamName = `${firstStudent.grade}-${firstStudent.classNum}반 ${genderDisplay} 팀 ${relativeIndex + 1}`;

                  const avgData = teamAverageScores.get(originalIndex);

                  const teamTotalScores = team.map(member => studentScores.get(member.id)?.totalScore || 0);
                  const teamAverageTotalScore = teamTotalScores.length > 0 ? Math.round(teamTotalScores.reduce((a, b) => a + b, 0) / teamTotalScores.length) : 0;

                  return (
                    <div
                      key={`${originalIndex}-${firstStudent.id}`}
                      className={cn(
                          "border rounded-md p-4 space-y-2 cursor-pointer transition-all",
                          movingStudent && movingStudent.sourceTeamIndex !== originalIndex ? "border-dashed border-primary hover:bg-primary/10" : "hover:bg-muted/50",
                      )}
                      onClick={() => handleTeamCardClick(originalIndex)}
                    >
                      <h4 className="font-bold text-center border-b pb-2">
                        {teamName}
                        <span className="font-normal text-sm text-muted-foreground ml-2">({teamAverageTotalScore}점)</span>
                      </h4>
                      {avgData && avgData.length > 0 ? (
                        <div className="h-[150px]">
                             <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={avgData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="item" tick={{ fontSize: 10 }} />
                                    <PolarRadiusAxis axisLine={false} tick={false} domain={[0, 100]} />
                                    <Radar name="팀 평균" dataKey="score" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: '12px' }}/>
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[150px] flex items-center justify-center text-xs text-muted-foreground">
                            팀 평균 능력치 데이터가 없습니다.
                        </div>
                      )}
                      <div className="text-sm pt-2 border-t">
                          <div className="flex flex-col gap-1">
                              {team.map((student) => (
                                <div
                                    key={student.id}
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent card click when clicking on a student
                                        handleStudentClick(student.id, originalIndex);
                                    }}
                                    className={cn(
                                        "flex items-center p-1 rounded-md cursor-pointer hover:bg-secondary",
                                        movingStudent?.studentId === student.id && "bg-primary/20 ring-2 ring-primary"
                                    )}
                                >
                                    <span>{student.name}</span>
                                    {movingStudent?.studentId === student.id && (
                                        <Move className="h-4 w-4 ml-auto text-primary" />
                                    )}
                                </div>
                              ))}
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
