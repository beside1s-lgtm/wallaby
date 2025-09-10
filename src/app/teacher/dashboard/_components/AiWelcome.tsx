'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getRecords, getStudents } from '@/lib/store';
import { getTeacherDashboardBriefing } from '@/ai/flows/teacher-ai-dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, BarChart2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type BriefingData = {
  briefing: string;
  advice: string;
};

export default function AiWelcome() {
  const { school } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);

  useEffect(() => {
    const welcomeShown = sessionStorage.getItem('welcomeShown');
    if (!welcomeShown && school) {
      setIsOpen(true);
      sessionStorage.setItem('welcomeShown', 'true');

      const fetchBriefing = async () => {
        try {
          const allRecords = getRecords(school);
          const allStudents = getStudents(school);
          
          if (allRecords.length === 0) {
            setBriefingData({
              briefing: '기록된 데이터가 없습니다.',
              advice: '학생들의 기록을 입력하여 분석을 시작해보세요.',
            });
            return;
          }

          const averageMeasurements: Record<string, number> = {};
          const recordCounts: Record<string, number> = {};
          
          allRecords.forEach(record => {
            if (!averageMeasurements[record.item]) {
              averageMeasurements[record.item] = 0;
              recordCounts[record.item] = 0;
            }
            averageMeasurements[record.item] += record.value;
            recordCounts[record.item]++;
          });

          for (const item in averageMeasurements) {
            averageMeasurements[item] /= recordCounts[item];
            averageMeasurements[item] = parseFloat(averageMeasurements[item].toFixed(2));
          }

          const result = await getTeacherDashboardBriefing({
            school,
            averageMeasurements,
            totalStudentCount: allStudents.length,
            studentRankings: {},
          });
          setBriefingData(result);
        } catch (error) {
          console.error('Failed to get AI briefing:', error);
          setBriefingData({
            briefing: 'AI 브리핑을 불러오는 데 실패했습니다.',
            advice: '네트워크 연결을 확인하거나 나중에 다시 시도해주세요.',
          });
        } finally {
          setIsLoading(false);
        }
      };

      fetchBriefing();
    } else {
        setIsLoading(false);
    }
  }, [school]);

  const chartData = useMemo(() => {
    if (!briefingData || !school) return [];
    const allRecords = getRecords(school);
    if(allRecords.length === 0) return [];

    const averages = allRecords.reduce((acc, record) => {
        if (!acc[record.item]) {
            acc[record.item] = { sum: 0, count: 0 };
        }
        acc[record.item].sum += record.value;
        acc[record.item].count++;
        return acc;
    }, {} as Record<string, { sum: number, count: number }>);
    
    return Object.entries(averages).map(([name, {sum, count}]) => ({
        name,
        average: parseFloat((sum / count).toFixed(2)),
    }));
  }, [briefingData, school]);

  if (!isOpen || !school) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-headline">{school} AI 수업 브리핑</DialogTitle>
          <DialogDescription>
            전체 학생의 평균 데이터를 기반으로 AI가 생성한 요약 및 조언입니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : briefingData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-primary" />
                        종목별 평균 기록
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-accent" />
                      종합 브리핑
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{briefingData.briefing}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    수업 조언
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{briefingData.advice}</p>
                </CardContent>
              </Card>

            </div>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setIsOpen(false)}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
