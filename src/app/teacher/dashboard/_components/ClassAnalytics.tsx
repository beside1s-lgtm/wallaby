'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudents, getRecords, getItems, addOrUpdateRecord, calculateRanks, getRecordsByStudent } from '@/lib/store';
import { Student, MeasurementRecord, MeasurementItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyzeStudentPerformance } from '@/ai/flows/teacher-ai-assistant';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Wand2, FileUp, X as XIcon, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPapsGrade, getCustomItemGrade } from '@/lib/paps';
import { parseCsv, exportToZip } from '@/lib/utils';
import { addOrUpdateRecords } from '@/lib/store';

type AiAnalysis = {
  strengths: string;
  weaknesses: string;
  suggestedTrainingMethods: string;
};

const gradeToPercentage = (grade: number | null): number => {
    if (grade === null) return 0;
    // 1등급 -> 100, 2등급 -> 80, ..., 5등급 -> 20
    return (5 - grade + 1) * 20;
};

const CustomTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const { name, value, unit } = payload[0].payload.originalRecord || {};
    return (
      <div className="p-2 text-sm bg-background/90 border rounded-md shadow-lg">
        <p className="font-bold">{label}</p>
        <p style={{ color: payload[0].color }}>
            {`${payload[0].name}: ${payload[0].value}${unit ? ` (${value}${unit})` : ''}`}
        </p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 text-sm bg-background/90 border rounded-md shadow-lg">
                <p className="font-bold">{label}</p>
                {payload.map((p: any) => (
                    <div key={p.dataKey} style={{ color: p.color }}>
                        <p>{`${p.name}: ${p.value}% (${p.payload.originalRecords[p.dataKey]?.value || 'N/A'}${p.payload.originalRecords[p.dataKey]?.unit || ''})`}</p>
                        {p.payload.originalRecords[p.dataKey]?.rank && <p className='text-xs text-muted-foreground'>{p.payload.originalRecords[p.dataKey].rank}</p>}
                    </div>
                ))}
            </div>
        );
    }
    return null;
};


