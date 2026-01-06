'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { 
    addItem as addItemToDb, 
    archiveItem, 
    archiveCategory, 
    getItems,
    deleteItemAndAssociatedRecords,
    deleteCategoryAndAssociatedRecords,
    updateItem,
} from '@/lib/store';
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
import { Plus, Loader2, Trash2, Pencil, Swords, Target } from 'lucide-react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MeasurementManagementProps {
  items: MeasurementItem[];
  onItemsUpdate: (items: MeasurementItem[]) => void;
}

const recordTypeDisplay: Record<RecordType, string> = {
    time: "시간",
    count: "횟수",
    distance: "거리",
    weight: "무게",
    level: "상중하",
    compound: "복합"
};

export default function MeasurementManagement({ items, onItemsUpdate }: MeasurementManagementProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  
  const [editMode, setEditMode] = useState<'none' | 'archive' | 'delete'>('none');
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const refreshItems = async () => {
      if (!school) return;
      const updatedItems = await getItems(school);
      onItemsUpdate(updatedItems);
  }

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
    await refreshItems();
    toast({
      title: '추가 완료',
      description: `"${newItem.name}" 종목이 추가되었습니다.`,
    });
  };
  
  const handleUpdateItem = async (itemId: string, data: Partial<Omit<MeasurementItem, 'id'>>) => {
    if (!school) return;
    try {
        await updateItem(school, itemId, data);
        await refreshItems();
        toast({ title: '수정 완료', description: '종목 정보가 업데이트되었습니다.'});
    } catch (e) {
        toast({ variant: 'destructive', title: '수정 실패', description: '종목 정보 업데이트 중 오류가 발생했습니다.'});
    }
  }

  const handleToggleMeasurementWeek = async (item: MeasurementItem, checked: boolean) => {
    if (!school) return;
    try {
      await updateItem(school, item.id, { isMeasurementWeek: checked });
      await refreshItems();
       toast({
        title: '설정 변경',
        description: `${item.name}이(가) 측정 주간으로 ${checked ? '설정' : '해제'}되었습니다.`,
      });
    } catch(error) {
       toast({
        variant: 'destructive',
        title: '업데이트 실패',
      });
    }
  };

  const cancelEditMode = () => {
    setEditMode('none');
    setSelection({});
  }

  const handleBulkAction = async () => {
    if (!school) return;

    const selectedItems = items.filter(item => selection[item.id]);
    const selectedCategories = Object.keys(selection).filter(key => !items.some(item => item.id === key) && selection[key]);
    
    if (selectedItems.length === 0 && selectedCategories.length === 0) {
      toast({ variant: 'destructive', title: '선택 오류', description: '처리할 항목을 선택해주세요.' });
      return;
    }

    setIsProcessing(true);
    try {
        if (editMode === 'archive') {
            for (const category of selectedCategories) {
                await archiveCategory(school, category, items, true);
            }
            for (const item of selectedItems) {
                await archiveItem(school, item.id, true);
            }
            toast({ title: '숨김 처리 완료', description: '선택한 항목들이 숨김 처리되었습니다.' });
        } else if (editMode === 'delete') {
            for (const category of selectedCategories) {
                await deleteCategoryAndAssociatedRecords(school, category, items);
            }
            for (const item of selectedItems) {
                await deleteItemAndAssociatedRecords(school, item);
            }
            toast({ title: '영구 삭제 완료', description: '선택한 항목과 관련 기록이 모두 삭제되었습니다.' });
        }
        await refreshItems();
        cancelEditMode();
    } catch (error) {
        console.error("Failed to perform bulk action", error);
        toast({ variant: 'destructive', title: '작업 실패' });
    } finally {
        setIsProcessing(false);
    }
  };


  const { groupedItems, archivedItems } = useMemo(() => {
    const active: Record<string, MeasurementItem[]> = {};
    const archived: MeasurementItem[] = [];

    items.forEach(item => {
        if (item.isArchived) {
            archived.push(item);
            return;
        }
        const category = item.category || (item.isPaps ? 'PAPS' : '기타');
        if (!active[category]) {
            active[category] = [];
        }
        active[category].push(item);
    });

    const orderedGroups: Record<string, MeasurementItem[]> = {};
    
    if (active['PAPS']) {
        orderedGroups['PAPS'] = active['PAPS'];
    }
    
    const sortedCategories = Object.keys(active)
      .filter(key => key !== 'PAPS' && key !== '기타')
      .sort((a,b) => a.localeCompare(b));

    sortedCategories.forEach(key => {
        orderedGroups[key] = active[key];
    });

    if (active['기타']) {
        orderedGroups['기타'] = active['기타'];
    }

    return { groupedItems: orderedGroups, archivedItems: archived };
  }, [items]);


  if (!school) return null;

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>종목 관리</CardTitle>
        <CardDescription>측정할 종목을 추가하고, 숨기거나 영구 삭제하여 목록을 관리합니다. '측정 주간'으로 설정하여 명예의 전당에 표시할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full flex-wrap items-center gap-2">
            <AddPapsItemDialog onAddItem={handleAddItem} currentItems={items} />
            <AddSportItemDialog onAddItem={handleAddItem} />
            <AddCustomItemDialog onAddItem={handleAddItem} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Pencil className="mr-2 h-4 w-4" /> 종목 편집</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => { setEditMode('archive'); setSelection({}); }}>
                  선택 숨김
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setEditMode('delete'); setSelection({}); }} className="text-destructive">
                  선택 영구 삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

        </div>
        <div className="border rounded-md p-4 space-y-2">
            <h3 className="font-semibold">활성 종목 목록</h3>
            {Object.values(groupedItems).some(arr => arr.length > 0) ? (
                <Accordion type="multiple" defaultValue={Object.keys(groupedItems)} className="w-full">
                    {Object.entries(groupedItems).map(([category, categoryItems]) => (
                        categoryItems.length > 0 && (
                            <AccordionItem value={category} key={category}>
                                <div className="flex items-center w-full">
                                    {editMode !== 'none' && (
                                        <Checkbox
                                            id={`category-${category}`}
                                            checked={selection[category] || false}
                                            onCheckedChange={(checked) => setSelection(prev => ({...prev, [category]: !!checked}))}
                                            className="mr-4"
                                        />
                                    )}
                                    <AccordionTrigger className="font-semibold flex-1">
                                        {category} ({categoryItems.length})
                                    </AccordionTrigger>
                                </div>
                                <AccordionContent>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-2">
                                        {categoryItems.map((item) => (
                                          <li key={item.id} className="flex items-center p-2 bg-secondary rounded-md text-sm">
                                               {editMode !== 'none' ? (
                                                    <Checkbox
                                                        id={`item-${item.id}`}
                                                        checked={selection[item.id] || false}
                                                        onCheckedChange={(checked) => setSelection(prev => ({...prev, [item.id]: !!checked}))}
                                                        className="mr-4"
                                                    />
                                                ) : (
                                                    <Checkbox
                                                        id={`measurement-week-${item.id}`}
                                                        checked={item.isMeasurementWeek || false}
                                                        onCheckedChange={(checked) => handleToggleMeasurementWeek(item, !!checked)}
                                                        className="mr-4"
                                                    />
                                                )}
                                              <div className="flex-1">
                                                  <span className="font-semibold">{item.name}</span>
                                                  <span className="text-muted-foreground ml-2">({item.unit}, {recordTypeDisplay[item.recordType]}{item.goal ? `, 목표:${item.goal}`: ''})</span>
                                              </div>
                                              <EditItemDialog item={item} onUpdate={handleUpdateItem} />
                                          </li>
                                        ))}
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    ))}
                </Accordion>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">활성화된 종목이 없습니다.</p>
            )}

            {archivedItems.length > 0 && (
                <Accordion type="single" collapsible className="w-full mt-4">
                    <AccordionItem value="archived">
                        <AccordionTrigger className="font-semibold text-muted-foreground">
                            숨겨진 종목 ({archivedItems.length})
                        </AccordionTrigger>
                        <AccordionContent>
                             <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-2">
                                {archivedItems.map((item) => (
                                    <li key={item.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md text-sm">
                                        <div>
                                            <span className="font-semibold">{item.name}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={async () => {
                                            if(!school) return;
                                            await archiveItem(school, item.id, false);
                                            refreshItems();
                                            toast({ title: '복원 완료', description: `${item.name} 종목이 복원되었습니다.`});
                                        }}>복원</Button>
                                    </li>
                                ))}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
        {editMode !== 'none' && (
            <div className="flex justify-end items-center gap-2 p-4 border-t sticky bottom-0 bg-background">
                <p className="text-sm text-muted-foreground">
                    {Object.values(selection).filter(Boolean).length}개 항목 선택됨
                </p>
                <Button variant="outline" onClick={cancelEditMode}>취소</Button>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant={editMode === 'delete' ? 'destructive' : 'default'}
                            disabled={isProcessing || Object.values(selection).filter(Boolean).length === 0}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editMode === 'archive' ? '선택 항목 숨기기' : '선택 항목 영구 삭제'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>정말로 {editMode === 'archive' ? '숨기시겠습니까?' : '삭제하시겠습니까?'}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {editMode === 'archive' 
                                    ? '선택한 항목들이 목록에서 숨겨집니다. 기록은 삭제되지 않으며 나중에 복원할 수 있습니다.'
                                    : '이 작업은 되돌릴 수 없습니다. 선택한 항목과 관련된 모든 학생 기록이 영구적으로 삭제됩니다.'
                                }
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkAction} className={editMode === 'delete' ? 'bg-destructive' : ''}>
                                {editMode === 'archive' ? '숨김 처리' : '영구 삭제'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditItemDialog({ item, onUpdate }: { item: MeasurementItem, onUpdate: (itemId: string, data: Partial<Omit<MeasurementItem, 'id'>>) => Promise<void> }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [goal, setGoal] = useState(item.goal?.toString() || '');
    const [category, setCategory] = useState(item.category || '');
    const { toast } = useToast();
    
    useEffect(() => {
        if(isOpen) {
            setGoal(item.goal?.toString() || '');
            setCategory(item.category || (item.isPaps ? 'PAPS' : ''));
        }
    }, [isOpen, item]);

    const handleSubmit = async () => {
        if (item.isPaps) {
            toast({ variant: 'destructive', title: '수정 불가', description: 'PAPS 종목은 수정할 수 없습니다.' });
            return;
        }

        const dataToUpdate: Partial<Omit<MeasurementItem, 'id'>> = {};
        
        if (category.trim() !== (item.category || '')) {
            dataToUpdate.category = category.trim();
        }
        
        if (item.recordType !== 'time' && item.recordType !== 'level' && item.recordType !== 'compound') {
            const newGoal = goal ? parseFloat(goal) : undefined;
            if (newGoal !== item.goal) {
                dataToUpdate.goal = newGoal;
            }
        }
        
        if (Object.keys(dataToUpdate).length === 0) {
            toast({ title: '변경 사항 없음' });
            setIsOpen(false);
            return;
        }

        setIsSubmitting(true);
        await onUpdate(item.id, dataToUpdate);
        setIsSubmitting(false);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" disabled={item.isPaps}>
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{item.name} 종목 수정</DialogTitle>
                    <DialogDescription>
                        {item.isPaps ? 'PAPS 종목은 수정할 수 없습니다.' : '종목의 카테고리 또는 목표값을 수정합니다.'}
                    </DialogDescription>
                </DialogHeader>
                {!item.isPaps && (
                    <>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-category" className="text-right">
                                    카테고리
                                </Label>
                                <Input
                                    id="edit-category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="col-span-3"
                                    placeholder="예: 구기, 육상"
                                />
                            </div>
                            {(item.recordType !== 'time' && item.recordType !== 'level' && item.recordType !== 'compound') && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="edit-goal" className="text-right">
                                        목표값
                                    </Label>
                                    <Input
                                        id="edit-goal"
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
                            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                저장
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
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

function AddSportItemDialog({ onAddItem }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void> }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [recordType, setRecordType] = useState<RecordType | ''>('');
  const [goal, setGoal] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name || !unit || !recordType || !category) {
      toast({ variant: 'destructive', title: '입력 오류', description: '스포츠명(카테고리), 평가지표명, 단위, 기록 유형은 필수입니다.' });
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
    document.getElementById('add-sport-item-dialog-close')?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><Swords className="mr-2 h-4 w-4" /> 스포츠 종목 추가</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>스포츠 평가지표 추가</DialogTitle>
           <DialogDescription>새로운 스포츠와 평가지표를 만듭니다. (예: 카테고리: 럭비, 종목명: 태클 성공)</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sport-category" className="text-right">스포츠명(카테고리)</Label>
            <Input id="sport-category" value={category} onChange={(e) => setCategory(e.target.value)} className="col-span-3" placeholder="예: 농구, 축구, 럭비" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sport-name" className="text-right">평가지표명</Label>
            <Input id="sport-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="예: 자유투, 헤딩, 태클 성공" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sport-unit" className="text-right">단위</Label>
            <Input id="sport-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" placeholder="예: 회, 점, 개" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sport-recordType" className="text-right">기록 유형</Label>
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
              <Label htmlFor="sport-goal" className="text-right">목표값(선택)</Label>
              <Input
                id="sport-goal"
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
            <Button id="add-sport-item-dialog-close" variant="outline">취소</Button>
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

function AddCustomItemDialog({ onAddItem }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void> }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [recordType, setRecordType] = useState<RecordType | ''>('');
  const [goal, setGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name || !unit || !recordType) {
      toast({ variant: 'destructive', title: '입력 오류', description: '종목명, 단위, 기록 유형은 필수입니다.' });
      return;
    }
    setIsSubmitting(true);
    const newItem: Omit<MeasurementItem, 'id'> = { name, unit, recordType, isPaps: false, category: '기타' };
    if (goal) {
        newItem.goal = parseFloat(goal);
    }
    await onAddItem(newItem);
    setName('');
    setUnit('');
    setRecordType('');
    setGoal('');
    setIsSubmitting(false);
    document.getElementById('add-custom-item-dialog-close')?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline"><Target className="mr-2 h-4 w-4" /> 기타 종목 추가</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>기타 종목 추가</DialogTitle>
           <DialogDescription>스포츠가 아닌 새로운 활동 종목을 추가합니다.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="custom-name" className="text-right">종목명</Label>
            <Input id="custom-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="예: 턱걸이, 플랭크" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="custom-unit" className="text-right">단위</Label>
            <Input id="custom-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" placeholder="예: 회, 초" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="custom-recordType" className="text-right">기록 유형</Label>
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
              <Label htmlFor="custom-goal" className="text-right">목표값(선택)</Label>
              <Input
                id="custom-goal"
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
