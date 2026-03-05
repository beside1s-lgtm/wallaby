
'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Youtube, ClipboardList, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { addOrUpdateRecord } from '@/lib/store';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export function MeasurementInputTab({ items, student }: any) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [selectedItemName, setSelectedItemName] = useState('');
  const [val, setVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!school || !student || !selectedItemName) return;
    setIsSubmitting(true);
    try {
      await addOrUpdateRecord({ studentId: student.id, school, item: selectedItemName, value: parseFloat(val), date: format(new Date(), 'yyyy-MM-dd') });
      toast({ title: "기록 저장 완료" }); setVal('');
    } finally { setIsSubmitting(false); }
  };

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>기록 입력</CardTitle><CardDescription>오늘의 측정 결과를 입력하세요.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedItemName} onValueChange={setSelectedItemName}><SelectTrigger><SelectValue placeholder="종목 선택" /></SelectTrigger><SelectContent>{items.map((i:any)=><SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
        <div className="space-y-2"><Label>기록 입력</Label><Input type="number" value={val} onChange={e=>setVal(e.target.value)} /></div>
      </CardContent>
      <CardFooter><Button className="w-full" onClick={handleSave} disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2" />}저장하기</Button></CardFooter>
    </Card>
  );
}
