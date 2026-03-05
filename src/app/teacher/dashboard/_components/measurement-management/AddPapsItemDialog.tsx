
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { papsStandards } from '@/lib/paps';
import { addItem } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import type { MeasurementItem } from '@/lib/types';

export function AddPapsItemDialog({ onAdd, currentItems, school }: { onAdd: () => Promise<void>, currentItems: MeasurementItem[], school: string }) {
  const [selected, setSelected] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const available = Object.keys(papsStandards).filter(
    name => !currentItems.some(i => i.name === name && !i.isDeactivated)
  );

  const handleSubmit = async () => {
    if (!selected || !school) return;
    setIsSubmitting(true);
    try {
      const standard = papsStandards[selected as keyof typeof papsStandards];
      await addItem(school, {
        name: selected,
        unit: standard.unit,
        recordType: standard.type,
        isPaps: true,
        isCompound: standard.type === 'compound',
        category: 'PAPS',
      });
      await onAdd();
      setSelected('');
      toast({ title: "PAPS 종목 활성화 완료" });
    } finally { setIsSubmitting(false); }
  };

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> PAPS</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>PAPS 종목 추가/활성화</DialogTitle></DialogHeader>
        <div className="py-4">
          <Label>종목 선택</Label>
          <Select onValueChange={setSelected} value={selected}>
            <SelectTrigger><SelectValue placeholder="종목 선택" /></SelectTrigger>
            <SelectContent>
              {available.length ? available.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>) : <SelectItem value="none" disabled>모두 활성 상태입니다.</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={!selected || isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}활성화</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
