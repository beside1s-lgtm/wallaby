'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { exportToCsv } from '@/lib/store';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import { getPapsGrade, calculatePapsScore, getCustomItemGrade } from '@/lib/paps';
import { calculateRanks } from '@/lib/store';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface RecordBrowserProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
}

type ViewType = 'grade' | 'score' | 'record';
type SortDescriptor = {
  column: string;
  direction: 'ascending' | 'descending';
};


const papsFactors: Record<string, string> = {
    '왕복오래달리기': '심폐지구력',
    '오래달리기': '심폐지구력',
    '윗몸 말아올리기': '근력/근지구력',
    '팔굽혀펴기': '근력/근지구력',
    '무릎 대고 팔굽혀펴기': '근력/근지구력',
    '악력': '근력/근지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '50m 달리기': '순발력',
    '제자리 멀리뛰기': '순발력',
    '체질량지수(BMI)': '체질량지수(BMI)',
};

const factorOrder = ['학년', '반', '번호', '이름', '성별', '심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)', '종합'];


export default function RecordBrowser({
  allStudents,
  allItems,
  allRecords,
}: RecordBrowserProps) {
  const { toast } = useToast();
  const { school } = useAuth();

  const [gradeFilter, setGradeFilter] = useState('all');
  const [classNumFilter, setClassNumFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | 'latest' | undefined>('latest');
  const [viewType, setViewType] = useState<ViewType>('grade');
  const [papsSort, setPapsSort] = useState<SortDescriptor[]>([{ column: '번호', direction: 'ascending'}]);


  // For "종목별 기록" tab
  const [selectedItem, setSelectedItem] = useState('');
  const [itemGradeFilter, setItemGradeFilter] = useState('all');
  const [itemClassNumFilter, setItemClassNumFilter] = useState('all');
  const [itemSort, setItemSort] = useState<SortDescriptor[]>([{ column: '이름', direction: 'ascending' }]);


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
  

  const studentPapsTableData = useMemo(() => {
     let filteredStudents = allStudents;
    if (gradeFilter !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === gradeFilter);
      if (classNumFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.classNum === classNumFilter);
      }
    }
    
    return filteredStudents.map(student => {
      const studentData: Record<string, any> = {
        '학년': student.grade,
        '반': student.classNum,
        '번호': student.studentNum,
        '이름': student.name,
        '성별': student.gender,
      };

      const studentRecords = allRecords.filter(r => r.studentId === student.id);
      let totalPapsScore = 0;
      let scoredFactorCount = 0;
      
      const papsFactorKeys = ['심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)'];

      papsFactorKeys.forEach(factor => {
        const factorItems = Object.keys(papsFactors).filter(key => papsFactors[key] === factor);
        let latestRecord: MeasurementRecord | undefined;
        let latestItem: MeasurementItem | undefined;
        
        for(const itemName of factorItems) {
            const item = allItems.find(i => i.name === itemName);
            if (!item) continue;

            const recordsForItem = studentRecords.filter(r => {
                if (r.item !== itemName) return false;
                if (dateFilter === 'latest') return true;
                return dateFilter && r.date === format(dateFilter, 'yyyy-MM-dd');
            });

            if (recordsForItem.length > 0) {
              const currentLatest = recordsForItem.sort((a,b) => new Date(b.date).getTime() - new Date(a).getTime())[0];
              if (!latestRecord || new Date(currentLatest.date) > new Date(latestRecord.date)) {
                  latestRecord = currentLatest;
                  latestItem = item;
              }
            }
        }
        
        if (latestRecord && latestItem) {
            const grade = getPapsGrade(latestRecord.item, student, latestRecord.value);
            const score = calculatePapsScore(latestRecord.item, student, latestRecord.value);
            
            if(viewType === 'grade') {
                studentData[factor] = grade ? `${grade}등급` : 'N/A';
            } else if (viewType === 'score') {
                studentData[factor] = score !== null ? score : 'N/A';
            } else { // 'record'
                studentData[factor] = `${latestRecord.value}${latestItem.unit}`;
            }

            if (score !== null && factor !== '체질량지수(BMI)') {
                totalPapsScore += score;
                scoredFactorCount++;
            }
        } else {
            studentData[factor] = '-';
        }
      });
      
      let finalGrade = '-';
      let finalScore = 0;

      if (scoredFactorCount > 0) {
        finalScore = (totalPapsScore / (scoredFactorCount * 20)) * 100;
        
        if (finalScore >= 80) finalGrade = '1등급';
        else if (finalScore >= 60) finalGrade = '2등급';
        else if (finalScore >= 40) finalGrade = '3등급';
        else if (finalScore >= 20) finalGrade = '4등급';
        else finalGrade = '5등급';
      }

      if(viewType === 'grade') {
        studentData['종합'] = finalGrade;
      } else if (viewType === 'score') {
        studentData['종합'] = scoredFactorCount > 0 ? Math.round(finalScore) : 'N/A';
      } else { // 'record'
        studentData['종합'] = finalGrade;
      }
      
      return studentData;
    });
  }, [allStudents, allRecords, allItems, gradeFilter, classNumFilter, dateFilter, viewType]);

  const sortedPapsData = useMemo(() => {
    if (!papsSort.length) return studentPapsTableData;
    
    return [...studentPapsTableData].sort((a, b) => {
        for (const sort of papsSort) {
            const { column, direction } = sort;
            const valA = a[column];
            const valB = b[column];
            const isAsc = direction === 'ascending';
            
            const numA = parseFloat(String(valA));
            const numB = parseFloat(String(valB));

            let comparison = 0;
            if (!isNaN(numA) && !isNaN(numB)) {
                comparison = numA - numB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            if (comparison !== 0) {
                return isAsc ? comparison : -comparison;
            }
        }
        return 0;
    });
  }, [studentPapsTableData, papsSort]);
  

  const handlePapsDownloadCsv = () => {
    if (sortedPapsData.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }
    
    const fileName = `PAPS_종합_현황_${viewType}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCsv(fileName, sortedPapsData);
    toast({
      title: '다운로드 시작',
      description: 'PAPS 종합 체력 현황을 CSV 파일로 다운로드합니다.',
    });
  };

  const finalFactorOrder = useMemo(() => {
    const newOrder = [...factorOrder];
    const 종합Index = newOrder.indexOf('종합');
    if (종합Index !== -1) {
        newOrder[종합Index] = viewType === 'score' ? '종합점수' : '종합등급';
    }
    return newOrder;
  }, [viewType]);


  const studentItemTableData = useMemo(() => {
    if (!selectedItem || !school) return [];

    const itemInfo = allItems.find(i => i.name === selectedItem);
    if (!itemInfo) return [];

    let filteredStudents = allStudents;
    if (itemGradeFilter !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === itemGradeFilter);
      if (itemClassNumFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.classNum === itemClassNumFilter);
      }
    }

    if (filteredStudents.length === 0) {
        return [];
    }

    const allRanks = calculateRanks(school, allItems, allRecords, allStudents, itemGradeFilter === 'all' ? undefined : itemGradeFilter);
    const itemRanks = allRanks[selectedItem] || [];

    return filteredStudents.map(student => {
      const records = allRecords.filter(r => r.studentId === student.id && r.item === selectedItem);
      const latestRecord = records.length > 0
        ? records.sort((a,b) => new Date(b.date).getTime() - new Date(a).getTime())[0]
        : null;
      
      const rankInfo = latestRecord ? itemRanks.find(r => r.studentId === student.id && r.value === latestRecord.value) : null;
      
      let grade: number | null = null;
      if (latestRecord) {
        if (itemInfo.isPaps) {
          grade = getPapsGrade(itemInfo.name, student, latestRecord.value);
        } else {
          grade = getCustomItemGrade(itemInfo, latestRecord.value);
        }
      }

      return {
        ...student,
        latestDate: latestRecord?.date || null,
        value: latestRecord?.value,
        grade,
        rank: rankInfo ? rankInfo.rank : null,
        totalRanked: itemRanks.length,
      };
    });

  }, [school, selectedItem, itemGradeFilter, itemClassNumFilter, allStudents, allRecords, allItems]);

  const sortedItemData = useMemo(() => {
      if (!itemSort.length) return studentItemTableData;
      
      return [...studentItemTableData].sort((a,b) => {
        for (const sort of itemSort) {
            const { column, direction } = sort;
            const isAsc = direction === 'ascending';
            
            let valA: any = a[column as keyof typeof a];
            let valB: any = b[column as keyof typeof b];

            // Handle nulls and undefined to sort them at the end
            if (valA == null) return 1;
            if (valB == null) return -1;
            
            let comparison = 0;
            if (column === 'value' || column === 'grade' || column === 'rank') {
                comparison = (valA ?? (isAsc ? Infinity : -Infinity)) - (valB ?? (isAsc ? Infinity : -Infinity));
                 if (itemSort.some(s => s.column === 'value') && allItems.find(i => i.name === selectedItem)?.recordType === 'time') {
                    // For time records, lower is better. Reverse the comparison.
                    comparison = -comparison;
                }
            } else if (column === 'latestDate') {
                const dateA = new Date(valA).getTime();
                const dateB = new Date(valB).getTime();
                comparison = dateA - dateB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            if (comparison !== 0) {
                return isAsc ? comparison : -comparison;
            }
        }
        return 0;
      });
  }, [studentItemTableData, itemSort, selectedItem, allItems]);


  const handleItemDownloadCsv = () => {
    if(sortedItemData.length === 0) {
       toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }
    const itemInfo = allItems.find(i => i.name === selectedItem);
    const dataToExport = sortedItemData.map(s => ({
        '학년': s.grade,
        '반': s.classNum,
        '번호': s.studentNum,
        '이름': s.name,
        '최근 측정일': s.latestDate || '-',
        '기록': s.value !== undefined ? `${s.value}${itemInfo?.unit || ''}` : '-',
        '등급': s.grade ? `${s.grade}등급` : '-',
        '순위': s.rank ? `${s.rank}등` : '-',
    }));
     const fileName = `${selectedItem}_기록 현황_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCsv(fileName, dataToExport);
    toast({
      title: '다운로드 시작',
      description: `${selectedItem} 기록을 CSV 파일로 다운로드합니다.`,
    });
  };

  useEffect(() => {
    setClassNumFilter('all');
  }, [gradeFilter]);
  
  useEffect(() => {
    setItemClassNumFilter('all');
  }, [itemGradeFilter]);
  
  const createSortHandler = (column: string, sortState: SortDescriptor[], setSortState: (descriptor: SortDescriptor[]) => void) => (event: React.MouseEvent) => {
    const isShiftKey = event.shiftKey;
    const existingSortIndex = sortState.findIndex(s => s.column === column);

    if (existingSortIndex > -1) {
        const newSortState = [...sortState];
        const currentSort = newSortState[existingSortIndex];
        if (currentSort.direction === 'ascending') {
            currentSort.direction = 'descending';
        } else {
            newSortState.splice(existingSortIndex, 1);
        }
        setSortState(newSortState);
    } else {
        const newSort = { column, direction: 'ascending' as const };
        if (isShiftKey) {
            setSortState([...sortState, newSort]);
        } else {
            setSortState([newSort]);
        }
    }
  };
  
  const getSortIndicator = (column: string, sortState: SortDescriptor[]) => {
    const sortIndex = sortState.findIndex(s => s.column === column);
    if (sortIndex === -1) return null;
    
    const sort = sortState[sortIndex];
    return (
        <span className="ml-1 text-xs font-normal">
            {sortIndex > 0 && <span className="text-muted-foreground mr-1">{sortIndex + 1}</span>}
            {sort.direction === 'ascending' ? '▲' : '▼'}
        </span>
    );
};


  return (
    <Card>
        <CardHeader>
            <CardTitle>기록 조회</CardTitle>
            <CardDescription>
                PAPS 종합 현황 또는 종목별 학생 기록을 조회하고 다운로드할 수 있습니다. Shift키를 누른 채로 헤더를 클릭하여 다중 정렬을 할 수 있습니다.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="paps">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="paps">PAPS 종합</TabsTrigger>
                    <TabsTrigger value="item">종목별 기록</TabsTrigger>
                </TabsList>
                <TabsContent value="paps" className="space-y-4">
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

                        <Select value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="표시 형식" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="grade">등급</SelectItem>
                                <SelectItem value="score">점수</SelectItem>
                                <SelectItem value="record">실제 기록</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        <Button onClick={handlePapsDownloadCsv} variant="outline" className="ml-auto">
                            <FileDown className="mr-2 h-4 w-4" />
                            결과 다운로드
                        </Button>
                    </div>
                     <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                {finalFactorOrder.map(key => {
                                    const columnKey = key.replace(/점수|등급/g, '');
                                    return (
                                        <TableHead key={key} onClick={createSortHandler(columnKey, papsSort, setPapsSort)} className="cursor-pointer hover:bg-muted whitespace-nowrap">
                                            {key}
                                            {getSortIndicator(columnKey, papsSort)}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {sortedPapsData.length > 0 ? (
                                sortedPapsData.map((row, index) => (
                                <TableRow key={index}>
                                    {finalFactorOrder.map((key, cellIndex) => {
                                    const displayKey = key.replace(/점수|등급/g, '');
                                    return (
                                        <TableCell key={cellIndex} className="whitespace-nowrap">{row[displayKey]}</TableCell>
                                    )
                                    })}
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                <TableCell colSpan={finalFactorOrder.length} className="h-24 text-center">
                                    선택된 조건에 해당하는 기록이 없습니다.
                                </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="item" className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 pt-4">
                       <Select value={selectedItem} onValueChange={setSelectedItem}>
                          <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="종목 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {allItems.map((item) => (
                              <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                       </Select>
                        <Select value={itemGradeFilter} onValueChange={(value) => {setItemGradeFilter(value); setItemClassNumFilter('all');}}>
                            <SelectTrigger className="w-full sm:w-[120px]">
                                <SelectValue placeholder="학년 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 학년</SelectItem>
                                {grades.map((grade) => (
                                <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={itemClassNumFilter}
                            onValueChange={setItemClassNumFilter}
                            disabled={itemGradeFilter === 'all'}
                        >
                            <SelectTrigger className="w-full sm:w-[120px]">
                            <SelectValue placeholder="반 선택" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 반</SelectItem>
                            {classNumsByGrade[itemGradeFilter]?.map((classNum) => (
                                <SelectItem key={classNum} value={classNum}>
                                {classNum}반
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleItemDownloadCsv} variant="outline" className="ml-auto" disabled={!selectedItem}>
                            <FileDown className="mr-2 h-4 w-4" />
                            결과 다운로드
                        </Button>
                    </div>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {[
                                      { key: 'grade', label: '학년' },
                                      { key: 'classNum', label: '반' },
                                      { key: 'studentNum', label: '번호' },
                                      { key: 'name', label: '이름' },
                                      { key: 'latestDate', label: '최근 측정일' },
                                      { key: 'value', label: '기록' },
                                      { key: 'grade', label: '등급' },
                                      { key: 'rank', label: '순위' },
                                    ].map((header, index) => (
                                       <TableHead key={`${header.key}-${index}`} onClick={createSortHandler(header.key, itemSort, setItemSort)} className="cursor-pointer hover:bg-muted whitespace-nowrap">
                                          {header.label}
                                          {getSortIndicator(header.key, itemSort)}
                                       </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedItemData.length > 0 ? (
                                    sortedItemData.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell>{s.grade}</TableCell>
                                            <TableCell>{s.classNum}</TableCell>
                                            <TableCell>{s.studentNum}</TableCell>
                                            <TableCell>{s.name}</TableCell>
                                            <TableCell>{s.latestDate || '-'}</TableCell>
                                            <TableCell>{s.value !== undefined ? `${s.value}${allItems.find(i => i.name === selectedItem)?.unit || ''}`: '-'}</TableCell>
                                            <TableCell>{s.grade ? `${s.grade}등급` : '-'}</TableCell>
                                            <TableCell>{s.rank ? `${s.rank} / ${s.totalRanked}` : '-'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            조회할 종목을 선택해주세요.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
        </CardContent>
    </Card>
  );
}
