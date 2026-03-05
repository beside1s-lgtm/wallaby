
'use client';
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { calculateRanks, getRecordsByStudent, deleteRecord } from "@/lib/store";
import { Student, MeasurementRecord, MeasurementItem, SportsClub } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Wand2, X as XIcon, ArrowUpDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPapsGrade, getCustomItemGrade, normalizePapsRecord, normalizeCustomRecord } from "@/lib/paps";
import AiWelcome from "../AiWelcome";
import { getScoutingReport } from "@/ai/flows/scouting-report-flow";
import { EditRecordDialog } from "./EditRecordDialog";

export default function ClassAnalytics({ allStudents, allItems, allRecords, onRecordUpdate, sportsClubs }: { allStudents: Student[], allItems: MeasurementItem[], allRecords: MeasurementRecord[], onRecordUpdate: any, sportsClubs: SportsClub[] }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("all");
  const [clubId, setClubId] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [item, setItem] = useState("");
  const [aiReport, setAiReport] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const activeItems = useMemo(() => allItems.filter(i => !i.isArchived && !i.isDeactivated), [allItems]);
  
  const filteredStudents = useMemo(() => {
    if (clubId) return allStudents.filter(s => sportsClubs.find(c => c.id === clubId)?.memberIds.includes(s.id));
    if (grade) return allStudents.filter(s => s.grade === grade && (classNum === 'all' || s.classNum === classNum)).sort((a,b) => parseInt(a.studentNum) - parseInt(b.studentNum));
    return [];
  }, [allStudents, grade, classNum, clubId, sportsClubs]);

  const handleAiAnalysis = async () => {
    if (!student || !school) return;
    setIsAiLoading(true);
    try {
      const ranks = calculateRanks(school, allItems, allRecords, allStudents, student.grade);
      const scores = allRecords.filter(r => r.studentId === student.id).map(r => {
        const itemRanks = ranks[r.item] || [];
        const rank = itemRanks.find(rk => rk.studentId === student.id);
        const score = rank ? Math.round((1 - (rank.rank - 1) / itemRanks.length) * 100) : 0;
        return { item: r.item, score };
      });
      const res = await getScoutingReport({ studentName: student.name, abilityScores: scores.map(s => ({...s, category: '기타'})), ranks: {}, allItems });
      setAiReport(res);
    } catch (e) { toast({ variant: "destructive", title: "AI 분석 실패" }); }
    finally { setIsAiLoading(false); }
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>학생별 분석</CardTitle>
        <div className="flex flex-wrap gap-2 pt-4">
          <Input placeholder="이름 검색..." value={search} onChange={e => setSearch(e.target.value)} className="w-auto" />
          <Select value={grade} onValueChange={setGrade}><SelectTrigger className="w-[120px]"><SelectValue placeholder="학년" /></SelectTrigger><SelectContent>{[...new Set(allStudents.map(s=>s.grade))].sort().map(g=><SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent></Select>
          <Select value={clubId} onValueChange={setClubId}><SelectTrigger className="w-[150px]"><SelectValue placeholder="클럽" /></SelectTrigger><SelectContent>{sportsClubs.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {student && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">{student.name} 학생 상세 분석</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle>성취도 변화</CardTitle></CardHeader><CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={allRecords.filter(r => r.studentId === student.id && r.item === item).sort((a,b)=>a.date.localeCompare(b.date))}>
                    <CartesianGrid vertical={false} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle>AI 코칭</CardTitle></CardHeader><CardContent>
                {isAiLoading ? <Loader2 className="animate-spin mx-auto" /> : aiReport ? <p className="text-sm">{aiReport.assessment}</p> : <Button onClick={handleAiAnalysis}><Wand2 className="mr-2" />분석 요청</Button>}
              </CardContent></Card>
            </div>
          </div>
        )}
        <Table>
          <TableHeader><TableRow><TableHead>번호</TableHead><TableHead>이름</TableHead><TableHead>성별</TableHead><TableHead>조회</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredStudents.map(s => (
              <TableRow key={s.id}><TableCell>{s.studentNum}</TableCell><TableCell>{s.name}</TableCell><TableCell>{s.gender}</TableCell><TableCell><Button variant="link" onClick={() => setStudent(s)}>보기</Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