export default function ClassAnalytics() {
  const { school } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('');
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<MeasurementRecord[]>([]);
  const [allRecords, setAllRecords] = useState<MeasurementRecord[]>([]);
  const [allItems, setAllItems] = useState<MeasurementItem[]>([]);
  const [progressChartItem, setProgressChartItem] = useState<string>('');
  
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // States for adding a new record
  const [selectedItemName, setSelectedItemName] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // States for sorting
  const [sortedStudents, setSortedStudents] = useState<(Student & { sortValue?: string | number })[] | null>(null);
  const [sortItem, setSortItem] = useState('');
  const [sortType, setSortType] = useState<'record' | 'averageGrade' | null>(null);

  const students = useMemo(() => school ? getStudents(school) : [], [school]);
  const measurementItems = useMemo(() => school ? getItems(school) : [], [school]);

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(students.map(s => s.grade))].sort();
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach(grade => {
        classNumsByGrade[grade] = [...new Set(students.filter(s => s.grade === grade).map(s => s.classNum))].sort();
    });
    return { grades, classNumsByGrade };
  }, [students]);

  const filteredStudentsByClass = useMemo(() => {
    if (!selectedGrade || !selectedClassNum) return [];
    const classStudents = students.filter(s => s.grade === selectedGrade && s.classNum === selectedClassNum);
    return classStudents.sort((a,b) => parseInt(a.studentNum) - parseInt(b.studentNum));
  }, [students, selectedGrade, selectedClassNum]);
  
  useEffect(() => {
    setSortedStudents(null);
    setSortType(null);
  }, [selectedGrade, selectedClassNum]);


  useEffect(() => {
    if (school) {
        const items = getItems(school);
        const papsItems = items.filter(i => i.isPaps);
        setAllItems(papsItems);
        setAllRecords(getRecords(school));
        if (papsItems.length > 0) {
            const firstPapsItem = papsItems[0].name;
            setProgressChartItem(firstPapsItem);
            setSortItem(firstPapsItem);
        }
    }
  }, [school]);
  
  useEffect(() => {
    // Reset student search when class filter changes
    if(selectedGrade && selectedClassNum){
        setSearchTerm('');
        setSelectedStudent(null);
    }
  }, [selectedGrade, selectedClassNum]);

  const selectedItem = useMemo(() => {
      return allItems.find(item => item.name === selectedItemName) ?? getItems(school).find(item => item.name === selectedItemName);
  }, [selectedItemName, allItems, school]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedItem) return "측정 결과 (숫자만 입력)";
    return `결과 (${selectedItem.unit})`;
  }, [selectedItem]);

  const refreshStudentRecords = (studentId: string) => {
    if(!school) return;
    const allRecs = getRecords(school);
    setAllRecords(allRecs);
    const studentRecs = allRecs.filter(r => r.studentId === studentId);
    setStudentRecords(studentRecs);
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    const studentRecs = allRecords.filter(r => r.studentId === student.id);
    setStudentRecords(studentRecs);
    setAiAnalysis(null);
  }

  const handleSearch = () => {
    if (!school) return;
    if (!searchTerm) {
        resetFilters();
        return;
    }
    const student = students.find(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (student) {
      handleSelectStudent(student);
      setSelectedGrade('');
      setSelectedClassNum('');
    } else {
      setSelectedStudent(null);
      setStudentRecords([]);
      toast({
        variant: 'destructive',
        title: '검색 실패',
        description: '해당 학생을 찾을 수 없습니다.'
      })
    }
  };

  const handleAddRecord = () => {
    if (!selectedItemName || !recordValue || !school || !selectedStudent) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '측정 종목과 결과를 모두 입력해주세요.',
      });
      return;
    }
    
    setIsSubmitting(true);
    const numericValue = parseFloat(recordValue);
    if (isNaN(numericValue)) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '결과는 숫자로 입력해주세요.',
      });
      setIsSubmitting(false);
      return;
    }
    
    addOrUpdateRecord({
      studentId: selectedStudent.id,
      school: school,
      item: selectedItemName,
      value: numericValue,
    });

    refreshStudentRecords(selectedStudent.id);
    
    toast({
      title: '기록 저장 완료',
      description: `${selectedStudent.name} 학생의 ${selectedItemName} 기록이 ${numericValue}${selectedItem?.unit}으로 저장/업데이트되었습니다.`,
    });
    
    setRecordValue('');
    setSelectedItemName('');
    setIsSubmitting(false);
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const parsedRecords = parseCsv<any>(text);
          const allStudents = getStudents(school);
          const studentMapByName = new Map(allStudents.map(s => [s.name, s]));
          
          const recordsToAdd: (Omit<MeasurementRecord, 'id'> & { studentId: string })[] = [];

          parsedRecords.forEach(rec => {
            const student = studentMapByName.get(rec.name || rec.이름);
            if (student && (rec.item || rec.측정종목) && (rec.value || rec.기록)) {
              recordsToAdd.push({
                studentId: student.id,
                school: school,
                item: rec.item || rec.측정종목,
                value: parseFloat(rec.value || rec.기록),
                date: rec.date || rec.측정일,
              });
            }
          });

          addOrUpdateRecords(school, recordsToAdd);
          
          toast({ title: '일괄 등록 완료', description: `${recordsToAdd.length}개의 기록을 등록/업데이트했습니다.` });
          
          if(selectedStudent) {
            refreshStudentRecords(selectedStudent.id);
          } else {
             setAllRecords(getRecords(school));
          }

        } catch (error) {
            console.error('CSV 처리 오류', error);
            toast({ variant: 'destructive', title: 'CSV 처리 오류', description: '파일 형식이 올바르지 않거나 데이터가 유효하지 않습니다.' });
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
    event.target.value = ''; // Reset file input
  };
  
  const handleDownloadTemplate = () => {
    if(!school) return;
    const templateData = [{
      이름: '홍길동',
      측정종목: '50m 달리기',
      기록: 9.5,
      측정일: '2024-01-01'
    }];
    
    const itemsData = measurementItems.map(item => ({
        종목명: item.name,
        단위: item.unit
    }));
    
    const files = [
        { name: '기록_등록_템플릿.csv', data: templateData },
        { name: '등록된_종목_목록.csv', data: itemsData },
    ];
    
    exportToZip('기록_등록_템플릿.zip', files);
    toast({ title: '다운로드 시작', description: '템플릿과 종목 목록을 ZIP 파일로 다운로드합니다.'});
  }

  const handleAiAnalysis = async () => {
    if (!selectedStudent || studentRecords.length === 0 || !school) return;
    setIsAiLoading(true);
    try {
       const allItemRanks = calculateRanks(school, selectedStudent.grade);
       const studentRanks: Record<string, string> = {};
       Object.entries(allItemRanks).forEach(([item, ranks]) => {
            const rankInfo = ranks.find(r => r.studentId === selectedStudent.id);
            if(rankInfo) {
                studentRanks[item] = `${ranks.length}명 중 ${rankInfo.rank}등`;
            }
       });

      const performanceData = JSON.stringify(studentRecords.map(r => {
          const itemInfo = allItems.find(item => item.name === r.item) ?? getItems(school).find(item => item.name === r.item);
          return { item: r.item, value: r.value, date: r.date, recordType: itemInfo?.recordType || 'count' }
        }));
      const result = await analyzeStudentPerformance({
        school,
        studentName: selectedStudent.name,
        performanceData,
        ranks: studentRanks,
      });
      setAiAnalysis(result);
    } catch (error) {
      console.error('AI analysis failed:', error);
       toast({
        variant: 'destructive',
        title: 'AI 분석 실패',
        description: 'AI 분석 중 오류가 발생했습니다. 나중에 다시 시도해주세요.'
      })
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSortByRecord = () => {
    if (!sortItem || filteredStudentsByClass.length === 0 || !school) return;
    const itemInfo = measurementItems.find(i => i.name === sortItem);
    if (!itemInfo) return;

    const studentRecords = filteredStudentsByClass.map(student => {
      const records = getRecordsByStudent(school, student.id).filter(r => r.item === sortItem);
      const latestRecord = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return {
        ...student,
        sortValue: latestRecord ? `${latestRecord.value}${itemInfo.unit}` : '기록 없음',
        _sortValue: latestRecord ? latestRecord.value : (itemInfo.recordType === 'time' ? Infinity : -1),
      };
    });

    studentRecords.sort((a, b) => {
      return itemInfo.recordType === 'time' ? a._sortValue - b._sortValue : b._sortValue - a._sortValue;
    });

    setSortedStudents(studentRecords);
    setSortType('record');
  };

  const handleSortByAverageGrade = () => {
      if (filteredStudentsByClass.length === 0 || !school) return;
      const papsItems = allItems.filter(i => i.isPaps);

      const studentAvgs = filteredStudentsByClass.map(student => {
          const studentRecords = getRecordsByStudent(school, student.id);
          const grades = papsItems.map(item => {
              const latestRecord = studentRecords
                  .filter(r => r.item === item.name)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              
              if (latestRecord) {
                  return getPapsGrade(item.name, student.gender, latestRecord.value);
              }
              return null;
          }).filter((g): g is number => g !== null);

          const avgGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 6;
          return { ...student, sortValue: `${avgGrade.toFixed(2)}등급`, _sortValue: avgGrade };
      });
      
      studentAvgs.sort((a, b) => a._sortValue - b._sortValue);
      setSortedStudents(studentAvgs);
      setSortType('averageGrade');
  };

  
  const calculateAverageGrades = (studentList: Student[]): Record<string, { percentage: number, avgValue: number, unit: string }> => {
      if (studentList.length === 0) return {};
      
      const averageData: Record<string, { totalPercentage: number, totalValue: number, count: number, unit: string }> = {};
      const studentIds = new Set(studentList.map(s => s.id));
      const relevantRecords = allRecords.filter(r => studentIds.has(r.studentId));

      allItems.forEach(item => {
        const itemRecords = relevantRecords.filter(r => r.item === item.name);
        if (itemRecords.length > 0) {
          if (!averageData[item.name]) {
            averageData[item.name] = { totalPercentage: 0, totalValue: 0, count: 0, unit: item.unit };
          }
          
          itemRecords.forEach(record => {
            const student = studentList.find(s => s.id === record.studentId);
            if (student) {
              const grade = getPapsGrade(item.name, student.gender, record.value);
              if (grade !== null) {
                averageData[item.name].totalPercentage += gradeToPercentage(grade);
                averageData[item.name].totalValue += record.value;
                averageData[item.name].count++;
              }
            }
          });
        }
      });
      
      const finalAverages: Record<string, { percentage: number, avgValue: number, unit: string }> = {};
      Object.keys(averageData).forEach(itemName => {
          const data = averageData[itemName];
          if(data.count > 0) {
            finalAverages[itemName] = {
                percentage: parseFloat((data.totalPercentage / data.count).toFixed(2)),
                avgValue: parseFloat((data.totalValue / data.count).toFixed(2)),
                unit: data.unit,
            };
          }
      });
      return finalAverages;
  }

  const comparisonData = useMemo(() => {
    if (allRecords.length === 0 || !school) return { data: [], targetLabel: '선택 대상'};
    
    let comparisonTargetData: Record<string, { percentage: number, avgValue: number, unit: string, rank?: string }> = {};
    let label = '선택 대상';

    if(selectedStudent) {
        const allItemRanks = calculateRanks(school, selectedStudent.grade);
        label = selectedStudent.name;
        const studentRecordsForComparison = allRecords.filter(r => r.studentId === selectedStudent.id);
        const latestRecords: Record<string, MeasurementRecord> = {};
        
        studentRecordsForComparison.forEach(r => {
            if (!latestRecords[r.item] || new Date(r.date) > new Date(latestRecords[r.item].date)) {
                latestRecords[r.item] = r;
            }
        });

        allItems.forEach(item => {
          const record = latestRecords[item.name];
          if (record) {
            const grade = getPapsGrade(item.name, selectedStudent.gender, record.value);
            if (grade !== null) {
              const rankInfo = allItemRanks[item.name]?.find(r => r.studentId === selectedStudent.id);
              comparisonTargetData[item.name] = {
                  percentage: gradeToPercentage(grade),
                  avgValue: record.value,
                  unit: item.unit,
                  rank: rankInfo ? `같은 학년 ${allItemRanks[item.name].length}명 중 ${rankInfo.rank}등` : undefined
              };
            }
          }
        });
    } else if (filteredStudentsByClass.length > 0) {
        label = `${selectedGrade}학년 ${selectedClassNum}반 평균`;
        comparisonTargetData = calculateAverageGrades(filteredStudentsByClass);
    }
    
    const overallAverageData = calculateAverageGrades(students.filter(s => s.grade === (selectedStudent?.grade || selectedGrade)));

    return {
        data: allItems.map(item => ({
            name: item.name,
            target: comparisonTargetData[item.name]?.percentage || 0,
            average: overallAverageData[item.name]?.percentage || 0,
            originalRecords: {
                target: { value: comparisonTargetData[item.name]?.avgValue, unit: comparisonTargetData[item.name]?.unit, rank: comparisonTargetData[item.name]?.rank },
                average: { value: overallAverageData[item.name]?.avgValue, unit: overallAverageData[item.name]?.unit }
            }
        })).filter(d => d.target > 0 || d.average > 0),
        targetLabel: label
    };

  }, [selectedStudent, filteredStudentsByClass, allRecords, allItems, students, selectedGrade, selectedClassNum, school]);
  
  const progressData = useMemo(() => {
    if (!progressChartItem || !selectedStudent || !school) return [];
    const allItemsList = getItems(school);
    const itemInfo = allItemsList.find(i => i.name === progressChartItem);

    if (!itemInfo) return [];

    return studentRecords
      .filter(r => r.item === progressChartItem)
      .map(r => {
          let grade: number | null = null;
          if (itemInfo.isPaps) {
            grade = getPapsGrade(r.item, selectedStudent.gender, r.value)
          } else {
            grade = getCustomItemGrade(itemInfo, r.value);
          }
          return { date: r.date, value: grade, originalRecord: { name: r.item, value: r.value, unit: itemInfo.unit } }
      })
      .filter(r => r.value !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [studentRecords, progressChartItem, selectedStudent, school]);
  
  const comparisonChartConfig = {
      target: { label: comparisonData.targetLabel, color: 'hsl(var(--chart-1))' },
      average: { label: '학년 평균', color: 'hsl(var(--chart-2))' },
  };
  
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedGrade('');
    setSelectedClassNum('');
    setSelectedStudent(null);
  }

  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>학급별 학생 기록 조회 및 분석</CardTitle>
        <CardDescription>학생을 검색하거나 학급을 선택하여 상세 기록과 AI 분석을 확인하고, 기록을 추가/관리할 수 있습니다.</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Input 
            type="text" 
            placeholder="학생 이름 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full sm:w-auto"
          />
          <Button type="button" onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> 검색</Button>
          
          <span className="text-muted-foreground text-sm mx-2">또는</span>

          <Select value={selectedGrade} onValueChange={(value) => { setSelectedGrade(value); setSelectedClassNum(''); }}>
            <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="학년 선택" />
            </SelectTrigger>
            <SelectContent>
                {grades.map(grade => <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}>
            <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="반 선택" />
            </SelectTrigger>
            <SelectContent>
                {classNumsByGrade[selectedGrade]?.map(classNum => <SelectItem key={classNum} value={classNum}>{classNum}반</SelectItem>)}
            </SelectContent>
          </Select>
          
           {(selectedStudent || selectedGrade) && (
            <Button variant="ghost" size="icon" onClick={resetFilters} className="h-9 w-9">
                <XIcon className="h-5 w-5" />
            </Button>
           )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {!selectedStudent && !filteredStudentsByClass.length && (
          <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle>기록 일괄 관리</CardTitle>
                    <CardDescription>
                      CSV 파일을 사용하여 여러 학생의 기록을 한 번에 등록합니다. 템플릿과 함께 제공되는 '등록된_종목_목록.csv' 파일을 참고하여 정확한 종목명을 입력해주세요. 한글 깨짐 방지를 위해 CSV 파일은 반드시 UTF-8 형식으로 저장해주세요.
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex-wrap gap-2">
                    <Button variant="outline" onClick={() => document.getElementById('record-csv-upload-main')?.click()}>
                        <FileUp className="mr-2 h-4 w-4" />
                        CSV 일괄 등록
                    </Button>
                    <input type="file" id="record-csv-upload-main" accept=".csv" onChange={handleCsvUpload} style={{ display: 'none' }} />
                    <Button variant="link" onClick={handleDownloadTemplate}>템플릿 및 종목 목록 다운로드</Button>
                </CardFooter>
            </Card>
            <p className="text-center text-muted-foreground">분석할 학생을 검색하거나 학급을 선택해주세요.</p>
          </div>
        )}

        {(selectedStudent || filteredStudentsByClass.length > 0) && (
          <div>
            {selectedStudent ? (
                <h2 className="text-2xl font-bold mb-6">{selectedStudent.name} ({selectedStudent.grade}-{selectedStudent.classNum}) 학생 분석</h2>
            ) : (
                <h2 className="text-2xl font-bold mb-6">{selectedGrade}학년 {selectedClassNum}반 학급 분석</h2>
            )}
            
            {!selectedStudent && filteredStudentsByClass.length > 0 && (
                 <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>학급 학생 목록</CardTitle>
                        <CardDescription>학생을 선택하여 개별 기록을 조회하거나, 목록을 정렬하여 성취도를 비교할 수 있습니다.</CardDescription>
                         <div className="flex flex-wrap items-center gap-2 pt-4">
                            <span className="text-sm font-medium">정렬 기준:</span>
                            <Select value={sortItem} onValueChange={setSortItem}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="정렬 종목 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {measurementItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={handleSortByRecord} disabled={!sortItem}>
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                기록순 정렬
                            </Button>
                             <Button size="sm" variant="outline" onClick={handleSortByAverageGrade}>
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                평균 등급순 정렬
                            </Button>
                             {sortedStudents && (
                                <Button size="sm" variant="ghost" onClick={() => setSortedStudents(null)}>정렬 초기화</Button>
                             )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>번호</TableHead>
                                    <TableHead>이름</TableHead>
                                    <TableHead>성별</TableHead>
                                    {sortType && <TableHead>정렬 기준값</TableHead>}
                                    <TableHead>기록 조회</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(sortedStudents || filteredStudentsByClass).map(student => (
                                    <TableRow key={student.id}>
                                        <TableCell>{student.studentNum}</TableCell>
                                        <TableCell>{student.name}</TableCell>
                                        <TableCell>{student.gender}</TableCell>
                                        {student.sortValue !== undefined && <TableCell>{student.sortValue}</TableCell>}
                                        <TableCell>
                                            <Button variant="link" size="sm" onClick={() => handleSelectStudent(student)}>기록 보기</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {selectedStudent && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>기록 개별 추가</CardTitle>
                  <CardDescription>
                    선택된 학생의 측정 기록을 개별적으로 추가합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Select onValueChange={setSelectedItemName} value={selectedItemName}>
                        <SelectTrigger>
                          <SelectValue placeholder="측정 종목 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {getItems(school).map(item => (
                            <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={inputPlaceholder}
                        value={recordValue}
                        onChange={e => setRecordValue(e.target.value)}
                        type="number"
                      />
                  </div>
                </CardContent>
                <CardFooter className="flex-wrap gap-2">
                  <Button onClick={handleAddRecord} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    개별 기록 저장
                  </Button>
                </CardFooter>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>PAPS 성취도 비교 ({comparisonData.targetLabel} vs 학년 평균)</CardTitle>
                  <CardDescription>100%에 가까울수록 성취도가 높습니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={comparisonChartConfig} className="h-[300px] w-full">
                    <BarChart data={comparisonData.data}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" height={80} interval={0} />
                      <YAxis domain={[0, 100]} unit="%" />
                      <ChartTooltip 
                        content={<CustomBarTooltipContent />} 
                      />
                      <Legend />
                      <Bar dataKey="target" name={comparisonChartConfig.target.label} fill="var(--color-target)" radius={4} />
                      <Bar dataKey="average" name={comparisonChartConfig.average.label} fill="var(--color-average)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              
              {selectedStudent && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>회차별 등급 변화</CardTitle>
                      <Select value={progressChartItem} onValueChange={setProgressChartItem}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="종목 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <CardDescription>1등급이 가장 높은 등급입니다.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{}} className="h-[300px] w-full">
                      <LineChart data={progressData}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tickCount={5} reversed={true} />
                        <Tooltip content={<CustomTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="value" name={progressChartItem} stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {selectedStudent && (
              <Card className="bg-primary/5">
                  <CardHeader>
                      <CardTitle>AI 코칭 어시스턴트</CardTitle>
                      <CardDescription>학생의 기록을 바탕으로 강점, 약점, 추천 훈련 방법을 분석합니다.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {isAiLoading ? (
                          <div className="flex items-center justify-center h-24">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          </div>
                      ) : aiAnalysis ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div><h4 className="font-bold mb-2 text-green-600">강점</h4><p className="whitespace-pre-wrap">{aiAnalysis.strengths}</p></div>
                              <div><h4 className="font-bold mb-2 text-red-600">약점</h4><p className="whitespace-pre-wrap">{aiAnalysis.weaknesses}</p></div>
                              <div><h4 className="font-bold mb-2 text-blue-600">추천 훈련 방법</h4><p className="whitespace-pre-wrap">{aiAnalysis.suggestedTrainingMethods}</p></div>
                          </div>
                      ) : (
                          <p className="text-center text-muted-foreground">AI 분석을 요청하여 학생 맞춤형 코칭을 받아보세요.</p>
                      )}
                  </CardContent>
                  <CardFooter>
                      <Button onClick={handleAiAnalysis} disabled={isAiLoading || studentRecords.length === 0}>
                          <Wand2 className="mr-2 h-4 w-4" />
                          {isAiLoading ? '분석 중...' : 'AI 분석 요청'}
                      </Button>
                  </CardFooter>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
