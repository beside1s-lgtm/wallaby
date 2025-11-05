'use client';
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addItem as addItemToDb, deleteItemAndAssociatedRecords } from '@/lib/store';
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
import { X, Plus, Loader2 } from 'lucide-react';
import type { MeasurementItem, RecordType } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { papsStandards } from '@/lib/paps';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface MeasurementManagementProps {
  items: MeasurementItem[];
  onItemsUpdate: () => void;
}

const recordTypeDisplay: Record<RecordType, string> = {
    time: "시간",
    count: "횟수",
    distance: "거리",
    weight: "무게",
    level: "상중하"
};

export default function MeasurementManagement({ items, onItemsUpdate }: MeasurementManagementProps) {
  const { school } = useAuth();
  const { toast } = useToast();

  const handleAddItem = async (newItem: Omit<MeasurementItem, 'id'>) => {
    if (newItem.name.trim() === '' || !school) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '종목 이름을 입력해주세요.',
      });
      return;
    }
    await addItemToDb(school, newItem);
    onItemsUpdate(); // Refresh data in parent
    toast({
      title: '추가 완료',
      description: `"${newItem.name}" 종목이 추가되었습니다.`,
    });
  };

  const handleDeleteItem = async (itemToDelete: MeasurementItem) => {
    if (!school) return;
    
    await deleteItemAndAssociatedRecords(school, itemToDelete);
    
    onItemsUpdate(); // Refresh data in parent
    toast({
      variant: 'destructive',
      title: '삭제 완료',
      description: `"${itemToDelete.name}" 종목과 관련 기록이 모두 삭제되었습니다.`,
    });
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, MeasurementItem[]> = {
      PAPS: [],
    };

    items.forEach(item => {
      const category = item.category || (item.isPaps ? 'PAPS' : '기타');
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Move PAPS to the front
    const orderedGroups: Record<string, MeasurementItem[]> = { PAPS: groups['PAPS'] };
    Object.keys(groups).forEach(key => {
        if (key !== 'PAPS') {
            orderedGroups[key] = groups[key];
        }
    });

    return orderedGroups;
  }, [items]);


  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>측정 종목 관리</CardTitle>
        <CardDescription>측정할 종목을 추가하거나 삭제합니다. PAPS 종목 또는 직접 생성한 기타 종목을 관리할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full items-center space-x-2">
            <AddPapsItemDialog onAddItem={handleAddItem} currentItems={items} />
            <AddCustomItemDialog onAddItem={handleAddItem} />
        </div>
        <div className="border rounded-md p-4 space-y-2">
            <h3 className="font-semibold">현재 종목 목록</h3>
            {items.length > 0 ? (
                <Accordion type="multiple" defaultValue={Object.keys(groupedItems)} className="w-full">
                    {Object.entries(groupedItems).map(([category, categoryItems]) => (
                        categoryItems.length > 0 && (
                            <AccordionItem value={category} key={category}>
                                <AccordionTrigger className="font-semibold">{category} ({categoryItems.length})</AccordionTrigger>
                                <AccordionContent>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-2">
                                        {categoryItems.map((item) => (
                                          <li key={item.id} className="flex items-center justify-between p-2 bg-secondary rounded-md text-sm">
                                              <div>
                                                  <span className="font-semibold">{item.name}</span>
                                                  <span className="text-muted-foreground ml-2">({item.unit}, {recordTypeDisplay[item.recordType]}{item.goal ? `, 목표:${item.goal}`: ''})</span>
                                              </div>
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <X className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        "{item.name}" 종목과 관련된 모든 학생 기록이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                                                    </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteItem(item)}>삭제</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                                </AlertDialog>
                                          </li>
                                        ))}
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    ))}
                </Accordion>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">등록된 종목이 없습니다.</p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddPapsItemDialog({ onAddItem, currentItems }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void>, currentItems: MeasurementItem[] }) {
    const [selectedItemName, setSelectedItemName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const availablePapsItems = Object.keys(papsStandards).filter(
        papsItemName => !currentItems.some(item => item.name === papsItemName)
    );

    const handleSubmit = async () => {
        if (!selectedItemName) {
            toast({ variant: 'destructive', title: '선택 오류', description: '추가할 PAPS 종목을 선택해주세요.' });
            return;
        }
        setIsSubmitting(true);
        const standard = papsStandards[selectedItemName as keyof typeof papsStandards];
        const newItem: Omit<MeasurementItem, 'id'> = {
            name: selectedItemName,
            unit: standard.unit,
            recordType: standard.type,
            isPaps: true,
            category: 'PAPS',
        };
        await onAddItem(newItem);
        setSelectedItemName('');
        setIsSubmitting(false);
        document.getElementById('add-paps-item-dialog-close')?.click();
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> PAPS 종목 추가</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>PAPS 종목 추가</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Label htmlFor="paps-item">추가할 종목</Label>
                    <Select onValueChange={setSelectedItemName} value={selectedItemName}>
                        <SelectTrigger id="paps-item">
                            <SelectValue placeholder="PAPS 종목 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            {availablePapsItems.length > 0 ? (
                                availablePapsItems.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))
                            ) : (
                                <SelectItem value="none" disabled>추가할 수 있는 PAPS 종목이 없습니다.</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button id="add-paps-item-dialog-close" variant="outline">취소</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={availablePapsItems.length === 0 || isSubmitting}>
                       {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                       추가
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function AddCustomItemDialog({ onAddItem }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void> }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [recordType, setRecordType] = useState<RecordType | ''>('');
  const [goal, setGoal] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name || !unit || !recordType || !category) {
      toast({ variant: 'destructive', title: '입력 오류', description: '종목명, 단위, 기록 유형, 카테고리는 필수입니다.' });
      return;
    }
    setIsSubmitting(true);
    const newItem: Omit<MeasurementItem, 'id'> = { name, unit, recordType, isPaps: false, category };
    if (goal) {
        newItem.goal = parseFloat(goal);
    }
    await onAddItem(newItem);
    setName('');
    setUnit('');
    setRecordType('');
    setGoal('');
    setCategory('');
    setIsSubmitting(false);
    document.getElementById('add-custom-item-dialog-close')?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> 기타 종목 추가</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>기타 종목 추가</DialogTitle>
           <DialogDescription>PAPS에 해당하지 않는 새로운 측정 종목을 만듭니다.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">카테고리</Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="col-span-3" placeholder="예: 농구, 배구, 야구" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">종목명</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="예: 자유투" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">단위</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" placeholder="예: 성공, 개, 점수" />
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
                    <SelectItem value="level">상-중-하</SelectItem>
                </SelectContent>
            </Select>
          </div>
           {recordType && recordType !== 'time' && recordType !== 'level' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="goal" className="text-right">목표값(선택)</Label>
              <Input
                id="goal"
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="col-span-3"
                placeholder="예: 10 (달성률 계산에 사용)"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button id="add-custom-item-dialog-close" variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
