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

export default function MeasurementManagement() {
  const { school } = useAuth();
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (school) {
      setItems(getItems(school));
    }
  }, [school]);

  const handleAddItem = () => {
    if (newItem.trim() === '' || !school) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '종목 이름을 입력해주세요.',
      });
      return;
    }
    addItem(school, newItem);
    setItems(getItems(school));
    setNewItem('');
    toast({
      title: '추가 완료',
      description: `"${newItem}" 종목이 추가되었습니다.`,
    });
  };

  const handleDeleteItem = (itemToDelete: string) => {
    if (!school) return;
    deleteItem(school, itemToDelete);
    setItems(getItems(school));
    toast({
      variant: 'destructive',
      title: '삭제 완료',
      description: `"${itemToDelete}" 종목이 삭제되었습니다.`,
    });
  };

  if (!school) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>측정 종목 관리</CardTitle>
        <CardDescription>측정할 종목을 추가하거나 삭제합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="새 종목 이름"
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <Button onClick={handleAddItem}><Plus className="mr-2 h-4 w-4" /> 추가</Button>
        </div>
        <div className="border rounded-md p-4 space-y-2">
            <h3 className="font-semibold">현재 종목 목록</h3>
            {items.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {items.map((item) => (
                    <li key={item} className="flex items-center justify-between p-2 bg-secondary rounded-md">
                        <span className="text-sm">{item}</span>
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