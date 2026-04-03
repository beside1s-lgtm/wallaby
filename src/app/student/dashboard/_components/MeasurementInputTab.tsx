
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Youtube, Eye, EyeOff, ClipboardList, Loader2, Calculator, Save } from 'lucide-react';
import { format } from 'date-fns';
import { addOrUpdateRecord } from '@/lib/store';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { papsGradeStandards } from '@/lib/paps';
import type { MeasurementItem, Student, MeasurementRecord } from '@/lib/types';

interface MeasurementInputTabProps {
  items: MeasurementItem[];
  student: Student | null;
  records: MeasurementRecord[];
}

export function MeasurementInputTab({ items, student, records }: MeasurementInputTabProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [selectedItemName, setSelectedItemName] = useState('');
  const [val, setVal] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showVideo, setShowVideo] = useState(false);
  const [showGrades, setShowGrades] = useState(false);

  const selectedItem = useMemo(() => items.find(i => i.name === selectedItemName), [items, selectedItemName]);

  // BMI(isCompound) 선택 시 이전 기록에서 키/몸무게 가져오기
  useEffect(() => {
    if (selectedItem?.isCompound) {
      const prev = [...records]
        .filter(r => r.item === selectedItemName)
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      if (prev && prev.height && prev.weight) {
        setHeight(prev.height.toString());
        setWeight(prev.weight.toString());
      } else {
        setHeight('');
        setWeight('');
      }
    } else {
      setHeight('');
      setWeight('');
    }
  }, [selectedItemName, selectedItem, records]);

  const calculateBmi = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
      const hMeter = h / 100;
      return (w / (hMeter * hMeter)).toFixed(2);
    }
    return '';
  }, [height, weight]);

  const handleSave = async () => {
    if (!school || !student || !selectedItemName) return;

    let finalValue: number;
    if (selectedItem?.isCompound) {
      const bmi = calculateBmi;
      if (!bmi) {
        toast({ variant: 'destructive', title: '키와 몸무게를 정확히 입력해주세요.' });
        return;
      }
      finalValue = parseFloat(bmi);
    } else {
      if (!val) {
        toast({ variant: 'destructive', title: '기록을 입력해주세요.' });
        return;
      }
      finalValue = parseFloat(val);
    }

    if (isNaN(finalValue)) return;

    setIsSubmitting(true);
    try {
      await addOrUpdateRecord({ 
        studentId: student.id, 
        school, 
        item: selectedItemName, 
        value: finalValue, 
        date: format(new Date(), 'yyyy-MM-dd'),
        height: selectedItem?.isCompound ? parseFloat(height) : undefined,
        weight: selectedItem?.isCompound ? parseFloat(weight) : undefined
      });
      toast({ title: "기록 저장 완료" }); 
      if (!selectedItem?.isCompound) setVal('');
    } catch (e) {
      toast({ variant: 'destructive', title: '저장 실패' });
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

  const renderGradeRanges = () => {
    if (!student || !selectedItem || !selectedItem.isPaps) return null;
    
    const gradeToUse = student.grade;
    const itemKey = selectedItem.name === '무릎 대고 팔굽혀펴기' ? '팔굽혀펴기' : selectedItem.name;
    const itemStandards = papsGradeStandards[gradeToUse]?.[itemKey];
    
    if (!itemStandards) return <TableCell colSpan={5} className="text-center text-muted-foreground">데이터 없음</TableCell>;

    const ranges = student.gender === '남' ? itemStandards.male : itemStandards.female;
    const unit = selectedItem.unit;
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
    <div className="space-y-6 mt-6">
      <Card className="premium-card overflow-hidden border-primary/10">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            오늘의 기록 입력
          </CardTitle>
          <CardDescription>측정할 종목을 선택하고 결과를 입력해 나의 성장을 기록하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-8">
          <div className="space-y-3">
            <Label className="text-lg font-bold">1. 종목 선택</Label>
            <Select value={selectedItemName} onValueChange={(v) => { setSelectedItemName(v); setShowVideo(false); setShowGrades(false); }}>
              <SelectTrigger className="h-14 text-lg font-bold border-2 focus:ring-primary/20"><SelectValue placeholder="측정할 종목을 선택하세요" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => <SelectItem key={i.id} value={i.name} className="text-lg font-bold">{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2">
              {selectedItem.videoUrl && (
                <Button variant="outline" className="rounded-full shadow-sm" onClick={() => setShowVideo(!showVideo)}>
                  <Youtube className="mr-2 h-4 w-4 text-red-600" />
                  {showVideo ? '영상 닫기' : '동작 시범 보기'}
                </Button>
              )}
              {selectedItem.isPaps && (
                <Button variant="outline" className="rounded-full shadow-sm" onClick={() => setShowGrades(!showGrades)}>
                  <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                  {showGrades ? '기준표 닫기' : '등급 기준 확인'}
                </Button>
              )}
            </div>
          )}

          {showVideo && selectedItem?.videoUrl && (
            <div className="aspect-video w-full rounded-2xl overflow-hidden border-4 border-background shadow-2xl bg-black animate-in fade-in zoom-in-95">
              <iframe
                width="100%" height="100%"
                src={getYouTubeEmbedUrl(selectedItem.videoUrl)!}
                title="참고 영상"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}

          {showGrades && selectedItem?.isPaps && (
            <div className="overflow-x-auto rounded-2xl border-2 border-primary/5 bg-primary/5 p-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-6 bg-primary rounded-full" />
                <p className="text-sm font-black text-primary font-headline uppercase">{selectedItem.name} 등급 기준</p>
                <span className="text-[10px] bg-white text-primary px-2 py-0.5 rounded-full border border-primary/20 font-bold ml-auto">{student?.grade}학년 {student?.gender}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-center h-10 text-xs font-black text-primary/70">1등급</TableHead>
                    <TableHead className="text-center h-10 text-xs font-black text-primary/70">2등급</TableHead>
                    <TableHead className="text-center h-10 text-xs font-black text-primary/70">3등급</TableHead>
                    <TableHead className="text-center h-10 text-xs font-black text-primary/70">4등급</TableHead>
                    <TableHead className="text-center h-10 text-xs font-black text-primary/70">5등급</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-white/80 rounded-xl border-none">
                    {renderGradeRanges()}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          <div className="space-y-4 pt-4 border-t-2 border-dashed">
            <Label className="text-lg font-bold">2. 측정 결과 입력</Label>
            {selectedItem?.isCompound ? (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground ml-1">키 (cm)</Label>
                  <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="h-16 text-2xl font-black text-center rounded-2xl border-2 focus:ring-4 ring-primary/10" placeholder="1XXX" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground ml-1">몸무게 (kg)</Label>
                  <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="h-16 text-2xl font-black text-center rounded-2xl border-2 focus:ring-4 ring-primary/10" placeholder="XX" />
                </div>
                <div className="col-span-2 flex flex-col items-center p-6 bg-primary/5 rounded-3xl border-2 border-primary/20">
                    <span className="text-sm font-black text-primary/60 uppercase tracking-widest mb-1">Body Mass Index</span>
                    <span className="text-5xl font-black text-primary tracking-tighter">{calculateBmi || '0.00'}</span>
                    <span className="text-xs font-bold text-muted-foreground mt-2">자동 계산된 나의 체질량 지수입니다.</span>
                </div>
              </div>
            ) : (
              <div className="relative group animate-in slide-in-from-bottom-4">
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-primary italic opacity-40 group-focus-within:opacity-100 transition-opacity">{selectedItem?.unit || ''}</div>
                <Input 
                  type="number" 
                  placeholder="측정된 숫자를 정확히 입력하세요" 
                  value={val} 
                  onChange={e => setVal(e.target.value)}
                  className="h-20 text-3xl font-black text-center rounded-3xl border-4 focus:ring-8 ring-primary/5 transition-all shadow-xl shadow-black/5"
                  disabled={!selectedItemName}
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-8 pb-10">
          <Button 
            className="w-full h-20 text-2xl font-black rounded-3xl shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden" 
            onClick={handleSave} 
            disabled={isSubmitting || !selectedItemName}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex items-center justify-center gap-3">
                {isSubmitting ? <Loader2 className="animate-spin w-8 h-8" /> : <Save className="w-7 h-7" />}
                기록 당당하게 저장하기
            </div>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
