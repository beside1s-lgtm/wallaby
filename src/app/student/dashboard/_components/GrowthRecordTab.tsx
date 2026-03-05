
'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Wand2, Trophy, Crown, Medal, Loader2 } from 'lucide-react';
import type { Student, MeasurementRecord, MeasurementItem } from '@/lib/types';

export function GrowthRecordTab({ records, activeItems, filter, setFilter, itemFilter, setItemFilter, hallOfFame, onAiFeedback, aiFeedback, isFeedbackLoading }: any) {
  return (
    <div className="space-y-8 mt-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>나의 성장 기록</CardTitle><CardDescription>기록 변화를 확인하세요.</CardDescription></div>
          <div className="flex gap-2">
            <Select value={itemFilter} onValueChange={setItemFilter}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">종합 현황</SelectItem>{activeItems.map((i:any)=><SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={records}>
              <CartesianGrid vertical={false} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Bar dataKey="value" fill="hsl(var(--primary))" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {hallOfFame.length > 0 && (
        <Card className="bg-yellow-50/50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-yellow-600"><Trophy />명예의 전당</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hallOfFame.map((h: any) => (
              <div key={h.itemName} className="p-4 bg-background rounded-lg shadow-sm">
                <p className="font-bold text-center mb-2">{h.itemName}</p>
                {h.topStudents.map((s:any, i:number) => <div key={i} className="flex justify-between text-sm"><span>{i+1}위 {s.name}</span><span>{s.value}</span></div>)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>AI 피드백</CardTitle></CardHeader>
        <CardContent>{isFeedbackLoading ? <Loader2 className="animate-spin mx-auto" /> : <p className="whitespace-pre-wrap text-sm">{aiFeedback || "분석 요청을 눌러주세요."}</p>}</CardContent>
        <CardFooter><Button className="w-full" onClick={onAiFeedback} disabled={isFeedbackLoading}><Wand2 className="mr-2 h-4 w-4" />AI 분석 받기</Button></CardFooter>
      </Card>
    </div>
  );
}
