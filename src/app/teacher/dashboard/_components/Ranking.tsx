"use client";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { calculateRanks } from "@/lib/store";
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
import { Crown, Medal, Trophy } from "lucide-react";

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

function HallOfFame({ allItems, allRecords, allStudents }: RankingProps) {
  const { school } = useAuth();
  
  const hallOfFameData = useMemo(() => {
    if (!school) return [];
    
    const measurementWeekItems = allItems.filter(item => item.isMeasurementWeek && !item.isArchived);
    if (measurementWeekItems.length === 0) return [];
    
    const allRanks = calculateRanks(school, allItems, allRecords, allStudents);
    const studentMap = new Map(allStudents.map(s => [s.id, s]));

    return measurementWeekItems.map(item => {
      const itemRanks = allRanks[item.name] || [];
      const top3 = itemRanks.slice(0, 3).map(rankInfo => {
        const student = studentMap.get(rankInfo.studentId);
        return {
          rank: rankInfo.rank,
          name: student?.name || '알 수 없음',
          value: `${rankInfo.value}${item.unit}`
        };
      });
      return { itemName: item.name, topStudents: top3 };
    });

  }, [allItems, allRecords, allStudents, school]);

  if (hallOfFameData.length === 0) {
    return (
      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Trophy />
            명예의 전당
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            '종목 관리' 탭에서 측정 주간으로 설정된 종목이 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-yellow-50/80 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 backdrop-blur-sm">
       <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Trophy />
            명예의 전당
          </CardTitle>
          <CardDescription>현재 측정 주간으로 설정된 종목의 전체 학년 1-3위 학생입니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hallOfFameData.map(({ itemName, topStudents }) => (
                <div key={itemName} className="p-4 rounded-lg bg-background/80 shadow">
                    <h3 className="font-bold text-lg text-center mb-3">{itemName}</h3>
                    {topStudents.length > 0 ? (
                        <ul className="space-y-2">
                            {topStudents.map((student, index) => (
                                <li key={index} className="flex items-center justify-between text-sm">
                                    <span className="flex items-center font-semibold">
                                        {index === 0 && <Crown className="w-5 h-5 text-yellow-500 mr-1"/>}
                                        {index === 1 && <Medal className="w-5 h-5 text-gray-400 mr-1"/>}
                                        {index === 2 && <Trophy className="w-5 h-5 text-orange-400 mr-1"/>}
                                        {student.rank}위: {student.name}
                                    </span>
                                    <span className="text-muted-foreground">{student.value}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                       <p className="text-sm text-center text-muted-foreground py-4">기록이 없습니다.</p>
                    )}
                </div>
            ))}
        </CardContent>
    </Card>
  )
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
  
  // Filter for active items only
  const activeItems = useMemo(() => allItems.filter(item => !item.isArchived && !item.isDeactivated), [allItems]);


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
      <HallOfFame allItems={allItems} allRecords={allRecords} allStudents={allStudents} />
      <Card className="bg-transparent shadow-none border-none">
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
                {activeItems.map((item) => (
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
    </div>
  );
}
