'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudents, getRecords, getItems } from '@/lib/store';
import { Student, MeasurementRecord } from '@/lib/types';
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyzeStudentPerformance } from '@/ai/flows/teacher-ai-assistant';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Wand2 } from 'lucide-react';

type AiAnalysis = {
  strengths: string;
  weaknesses: string;
  suggestedTrainingMethods: string;
};

export default function Analytics() {
  const { school } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<MeasurementRecord[]>([]);
  const [allRecords, setAllRecords] = useState<MeasurementRecord[]>([]);
  const [allItems, setAllItems] = useState<string[]>([]);
  const [progressChartItem, setProgressChartItem] = useState<string>('');
  
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const students = useMemo(() => school ? getStudents(school) : [], [school]);

  useEffect(() => {
    if (school) {
        setAllItems(getItems(school));
        setAllRecords(getRecords(school));
    }
  }, [school]);

  const handleSearch = () => {
    if (!school) return;
    const student = students.find(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (student) {
      setSelectedStudent(student);
      const studentRecs = allRecords.filter(r => r.studentId === student.id);
      setStudentRecords(studentRecs);
      setProgressChartItem(allItems[0] || '');
      setAiAnalysis(null);
    } else {
      setSelectedStudent(null);
      setStudentRecords([]);
    }
  };

  const handleAiAnalysis = async () => {
    if (!selectedStudent || studentRecords.length === 0 || !school) return;
    setIsAiLoading(true);
    try {
      const performanceData = JSON.stringify(studentRecords.map(r => ({ item: r.item, value: r.value, date: r.date })));
      const result = await analyzeStudentPerformance({
        school,
        studentName: selectedStudent.name,
        performanceData,
      });
      setAiAnalysis(result);
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const comparisonData = useMemo(() => {
    if (!selectedStudent || studentRecords.length === 0 || allRecords.length === 0) return [];
    
    const latestStudentRecords: Record<string, MeasurementRecord> = {};
    studentRecords.forEach(record => {
      if (!latestStudentRecords[record.item] || new Date(record.date) > new Date(latestStudentRecords[record.item].date)) {
        latestStudentRecords[record.item] = record;
      }
    });

    const averageRecords: Record<string, { sum: number, count: number }> = {};
    allRecords.forEach(record => {
      if (!averageRecords[record.item]) {
        averageRecords[record.item] = { sum: 0, count: 0 };
      }
      averageRecords[record.item].sum += record.value;
      averageRecords[record.item].count++;
    });

    return allItems.map(item => ({
      name: item,
      student: latestStudentRecords[item]?.value || 0,
      average: averageRecords[item] ? parseFloat((averageRecords[item].sum / averageRecords[item].count).toFixed(2)) : 0,
    }));
  }, [selectedStudent, studentRecords, allRecords, allItems]);
  
  const progressData = useMemo(() => {
    if (!progressChartItem) return [];
    return studentRecords
      .filter(r => r.item === progressChartItem)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [studentRecords, progressChartItem]);
  
  const comparisonChartConfig = {
      student: { label: selectedStudent?.name || '학생', color: 'hsl(var(--chart-1))' },
      average: { label: '전체 평균', color: 'hsl(var(--chart-2))' },
  } satisfies ChartConfig;

  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>학생 기록 조회 및 분석</CardTitle>
        <CardDescription>학생 이름을 검색하여 상세 기록과 AI 분석을 확인하세요.</CardDescription>
        <div className="flex w-full max-w-sm items-center space-x-2 pt-4">
          <Input 
            type="text" 
            placeholder="학생 이름 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button type="button" onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> 검색</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {!selectedStudent && <p className="text-center text-muted-foreground">분석할 학생을 검색해주세요.</p>}
        {selectedStudent && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{selectedStudent.name} ({selectedStudent.grade}-{selectedStudent.classNum}) 학생 분석</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>기록 비교 (학생 vs 전체 평균)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={comparisonChartConfig} className="h-[300px] w-full">
                    <BarChart data={comparisonData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" height={60} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="student" fill="var(--color-student)" radius={4} />
                      <Bar dataKey="average" fill="var(--color-average)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>회차별 기록 변화</CardTitle>
                    <Select value={progressChartItem} onValueChange={setProgressChartItem}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="종목 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {allItems.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[300px] w-full">
                    <LineChart data={progressData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" name={progressChartItem} stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
            
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

          </div>
        )}
      </CardContent>
    </Card>
  );
}
