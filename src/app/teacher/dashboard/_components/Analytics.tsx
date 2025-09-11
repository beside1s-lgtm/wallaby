'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudents, getRecords, getItems, addOrUpdateRecord } from '@/lib/store';
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyzeStudentPerformance } from '@/ai/flows/teacher-ai-assistant';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Wand2, UserPlus, FileUp, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPapsGrade } from '@/lib/paps';
import { parseCsv, exportToCsv, exportToZip } from '@/lib/utils';
import { addOrUpdateRecords } from '@/lib/store';

type AiAnalysis = {
  strengths: string;
  weaknesses: string;
  suggestedTrainingMethods: string;
};

export default function Analytics() {
  const { school } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
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

  const students = useMemo(() => school ? getStudents(school) : [], [school]);
  const measurementItems = useMemo(() => school ? getItems(school) : [], [school]);

  useEffect(() => {
    if (school) {
        const items = getItems(school);
        const papsItems = items.filter(i => getPapsGrade(i.name, '남', 0) !== null);
        setAllItems(papsItems);
        setAllRecords(getRecords(school));
        if (papsItems.length > 0) {
            setProgressChartItem(papsItems[0].name);
        }
    }
  }, [school]);

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

  const handleSearch = () => {
    if (!school) return;
    const student = students.find(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (student) {
      setSelectedStudent(student);
      const studentRecs = allRecords.filter(r => r.studentId === student.id);
      setStudentRecords(studentRecs);
      setAiAnalysis(null);
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
      const performanceData = JSON.stringify(studentRecords.map(r => {
          const itemInfo = allItems.find(item => item.name === r.item) ?? getItems(school).find(item => item.name === r.item);
          return { item: r.item, value: r.value, date: r.date, recordType: itemInfo?.recordType || 'count' }
        }));
      const result = await analyzeStudentPerformance({
        school,
        studentName: selectedStudent.name,
        performanceData,
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

  const comparisonData = useMemo(() => {
    if (!selectedStudent || allRecords.length === 0) return [];
    
    const studentLatestGrades: Record<string, number> = {};
    const studentRecordsForComparison = allRecords.filter(r => r.studentId === selectedStudent.id);
    
    allItems.forEach(item => {
      const recordsForItem = studentRecordsForComparison
        .filter(r => r.item === item.name)
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (recordsForItem.length > 0) {
        const grade = getPapsGrade(item.name, selectedStudent.gender, recordsForItem[0].value);
        if (grade !== null) {
          studentLatestGrades[item.name] = grade;
        }
      }
    });

    const averageGrades: Record<string, number> = {};
    allItems.forEach(item => {
      const itemRecords = allRecords.filter(r => r.item === item.name);
      if (itemRecords.length > 0) {
        const totalGrades = itemRecords.reduce((sum, record) => {
          const student = students.find(s => s.id === record.studentId);
          if (student) {
            const grade = getPapsGrade(item.name, student.gender, record.value);
            if (grade !== null) return sum + grade;
          }
          return sum;
        }, 0);
        const validRecordsCount = itemRecords.filter(r => {
            const student = students.find(s => s.id === r.studentId);
            return student && getPapsGrade(item.name, student.gender, r.value) !== null;
        }).length;

        if (validRecordsCount > 0) {
            averageGrades[item.name] = parseFloat((totalGrades / validRecordsCount).toFixed(2));
        }
      }
    });

    return allItems.map(item => ({
      name: item.name,
      student: studentLatestGrades[item.name] || 0,
      average: averageGrades[item.name] || 0,
    })).filter(d => d.student > 0 || d.average > 0);

  }, [selectedStudent, allRecords, allItems, students]);
  
  const progressData = useMemo(() => {
    if (!progressChartItem || !selectedStudent) return [];
    const allItemsList = getItems(school);
    return studentRecords
      .filter(r => r.item === progressChartItem)
      .map(r => {
          const itemInfo = allItemsList.find(i => i.name === r.item);
          if (!itemInfo) return {date: r.date, value: null};
          const grade = itemInfo.isPaps 
                ? getPapsGrade(r.item, selectedStudent.gender, r.value)
                : getPapsGrade(r.item, selectedStudent.gender, r.value);
          return { date: r.date, value: grade }
      })
      .filter(r => r.value !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [studentRecords, progressChartItem, selectedStudent, school]);
  
  const comparisonChartConfig = {
      student: { label: selectedStudent?.name || '학생', color: 'hsl(var(--chart-1))' },
      average: { label: '전체 평균', color: 'hsl(var(--chart-2))' },
  };

  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>학생 기록 조회 및 분석</CardTitle>
        <CardDescription>학생 이름을 검색하여 상세 기록과 AI 분석을 확인하고, 기록을 추가/관리할 수 있습니다.</CardDescription>
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
        {!selectedStudent && (
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
            <p className="text-center text-muted-foreground">분석할 학생을 검색해주세요.</p>
          </div>
        )}

        {selectedStudent && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{selectedStudent.name} ({selectedStudent.grade}-{selectedStudent.classNum}) 학생 분석</h2>
            
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>PAPS 등급 비교 (학생 vs 전체 평균)</CardTitle>
                  <CardDescription>1등급이 가장 높음</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={comparisonChartConfig} className="h-[300px] w-full">
                    <BarChart data={comparisonData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" height={80} interval={0} />
                      <YAxis reversed={true} domain={[1, 5]} ticks={[1,2,3,4,5]} tickCount={5} />
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
                   <CardDescription>1등급이 가장 높음</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[300px] w-full">
                    <LineChart data={progressData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis reversed={true} domain={[1, 5]} ticks={[1,2,3,4,5]} tickCount={5} />
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
