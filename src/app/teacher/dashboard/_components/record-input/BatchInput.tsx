
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord, addOrUpdateRecords } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, X, Youtube, ClipboardList, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { papsGradeStandards } from '@/lib/paps';

export function BatchInput({ allStudents, activeItems, allRecords, onRecordUpdate, allTeamGroups, sportsClubs }: { allStudents: Student[], activeItems: MeasurementItem[], allRecords: MeasurementRecord[], onRecordUpdate: any, allTeamGroups: TeamGroup[], sportsClubs: SportsClub[] }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [batchItem, setBatchItem] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [records, setBatchRecords] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  
  const [showVideo, setShowVideo] = useState(false);
  const [showGradeTable, setShowGradeTable] = useState(false);

  useEffect(() => { 
    if (activeItems.length && !batchItem) setBatchItem(activeItems[0].name); 
  }, [activeItems, batchItem]);

  useEffect(() => {
    setBatchRecords({});
    setSavedIds(new Set());
  }, [selectedGrade, selectedClassNum, selectedGroupId, batchItem]);

  const students = useMemo(() => {
    let list: Student[] = [];
    if (selectedGroupId) {
      // 1. TeamGroup에서 찾기
      const teamGroup = allTeamGroups.find(g => g.id === selectedGroupId);
      if (teamGroup) {
        const allMemberIdsInGroup = teamGroup.teams.flatMap(t => t.memberIds);
        list = allStudents.filter(s => allMemberIdsInGroup.includes(s.id));
      } else {
        // 2. SportsClub에서 찾기
        const club = sportsClubs.find(c => c.id === selectedGroupId);
        if (club) list = allStudents.filter(s => club.memberIds.includes(s.id));
      }
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

  const getPreviousRecord = (studentId: string) => {
    return allRecords
      .filter(r => r.studentId === studentId && r.item === batchItem)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const calculateBmi = (heightCm?: string, weightKg?: string): string => {
    const h = parseFloat(heightCm || '');
    const w = parseFloat(weightKg || '');
    if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
        const heightInMeters = h / 100;
        return (w / (heightInMeters * heightInMeters)).toFixed(2);
    }
    return '';
  };

  const handleIndividualSave = async (studentId: string) => {
    if (!school || !batchItem || !date) return;
    
    const input = records[studentId];
    if (!input) {
        toast({ variant: 'destructive', title: '입력된 값이 없습니다.' });
        return;
    }

    let valueToSave: number | null = null;
    if (selectedItemInfo?.isCompound) {
        const bmi = calculateBmi(input.height, input.weight);
        if (!bmi) {
            toast({ variant: 'destructive', title: '키와 몸무게를 올바르게 입력해주세요.' });
            return;
        }
        valueToSave = parseFloat(bmi);
    } else {
        if (!input.value) {
            toast({ variant: 'destructive', title: '기록을 입력해주세요.' });
            return;
        }
        valueToSave = parseFloat(input.value);
    }

    if (valueToSave === null || isNaN(valueToSave)) return;

    setSavingId(studentId);
    try {
      const rec = await addOrUpdateRecord({ 
        studentId, 
        school, 
        item: batchItem, 
        date: format(date, 'yyyy-MM-dd'), 
        value: valueToSave 
      });
      onRecordUpdate([rec], 'update');
      setSavedIds(prev => new Set(prev).add(studentId));
      toast({ title: "저장 완료" });
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!school || !batchItem || !date) return;
    setIsSubmitting(true);
    try {
      const toSave = students.map(s => {
        const input = records[s.id];
        if (!input) return null;
        
        let val: number | null = null;
        if (selectedItemInfo?.isCompound) {
            const bmi = calculateBmi(input.height, input.weight);
            val = bmi ? parseFloat(bmi) : null;
        } else {
            val = input.value ? parseFloat(input.value) : null;
        }
        
        if (val === null || isNaN(val)) return null;

        return {
            studentId: s.id, 
            school, 
            item: batchItem, 
            date: format(date, 'yyyy-MM-dd'), 
            value: val
        };
      }).filter((r): r is any => r !== null);

      if (toSave.length === 0) {
          toast({ variant: "destructive", title: "저장할 기록이 없습니다." });
          setIsSubmitting(false);
          return;
      }

      const updated = await addOrUpdateRecords(school, students, toSave);
      onRecordUpdate(updated, 'update');
      setSavedIds(new Set(toSave.map(r => r.studentId)));
      toast({ title: "일괄 저장 완료" });
    } catch (e) { 
      toast({ variant: "destructive", title: "일괄 저장 실패" }); 
    } finally { 
      setIsSubmitting(false); 
    }
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
        <CardDescription>아이들의 이전 기록을 확인하며 한 명씩 실시간으로 안전하게 저장하세요.</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedGroupId(''); }}><SelectTrigger className="w-[120px]"><SelectValue placeholder="학년" /></SelectTrigger><SelectContent>{[...new Set(allStudents.map((s: any) => s.grade))].sort((a: any,b: any) => parseInt(a)-parseInt(b)).map((g: any) => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent></Select>
          <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}><SelectTrigger className="w-[120px]"><SelectValue placeholder="반" /></SelectTrigger><SelectContent><SelectItem value="all">전체</SelectItem>{[...new Set(allStudents.filter((s: any) => s.grade === selectedGrade).map((s: any) => s.classNum))].sort((a: any,b: any) => parseInt(a)-parseInt(b)).map((c: any) => <SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent></Select>
          <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="그룹 선택" /></SelectTrigger><SelectContent>{allTeamGroups.concat(sportsClubs as any).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.description || g.name}</SelectItem>)}</SelectContent></Select>
          <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[200px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : "날짜"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent></Popover>
          <Select value={batchItem} onValueChange={v => { setBatchItem(v); setShowVideo(false); setShowGradeTable(false); }}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
          <Button onClick={handleSaveAll} disabled={isSubmitting || !students.length} className="ml-auto font-bold">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}전체 일괄 저장</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {selectedItemInfo && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedItemInfo.videoUrl && (
              <Button variant="outline" size="sm" onClick={() => setShowVideo(!showVideo)}>
                <Youtube className="mr-2 h-4 w-4 text-red-600" />
                {showVideo ? '영상 닫기' : '측정 예시 영상'}
              </Button>
            )}
            {selectedItemInfo.isPaps && (
              <Button variant="outline" size="sm" onClick={() => setShowGradeTable(!showGradeTable)}>
                <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                {showGradeTable ? '기준표 닫기' : '등급 기준표'}
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

        <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-16">사진</TableHead>
                    <TableHead className="w-32">이름</TableHead>
                    <TableHead className="w-24 text-blue-600 font-bold">이전 기록</TableHead>
                    {selectedItemInfo?.isCompound ? (
                        <>
                            <TableHead className="w-24 text-center">키(cm)</TableHead>
                            <TableHead className="w-24 text-center">몸무게(kg)</TableHead>
                            <TableHead className="w-24 text-center">BMI</TableHead>
                        </>
                    ) : (
                        <TableHead className="text-center">현재 기록({selectedItemInfo?.unit})</TableHead>
                    )}
                    <TableHead className="w-24 text-right">작업</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {students.map(s => {
                const prev = getPreviousRecord(s.id);
                const current = records[s.id] || {};
                const isSaved = savedIds.has(s.id);
                
                return (
                <TableRow key={s.id} className={cn(isSaved && "bg-green-50/50 transition-colors")}>
                    <TableCell><Avatar className="w-10 h-10"><AvatarImage src={s.photoUrl} /><AvatarFallback>{s.name[0]}</AvatarFallback></Avatar></TableCell>
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="font-bold">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground">{s.grade}-{s.classNum} {s.studentNum}번</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-xs font-black text-blue-600 italic">
                        {prev ? `${prev.value}${selectedItemInfo?.unit || ''}` : '-'}
                    </TableCell>
                    {selectedItemInfo?.isCompound ? (
                        <>
                            <TableCell>
                                <Input 
                                    type="number" 
                                    placeholder="키"
                                    value={current.height || ''} 
                                    onChange={e => setBatchRecords({...records, [s.id]: {...current, height: e.target.value}})} 
                                    className="text-center h-9"
                                />
                            </TableCell>
                            <TableCell>
                                <Input 
                                    type="number" 
                                    placeholder="몸무게"
                                    value={current.weight || ''} 
                                    onChange={e => setBatchRecords({...records, [s.id]: {...current, weight: e.target.value}})} 
                                    className="text-center h-9"
                                />
                            </TableCell>
                            <TableCell className="text-center font-bold text-primary text-sm">
                                {calculateBmi(current.height, current.weight)}
                            </TableCell>
                        </>
                    ) : (
                        <TableCell>
                            <Input 
                                type="number" 
                                value={current.value || ''} 
                                onChange={e => setBatchRecords({...records, [s.id]: {value: e.target.value}})} 
                                className="text-center max-w-[120px] mx-auto h-9" 
                            />
                        </TableCell>
                    )}
                    <TableCell className="text-right">
                        <Button 
                            variant={isSaved ? "ghost" : "outline"} 
                            size="sm" 
                            className={cn("h-8 px-2 transition-all", isSaved && "text-green-600 font-bold")}
                            onClick={() => handleIndividualSave(s.id)}
                            disabled={savingId === s.id}
                        >
                            {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">{isSaved ? '저장됨' : '저장'}</span>
                        </Button>
                    </TableCell>
                </TableRow>
                )})}
                {students.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            대상을 선택해주세요.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
