
'use client';
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { archiveItem, archiveCategory, getItems, deleteItemAndAssociatedRecords, deleteCategoryAndAssociatedRecords, updateItem, deactivateItem, deactivateCategory } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Pencil, CalendarRange, Check, ChevronRight, Loader2 } from 'lucide-react';
import type { MeasurementItem } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AddPapsItemDialog } from './AddPapsItemDialog';
import { AddSportDialog } from './AddSportDialog';
import { AddCustomItemDialog } from './AddCustomItemDialog';
import { EditItemDialog } from './EditItemDialog';

export default function MeasurementManagement({ items, onItemsUpdate }: { items: MeasurementItem[], onItemsUpdate: (items: MeasurementItem[]) => void }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState<'none' | 'archive' | 'deactivate' | 'delete' | 'measurementWeek'>('none');
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const refresh = async () => { if (school) onItemsUpdate(await getItems(school)); };

  const handleBulkAction = async () => {
    if (!school) return;
    setIsProcessing(true);
    const selectedItems = items.filter(i => selection[i.id]);
    try {
      if (editMode === 'archive') {
        await Promise.all(selectedItems.map(i => archiveItem(school, i.id, true)));
      } else if (editMode === 'deactivate') {
        await Promise.all(selectedItems.map(i => deactivateItem(school, i.id, true)));
      } else if (editMode === 'delete') {
        if (selectedItems.some(i => i.isPaps)) { toast({ variant: "destructive", title: "PAPS는 삭제 불가" }); return; }
        await Promise.all(selectedItems.map(i => deleteItemAndAssociatedRecords(school, i)));
      }
      await refresh(); setEditMode('none'); setSelection({});
      toast({ title: "작업 완료" });
    } finally { setIsProcessing(false); }
  };

  const grouped = useMemo(() => {
    const res: Record<string, MeasurementItem[]> = {};
    items.filter(i => !i.isDeactivated && !i.isArchived).forEach(i => {
      const cat = i.category || (i.isPaps ? 'PAPS' : '기타');
      if (!res[cat]) res[cat] = [];
      res[cat].push(i);
    });
    return res;
  }, [items]);

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>종목 관리</CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <AddPapsItemDialog onAdd={refresh} currentItems={items} school={school || ''} />
          <AddSportDialog onAdd={refresh} allItems={items} school={school || ''} />
          <AddCustomItemDialog onAdd={refresh} school={school || ''} />
          <div className="ml-auto flex gap-2">
            <Button variant={editMode === 'measurementWeek' ? 'outline-active' : 'outline'} onClick={() => setEditMode(editMode === 'measurementWeek' ? 'none' : 'measurementWeek')}><CalendarRange className="mr-2 h-4 w-4" />측정 주간</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><Pencil className="mr-2 h-4 w-4" />편집</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setEditMode('archive')}>숨기기</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditMode('deactivate')}>비활성화</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setEditMode('delete')}>영구 삭제</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={Object.keys(grouped)}>
          {Object.entries(grouped).map(([cat, catItems]) => (
            <AccordionItem key={cat} value={cat}>
              <AccordionTrigger className="font-bold">{cat} ({catItems.length})</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {catItems.map(i => (
                    <div key={i.id} className="flex items-center p-2 bg-secondary rounded-md">
                      {editMode !== 'none' && <Checkbox className="mr-2" checked={selection[i.id]} onCheckedChange={c => setSelection({...selection, [i.id]: !!c})} />}
                      <span className="flex-1 font-medium">{i.name}</span>
                      <EditItemDialog item={i} onUpdate={refresh} school={school || ''} />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {editMode !== 'none' && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setEditMode('none'); setSelection({}); }}>취소</Button>
            <Button onClick={handleBulkAction} disabled={isProcessing}>{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}확인</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
