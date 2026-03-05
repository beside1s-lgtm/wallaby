
'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Youtube, Eye, EyeOff, ClipboardList, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { addOrUpdateRecord } from '@/lib/store';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { papsGradeStandards } from '@/lib/paps';
import type { MeasurementItem, Student } from '@/lib/types';

interface MeasurementInputTabProps {
  items: MeasurementItem[];
  student: Student | null;
}

export function MeasurementInputTab({ items, student }: MeasurementInputTabProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [selectedItemName, setSelectedItemName] = useState('');
  const [val, setVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showVideo, setShowVideo] = useState(false);
  const [showGrades, setShowGrades] = useState(false);

  const selectedItem = useMemo(() => items.find(i => i.name === selectedItemName), [items, selectedItemName]);

  const handleSave = async () => {
    if (!school || !student || !selectedItemName || !val) {
      toast({ variant: 'destructive', title: '기록을 입력해주세요.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await addOrUpdateRecord({ 
        studentId: student.id, 
        school, 
        item: selectedItemName, 
        value: parseFloat(val), 
        date: format(new Date(), 'yyyy-MM-dd') 
      });
      toast({ title: "기록 저장 완료" }); 
      setVal('');
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
      <Card>
        <CardHeader>
          <CardTitle>오늘의 기록 입력</CardTitle>
          <CardDescription>종목을 선택하고 측정 결과를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>종목 선택</Label>
            <Select value={selectedItemName} onValueChange={(v) => { setSelectedItemName(v); setShowVideo(false); setShowGrades(false); }}>
              <SelectTrigger><SelectValue placeholder="종목을 선택하세요" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <div className="flex flex-wrap gap-2">
              {selectedItem.videoUrl && (
                <Button variant="outline" size="sm" onClick={() => setShowVideo(!showVideo)}>
                  <Youtube className="mr-2 h-4 w-4 text-red-600" />
                  {showVideo ? '영상 닫기' : '참고 영상 보기'}
                </Button>
              )}
              {selectedItem.isPaps && (
                <Button variant="outline" size="sm" onClick={() => setShowGrades(!showGrades)}>
                  <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                  {showGrades ? '기준표 닫기' : '등급 기준표 보기'}
                </Button>
              )}
            </div>
          )}

          {showVideo && selectedItem?.videoUrl && (
            <div className="aspect-video w-full rounded-lg overflow-hidden border bg-black animate-in fade-in zoom-in-95">
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
            <div className="overflow-x-auto rounded-md border bg-muted/30 p-2 animate-in fade-in zoom-in-95">
              <p className="text-xs font-bold mb-2 px-1 text-primary">{selectedItem.name} 등급 기준 ({student?.grade}학년 {student?.gender}학생)</p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-background">
                    <TableHead className="text-center h-8 text-[10px] p-1">1등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">2등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">3등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">4등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">5등급</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-background">
                    {renderGradeRanges()}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          <div className="space-y-2">
            <Label>측정 결과 ({selectedItem?.unit || ''})</Label>
            <Input 
              type="number" 
              placeholder="숫자만 입력하세요" 
              value={val} 
              onChange={e => setVal(e.target.value)}
              className="text-lg py-6"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full py-6 text-lg font-bold" onClick={handleSave} disabled={isSubmitting || !selectedItemName}>
            {isSubmitting && <Loader2 className="animate-spin mr-2" />}
            기록 저장하기
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
