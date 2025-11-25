'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { exportToCsv } from '@/lib/store';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import { getPapsGrade } from '@/lib/paps';
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
import { FileDown, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';


interface RecordBrowserProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
}

const papsFactors: Record<string, string> = {
    '왕복오래달리기': '심폐지구력',
    '오래달리기': '심폐지구력',
    '윗몸 말아올리기': '근지구력',
    '팔굽혀펴기': '근지구력',
    '무릎 대고 팔굽혀펴기': '근지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '악력': '근력',
    '50m 달리기': '순발력',
    '제자리 멀리뛰기': '순발력',
    '체질량지수(BMI)': '체질량지수(BMI)',
};

const factorOrder = ['심폐지구력', '근지구력', '근력', '유연성', '순발력', '체질량지수(BMI)'];


export default function RecordBrowser({
  allStudents,
  allItems,
  allRecords,
}: RecordBrowserProps) {
  const { toast } = useToast();

  const [gradeFilter, setGradeFilter] = useState('all');
  const [classNumFilter, setClassNumFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | 'latest' | undefined>('latest');

  const { grades, classNumsByGrade, availableDates } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [
        ...new Set(
          allStudents.filter((s) => s.grade === grade).map((s) => s.classNum)
        ),
      ].sort((a,b) => parseInt(a) - parseInt(b));
    });
    const dates = [...new Set(allRecords.map(r => r.date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return { grades, classNumsByGrade, availableDates: dates };
  }, [allStudents, allRecords]);
  

  const studentTableData = useMemo(() => {
     let filteredStudents = allStudents;
    if (gradeFilter !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === gradeFilter);
      if (classNumFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.classNum === classNumFilter);
      }
    }
    
    return filteredStudents.map(student => {
      const studentData: Record<string, any> = {
        이름: student.name,
        학년: student.grade,
        반: student.classNum,
      };

      const studentRecords = allRecords.filter(r => r.studentId === student.id);
      let totalScore = 0;
      let gradeCount = 0;

      factorOrder.forEach(factor => {
        const factorItems = Object.keys(papsFactors).filter(key => papsFactors[key] === factor);
        let latestRecord: MeasurementRecord | undefined;
        
        for(const item of factorItems) {
            const recordsForItem = studentRecords.filter(r => {
                if (r.item !== item) return false;
                if (dateFilter === 'latest') return true;
                return dateFilter && r.date === format(dateFilter, 'yyyy-MM-dd');
            });

            if (recordsForItem.length > 0) {
              const currentLatest = recordsForItem.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              if (!latestRecord || new Date(currentLatest.date) > new Date(latestRecord.date)) {
                  latestRecord = currentLatest;
              }
            }
        }
        
        if (latestRecord) {
            const grade = getPapsGrade(latestRecord.item, student, latestRecord.value);
            studentData[factor] = grade ? `${grade}등급` : 'N/A';
            if (grade && factor !== '체질량지수(BMI)') {
                totalScore += (6 - grade); // 1등급=5점, 5등급=1점
                gradeCount++;
            }
        } else {
            studentData[factor] = '-';
        }
      });
      
      if (gradeCount > 0) {
        const averagePoints = totalScore / gradeCount;
        studentData['종합점수'] = ((averagePoints / 5) * 100).toFixed(1);
        if (averagePoints >= 4.5) studentData['종합등급'] = '1등급';
        else if (averagePoints >= 3.5) studentData['종합등급'] = '2등급';
        else if (averagePoints >= 2.5) studentData['종합등급'] = '3등급';
        else if (averagePoints >= 1.5) studentData['종합등급'] = '4등급';
        else studentData['종합등급'] = '5등급';
      } else {
        studentData['종합점수'] = '-';
        studentData['종합등급'] = '-';
      }
      
      return studentData;
    });
  }, [allStudents, allRecords, gradeFilter, classNumFilter, dateFilter]);
  

  const handleDownloadCsv = () => {
    if (studentTableData.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }
    
    const fileName = `종합_체력_현황_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCsv(fileName, studentTableData);
    toast({
      title: '다운로드 시작',
      description: '종합 체력 현황을 CSV 파일로 다운로드합니다.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>종합 체력 현황</CardTitle>
        <CardDescription>
          학생들의 PAPS 종목별 최신 기록을 바탕으로 종합적인 체력 현황을 확인하고 다운로드할 수 있습니다.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
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
          
          <Popover>
            <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter === 'latest' ? '최근 측정일 기준' : dateFilter ? format(dateFilter, "PPP") : <span>날짜 선택</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="flex w-auto flex-col space-y-2 p-2">
                 <Select onValueChange={(value) => value === 'latest' ? setDateFilter('latest') : setDateFilter(new Date(value))}>
                    <SelectTrigger>
                        <SelectValue placeholder="측정일 선택" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                        <SelectItem value="latest">최근 측정일 기준</SelectItem>
                        {availableDates.map(date => (
                            <SelectItem key={date} value={date}>{date}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="rounded-md border">
                    <Calendar mode="single" selected={dateFilter === 'latest' ? undefined : dateFilter} onSelect={(d) => setDateFilter(d)} />
                </div>
            </PopoverContent>
          </Popover>
          
          <Button onClick={handleDownloadCsv} variant="outline" className="ml-auto">
            <FileDown className="mr-2 h-4 w-4" />
            결과 다운로드
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {studentTableData.length > 0 && Object.keys(studentTableData[0]).map(key => (
                  <TableHead key={key}>{key}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentTableData.length > 0 ? (
                studentTableData.map((row, index) => (
                  <TableRow key={index}>
                    {Object.values(row).map((value, cellIndex) => (
                      <TableCell key={cellIndex}>{value}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={factorOrder.length + 4} className="h-24 text-center">
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
