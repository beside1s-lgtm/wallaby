
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Loader2 } from 'lucide-react';
import { addItem } from '@/lib/store';
import type { RecordType } from '@/lib/types';

export function AddCustomItemDialog({ onAdd, school }: { onAdd: () => Promise<void>, school: string }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [recordType, setRecordType] = useState<RecordType | ''>('');
  const [goal, setGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !unit || !recordType || !school) return;
    setIsSubmitting(true);
    await addItem(school, { name, unit, recordType: recordType as RecordType, isPaps: false, category: '기타', goal: goal ? parseFloat(goal) : undefined });
    await onAdd();
    setName(''); setUnit(''); setRecordType(''); setGoal('');
    setIsSubmitting(false);
    document.getElementById('add-custom-close')?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline"><Target className="mr-2 h-4 w-4" /> +기타</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>기타 종목 추가</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">종목명</Label><Input value={name} onChange={e => setName(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">단위</Label><Input value={unit} onChange={e => setUnit(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">유형</Label>
            <Select onValueChange={v => setRecordType(v as RecordType)} value={recordType}><SelectTrigger className="col-span-3"><SelectValue placeholder="유형 선택" /></SelectTrigger>
              <SelectContent><SelectItem value="time">시간</SelectItem><SelectItem value="count">횟수</SelectItem><SelectItem value="distance">거리</SelectItem><SelectItem value="level">상중하</SelectItem></SelectContent>
            </Select>
          </div>
          {recordType && recordType !== 'time' && recordType !== 'level' && <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">목표</Label><Input type="number" value={goal} onChange={e => setGoal(e.target.value)} className="col-span-3" /></div>}
        </div>
        <DialogFooter><DialogClose asChild><Button id="add-custom-close" variant="outline">취소</Button></DialogClose><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}추가</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
