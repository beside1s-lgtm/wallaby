'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudents, getItems, calculateRanks } from '@/lib/store';
import { Student, MeasurementItem } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type RankedStudent = {
  rank: number;
  id: string;
  name: string;
  grade: string;
  classNum: string;
  studentNum: string;
  value: string;
};

export default function Ranking() {
  const { school } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [rankedStudents, setRankedStudents] = useState<RankedStudent[]>([]);
  
  const allStudents = useMemo(() => school ? getStudents(school) : [], [school]);
  const allItems = useMemo(() => school ? getItems(school) : [], [school]);

  const grades = useMemo(() => [...new Set(allStudents.map(s => s.grade))].sort(), [allStudents]);

  useEffect(() => {
    if (school && selectedGrade && selectedItem) {
      const ranksByItem = calculateRanks(school, selectedGrade);
      const itemRanks = ranksByItem[selectedItem];
      const itemInfo = allItems.find(i => i.name === selectedItem);
      
      if (itemRanks && itemInfo) {
        const studentMap = new Map(allStudents.map(s => [s.id, s]));
        const sortedRankedStudents = itemRanks
          .map(rankInfo => {
            const student = studentMap.get(rankInfo.studentId);
            if (!student) return null;
            return {
              rank: rankInfo.rank,
              id: student.id,
              name: student.name,
              grade: student.grade,
              classNum: student.classNum,
              studentNum: student.studentNum,
              value: `${rankInfo.value}${itemInfo.unit}`,
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
  }, [school, selectedGrade, selectedItem, allStudents, allItems]);
  
  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>종목별 순위 조회</CardTitle>
        <CardDescription>학년과 종목을 선택하여 전체 학생 순위를 확인합니다. 종목별 우수 학생과 부진 학생을 쉽게 파악할 수 있습니다.</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="학년 선택" />
            </SelectTrigger>
            <SelectContent>
              {grades.map(grade => <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedItem} onValueChange={setSelectedItem} disabled={!selectedGrade}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="종목 선택" />
            </SelectTrigger>
            <SelectContent>
              {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
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
              rankedStudents.map(student => (
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
  );
}
