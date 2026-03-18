'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart } from 'recharts';
import { Wand2, Trophy, Loader2, Info, LayoutDashboard } from 'lucide-react';
import type { Student, MeasurementRecord, MeasurementItem, ItemStatistics } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getPapsGrade, getCustomItemGrade } from '@/lib/paps';

interface GrowthRecordTabProps {
  records: MeasurementRecord[];
  activeItems: MeasurementItem[];
  allStudents: Student[];
  allRecords: MeasurementRecord[];
  statistics: ItemStatistics[];
  itemFilter: string;
  setItemFilter: (val: string) => void;
  onAiFeedback: () => void;
  aiFeedback: string;
  isFeedbackLoading: boolean;
  student: Student | null;
  isExtendedLoading?: boolean;
}

export function GrowthRecordTab({ 
  records, 
  activeItems, 
  statistics,
  itemFilter, 
  setItemFilter, 
  onAiFeedback, 
  aiFeedback, 
  isFeedbackLoading,
  student,
  isExtendedLoading
}: GrowthRecordTabProps) {
  const [hofGrade, setHofGrade] = useState<string>(student?.grade || 'all');
  
  const filteredRecords = useMemo(() => {
    if (!itemFilter || itemFilter === 'all') return [];
    return records
      .filter(r => r.item === itemFilter)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records, itemFilter]);

  const grades = useMemo(() => 
    ['4', '5', '6', '7', '8', '9', '10', '11', '12'],
    []
  );

  const filteredHallOfFameData = useMemo(() => {
    if (!student || activeItems.length === 0 || statistics.length === 0) return [];
    
    const measurementWeekItems = activeItems.filter(item => item.isMeasurementWeek && !item.isArchived && !item.isDeactivated);
    if (measurementWeekItems.length === 0) return [];
    
    return measurementWeekItems.map(item => {
      const itemStats = statistics.find(s => s.id === item.name);
      if (!itemStats) return { itemName: item.name, topStudents: [] };

      let studentsToDisplay = [];
      if (hofGrade === 'all') {
        // Find top 3 across all grades
        const allRanks = Object.values(itemStats.gradeStats).flatMap(g => g.topRanks);
        studentsToDisplay = allRanks
            .sort((a, b) => {
                if (item.recordType === 'time' || item.recordType === 'level') return a.value - b.value;
                return b.value - a.value;
            })
            .slice(0, 3);
      } else {
        studentsToDisplay = itemStats.gradeStats[hofGrade]?.topRanks.slice(0, 3) || [];
      }

      return {
        itemName: item.name,
        topStudents: studentsToDisplay.map(s => ({
          ...s,
          value: `${s.value}${item.unit}`,
          grade: hofGrade === 'all' ? undefined : hofGrade
        }))
      };
    }).filter(h => h.topStudents.length > 0);
  }, [activeItems, statistics, hofGrade, student]);

  const summaryData = useMemo(() => {
    if (itemFilter !== 'all' || !student) return [];

    return activeItems
      .filter(item => !item.isArchived && !item.isDeactivated)
      .map(item => {
        const myRecs = records.filter(r => r.item === item.name);
        const latest = myRecs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (!latest) return null;

        const itemStats = statistics.find(s => s.id === item.name);
        const average = itemStats?.gradeStats[student.grade]?.average || 0;

        let grade = item.isPaps ? getPapsGrade(item.name, student, latest.value) : getCustomItemGrade(item, latest.value);
        let priority = item.isPaps ? 1 : (item.category && item.category !== '기타' ? 2 : 3);

        return { name: item.name, value: latest.value, average, unit: item.unit, grade, priority };
      })
      .filter((d): d is any => d !== null)
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [records, activeItems, statistics, itemFilter, student]);

  const selectedItemInfo = useMemo(() => activeItems.find(i => i.name === itemFilter), [activeItems, itemFilter]);

  return (
    <div className="space-y-8 mt-6">
      <Card className="border-2 border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b bg-card">
          <div>
            <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
              {itemFilter === 'all' ? <><LayoutDashboard className="h-6 w-6" /> 나의 체력 분석</> : "나의 성장 기록"}
            </CardTitle>
            <CardDescription className="text-base font-bold">
              {itemFilter === 'all' 
                ? "학년 평균 대비 나의 위치를 확인하세요." 
                : <span className="text-foreground"><strong className="text-primary">{itemFilter}</strong> 기록 변화</span>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto bg-muted/30 p-1.5 rounded-xl border">
            <Select value={itemFilter} onValueChange={setItemFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background border-none shadow-none focus:ring-0 h-9 font-bold">
                <SelectValue placeholder="종목 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold">나의 체력 요약 (전체)</SelectItem>
                {activeItems.map((i) => (
                  <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          {itemFilter === 'all' ? (
            summaryData.length > 0 ? (
              <div className="space-y-10">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summaryData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }} barGap={-25}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                      <XAxis dataKey="name" fontSize={11} fontWeight="800" tickLine={false} axisLine={false} tickMargin={12} angle={-10} textAnchor="end" />
                      <YAxis fontSize={11} fontWeight="600" tickLine={false} axisLine={false} tickMargin={8} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '16px', fontWeight: 'bold' }}
                        formatter={(value: number, name: string, props: any) => [`${value}${props.payload.unit}`, name === 'value' ? '나의 기록' : '학년 평균']}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                      <Bar dataKey="average" name="학년 평균" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} barSize={45} animationDuration={1000} opacity={0.4} />
                      <Bar dataKey="value" name="나의 기록" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={30} animationDuration={1200} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {summaryData.map((data, idx) => (
                    <div key={idx} className="flex flex-col items-center p-4 bg-muted/20 rounded-2xl border-2 border-transparent hover:border-primary/10 transition-all">
                      <p className="text-[10px] font-black text-muted-foreground mb-1 truncate w-full text-center">{data.name}</p>
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <span className="text-xl font-black text-primary">{data.value}</span>
                        <span className="text-[10px] font-bold text-muted-foreground mt-1">{data.unit}</span>
                      </div>
                      {data.grade && (
                        <Badge className={cn("font-black px-3 py-0.5 rounded-full text-[10px]", data.grade <= 2 ? "bg-green-500" : data.grade === 3 ? "bg-amber-500" : "bg-destructive")}>
                          {data.grade}등급
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground border-4 border-dashed rounded-3xl bg-muted/5">
                <Info className="h-16 w-16 mb-4 opacity-10 text-primary" />
                <p className="font-black text-xl">기록 데이터가 부족합니다.</p>
              </div>
            )
          ) : filteredRecords.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={filteredRecords} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="date" fontSize={11} fontWeight="700" tickLine={false} axisLine={false} tickMargin={12} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                <YAxis fontSize={11} fontWeight="600" tickLine={false} axisLine={false} unit={selectedItemInfo?.unit} domain={['auto', 'auto']} tickMargin={8} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '16px' }}
                  formatter={(value: number) => [`${value}${selectedItemInfo?.unit || ''}`, '기록']}
                />
                <Bar dataKey="value" name={itemFilter} fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={32} opacity={0.3} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 6, fill: "hsl(var(--background))", strokeWidth: 4, stroke: "hsl(var(--primary))" }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground border-4 border-dashed rounded-3xl bg-muted/5">
              <p className="font-black text-xl mb-1">기록이 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {filteredHallOfFameData.length > 0 && (
        <Card className="bg-amber-50/50 border-2 border-amber-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-amber-100 pb-4 border-b border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-amber-900 font-black">
                <Trophy className="h-6 w-6 text-amber-600" /> 우리 학교 명예의 전당
              </CardTitle>
              <CardDescription className="text-amber-800 font-bold opacity-90">
                {hofGrade === 'all' ? '전체 학년' : `${hofGrade}학년`} 상위 기록자입니다.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-xl border border-amber-200 shadow-sm">
              <Select value={hofGrade} onValueChange={setHofGrade}>
                <SelectTrigger className="w-[120px] h-8 bg-transparent border-none shadow-none focus:ring-0 font-bold text-amber-900">
                  <SelectValue placeholder="학년 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold">전체 학년</SelectItem>
                  {grades.map(g => <SelectItem key={g} value={g} className="font-bold">{g}학년</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {filteredHallOfFameData.map((h: any) => (
              <div key={h.itemName} className="p-4 bg-background rounded-xl shadow-sm border border-amber-100 flex flex-col gap-3">
                <div className="bg-amber-100 self-center px-3 py-1 rounded-full text-amber-900 font-black text-sm">{h.itemName}</div>
                <div className="space-y-2">
                  {h.topStudents.map((s:any, i:number) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black text-white", i === 0 ? "bg-yellow-500" : i === 1 ? "bg-slate-400" : "bg-amber-600")}>{i+1}</span>
                        <div className="flex flex-col">
                          <span className="font-bold">{s.name}</span>
                          <span className="text-[9px] text-muted-foreground">{s.grade || '전체'}학년 {s.classNum}반</span>
                        </div>
                      </div>
                      <span className="font-black text-primary">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-primary/10 overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4 border-b">
          <CardTitle className="flex items-center gap-2 text-primary font-black"><Wand2 className="h-6 w-6" /> AI 맞춤 성장 피드백</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-6">
          {isFeedbackLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
              <p className="text-sm font-bold text-muted-foreground">나의 기록을 분석하는 중입니다...</p>
            </div>
          ) : (
            <div className={cn("p-6 rounded-2xl transition-all duration-500", aiFeedback ? "bg-primary/5 border border-primary/10 shadow-inner" : "bg-muted/20 border border-dashed text-center")}>
              <p className="whitespace-pre-wrap text-base font-medium leading-relaxed italic text-foreground/80">{aiFeedback || "아직 분석된 내용이 없습니다."}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-primary/5 pt-0 px-6 pb-6">
          <Button className="w-full h-14 text-lg font-black shadow-lg gap-2" onClick={onAiFeedback} disabled={isFeedbackLoading || records.length === 0}>
            {isFeedbackLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
            AI 성장 분석 요청하기
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
