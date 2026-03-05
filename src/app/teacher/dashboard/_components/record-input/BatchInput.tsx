
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecords } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, X, Youtube, Eye, EyeOff, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { papsGradeStandards } from '@/lib/paps';

export function BatchInput({ allStudents, activeItems, onRecordUpdate, allTeamGroups, sportsClubs }: { allStudents: Student[], activeItems: MeasurementItem[], onRecordUpdate: any, allTeamGroups: TeamGroup[], sportsClubs: SportsClub[] }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [batchItem, setBatchItem] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [records, setBatchRecords] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showGrades, setShowGradeTable] = useState(false);

  useEffect(() => { if (activeItems.length && !batchItem) setBatchItem(activeItems[0].name); }, [activeItems, batchItem]);

  const students = useMemo(() => {
    let list: Student[] = [];
    if (selectedGroupId) {
      const group = allTeamGroups.find(g => g.id === selectedGroupId) || sportsClubs.find(c => c.id === selectedGroupId);
      if (group) list = allStudents.filter(s => group.memberIds.includes(s.id));
    } else if (selectedGrade) {
      list = allStudents.filter(s => s.grade === selectedGrade && (selectedClassNum === 'all' || s.classNum === selectedClassNum));
    }
    return list.sort((a, b) => parseInt(a.studentNum) - parseInt(b.studentNum));
  }, [allStudents, selectedGrade, selectedClassNum, selectedGroupId, allTeamGroups, sportsClubs]);

  const handleSave = async () => {
    if (!school || !batchItem || !date) return;
    setIsSubmitting(true);
    try {
      const toSave = Object.entries(records).map(([id, val]) => ({
        studentId: id, school, item: batchItem, date: format(date, 'yyyy-MM-dd'), value: parseFloat(val.value || 0)
      })).filter(r => r.value > 0);
      const updated = await addOrUpdateRecords(school, students, toSave);
      onRecordUpdate(updated, 'update');
      toast({ title: "저장 완료" });
      setBatchRecords({});
    } catch (e) { toast({ variant: "destructive", title: "저장 실패" }); }
    finally { setIsSubmitting(false); }
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>학급/팀별 측정 기록</CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedGroupId(''); }}><SelectTrigger className="w-[120px]"><SelectValue placeholder="학년" /></SelectTrigger><SelectContent>{[...new Set(allStudents.map(s => s.grade))].sort().map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent></Select>
          <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}><SelectTrigger className="w-[120px]"><SelectValue placeholder="반" /></SelectTrigger><SelectContent><SelectItem value="all">전체</SelectItem>{[...new Set(allStudents.filter(s => s.grade === selectedGrade).map(s => s.classNum))].sort().map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent></Select>
          <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="그룹 선택" /></SelectTrigger><SelectContent>{allTeamGroups.concat(sportsClubs as any).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.description || g.name}</SelectItem>)}</SelectContent></Select>
          <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[200px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : "날짜"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent></Popover>
          <Select value={batchItem} onValueChange={setBatchItem}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
          <Button onClick={handleSave} disabled={isSubmitting || !students.length} className="ml-auto">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}일괄 저장</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>사진</TableHead><TableHead>이름</TableHead><TableHead>기록({activeItems.find(i=>i.name===batchItem)?.unit})</TableHead></TableRow></TableHeader>
          <TableBody>
            {students.map(s => (
              <TableRow key={s.id}>
                <TableCell><Avatar className="w-20 h-20"><AvatarImage src={s.photoUrl} /><AvatarFallback>{s.name[0]}</AvatarFallback></Avatar></TableCell>
                <TableCell>{s.grade}-{s.classNum} {s.name}</TableCell>
                <TableCell><Input type="number" value={records[s.id]?.value || ''} onChange={e => setBatchRecords({...records, [s.id]: {value: e.target.value}})} className="w-[120px]" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
