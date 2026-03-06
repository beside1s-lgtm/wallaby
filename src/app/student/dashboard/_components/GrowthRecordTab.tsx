
'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wand2, Trophy, Loader2, Info } from 'lucide-react';
import type { Student, MeasurementRecord, MeasurementItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GrowthRecordTabProps {
  records: MeasurementRecord[];
  activeItems: MeasurementItem[];
  itemFilter: string;
  setItemFilter: (val: string) => void;
  hallOfFame: any[];
  onAiFeedback: () => void;
  aiFeedback: string;
  isFeedbackLoading: boolean;
  student: Student | null;
}

export function GrowthRecordTab({ 
  records, 
  activeItems, 
  itemFilter, 
  setItemFilter, 
  hallOfFame, 
  onAiFeedback, 
  aiFeedback, 
  isFeedbackLoading,
  student
}: GrowthRecordTabProps) {
  
  const filteredRecords = useMemo(() => {
    if (!itemFilter || itemFilter === 'all') return [];
    
    return records
      .filter(r => r.item === itemFilter)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records, itemFilter]);

  const selectedItemInfo = useMemo(() => {
    return activeItems.find(i => i.name === itemFilter);
  }, [activeItems, itemFilter]);

  return (
    <div className="space-y-8 mt-6">
      <Card className="border-2 border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
              나의 성장 기록
            </CardTitle>
            <CardDescription className="text-base font-medium">
              {itemFilter === 'all' 
                ? "종목을 선택하여 기록의 변화를 확인하세요." 
                : <span className="text-foreground"><strong className="text-primary">{itemFilter}</strong> 기록의 변화 추이입니다.</span>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto bg-muted/30 p-1.5 rounded-lg border">
            <span className="text-xs font-bold text-muted-foreground px-2 shrink-0">종목 변경</span>
            <Select value={itemFilter} onValueChange={setItemFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background border-none shadow-none focus:ring-0 h-9">
                <SelectValue placeholder="종목 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">종목을 선택하세요</SelectItem>
                {activeItems.map((i) => (
                  <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-[400px] pt-6">
          {itemFilter === 'all' ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5 animate-in fade-in duration-500">
              <Info className="h-12 w-12 mb-3 opacity-20 text-primary" />
              <p className="font-bold text-lg">성장 그래프를 확인하려면</p>
              <p className="text-sm opacity-70">우측 상단에서 종목을 먼저 선택해주세요.</p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredRecords} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  fontSize={11} 
                  fontWeight="600"
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={12}
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                />
                <YAxis 
                  fontSize={11} 
                  fontWeight="600"
                  tickLine={false} 
                  axisLine={false} 
                  unit={selectedItemInfo?.unit}
                  domain={['auto', 'auto']}
                  tickMargin={8}
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid hsl(var(--border))', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: number) => [`${value}${selectedItemInfo?.unit || ''}`, '기록']}
                  labelFormatter={(label) => `측정일: ${label}`}
                />
                <Bar 
                  dataKey="value" 
                  name={itemFilter} 
                  fill="hsl(var(--primary))" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32}
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: "hsl(var(--background))", strokeWidth: 3, stroke: "hsl(var(--primary))" }}
                  activeDot={{ r: 7, strokeWidth: 0 }}
                  animationDuration={2000}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5 animate-in fade-in duration-500">
              <p className="font-bold text-lg mb-1">'{itemFilter}' 기록이 아직 없습니다.</p>
              <p className="text-sm opacity-70">기록 입력 탭에서 오늘의 측정 결과를 저장해보세요!</p>
            </div>
          )}
        </CardContent>
        {itemFilter !== 'all' && filteredRecords.length > 0 && (
          <CardFooter className="bg-muted/20 px-6 py-3 border-t">
            <p className="text-xs text-muted-foreground font-medium">
              * 최근 {filteredRecords.length}회의 측정 결과가 표시되고 있습니다.
            </p>
          </CardFooter>
        )}
      </Card>
      
      {hallOfFame.length > 0 && (
        <Card className="bg-yellow-50/50 border-2 border-yellow-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-yellow-500/10 pb-4 border-b border-yellow-200">
            <CardTitle className="flex items-center gap-2 text-yellow-700 font-black">
              <Trophy className="h-6 w-6" /> 우리 학교 명예의 전당
            </CardTitle>
            <CardDescription className="text-yellow-600 font-bold">현재 측정 주간인 종목의 상위 기록자입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {hallOfFame.map((h: any) => (
              <div key={h.itemName} className="p-4 bg-background rounded-xl shadow-sm border border-yellow-100 flex flex-col gap-3">
                <div className="bg-yellow-500/10 self-center px-3 py-1 rounded-full text-yellow-700 font-black text-sm">
                  {h.itemName}
                </div>
                <div className="space-y-2">
                  {h.topStudents.map((s:any, i:number) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black text-white",
                          i === 0 ? "bg-yellow-500" : i === 1 ? "bg-slate-400" : "bg-amber-600"
                        )}>
                          {i+1}
                        </span>
                        <span className="font-bold">{s.name}</span>
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
          <CardTitle className="flex items-center gap-2 text-primary font-black">
            <Wand2 className="h-6 w-6" /> AI 맞춤 성장 피드백
          </CardTitle>
          <CardDescription className="font-medium">나의 최근 기록을 바탕으로 AI 코치가 분석해 드립니다.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 pb-6">
          {isFeedbackLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
              <p className="text-sm font-bold text-muted-foreground animate-pulse">나의 기록을 분석하는 중입니다...</p>
            </div>
          ) : (
            <div className={cn(
              "p-6 rounded-2xl transition-all duration-500",
              aiFeedback ? "bg-primary/5 border border-primary/10 shadow-inner" : "bg-muted/20 border border-dashed text-center"
            )}>
              <p className="whitespace-pre-wrap text-base font-medium leading-relaxed italic text-foreground/80">
                {aiFeedback || "아직 분석된 내용이 없습니다. 아래 버튼을 눌러 AI 분석을 시작해보세요!"}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-primary/5 pt-0 px-6 pb-6">
          <Button 
            className="w-full h-14 text-lg font-black shadow-lg hover:shadow-xl transition-all gap-2" 
            onClick={onAiFeedback} 
            disabled={isFeedbackLoading || records.length === 0}
          >
            {isFeedbackLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
            AI 성장 분석 요청하기
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
