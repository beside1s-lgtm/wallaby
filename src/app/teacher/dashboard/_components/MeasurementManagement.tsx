'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getItems, addItem, deleteItem } from '@/lib/store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { X, Plus } from 'lucide-react';
import type { MeasurementItem, RecordType } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function MeasurementManagement() {
  const { school } = useAuth();
  const [items, setItemsState] = useState<MeasurementItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (school) {
      setItemsState(getItems(school));
    }
  }, [school]);

  const handleAddItem = (newItem: Omit<MeasurementItem, 'id'>) => {
    if (newItem.name.trim() === '' || !school) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '종목 이름을 입력해주세요.',
      });
      return;
    }
    addItem(school, newItem);
    setItemsState(getItems(school));
    toast({
      title: '추가 완료',
      description: `"${newItem.name}" 종목이 추가되었습니다.`,
    });
  };

  const handleDeleteItem = (itemToDelete: MeasurementItem) => {
    if (!school) return;
    deleteItem(school, itemToDelete.id);
    setItemsState(getItems(school));
    toast({
      variant: 'destructive',
      title: '삭제 완료',
      description: `"${itemToDelete.name}" 종목이 삭제되었습니다.`,
    });
  };

  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>측정 종목 관리</CardTitle>
        <CardDescription>측정할 종목을 추가하거나 삭제합니다. 이름, 단위, 기록 유형, 목표(선택)를 설정할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full max-w-sm items-center space-x-2">
            <AddMeasurementItemDialog onAddItem={handleAddItem} />
        </div>
        <div className="border rounded-md p-4 space-y-2">
            <h3 className="font-semibold">현재 종목 목록</h3>
            {items.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between p-2 bg-secondary rounded-md text-sm">
                          <div>
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-muted-foreground ml-2">({item.unit}, {item.recordType}{item.goal ? `, 목표:${item.goal}`: ''})</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteItem(item)}>
                             <X className="h-4 w-4" />
                          </Button>
                      </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">등록된 종목이 없습니다.</p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddMeasurementItemDialog({ onAddItem }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [recordType, setRecordType] = useState<RecordType | ''>('');
  const [goal, setGoal] = useState('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!name || !unit || !recordType) {
      toast({ variant: 'destructive', title: '입력 오류', description: '이름, 단위, 기록 유형은 필수입니다.' });
      return;
    }
    const newItem: Omit<MeasurementItem, 'id'> = { name, unit, recordType };
    if (goal) {
        newItem.goal = parseFloat(goal);
    }
    onAddItem(newItem);
    setName('');
    setUnit('');
    setRecordType('');
    setGoal('');
    document.getElementById('add-item-dialog-close')?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> 새 종목 추가</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 측정 종목 추가</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">종목명</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="예: 50m 달리기" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">단위</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" placeholder="예: 초, cm, 회, kg" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recordType" className="text-right">기록 유형</Label>
            <Select onValueChange={(value) => setRecordType(value as RecordType)} value={recordType}>
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="기록 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="time">시간 (낮을수록 좋음)</SelectItem>
                    <SelectItem value="count">횟수 (높을수록 좋음)</SelectItem>
                    <SelectItem value="distance">거리 (높을수록 좋음)</SelectItem>
                    <SelectItem value="weight">무게 (높을수록 좋음)</SelectItem>
                </SelectContent>
            </Select>
          </div>
           {recordType && recordType !== 'time' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="goal" className="text-right">목표값(선택)</Label>
              <Input
                id="goal"
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="col-span-3"
                placeholder="예: 100 (PAPS 외 종목)"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button id="add-item-dialog-close" variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>추가</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
