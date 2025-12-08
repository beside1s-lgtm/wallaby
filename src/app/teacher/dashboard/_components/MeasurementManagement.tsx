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
import { Checkbox } from '@/components/ui/checkbox';

interface MeasurementManagementProps {
  items: MeasurementItem[];
  onItemsUpdate: () => void;
}

const recordTypeDisplay: Record<RecordType, string> = {
    time: "시간",
    count: "횟수",
    distance: "거리",
    weight: "무게",
    level: "상중하",
    compound: "복합"
};

const teamSportMetrics: Record<string, {name: string, unit: string, recordType: RecordType, goal?: number}[]> = {
    '농구': [
        { name: '슛', unit: '점', recordType: 'count', goal: 10 },
        { name: '어시스트', unit: '점', recordType: 'count', goal: 10 },
        { name: '리바운드', unit: '점', recordType: 'count', goal: 10 },
        { name: '스틸', unit: '점', recordType: 'count', goal: 10 },
    ],
    '배구': [
        { name: '스파이크', unit: '점', recordType: 'count', goal: 10 },
        { name: '리시브', unit: '점', recordType: 'count', goal: 10 },
        { name: '토스', unit: '점', recordType: 'count', goal: 10 },
        { name: '서브', unit: '점', recordType: 'count', goal: 10 },
    ],
    '야구': [
        { name: '타격', unit: '점', recordType: 'count', goal: 10 },
        { name: '주루', unit: '점', recordType: 'count', goal: 10 },
        { name: '송구', unit: '점', recordType: 'count', goal: 10 },
        { name: '포구', unit: '점', recordType: 'count', goal: 10 },
    ],
    '축구': [
        { name: '득점', unit: '점', recordType: 'count', goal: 5 },
        { name: '패스', unit: '점', recordType: 'count', goal: 20 },
        { name: '돌파성공', unit: '점', recordType: 'count', goal: 10 },
        { name: '수비성공', unit: '점', recordType: 'count', goal: 15 },
    ],
    '피구': [
        { name: '공격성공', unit: '점', recordType: 'count', goal: 10 },
        { name: '패스성공', unit: '점', recordType: 'count', goal: 20 },
        { name: '포구', unit: '점', recordType: 'count', goal: 10 },
        { name: '회피성공', unit: '점', recordType: 'count', goal: 15 },
    ]
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

    // Move PAPS to the front, then team sports, then others
    const orderedGroups: Record<string, MeasurementItem[]> = { };
    const teamSportCategories = Object.keys(teamSportMetrics);
    
    if (groups['PAPS']?.length > 0) orderedGroups['PAPS'] = groups['PAPS'];
    teamSportCategories.forEach(cat => {
      if (groups[cat]?.length > 0) orderedGroups[cat] = groups[cat];
    });

    Object.keys(groups).forEach(key => {
        if (key !== 'PAPS' && !teamSportCategories.includes(key)) {
            orderedGroups[key] = groups[key];
        }
    });

    return orderedGroups;
  }, [items]);


  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>종목 관리</CardTitle>
        <CardDescription>측정할 종목을 추가하거나 삭제합니다. PAPS, 팀 스포츠 또는 직접 생성한 기타 종목을 관리할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full flex-wrap items-center gap-2">
            <AddPapsItemDialog onAddItem={handleAddItem} currentItems={items} />
            <AddTeamSportItemsDialog onAddItems={async (newItems) => {
                if (!school) return;
                for (const item of newItems) {
                    await addItemToDb(school, item);
                }
                onItemsUpdate();
                toast({ title: '추가 완료', description: `${newItems.length}개의 팀 스포츠 종목이 추가되었습니다.` });
            }} currentItems={items} />
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
            isCompound: standard.type === 'compound',
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
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> PAPS</Button>
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

function AddTeamSportItemsDialog({ onAddItems, currentItems }: { onAddItems: (items: Omit<MeasurementItem, 'id'>[]) => Promise<void>, currentItems: MeasurementItem[] }) {
    const [selectedSport, setSelectedSport] = useState('');
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const availableMetrics = useMemo(() => {
        if (!selectedSport) return [];
        return (teamSportMetrics[selectedSport] || []).filter(
            metric => !currentItems.some(item => item.name === metric.name && item.category === selectedSport)
        );
    }, [selectedSport, currentItems]);

    const handleSportChange = (sport: string) => {
        setSelectedSport(sport);
        setCheckedItems({});
    };

    const handleCheckChange = (itemName: string, isChecked: boolean) => {
        setCheckedItems(prev => ({ ...prev, [itemName]: isChecked }));
    };

    const handleSubmit = async () => {
        const itemsToAdd = availableMetrics
            .filter(metric => checkedItems[metric.name])
            .map(metric => ({
                name: metric.name,
                unit: metric.unit,
                recordType: metric.recordType,
                goal: metric.goal,
                isPaps: false,
                category: selectedSport,
            }));

        if (itemsToAdd.length === 0) {
            return;
        }

        setIsSubmitting(true);
        await onAddItems(itemsToAdd);
        setIsSubmitting(false);
        setSelectedSport('');
        setCheckedItems({});
        document.getElementById('add-team-sport-dialog-close')?.click();
    };

    return (
        <Dialog onOpenChange={(open) => { if (!open) { setSelectedSport(''); setCheckedItems({}); } }}>
            <DialogTrigger asChild>
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> 팀 스포츠</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>팀 스포츠 종목 추가</DialogTitle>
                    <DialogDescription>스포츠를 선택하고 추가할 평가지표를 선택하세요.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Label htmlFor="sport-select">스포츠 종류</Label>
                    <Select onValueChange={handleSportChange} value={selectedSport}>
                        <SelectTrigger id="sport-select">
                            <SelectValue placeholder="스포츠 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.keys(teamSportMetrics).map(sport => (
                                <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedSport && (
                        <div className="space-y-2 pt-4">
                            <Label>평가지표 선택</Label>
                            <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                                {availableMetrics.length > 0 ? availableMetrics.map(metric => (
                                    <div key={metric.name} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`metric-${metric.name}`}
                                            checked={checkedItems[metric.name] || false}
                                            onCheckedChange={(checked) => handleCheckChange(metric.name, !!checked)}
                                        />
                                        <Label htmlFor={`metric-${metric.name}`}>{metric.name}</Label>
                                    </div>
                                )) : <p className="col-span-2 text-sm text-muted-foreground">모든 {selectedSport} 종목이 추가되었습니다.</p>}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button id="add-team-sport-dialog-close" variant="outline">취소</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={Object.values(checkedItems).every(v => !v) || isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        선택 항목 추가
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
        <Button><Plus className="mr-2 h-4 w-4" /> 기타</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>기타 종목 추가</DialogTitle>
           <DialogDescription>기록지가 없는 새로운 측정 종목을 만듭니다. (예: 줄넘기, 턱걸이 등)</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">카테고리</Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="col-span-3" placeholder="예: 구기, 육상" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">종목명</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="예: 줄넘기" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">단위</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" placeholder="예: 회, 초" />
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
