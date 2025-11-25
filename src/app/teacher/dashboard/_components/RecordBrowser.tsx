'use client';
import { useState, useMemo } from 'react';
import { exportToCsv } from '@/lib/store';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecordBrowserProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
}

export default function RecordBrowser({
  allStudents,
  allItems,
  allRecords,
}: RecordBrowserProps) {
  const { toast } = useToast();

  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'paps' | 'custom'>('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [classNumFilter, setClassNumFilter] = useState('all');

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [
        ...new Set(
          allStudents.filter((s) => s.grade === grade).map((s) => s.classNum)
        ),
      ].sort((a,b) => parseInt(a) - parseInt(b));
    });
    return { grades, classNumsByGrade };
  }, [allStudents]);

  const studentMap = useMemo(() => new Map(allStudents.map(s => [s.id, s])), [allStudents]);
  const itemMap = useMemo(() => new Map(allItems.map(i => [i.name, i])), [allItems]);

  const filteredRecords = useMemo(() => {
    let records = allRecords;

    // Filter by record type (PAPS/custom)
    if (recordTypeFilter !== 'all') {
      records = records.filter(record => {
        const item = itemMap.get(record.item);
        if (!item) return false;
        return recordTypeFilter === 'paps' ? item.isPaps : !item.isPaps;
      });
    }

    // Filter by student properties (grade/class)
    if (gradeFilter !== 'all') {
      records = records.filter(record => {
        const student = studentMap.get(record.studentId);
        if (!student) return false;
        if (student.grade !== gradeFilter) return false;
        if (classNumFilter !== 'all' && student.classNum !== classNumFilter) return false;
        return true;
      });
    }

    return records.map(record => {
      const student = studentMap.get(record.studentId);
      const item = itemMap.get(record.item);
      return {
        ...record,
        studentName: student?.name || 'N/A',
        grade: student?.grade || 'N/A',
        classNum: student?.classNum || 'N/A',
        studentNum: student?.studentNum || 'N/A',
        unit: item?.unit || '',
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [allRecords, studentMap, itemMap, recordTypeFilter, gradeFilter, classNumFilter]);

  const handleDownloadCsv = () => {
    if (filteredRecords.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }

    const dataToExport = filteredRecords.map(r => ({
      측정일: r.date,
      학년: r.grade,
      반: r.classNum,
      번호: r.studentNum,
      이름: r.studentName,
      종목: r.item,
      기록: r.value,
      단위: r.unit,
    }));
    
    const fileName = `기록_조회_결과_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCsv(fileName, dataToExport);
    toast({
      title: '다운로드 시작',
      description: '선택된 조건의 기록을 CSV 파일로 다운로드합니다.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>전체 기록 조회</CardTitle>
        <CardDescription>
          다양한 조건으로 전체 학생 기록을 필터링하고 결과를 확인하거나 다운로드할 수 있습니다.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={recordTypeFilter} onValueChange={(v) => setRecordTypeFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="기록 종류" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기록</SelectItem>
              <SelectItem value="paps">PAPS</SelectItem>
              <SelectItem value="custom">기타</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={gradeFilter}
            onValueChange={(value) => {
              setGradeFilter(value);
              setClassNumFilter('all');
            }}
          >
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="학년 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 학년</SelectItem>
              {grades.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade}학년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={classNumFilter}
            onValueChange={setClassNumFilter}
            disabled={gradeFilter === 'all'}
          >
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="반 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 반</SelectItem>
              {classNumsByGrade[gradeFilter]?.map((classNum) => (
                <SelectItem key={classNum} value={classNum}>
                  {classNum}반
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={handleDownloadCsv} variant="outline" className="ml-auto">
            <FileDown className="mr-2 h-4 w-4" />
            결과 다운로드
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>측정일</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>학년</TableHead>
                <TableHead>반</TableHead>
                <TableHead>종목</TableHead>
                <TableHead>기록</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>{record.studentName}</TableCell>
                    <TableCell>{record.grade}</TableCell>
                    <TableCell>{record.classNum}</TableCell>
                    <TableCell>{record.item}</TableCell>
                    <TableCell>{record.value}{record.unit}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    선택된 조건에 해당하는 기록이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
