
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Loader2 } from 'lucide-react';
import { updateItem } from '@/lib/store';
import type { MeasurementItem, RecordType } from '@/lib/types';

export function EditItemDialog({ item, onUpdate, school }: { item: MeasurementItem, onUpdate: () => Promise<void>, school: string }) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [recordType, setRecordType] = useState<RecordType>(item.recordType);
  const [goal, setGoal] = useState(item.goal?.toString() || '');
  const [videoUrl, setVideoUrl] = useState(item.videoUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!school) return;
    setIsSubmitting(true);
    await updateItem(school, item.id, { name, unit, recordType, goal: goal ? parseFloat(goal) : undefined, videoUrl });
    await onUpdate();
    setIsSubmitting(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 ml-auto"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>종목 정보 수정</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">종목명</Label><Input value={name} onChange={e => setName(e.target.value)} disabled={item.isPaps} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">단위</Label><Input value={unit} onChange={e => setUnit(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">유형</Label>
            <Select value={recordType} onValueChange={v => setRecordType(v as RecordType)} disabled={item.isPaps}><SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="count">횟수</SelectItem><SelectItem value="time">시간</SelectItem><SelectItem value="distance">거리</SelectItem><SelectItem value="level">상중하</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">영상 URL</Label><Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="col-span-3" /></div>
        </div>
        <DialogFooter><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}저장</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
