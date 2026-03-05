
'use client';
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  exportToCsv,
  addOrUpdateRecords,
  deleteRecordsByDateAndItem,
  cleanUpDuplicateRecords,
  assignMissingAccessCodes,
  promoteStudents,
} from "@/lib/store";
import type { Student, MeasurementItem, MeasurementRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { parseCsv, exportToZip } from "@/lib/utils";
import { FileUp, FileDown, Loader2, Sparkles, KeyRound, Trash2 } from "lucide-react";

export function DatabaseManagement({ students, records, items, onUpdate }: { students: Student[], records: MeasurementRecord[], items: MeasurementItem[], onUpdate: () => void }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteDate, setDeleteDate] = useState("");
  const [deleteItem, setDeleteItem] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);

  const recordDates = useMemo(() => [...new Set(records.map(r => r.date))].sort((a,b) => new Date(b).getTime() - new Date(a).getTime()), [records]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'records' | 'promote') => {
    const file = e.target.files?.[0];
    if (!file || !school) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = parseCsv<any>(ev.target?.result as string);
        if (type === 'records') await addOrUpdateRecords(school, students, data);
        else await promoteStudents(school, students, data);
        onUpdate(); toast({ title: "완료되었습니다." });
      } catch (err) { toast({ variant: "destructive", title: "실패" }); }
      finally { setIsProcessing(false); }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader><CardTitle>DB 유틸리티</CardTitle><CardDescription>데이터베이스 관리 작업을 수행합니다.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div className="border-b pb-6">
          <h3 className="font-semibold mb-2">진급 처리 및 기록 관리</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => document.getElementById("promote-upload")?.click()} disabled={isProcessing}><FileUp className="mr-2 h-4 w-4" /> 진급 파일 업로드</Button>
            <input type="file" id="promote-upload" accept=".csv" onChange={e => handleUpload(e, 'promote')} className="hidden" />
            <Button variant="outline" onClick={() => document.getElementById("record-upload")?.click()} disabled={isProcessing}><FileUp className="mr-2 h-4 w-4" /> 기록 일괄 등록</Button>
            <input type="file" id="record-upload" accept=".csv" onChange={e => handleUpload(e, 'records')} className="hidden" />
          </div>
        </div>
        <div className="border-b pb-6 space-y-4">
          <h3 className="font-semibold">기록 삭제</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={deleteDate} onValueChange={setDeleteDate}><SelectTrigger className="w-[200px]"><SelectValue placeholder="날짜" /></SelectTrigger><SelectContent>{recordDates.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
            <Select value={deleteItem} onValueChange={setDeleteItem}><SelectTrigger className="w-[180px]"><SelectValue placeholder="종목" /></SelectTrigger><SelectContent><SelectItem value="all">모든 종목</SelectItem>{items.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" disabled={!deleteDate || !deleteItem || isProcessing}><Trash2 className="mr-2 h-4 w-4" /> 일괄 삭제</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle><AlertDialogDescription>{deleteDate}의 기록이 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={async () => { setIsProcessing(true); await deleteRecordsByDateAndItem(school!, deleteDate, deleteItem); onUpdate(); setIsProcessing(false); }}>삭제</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => { setIsProcessing(true); await cleanUpDuplicateRecords(school!); onUpdate(); setIsProcessing(false); }} disabled={isProcessing}><Sparkles className="mr-2 h-4 w-4" /> 중복 정리</Button>
          <Button variant="outline" onClick={async () => { setIsProcessing(true); await assignMissingAccessCodes(school!); onUpdate(); setIsProcessing(false); }} disabled={isProcessing}><KeyRound className="mr-2 h-4 w-4" /> 코드 생성</Button>
        </div>
      </CardContent>
    </Card>
  );
}
