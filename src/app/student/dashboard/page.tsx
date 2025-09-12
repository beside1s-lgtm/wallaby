'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getItems, addOrUpdateRecord, getRecordsByStudent, getStudentById, calculateRanks, deleteRecord } from '@/lib/store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getStudentFeedback } from '@/ai/flows/student-ai-feedback';
import { Loader2, Wand2, Trash2 } from 'lucide-react';
import type { Student, MeasurementRecord, MeasurementItem } from '@/lib/types';
import { getPapsGrade, getCustomItemGrade } from '@/lib/paps';
import { getStudents, getRecords } from '@/lib/store';

const chartColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const { originalRecord, rank } = payload[0].payload;
    return (
      <div className="p-2 text-sm bg-background/90 border rounded-md shadow-lg">
        <p className="font-bold">{label}</p>
        {payload.map((p: any) => (
            <div key={p.dataKey} style={{ color: p.color }}>
                <p>{`${p.name}: ${p.value}등급 (${originalRecord[p.dataKey]?.value}${originalRecord[p.dataKey]?.unit})`}</p>
            </div>
        ))}
         {rank && <p className="text-muted-foreground mt-1">{rank}</p>}
      </div>
    );
  }
  return null;
};

export default function StudentDashboardPage() {
  const { user, school } = useAuth();
  const { toast } = useToast();
  const student = user as Student;

  const [measurementItems, setMeasurementItems] = useState<MeasurementItem[]>([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [value, setValue] = useState('');
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [aiFeedback, setAiFeedback] = useState('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  const [chartFilter, setChartFilter] = useState<'all' | 'paps' | 'custom'>('all');
  const [chartItemFilter, setChartItemFilter] = useState('all');
  
  const [fullStudent, setFullStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allRecords, setAllRecords] = useState<MeasurementRecord[]>([]);

  useEffect(() => {
    async function loadData() {
        if (student?.id && school) {
            try {
                const [items, recs, stud, allStuds, allRecs] = await Promise.all([
                    getItems(school),
                    getRecordsByStudent(school, student.id),
                    getStudentById(school, student.id),
                    getStudents(school),
                    getRecords(school),
                ]);
                setMeasurementItems(items);
                setRecords(recs);
                setFullStudent(stud || null);
                setAllStudents(allStuds);
                setAllRecords(allRecs);
            } catch (error) {
                console.error("Failed to load student data", error);
                toast({ variant: 'destructive', title: '데이터 로딩 실패' });
            }
        }
    }
    loadData();
  }, [student?.id, school, toast]);
  
  const selectedItem = useMemo(() => {
      return measurementItems.find(item => item.name === selectedItemName);
  }, [selectedItemName, measurementItems]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedItem) return "측정 결과 (숫자만 입력)";
    return `결과 (${selectedItem.unit})`;
  }, [selectedItem]);

  const fetchRecords = async () => {
      if (!school || !student) return;
      const updatedRecords = await getRecordsByStudent(school, student.id);
      const updatedAllRecords = await getRecords(school);
      setRecords(updatedRecords);
      setAllRecords(updatedAllRecords);
  }

  const handleSubmit = async () => {
    if (!selectedItemName || !value || !school || !student) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '측정 종목과 결과를 모두 입력해주세요.',
      });
      return;
    }
    
    setIsSubmitting(true);
    const numericValue = parseFloat(value);
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
            studentId: student.id,
            school: school,
            item: selectedItemName,
            value: numericValue,
        });

        await fetchRecords();
        setAiFeedback('');
        
        toast({
            title: '기록 저장 완료',
            description: `${selectedItemName} 기록이 ${numericValue}${selectedItem?.unit}으로 저장/업데이트되었습니다.`,
        });
        
        setValue('');
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
        await fetchRecords();
        toast({
            title: '기록 삭제 완료',
            description: '선택한 기록이 삭제되었습니다.',
        });
    } catch (error) {
        console.error("Failed to delete record:", error);
        toast({ variant: 'destructive', title: '삭제 실패', description: '기록 삭제 중 오류가 발생했습니다.'})
    }
  };
  
  const handleGetFeedback = async () => {
    if (!fullStudent || records.length === 0 || !school) {
        toast({
            variant: 'destructive',
            title: '피드백 생성 불가',
            description: '피드백을 생성하려면 먼저 기록을 하나 이상 입력해주세요.',
        });
        return;
    }
    
    setIsFeedbackLoading(true);
    try {
      const allItemRanks = calculateRanks(school, measurementItems, allRecords, allStudents, fullStudent.grade);
      const studentRanks: Record<string, string> = {};
       Object.entries(allItemRanks).forEach(([item, ranks]) => {
            const rankInfo = ranks.find(r => r.studentId === fullStudent.id);
            if(rankInfo) {
                studentRanks[item] = `${ranks.length}명 중 ${rankInfo.rank}등`;
            }
       });

      const performanceResults = records
        .map(r => {
            const itemInfo = measurementItems.find(item => item.name === r.item);
            return `${r.item}: ${r.value}${itemInfo?.unit || ''}`;
        })
        .join('\n');

      const feedbackInput = {
        school: school,
        studentName: fullStudent.name,
        grade: fullStudent.grade,
        classNumber: fullStudent.classNum,
        studentNumber: fullStudent.studentNum,
        gender: fullStudent.gender,
        exerciseType: '종합',
        performanceResults: `최근 기록\n${performanceResults}`,
        ranks: studentRanks,
      };
      const result = await getStudentFeedback(feedbackInput);
      setAiFeedback(result.feedback);
    } catch (error) {
      console.error('AI 피드백 요청 실패:', error);
      toast({
        variant: 'destructive',
        title: 'AI 피드백 오류',
        description: '피드백을 생성하는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const { chartData, chartConfig, availableItems } = useMemo(() => {
    if (!fullStudent || !school) return { chartData: [], chartConfig: {}, availableItems: [] };
    
    const allItemRanks = calculateRanks(school, measurementItems, allRecords, allStudents, fullStudent.grade);

    const itemsToShow = measurementItems.filter(item => {
        if (chartFilter === 'paps') return item.isPaps;
        if (chartFilter === 'custom') return !item.isPaps;
        return true; // 'all'
    });

    const recordsToShow = records.filter(r => itemsToShow.some(item => item.name === r.item));

    const filteredRecords = chartItemFilter === 'all' 
      ? recordsToShow 
      : recordsToShow.filter(r => r.item === chartItemFilter);
    
    const dataByDate: Record<string, { date: string, originalRecord: Record<string, {value: number, unit: string}>, rank?: string } & Record<string, number>> = {};

    filteredRecords.forEach(record => {
        const itemInfo = measurementItems.find(i => i.name === record.item);
        if (!itemInfo) return;

        let grade = null;
        if (itemInfo.isPaps) {
            grade = getPapsGrade(record.item, fullStudent, record.value);
        } else {
            grade = getCustomItemGrade(itemInfo, record.value);
        }
        
        if (grade === null) return;

        if (!dataByDate[record.date]) {
            dataByDate[record.date] = { date: record.date, originalRecord: {} };
        }
        dataByDate[record.date][record.item] = grade;
        dataByDate[record.date].originalRecord[record.item] = { value: record.value, unit: itemInfo.unit };
        
        const itemRanks = allItemRanks[record.item];
        if (itemRanks) {
            const studentRank = itemRanks.find(r => r.studentId === fullStudent.id && r.value === record.value);
            if (studentRank) {
                dataByDate[record.date].rank = `같은 학년 ${itemRanks.length}명 중 ${studentRank.rank}등`;
            }
        }
    });
    
    const uniqueItems = [...new Set(Object.values(dataByDate).flatMap(d => Object.keys(d).filter(k => k !== 'date' && k !== 'originalRecord' && k !== 'rank')))];

    const config: Record<string, any> = {};
    uniqueItems.forEach((itemName, index) => {
      config[itemName] = {
        label: `${itemName}`,
        color: chartColors[index % chartColors.length],
      };
    });

    const data = Object.values(dataByDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const itemsWithGrade = itemsToShow.filter(item => {
        if (item.isPaps) return getPapsGrade(item.name, fullStudent, 0) !== null; // check if it's a valid paps item for the gender
        return getCustomItemGrade(item, 0) !== null;
    });

    return { chartData: data, chartConfig: config, availableItems: itemsWithGrade };
  }, [records, chartFilter, chartItemFilter, measurementItems, fullStudent, school, allRecords, allStudents]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);


  if (!fullStudent || !school) {
    return (
         <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
         </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <h1 className="text-3xl font-bold text-primary font-headline">
        {school} {fullStudent.name} 학생 대시보드
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>측정 결과 입력</CardTitle>
            <CardDescription>오늘의 측정 결과를 입력하세요. 같은 날짜에 다시 입력하면 덮어쓰기됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <Select onValueChange={setSelectedItemName} value={selectedItemName}>
              <SelectTrigger>
                <SelectValue placeholder="측정 종목 선택" />
              </SelectTrigger>
              <SelectContent>
                {measurementItems.map(item => (
                  <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={inputPlaceholder}
              value={value}
              onChange={e => setValue(e.target.value)}
              type="number"
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              결과 저장
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>AI 피드백</CardTitle>
            <CardDescription>운동 수행 결과를 바탕으로 AI가 피드백을 제공합니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isFeedbackLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : aiFeedback ? (
              <p className="text-sm whitespace-pre-wrap">{aiFeedback}</p>
            ) : (
              <p className="text-sm text-muted-foreground">AI 피드백 받기 버튼을 눌러 피드백을 받아보세요.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGetFeedback}
              disabled={isFeedbackLoading || records.length === 0}
              className="w-full"
              variant="outline"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {isFeedbackLoading ? '피드백 생성 중...' : 'AI 피드백 받기'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle>나의 성장 기록 (등급)</CardTitle>
                <CardDescription>지금까지의 측정 결과 변화를 등급으로 확인해보세요. (1등급이 가장 높음)</CardDescription>
            </div>
            <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
                <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1 w-full sm:w-auto">
                    <Button variant={chartFilter === 'all' ? 'outline-active' : 'ghost'} size="sm" onClick={() => setChartFilter('all')} className="bg-background data-[active]:bg-primary data-[active]:text-primary-foreground">전체</Button>
                    <Button variant={chartFilter === 'paps' ? 'outline-active' : 'ghost'} size="sm" onClick={() => setChartFilter('paps')} className="bg-background data-[active]:bg-primary data-[active]:text-primary-foreground">PAPS</Button>
                    <Button variant={chartFilter === 'custom' ? 'outline-active' : 'ghost'} size="sm" onClick={() => setChartFilter('custom')} className="bg-background data-[active]:bg-primary data-[active]:text-primary-foreground">기타</Button>
                </div>
                 <Select onValueChange={setChartItemFilter} value={chartItemFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="종목 필터" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 종목</SelectItem>
                    {availableItems.map(item => (
                      <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis reversed={true} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickCount={5} />
                <ChartTooltip content={<CustomTooltip />} />
                <ChartLegend content={<ChartLegendContent />} />
                {Object.keys(chartConfig).map((key) => (
                  <Line key={key} dataKey={key} type="monotone" stroke={chartConfig[key].color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>전체 측정 기록</CardTitle>
          <CardDescription>지금까지의 모든 측정 기록입니다. 잘못 입력된 기록은 삭제할 수 있습니다.</CardDescription>
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
              {sortedRecords.length > 0 ? (
                sortedRecords.map((record) => {
                  const item = measurementItems.find(i => i.name === record.item);
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
  );
}
