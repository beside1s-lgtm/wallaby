'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getItems, addOrUpdateRecord, getRecordsByStudent } from '@/lib/store';
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
  ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getStudentFeedback } from '@/ai/flows/student-ai-feedback';
import { Loader2, Wand2 } from 'lucide-react';
import type { Student, MeasurementRecord } from '@/lib/types';

const chartColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const student = user as Student;

  const [measurementItems, setMeasurementItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [value, setValue] = useState('');
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [aiFeedback, setAiFeedback] = useState('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [lastSubmittedRecord, setLastSubmittedRecord] = useState<{item: string, value: string} | null>(null);

  const [chartFilter, setChartFilter] = useState('all');

  useEffect(() => {
    if (student?.id) {
      setMeasurementItems(getItems());
      setRecords(getRecordsByStudent(student.id));
    }
  }, [student]);

  const handleSubmit = () => {
    if (!selectedItem || !value) {
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
    
    const newRecord = addOrUpdateRecord({
      studentId: student.id,
      item: selectedItem,
      value: numericValue,
    });

    setRecords(getRecordsByStudent(student.id));
    setLastSubmittedRecord({ item: selectedItem, value: String(numericValue) });
    setAiFeedback('');
    
    toast({
      title: '기록 저장 완료',
      description: `${selectedItem} 기록이 ${numericValue}으로 저장/업데이트되었습니다.`,
    });
    
    setValue('');
    setIsSubmitting(false);
  };
  
  const handleGetFeedback = async () => {
    if (!lastSubmittedRecord) return;
    
    setIsFeedbackLoading(true);
    try {
      const feedbackInput = {
        studentName: student.name,
        grade: student.grade,
        classNumber: student.classNum,
        studentNumber: student.studentNum,
        exerciseType: lastSubmittedRecord.item,
        performanceResults: `${lastSubmittedRecord.item} 결과: ${lastSubmittedRecord.value}`
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

  const { chartData, chartConfig } = useMemo(() => {
    const filteredRecords = chartFilter === 'all' 
      ? records 
      : records.filter(r => r.item === chartFilter);
    
    const uniqueItems = [...new Set(filteredRecords.map(r => r.item))];
    const config: ChartConfig = {};
    uniqueItems.forEach((item, index) => {
      config[item] = {
        label: item,
        color: chartColors[index % chartColors.length],
      };
    });

    const dataByDate = filteredRecords.reduce((acc, record) => {
      if (!acc[record.date]) {
        acc[record.date] = { date: record.date };
      }
      acc[record.date][record.item] = record.value;
      return acc;
    }, {} as Record<string, { date: string } & Record<string, number>>);

    const data = Object.values(dataByDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return { chartData: data, chartConfig: config };
  }, [records, chartFilter]);

  if (!student) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <h1 className="text-3xl font-bold text-primary font-headline">
        {student.name} 학생 대시보드
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>측정 결과 입력</CardTitle>
            <CardDescription>오늘의 측정 결과를 입력하세요. 같은 날짜에 다시 입력하면 덮어쓰기됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <Select onValueChange={setSelectedItem} value={selectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="측정 종목 선택" />
              </SelectTrigger>
              <SelectContent>
                {measurementItems.map(item => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="측정 결과 (숫자만 입력)"
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
              <p className="text-sm text-muted-foreground">결과를 저장하고 AI 피드백을 받아보세요.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGetFeedback}
              disabled={!lastSubmittedRecord || isFeedbackLoading || !!aiFeedback}
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
                <CardTitle>나의 성장 기록</CardTitle>
                <CardDescription>지금까지의 측정 결과 변화를 확인해보세요.</CardDescription>
            </div>
            <Select onValueChange={setChartFilter} value={chartFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="종목 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 종목</SelectItem>
                {measurementItems.map(item => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
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
