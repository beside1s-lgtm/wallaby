'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord, calculateRanks, getRecordsByStudent, deleteRecord, addOrUpdateRecords } from '@/lib/store';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyzeStudentPerformance } from '@/ai/flows/teacher-ai-assistant';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Wand2, X as XIcon, ArrowUpDown, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPapsGrade, getCustomItemGrade, normalizePapsRecord, normalizeCustomRecord } from '@/lib/paps';
import AiWelcome from './AiWelcome';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';


type AiAnalysis = {
  strengths: string;
  weaknesses: string;
  suggestedTrainingMethods: string;
};

interface ClassAnalyticsProps {
    allStudents: Student[];
    allItems: MeasurementItem[];
    allRecords: MeasurementRecord[];
    onRecordUpdate: () => void;
}

const gradeToPercentage = (grade: number | null): number => {
    if (grade === null) return 0;
    // 1등급: 100%, 2등급: 75%, 3등급: 50%, 4등급: 25%, 5등급: 0%
    if (grade >= 5) return 0;
    return (5 - grade) * 25;
};

const chartConfig = {
  score: { label: "등급", color: "hsl(var(--chart-2))" },
  achievement: { label: "기록 성취도", color: "hsl(var(--chart-1))" },
};

const CustomTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const scorePayload = payload.find(p => p.dataKey === 'score');
    const achievementPayload = payload.find(p => p.dataKey === 'achievement');

    return (
      <div className="p-2 text-sm bg-background/90 border rounded-md shadow-lg">
        <p className="font-bold">{label} ({data.itemName})</p>
        {scorePayload && <p style={{ color: scorePayload.color }}>{`등급: ${data.grade}등급`}</p>}
        {achievementPayload && <p style={{ color: achievementPayload.color }}>{`기록: ${data.value}${data.unit}`}</p>}
        {data.rank && <p className="text-muted-foreground mt-1">{data.rank}</p>}
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


export default function ClassAnalytics({ allStudents, allItems, allRecords, onRecordUpdate }: ClassAnalyticsProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('');
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<MeasurementRecord[]>([]);
  const [progressChartItem, setProgressChartItem] = useState<string>('');
  
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // States for adding a new record (for single student)
  const [selectedItemName, setSelectedItemName] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());

  // States for batch recording
  const [batchRecordItem, setBatchRecordItem] = useState('');
  const [batchRecordDate, setBatchRecordDate] = useState<Date | undefined>(new Date());
  const [batchRecords, setBatchRecords] = useState<Record<string, string>>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  
  // States for sorting
  const [sortedStudents, setSortedStudents] = useState<(Student & { sortValue?: string | number })[] | null>(null);
  const [sortItem, setSortItem] = useState('');
  const [sortType, setSortType] = useState<'record' | 'averageGrade' | null>(null);

  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);
  const [comparisonType, setComparisonType] = useState<'paps' | 'custom'>('paps');

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(allStudents.map(s => s.grade))].sort();
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach(grade => {
        classNumsByGrade[grade] = [...new Set(allStudents.filter(s => s.grade === grade).map(s => s.classNum))].sort();
    });
    return { grades, classNumsByGrade };
  }, [allStudents]);

  const filteredStudentsByClass = useMemo(() => {
    if (!selectedGrade || !selectedClassNum) return [];
    const classStudents = allStudents.filter(s => s.grade === selectedGrade && s.classNum === selectedClassNum);
    return classStudents.sort((a,b) => parseInt(a.studentNum) - parseInt(b.studentNum));
  }, [allStudents, selectedGrade, selectedClassNum]);
  
  useEffect(() => {
    setSortedStudents(null);
    setSortType(null);
    // When class selection changes, reset student selection
    setSelectedStudent(null);
    setBatchRecords({}); // Clear batch records on class change
  }, [selectedGrade, selectedClassNum]);


  useEffect(() => {
    if (allItems.length > 0) {
        const papsItems = allItems.filter(i => i.isPaps);
        if (papsItems.length > 0) {
            const firstPapsItem = papsItems[0].name;
            setProgressChartItem(firstPapsItem);
            setSortItem(firstPapsItem);
            setBatchRecordItem(firstPapsItem);
        } else if (allItems.length > 0) {
            const firstItem = allItems[0].name;
            setProgressChartItem(firstItem);
            setSortItem(firstItem);
            setBatchRecordItem(firstItem);
        }
    }
  }, [allItems]);
  
  useEffect(() => {
    // Reset student search when class filter changes
    if(selectedGrade && selectedClassNum){
        setSearchTerm('');
        setSelectedStudent(null);
    }
  }, [selectedGrade, selectedClassNum]);

  const selectedItemForSingleAdd = useMemo(() => {
      return allItems.find(item => item.name === selectedItemName);
  }, [selectedItemName, allItems]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedItemForSingleAdd) return "측정 결과 (숫자만 입력)";
    return `결과 (${selectedItemForSingleAdd.unit})`;
  }, [selectedItemForSingleAdd]);

  const refreshStudentRecords = (studentId: string) => {
    if(!school) return;
    const studentRecs = allRecords.filter(r => r.studentId === studentId);
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
  
    const matchingStudents = allStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
    if (matchingStudents.length === 0) {
      setSelectedStudent(null);
      setStudentRecords([]);
      toast({
        variant: 'destructive',
        title: '검색 실패',
        description: '해당 학생을 찾을 수 없습니다.'
      });
    } else if (matchingStudents.length === 1) {
      handleSelectStudent(matchingStudents[0]);
      setSelectedGrade('');
      setSelectedClassNum('');
    } else {
      // Multiple students found, open selection dialog
      setFoundStudents(matchingStudents);
      setIsSelectionDialogOpen(true);
    }
  };

  const handleStudentSelectionFromDialog = (student: Student) => {
    handleSelectStudent(student);
    setSelectedGrade('');
    setSelectedClassNum('');
    setIsSelectionDialogOpen(false);
    setFoundStudents([]);
  };

  const handleAddRecord = async () => {
    if (!selectedItemName || !recordValue || !school || !selectedStudent || !recordDate) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '날짜, 측정 종목, 결과를 모두 입력해주세요.',
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
    
    try {
        await addOrUpdateRecord({
          studentId: selectedStudent.id,
          school: school,
          item: selectedItemName,
          value: numericValue,
          date: format(recordDate, 'yyyy-MM-dd'),
        });

        await onRecordUpdate(); // This will re-fetch all records in parent and pass down
        
        toast({
          title: '기록 저장 완료',
          description: `${selectedStudent.name} 학생의 ${selectedItemName} 기록이 ${numericValue}${selectedItemForSingleAdd?.unit}으로 저장/업데이트되었습니다.`,
        });
        
        setRecordValue('');
        setSelectedItemName('');
    } catch(error) {
         console.error("Failed to save record:", error);
        toast({ variant: 'destructive', title: '저장 실패', description: '기록 저장 중 오류가 발생했습니다.'})
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!school) return;
    try {
        await deleteRecord(school, recordId);
        await onRecordUpdate();
        toast({
            title: '기록 삭제 완료',
            description: '선택한 기록이 삭제되었습니다.',
        });
    } catch (error) {
        console.error("Failed to delete record:", error);
        toast({ variant: 'destructive', title: '삭제 실패', description: '기록 삭제 중 오류가 발생했습니다.'})
    }
  };

  useEffect(() => {
    if (selectedStudent) {
        refreshStudentRecords(selectedStudent.id);
    }
  }, [allRecords, selectedStudent]);

  const handleAiAnalysis = async () => {
    if (!selectedStudent || studentRecords.length === 0 || !school) return;
    setIsAiLoading(true);
    try {
       const allItemRanks = calculateRanks(school, allItems, allRecords, allStudents, selectedStudent.grade);
       const studentRanks: Record<string, string> = {};
       Object.entries(allItemRanks).forEach(([item, ranks]) => {
            const rankInfo = ranks.find(r => r.studentId === selectedStudent.id);
            if(rankInfo) {
                studentRanks[item] = `${ranks.length}명 중 ${rankInfo.rank}등`;
            }
       });

      const performanceData = JSON.stringify(studentRecords.map(r => {
          const itemInfo = allItems.find(item => item.name === r.item);
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

  const handleSortByRecord = async () => {
    if (!sortItem || filteredStudentsByClass.length === 0 || !school) return;
    const itemInfo = allItems.find(i => i.name === sortItem);
    if (!itemInfo) return;

    const studentRecs = await Promise.all(filteredStudentsByClass.map(async (student) => {
        const records = (await getRecordsByStudent(school, student.id)).filter(r => r.item === sortItem);
        const latestRecord = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return {
            ...student,
            sortValue: latestRecord ? `${latestRecord.value}${itemInfo.unit}` : '기록 없음',
            _sortValue: latestRecord ? latestRecord.value : (itemInfo.recordType === 'time' ? Infinity : -1),
        };
    }));


    studentRecs.sort((a, b) => {
      return itemInfo.recordType === 'time' ? a._sortValue - b._sortValue : b._sortValue - a._sortValue;
    });

    setSortedStudents(studentRecs);
    setSortType('record');
  };

  const handleSortByAverageGrade = async () => {
      if (filteredStudentsByClass.length === 0 || !school) return;
      const papsItems = allItems.filter(i => i.isPaps);

      const studentAvgs = await Promise.all(filteredStudentsByClass.map(async (student) => {
          const studentRecords = await getRecordsByStudent(school, student.id);
          const grades = papsItems.map(item => {
              const latestRecord = studentRecords
                  .filter(r => r.item === item.name)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              
              if (latestRecord) {
                  return getPapsGrade(item.name, student, latestRecord.value);
              }
              return null;
          }).filter((g): g is number => g !== null);

          if (grades.length === 0) {
              return { ...student, sortValue: '미측정', _sortValue: 6 };
          }
          
          const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
          return { ...student, sortValue: `${Math.round(avgGrade)}등급`, _sortValue: avgGrade };
      }));
      
      studentAvgs.sort((a, b) => a._sortValue - b._sortValue);
      setSortedStudents(studentAvgs);
      setSortType('averageGrade');
  };
  
    const handleBatchRecordChange = (studentId: string, value: string) => {
        setBatchRecords(prev => ({
            ...prev,
            [studentId]: value,
        }));
    };

    const handleSaveBatchRecords = async () => {
        if (!school || !batchRecordItem || !batchRecordDate || Object.keys(batchRecords).length === 0) {
            toast({ variant: 'destructive', title: '입력 오류', description: '날짜, 종목을 선택하고 하나 이상의 기록을 입력해주세요.' });
            return;
        }

        setIsBatchSubmitting(true);
        try {
            const recordsToSave = Object.entries(batchRecords)
                .map(([studentId, value]) => {
                    const student = filteredStudentsByClass.find(s => s.id === studentId);
                    const numericValue = parseFloat(value);
                    if (!student || value.trim() === '' || isNaN(numericValue)) return null;

                    return {
                        ...student,
                        item: batchRecordItem,
                        value: numericValue,
                        date: format(batchRecordDate, 'yyyy-MM-dd'),
                    };
                })
                .filter((r): r is (Student & { item: string; value: number; date: string; }) => r !== null);
            
            if (recordsToSave.length > 0) {
                await addOrUpdateRecords(school, allStudents, recordsToSave);
                await onRecordUpdate();
                toast({ title: '저장 완료', description: `${batchRecordItem}에 대한 ${recordsToSave.length}개의 기록이 저장/업데이트되었습니다.` });
                setBatchRecords({}); // Clear inputs after saving
            } else {
                toast({ variant: 'destructive', title: '저장할 기록 없음', description: '유효한 기록을 입력해주세요.' });
            }
        } catch (error) {
            console.error('Failed to save batch records:', error);
            toast({ variant: 'destructive', title: '일괄 저장 실패', description: '기록 저장 중 오류가 발생했습니다.' });
        } finally {
            setIsBatchSubmitting(false);
        }
    };

  const calculateAverageGrades = (studentList: Student[], isPaps: boolean): Record<string, { percentage: number, avgValue: number, unit: string }> => {
      if (studentList.length === 0) return {};
      
      const itemsToAnalyze = isPaps ? allItems.filter(i => i.isPaps) : allItems.filter(i => !i.isPaps && i.goal);
      const averageData: Record<string, { totalPercentage: number, totalValue: number, count: number, unit: string }> = {};
      
      const studentIds = new Set(studentList.map(s => s.id));
      
      itemsToAnalyze.forEach(item => {
        if (!averageData[item.name]) {
            averageData[item.name] = { totalPercentage: 0, totalValue: 0, count: 0, unit: item.unit };
        }
        studentList.forEach(student => {
             const latestRecord = allRecords
                .filter(r => r.studentId === student.id && r.item === item.name)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            if (latestRecord) {
              if (isPaps) {
                const grade = getPapsGrade(item.name, student, latestRecord.value);
                if (grade !== null) {
                    averageData[item.name].totalPercentage += normalizePapsRecord(grade);
                    averageData[item.name].totalValue += latestRecord.value;
                    averageData[item.name].count++;
                }
              } else {
                 const achievement = normalizeCustomRecord(item, latestRecord.value);
                 averageData[item.name].totalPercentage += achievement;
                 averageData[item.name].totalValue += latestRecord.value;
                 averageData[item.name].count++;
              }
            }
        });
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
    
    const itemsToAnalyze = comparisonType === 'paps' ? allItems.filter(i => i.isPaps) : allItems.filter(i => !i.isPaps && i.goal);

    let comparisonTargetData: Record<string, { percentage: number, avgValue: number, unit: string, rank?: string }> = {};
    let label = '선택 대상';
    let gradeForRanks = selectedStudent?.grade || selectedGrade;

    if(selectedStudent) {
        const allItemRanks = calculateRanks(school, allItems, allRecords, allStudents, gradeForRanks);
        label = selectedStudent.name;
        const studentRecordsForComparison = allRecords.filter(r => r.studentId === selectedStudent.id);
        const latestRecords: Record<string, MeasurementRecord> = {};
        
        studentRecordsForComparison.forEach(r => {
            if (!latestRecords[r.item] || new Date(r.date) > new Date(latestRecords[r.item].date)) {
                latestRecords[r.item] = r;
            }
        });

        itemsToAnalyze.forEach(item => {
          const record = latestRecords[item.name];
          if (record) {
            let percentage: number | null = null;
            if (comparisonType === 'paps') {
              const grade = getPapsGrade(item.name, selectedStudent, record.value);
              if (grade !== null) percentage = normalizePapsRecord(grade);
            } else {
              percentage = normalizeCustomRecord(item, record.value);
            }

            if (percentage !== null) {
              const rankInfo = allItemRanks[item.name]?.find(r => r.studentId === selectedStudent.id);
              comparisonTargetData[item.name] = {
                  percentage: percentage,
                  avgValue: record.value,
                  unit: item.unit,
                  rank: rankInfo ? `같은 학년 ${allItemRanks[item.name].length}명 중 ${rankInfo.rank}등` : undefined
              };
            }
          }
        });
    } else if (filteredStudentsByClass.length > 0) {
        label = `${selectedGrade}학년 ${selectedClassNum}반 평균`;
        comparisonTargetData = calculateAverageGrades(filteredStudentsByClass, comparisonType === 'paps');
    }
    
    const studentsForOverallAverage = selectedGrade ? allStudents.filter(s => s.grade === selectedGrade) : allStudents;
    const overallAverageData = calculateAverageGrades(studentsForOverallAverage, comparisonType === 'paps');

    return {
        data: itemsToAnalyze.map(item => ({
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

  }, [selectedStudent, selectedGrade, selectedClassNum, filteredStudentsByClass, allRecords, allItems, allStudents, school, comparisonType]);
  
  const progressData = useMemo(() => {
    if (!progressChartItem || !selectedStudent || !school) return [];
    
    const itemInfo = allItems.find(i => i.name === progressChartItem);
    if (!itemInfo) return [];

    const itemRanks = calculateRanks(school, allItems, allRecords, allStudents, selectedStudent.grade)[progressChartItem] || [];

    return studentRecords
      .filter(r => r.item === progressChartItem)
      .map(r => {
          let grade: number | null = null;
          let achievement: number | null = null;

          if (itemInfo.isPaps) {
            grade = getPapsGrade(r.item, selectedStudent, r.value)
            if(grade) achievement = normalizePapsRecord(grade);
          } else {
            grade = getCustomItemGrade(itemInfo, r.value);
            if(grade) achievement = normalizeCustomRecord(itemInfo, r.value);
          }
          
          if (grade === null) return null;

          const rankInfo = itemRanks.find(rank => rank.studentId === r.studentId && rank.value === r.value);

          return { 
              date: r.date, 
              itemName: r.item,
              grade: grade,
              score: 6 - grade, // 1등급 -> 5점, 5등급 -> 1점
              achievement: achievement,
              value: r.value,
              unit: itemInfo.unit,
              rank: rankInfo ? `같은 학년 ${itemRanks.length}명 중 ${rankInfo.rank}등` : undefined
          }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [studentRecords, progressChartItem, selectedStudent, allItems, allRecords, allStudents, school]);
  
    const sortedStudentRecords = useMemo(() => {
        return [...studentRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [studentRecords]);
  
  const comparisonChartConfig = {
      target: { label: comparisonData.targetLabel, color: 'hsl(var(--chart-1))' },
      average: { label: `${selectedGrade || '전체'}학년 평균`, color: 'hsl(var(--chart-2))' },
  };
  
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedGrade('');
    setSelectedClassNum('');
    setSelectedStudent(null);
  }

  if (!school) return null;

  return (
    <>
      <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>동명이인 학생 선택</DialogTitle>
                  <DialogDescription>
                      검색된 학생 중 한 명을 선택해주세요.
                  </DialogDescription>
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
                          {foundStudents.map((student) => (
                              <TableRow key={student.id}>
                                  <TableCell>{student.name}</TableCell>
                                  <TableCell>{student.grade}</TableCell>
                                  <TableCell>{student.classNum}</TableCell>
                                  <TableCell>{student.studentNum}</TableCell>
                                  <TableCell className="text-right">
                                      <Button size="sm" onClick={() => handleStudentSelectionFromDialog(student)}>
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
              <p className="text-center text-muted-foreground">분석할 학생을 검색하거나 학급을 선택해주세요.</p>
            </div>
          )}

          {selectedStudent ? (
              <div className="space-y-8">
                  <h2 className="text-2xl font-bold mb-6">{selectedStudent.name} ({selectedStudent.grade}-{selectedStudent.classNum}) 학생 분석</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>성취도 비교 ({comparisonData.targetLabel} vs 학년 평균)</CardTitle>
                          <Select value={comparisonType} onValueChange={(v) => setComparisonType(v as 'paps' | 'custom')}>
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="paps">PAPS</SelectItem>
                                <SelectItem value="custom">기타</SelectItem>
                              </SelectContent>
                          </Select>
                        </div>
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
                            <Bar dataKey="target" name={comparisonChartConfig.target.label} fill="var(--color-target)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="average" name={comparisonChartConfig.average.label} fill="var(--color-average)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>회차별 성장 그래프</CardTitle>
                          <Select value={progressChartItem} onValueChange={setProgressChartItem}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="종목 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <CardDescription>등급(막대)과 기록 성취도(선)의 변화를 확인하세요.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                          <ComposedChart data={progressData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" />
                            <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-2))" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={(value) => `${6 - value}등급`} name="등급" />
                            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-1))" domain={[0, 100]} unit="%" name="성취도" />
                            <Tooltip content={<CustomTooltipContent />} />
                            <Legend />
                             <Bar dataKey="score" yAxisId="left" fill="var(--color-score)" name="등급" radius={[4, 4, 0, 0]} barSize={20}/>
                             <Line dataKey="achievement" yAxisId="right" type="monotone" stroke="var(--color-achievement)" strokeWidth={2} dot={true} name="성취도" />
                          </ComposedChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <Card>
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

                      <Card>
                          <CardHeader>
                              <CardTitle>기록 추가/수정</CardTitle>
                              <CardDescription>특정 날짜의 기록을 추가하거나, 기존 기록을 수정합니다.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <Popover>
                                  <PopoverTrigger asChild>
                                  <Button
                                      variant={"outline"}
                                      className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !recordDate && "text-muted-foreground"
                                      )}
                                  >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {recordDate ? format(recordDate, "PPP") : <span>날짜 선택</span>}
                                  </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                  <Calendar
                                      mode="single"
                                      selected={recordDate}
                                      onSelect={setRecordDate}
                                      initialFocus
                                  />
                                  </PopoverContent>
                              </Popover>
                              <Select onValueChange={setSelectedItemName} value={selectedItemName}>
                                  <SelectTrigger>
                                      <SelectValue placeholder="측정 종목 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {allItems.map(item => (
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
                          </CardContent>
                          <CardFooter>
                              <Button onClick={handleAddRecord} disabled={isSubmitting} className="w-full">
                                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  결과 저장
                              </Button>
                          </CardFooter>
                      </Card>
                  </div>
                  
                  <Card>
                      <CardHeader>
                          <CardTitle>전체 측정 기록</CardTitle>
                          <CardDescription>선택된 학생의 모든 측정 기록입니다. 잘못 입력된 기록은 삭제할 수 있습니다.</CardDescription>
                      </CardHeader>
                      <CardContent>
                      <Table>
                          <TableHeader>
                          <TableRow>
                              <TableHead>날짜</TableHead>
                              <TableHead>종목</TableHead>
                              <TableHead>기록</TableHead>
                              <TableHead className="text-right">작업</TableHead>
                          </TableRow>
                          </TableHeader>
                          <TableBody>
                          {sortedStudentRecords.length > 0 ? (
                              sortedStudentRecords.map((record) => {
                              const item = allItems.find(i => i.name === record.item);
                              return (
                                  <TableRow key={record.id}>
                                  <TableCell>{record.date}</TableCell>
                                  <TableCell>{record.item}</TableCell>
                                  <TableCell>{record.value}{item?.unit}</TableCell>
                                  <TableCell className="text-right">
                                      <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                          <AlertDialogHeader>
                                          <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                              이 작업은 되돌릴 수 없습니다. 이 기록이 영구적으로 삭제됩니다.
                                          </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                          <AlertDialogCancel>취소</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteRecord(record.id)}>삭제</AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                      </AlertDialog>
                                  </TableCell>
                                  </TableRow>
                              );
                              })
                          ) : (
                              <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center">
                                  측정된 기록이 없습니다.
                              </TableCell>
                              </TableRow>
                          )}
                          </TableBody>
                      </Table>
                      </CardContent>
                  </Card>
              </div>
          ) : filteredStudentsByClass.length > 0 && (
              <div className="space-y-8">
                  <h2 className="text-2xl font-bold">{selectedGrade}학년 {selectedClassNum}반 분석 및 기록</h2>
                  <Card>
                      <CardHeader className="flex-row items-start justify-between">
                        <div>
                          <CardTitle>성취도 비교 ({comparisonData.targetLabel} vs 학년 평균)</CardTitle>
                          <CardDescription>100%에 가까울수록 성취도가 높습니다.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Select value={comparisonType} onValueChange={(v) => setComparisonType(v as 'paps' | 'custom')}>
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="paps">PAPS</SelectItem>
                                <SelectItem value="custom">기타</SelectItem>
                              </SelectContent>
                          </Select>
                          <AiWelcome 
                            itemType='paps' 
                            title="학급 AI 브리핑" 
                            students={filteredStudentsByClass} 
                            items={allItems} 
                            records={allRecords} 
                          />
                        </div>
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
                            <Bar dataKey="target" name={comparisonChartConfig.target.label} fill="var(--color-target)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="average" name={comparisonChartConfig.average.label} fill="var(--color-average)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                          <CardTitle>학급 학생 목록 정렬</CardTitle>
                          <CardDescription>학생을 선택하여 개별 기록을 조회하거나, 목록을 정렬하여 성취도를 비교할 수 있습니다.</CardDescription>
                          <div className="flex flex-wrap items-center gap-2 pt-4">
                              <span className="text-sm font-medium">정렬 기준:</span>
                              <Select value={sortItem} onValueChange={setSortItem}>
                                  <SelectTrigger className="w-full sm:w-[180px]">
                                      <SelectValue placeholder="정렬 종목 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
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

                  <Card>
                      <CardHeader>
                          <CardTitle>학급별 측정 기록</CardTitle>
                          <CardDescription>수업 중 측정한 결과를 학급 전체에 대해 한 번에 입력하고 저장할 수 있습니다.</CardDescription>
                          <div className="flex flex-wrap items-center gap-2 pt-4">
                              <Popover>
                                  <PopoverTrigger asChild>
                                  <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !batchRecordDate && "text-muted-foreground")}>
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {batchRecordDate ? format(batchRecordDate, "PPP") : <span>날짜 선택</span>}
                                  </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                      <Calendar mode="single" selected={batchRecordDate} onSelect={setBatchRecordDate} initialFocus />
                                  </PopoverContent>
                              </Popover>
                              <Select value={batchRecordItem} onValueChange={setBatchRecordItem}>
                                  <SelectTrigger className="w-full sm:w-[180px]">
                                      <SelectValue placeholder="측정 종목 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <Button onClick={handleSaveBatchRecords} disabled={isBatchSubmitting} className="ml-auto">
                                  {isBatchSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  학급 전체 기록 저장
                              </Button>
                          </div>
                      </CardHeader>
                      <CardContent>
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>번호</TableHead>
                                      <TableHead>이름</TableHead>
                                      <TableHead>기록 ({allItems.find(i=>i.name === batchRecordItem)?.unit})</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {filteredStudentsByClass.map(student => (
                                      <TableRow key={student.id}>
                                          <TableCell>{student.studentNum}</TableCell>
                                          <TableCell>{student.name}</TableCell>
                                          <TableCell>
                                              <Input
                                                  type="number"
                                                  value={batchRecords[student.id] || ''}
                                                  onChange={(e) => handleBatchRecordChange(student.id, e.target.value)}
                                                  className="max-w-[120px]"
                                              />
                                          </TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </CardContent>
                  </Card>
              </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
