
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Pencil, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { addOrUpdateRecord } from '@/lib/store';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { Student, MeasurementRecord, MeasurementItem } from '@/lib/types';

export function EditRecordDialog({ record, student, onUpdate }: { record: MeasurementRecord, student: Student, onUpdate: any }) {
  const { school } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date(record.date));
  const [val, setVal] = useState(record.value.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!school || !date) return;
    setIsSubmitting(true);
    try {
      await addOrUpdateRecord({ id: record.id, studentId: student.id, school, item: record.item, value: parseFloat(val), date: format(date, 'yyyy-MM-dd') });
      onUpdate();
    } finally { setIsSubmitting(false); }
  };

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>기록 수정</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <Popover><PopoverTrigger asChild><Button variant="outline" className="justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : "날짜 선택"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent></Popover>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">기록</Label><Input type="number" value={val} onChange={e => setVal(e.target.value)} className="col-span-3" /></div>
        </div>
        <DialogFooter><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}저장</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
