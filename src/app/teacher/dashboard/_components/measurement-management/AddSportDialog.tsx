
'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Swords, ChevronRight, Loader2 } from 'lucide-react';
import { addItem } from '@/lib/store';
import type { MeasurementItem, RecordType } from '@/lib/types';

export function AddSportDialog({ onAdd, allItems, school }: { onAdd: () => Promise<void>, allItems: MeasurementItem[], school: string }) {
  const [cat, setCat] = useState<string | null>(null);
  const baseCategories = ['배구', '농구', '야구', '축구', '피구'];
  const currentCategories = [...new Set(allItems.filter(i => !i.isPaps && i.category !== '기타').map(i => i.category as string))];
  const categories = [...new Set([...baseCategories, ...currentCategories])].sort();

  const deactivated = useMemo(() => allItems.filter(i => i.category === cat && i.isDeactivated), [cat, allItems]);

  const handleReactivate = async (item: MeasurementItem) => {
    if (!school) return;
    await addItem(school, { ...item });
    await onAdd();
  };

  return (
    <Dialog onOpenChange={(open) => !open && setCat(null)}>
      <DialogTrigger asChild><Button className="bg-primary text-white"><Swords className="mr-2 h-4 w-4" /> +스포츠</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>스포츠 종목 관리</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-2">
            <Label>카테고리 선택</Label>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
              {categories.map(c => <Button key={c} variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)} className="justify-between">{c} <ChevronRight className="h-4 w-4 opacity-50" /></Button>)}
            </div>
            <AddCategoryDialog onAdd={setCat} />
          </div>
          <div className="space-y-4 border-l pl-6">
            {cat ? (
              <>
                <div className="flex items-center justify-between"><h4 className="font-bold text-primary">{cat} 지표</h4><AddMetricInCategoryDialog category={cat} onAdd={onAdd} school={school} /></div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">비활성 종목 (클릭 시 활성)</Label>
                  <div className="space-y-1">
                    {deactivated.length ? deactivated.map(i => <Button key={i.id} variant="secondary" className="w-full justify-start text-sm" onClick={() => handleReactivate(i)}><Plus className="h-3 w-3 mr-2" /> {i.name}</Button>) : <p className="text-xs text-center py-4 border border-dashed rounded-md">없음</p>}
                  </div>
                </div>
              </>
            ) : <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50"><Swords className="h-12 w-12 mb-2" /><p className="text-sm">스포츠를 선택하세요.</p></div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCategoryDialog({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild><Button variant="ghost" className="w-full border-dashed border-2 mt-2"><Plus className="h-4 w-4 mr-2" /> 새 스포츠</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>새 스포츠 카테고리</DialogTitle></DialogHeader>
        <div className="py-4"><Label>스포츠 이름</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 배드민턴" /></div>
        <DialogFooter><Button onClick={() => { if(name.trim()) { onAdd(name.trim()); setIsOpen(false); setName(''); } }}>추가</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMetricInCategoryDialog({ category, onAdd, school }: { category: string, onAdd: () => Promise<void>, school: string }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [recordType, setRecordType] = useState<RecordType>('count');
  const [goal, setGoal] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !unit.trim() || !school) return;
    setIsSubmitting(true);
    await addItem(school, { name: name.trim(), unit: unit.trim(), recordType, category, isPaps: false, goal: goal ? parseFloat(goal) : undefined });
    await onAdd(); setIsSubmitting(false); setIsOpen(false); setName(''); setUnit(''); setGoal('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> 추가</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>{category} 지표 추가</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">지표명</Label><Input value={name} onChange={e => setName(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">단위</Label><Input value={unit} onChange={e => setUnit(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">유형</Label>
            <Select value={recordType} onValueChange={v => setRecordType(v as RecordType)}><SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="count">횟수</SelectItem><SelectItem value="time">시간</SelectItem><SelectItem value="distance">거리</SelectItem><SelectItem value="level">상중하</SelectItem></SelectContent>
            </Select>
          </div>
          {recordType !== 'time' && recordType !== 'level' && <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">목표</Label><Input type="number" value={goal} onChange={e => setGoal(e.target.value)} className="col-span-3" /></div>}
        </div>
        <DialogFooter><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : '추가'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
