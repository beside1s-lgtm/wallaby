
'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Calendar as CalendarIcon, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function IndividualInput({ allStudents, activeItems, onRecordUpdate }: { allStudents: Student[], activeItems: MeasurementItem[], onRecordUpdate: any }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [itemName, setItemName] = useState('');
  const [val, setVal] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = () => {
    const found = allStudents.filter(s => s.name.includes(search));
    if (found.length === 1) setStudent(found[0]);
    else toast({ variant: "destructive", title: "학생을 정확히 검색해주세요." });
  };

  const handleSave = async () => {
    if (!school || !student || !itemName || !date) return;
    setIsSubmitting(true);
    try {
      const rec = await addOrUpdateRecord({ studentId: student.id, school, item: itemName, date: format(date, 'yyyy-MM-dd'), value: parseFloat(val) });
      onRecordUpdate([rec], 'update');
      toast({ title: "저장 완료" });
      setVal('');
    } catch (e) { toast({ variant: "destructive", title: "실패" }); }
    finally { setIsSubmitting(false); }
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>개별 학생 기록 입력</CardTitle>
        <div className="flex gap-2 pt-4">
          <Input placeholder="이름 검색..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <Button onClick={handleSearch}><Search className="h-4 w-4 mr-2" />검색</Button>
        </div>
      </CardHeader>
      {student && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
            <Avatar className="w-20 h-20"><AvatarImage src={student.photoUrl} /><AvatarFallback>{student.name[0]}</AvatarFallback></Avatar>
            <div><p className="font-bold">{student.name}</p><p className="text-sm text-muted-foreground">{student.grade}-{student.classNum}</p></div>
          </div>
          <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : "날짜"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent></Popover>
          <Select value={itemName} onValueChange={setItemName}><SelectTrigger><SelectValue placeholder="종목 선택" /></SelectTrigger><SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
          <div className="space-y-2"><Label>기록({activeItems.find(i=>i.name===itemName)?.unit})</Label><Input type="number" value={val} onChange={e => setVal(e.target.value)} /></div>
          <Button className="w-full" onClick={handleSave} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}저장</Button>
        </CardContent>
      )}
    </Card>
  );
}
