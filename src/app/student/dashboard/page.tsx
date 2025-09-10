'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getItems, addOrUpdateRecord, getRecordsByStudent, getStudentById } from '@/lib/store';
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getStudentFeedback } from '@/ai/flows/student-ai-feedback';
import { Loader2, Wand2 } from 'lucide-react';
import type { Student, MeasurementRecord, MeasurementItem } from '@/lib/types';
import { getPapsGrade } from '@/lib/paps';

const chartColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const originalRecord = payload[0].payload.originalRecord;
    return (
      <div className="p-2 text-sm bg-background/90 border rounded-md shadow-lg">
        <p className="font-bold">{label}</p>
        {payload.map((p: any) => (
            <div key={p.dataKey} style={{ color: p.color }}>
                <p>{`${p.name}: ${p.value}등급`}</p>
                <p className="text-xs text-muted-foreground">{`원래 기록: ${originalRecord[p.dataKey]?.value} ${originalRecord[p.dataKey]?.unit}`}</p>
            </div>
        ))}
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

  const fullStudent = useMemo(() => {
    if (student?.id && school) {
      return getStudentById(school, student.id);
    }
    return student;
  }, [student, school])

  useEffect(() => {
    if (student?.id && school) {
      setMeasurementItems(getItems(school));
      setRecords(getRecordsByStudent(school, student.id));
    }
  }, [student, school]);
  
  const selectedItem = useMemo(() => {
      return measurementItems.find(item => item.name === selectedItemName);
  }, [selectedItemName, measurementItems]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedItem) return "측정 결과 (숫자만 입력)";
    return `결과 (${selectedItem.unit})`;
  }, [selectedItem]);


  const handleSubmit = () => {
    if (!selectedItemName || !value || !school) {
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
    
    addOrUpdateRecord({
      studentId: student.id,
      school: school,
      item: selectedItemName,
      value: numericValue,
    });

    setRecords(getRecordsByStudent(school, student.id));
    setAiFeedback('');
    
    toast({
      title: '기록 저장 완료',
      description: `${selectedItemName} 기록이 ${numericValue}${selectedItem?.unit}으로 저장/업데이트되었습니다.`,
    });
    
    setValue('');
    setSelectedItemName('');
    setIsSubmitting(false);
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
        performanceResults: `최근 기록\n${performanceResults}`
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
    if (!fullStudent) return { chartData: [], chartConfig: {}, availableItems: [] };
    
    const itemsToShow = measurementItems.filter(item => {
        if (chartFilter === 'paps') return item.isPaps;
        if (chartFilter === 'custom') return !item.isPaps;
        return true; // 'all'
    });

    const recordsToShow = records.filter(r => itemsToShow.some(item => item.name === r.item));

    const filteredRecords = chartItemFilter === 'all' 
      ? recordsToShow 
      : recordsToShow.filter(r => r.item === chartItemFilter);
    
    const dataByDate: Record<string, { date: string, originalRecord: Record<string, {value: number, unit: string}> } & Record<string, number>> = {};

    filteredRecords.forEach(record => {
        const itemInfo = measurementItems.find(i => i.name === record.item);
        if (!itemInfo) return;

        const grade = getPapsGrade(record.item, fullStudent.gender, record.value);
        if (grade === null) return;

        if (!dataByDate[record.date]) {
            dataByDate[record.date] = { date: record.date, originalRecord: {} };
        }
        dataByDate[record.date][record.item] = grade;
        dataByDate[record.date].originalRecord[record.item] = { value: record.value, unit: itemInfo.unit };
    });
    
    const uniqueItems = [...new Set(Object.values(dataByDate).flatMap(d => Object.keys(d).filter(k => k !== 'date' && k !== 'originalRecord')))];

    const config: Record<string, any> = {};
    uniqueItems.forEach((itemName, index) => {
      config[itemName] = {
        label: `${itemName}`,
        color: chartColors[index % chartColors.length],
      };
    });

    const data = Object.values(dataByDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return { chartData: data, chartConfig: config, availableItems: itemsToShow.filter(item => getPapsGrade(item.name, fullStudent.gender, 0) !== null) };
  }, [records, chartFilter, chartItemFilter, measurementItems, fullStudent]);

  if (!fullStudent || !school) {
    return null;
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
                <CardTitle>나의 성장 기록 (PAPS 등급)</CardTitle>
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
    </div>
  );
}
