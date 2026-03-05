
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
  const [showGradeTable, setShowGradeTable] = useState(false);

  useEffect(() => { if (activeItems.length && !batchItem) setBatchItem(activeItems[0].name); }, [activeItems, batchItem]);

  const students = useMemo(() => {
    let list: Student[] = [];
    if (selectedGroupId) {
      const group = allTeamGroups.find(g => g.id === selectedGroupId) || sportsClubs.find(c => c.id === selectedGroupId);
      if (group) list = allStudents.filter(s => group.memberIds.includes(s.id));
    } else if (selectedGrade) {
      list = allStudents.filter(s => s.grade === selectedGrade && (selectedClassNum === 'all' || s.classNum === selectedClassNum));
    }
    
    return list.sort((a, b) => {
      if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
      if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
      return parseInt(a.studentNum) - parseInt(b.studentNum);
    });
  }, [allStudents, selectedGrade, selectedClassNum, selectedGroupId, allTeamGroups, sportsClubs]);

  const selectedItemInfo = useMemo(() => activeItems.find(i => i.name === batchItem), [batchItem, activeItems]);

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

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const renderGradeRanges = (gender: 'male' | 'female') => {
    const gradeToUse = selectedGrade || (students.length > 0 ? students[0].grade : '5');
    const itemKey = batchItem === '무릎 대고 팔굽혀펴기' ? '팔굽혀펴기' : batchItem;
    const itemStandards = papsGradeStandards[gradeToUse]?.[itemKey];
    
    if (!itemStandards) return <TableCell colSpan={5} className="text-center text-muted-foreground">데이터 없음</TableCell>;

    const ranges = itemStandards[gender];
    const unit = selectedItemInfo?.unit || '';
    const type = itemStandards.type;

    return [1, 2, 3, 4, 5].map(g => {
      const gradeRanges = ranges.filter(r => r.grade === g);
      if (gradeRanges.length === 0) return <TableCell key={g} className="text-center">-</TableCell>;

      const rangeTexts = gradeRanges.map(r => {
        if (r.max === Infinity) return `${r.min}${unit} ↑`;
        if (r.min === 1 || r.min === -Infinity || (type === 'time' && r.min === 0)) return `${r.max}${unit} ↓`;
        return `${r.min}~${r.max}${unit}`;
      });

      return (
        <TableCell key={g} className="text-center text-[10px] sm:text-xs break-keep px-1">
          {rangeTexts.join(' / ')}
        </TableCell>
      );
    });
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>학급/팀별 측정 기록</CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedGroupId(''); }}><SelectTrigger className="w-[120px]"><SelectValue placeholder="학년" /></SelectTrigger><SelectContent>{[...new Set(allStudents.map((s: any) => s.grade))].sort((a: any,b: any) => parseInt(a)-parseInt(b)).map((g: any) => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent></Select>
          <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}><SelectTrigger className="w-[120px]"><SelectValue placeholder="반" /></SelectTrigger><SelectContent><SelectItem value="all">전체</SelectItem>{[...new Set(allStudents.filter((s: any) => s.grade === selectedGrade).map((s: any) => s.classNum))].sort((a: any,b: any) => parseInt(a)-parseInt(b)).map((c: any) => <SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent></Select>
          <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="그룹 선택" /></SelectTrigger><SelectContent>{allTeamGroups.concat(sportsClubs as any).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.description || g.name}</SelectItem>)}</SelectContent></Select>
          <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[200px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : "날짜"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent></Popover>
          <Select value={batchItem} onValueChange={v => { setBatchItem(v); setShowVideo(false); setShowGradeTable(false); }}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
          <Button onClick={handleSave} disabled={isSubmitting || !students.length} className="ml-auto">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}일괄 저장</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {selectedItemInfo && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedItemInfo.videoUrl && (
              <Button variant="outline" size="sm" onClick={() => setShowVideo(!showVideo)}>
                <Youtube className="mr-2 h-4 w-4 text-red-600" />
                {showVideo ? '영상 닫기' : '참고 영상 보기'}
              </Button>
            )}
            {selectedItemInfo.isPaps && (
              <Button variant="outline" size="sm" onClick={() => setShowGradeTable(!showGradeTable)}>
                <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                {showGradeTable ? '기준표 닫기' : '등급 기준표 보기'}
              </Button>
            )}
          </div>
        )}

        {showVideo && selectedItemInfo?.videoUrl && (
          <div className="aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden border bg-black animate-in fade-in zoom-in-95">
            <iframe
              width="100%" height="100%"
              src={getYouTubeEmbedUrl(selectedItemInfo.videoUrl)!}
              title="참고 영상"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        )}

        {showGradeTable && selectedItemInfo?.isPaps && (
          <div className="overflow-x-auto rounded-md border bg-muted/30 p-2 animate-in fade-in zoom-in-95">
            <p className="text-xs font-bold mb-2 px-1 text-primary">{batchItem} 등급 기준 ({selectedGrade || students[0]?.grade || '5'}학년)</p>
            <Table>
              <TableHeader>
                <TableRow className="bg-background">
                  <TableHead className="text-center h-8 text-[10px] p-1 w-[80px]">성별</TableHead>
                  <TableHead className="text-center h-8 text-[10px] p-1">1등급</TableHead>
                  <TableHead className="text-center h-8 text-[10px] p-1">2등급</TableHead>
                  <TableHead className="text-center h-8 text-[10px] p-1">3등급</TableHead>
                  <TableHead className="text-center h-8 text-[10px] p-1">4등급</TableHead>
                  <TableHead className="text-center h-8 text-[10px] p-1">5등급</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-background">
                  <TableCell className="text-center font-bold text-[10px]">남학생</TableCell>
                  {renderGradeRanges('male')}
                </TableRow>
                <TableRow className="bg-background">
                  <TableCell className="text-center font-bold text-[10px]">여학생</TableCell>
                  {renderGradeRanges('female')}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

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
