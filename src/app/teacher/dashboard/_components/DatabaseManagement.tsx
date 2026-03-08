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
import { FileUp, FileDown, Loader2, Sparkles, KeyRound, Trash2, Search } from "lucide-react";
import { format } from "date-fns";

export function DatabaseManagement({ students, records, items, onUpdate }: { students: Student[], records: MeasurementRecord[], items: MeasurementItem[], onUpdate: () => void }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [deleteDate, setDeleteDate] = useState("");
  const [deleteItem, setDeleteItem] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [studentSearch, setStudentSearch] = useState("");
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);

  const recordDates = useMemo(() => [...new Set(records.map(r => r.date))].sort((a,b) => new Date(b).getTime() - new Date(a).getTime()), [records]);

  const handlePromotionCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        try {
          const promotionData = parseCsv<any>(text);
          if (promotionData.length === 0) throw new Error("CSV 파일에 데이터가 없습니다.");
          const updatedCount = await promoteStudents(school, students, promotionData);
          onUpdate();
          toast({ title: "진급 처리 완료", description: `${updatedCount}명의 학생 정보가 업데이트되었습니다.` });
        } catch (error: any) {
          toast({ variant: "destructive", title: "진급 처리 실패", description: error.message || "CSV 형식을 확인해주세요." });
        } finally { setIsProcessing(false); }
      };
      reader.readAsText(file, "UTF-8");
    }
    event.target.value = ""; 
  };

  const handleRecordCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        setIsUploading(true);
        try {
          const parsedRecords = parseCsv<any>(text);
          if (parsedRecords.length === 0) throw new Error("No data in CSV");
          await addOrUpdateRecords(school, students, parsedRecords);
          onUpdate();
          toast({ title: "기록 등록 완료", description: `기록 일괄 등록이 완료되었습니다.` });
        } catch (error) {
          toast({ variant: "destructive", title: "파일 오류", description: "CSV 파일 형식이나 내용을 확인해주세요." });
        } finally { setIsUploading(false); }
      };
      reader.readAsText(file, "UTF-8");
    }
    event.target.value = ""; 
  };

  const handleSearchStudent = () => {
    if (!studentSearch.trim()) return;
    const found = students.filter(s => s.name.includes(studentSearch.trim()));
    if (found.length === 1) {
        setFoundStudent(found[0]);
        toast({ title: "학생 선택됨", description: `${found[0].name} 학생의 기록을 추출할 수 있습니다.`});
    } else if (found.length > 1) {
        toast({ variant: "default", title: "여러 명의 학생이 검색됨", description: "더 정확한 이름을 입력해주세요."});
        setFoundStudent(null);
    } else {
        toast({ variant: "destructive", title: "검색 결과 없음" });
        setFoundStudent(null);
    }
  };

  const handleDownloadStudentRecords = () => {
      if (!school || !foundStudent) return;
      const studentRecords = records.filter(r => r.studentId === foundStudent.id);
      if (studentRecords.length === 0) {
          toast({ variant: "destructive", title: "데이터 없음", description: "해당 학생의 기록이 없습니다." });
          return;
      }
      const dataToExport = studentRecords.map(r => ({
          학교: school, 학년: foundStudent.grade, 반: foundStudent.classNum, 번호: foundStudent.studentNum,
          이름: foundStudent.name, 성별: foundStudent.gender, 측정종목: r.item, 기록: r.value, 측정일: r.date,
      }));
      exportToCsv(`${school}_${foundStudent.name}_기록.csv`, dataToExport);
  };

  const handleBulkDelete = async () => {
    if (!school || !deleteDate || !deleteItem) return;
    setIsDeleting(true);
    try {
      const deletedCount = await deleteRecordsByDateAndItem(school, deleteDate, deleteItem);
      onUpdate();
      toast({ title: "삭제 완료", description: `${deleteDate}의 ${deleteItem === 'all' ? '모든' : deleteItem} 기록 ${deletedCount}건이 삭제되었습니다.` });
      setDeleteDate(""); setDeleteItem("");
    } finally { setIsDeleting(false); }
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>DB 유틸리티</CardTitle>
        <CardDescription>
          학생 진급 처리, 기록 일괄 등록 및 다운로드, 데이터 정리 등 데이터베이스 관련 작업을 수행합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. 진급 처리 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-2">학생 진급 처리</h3>
          <p className="text-sm text-muted-foreground mb-4">
            새 학년이 시작될 때 학생들의 학년, 반, 번호를 일괄 업데이트합니다. 기존 기록은 그대로 유지됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => document.getElementById("promotion-upload")?.click()} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              진급 파일 업로드
            </Button>
            <input type="file" id="promotion-upload" accept=".csv" onChange={handlePromotionCsvUpload} className="hidden" />
            <Button variant="link" onClick={() => exportToCsv(`${school}_학생_진급_템플릿.csv`, [{ school, grade: "1", classNum: "1", studentNum: "1", name: "홍길동", newGrade: "2", newClassNum: "1", newStudentNum: "1" }])}>
              진급용 템플릿 다운로드
            </Button>
          </div>
        </div>

        {/* 2. 기록 등록 및 추출 */}
        <div className="border-b pb-6 space-y-4">
          <h3 className="text-lg font-semibold">기록 등록 및 다운로드</h3>
          <p className="text-sm text-muted-foreground">
            CSV 파일을 사용하여 여러 학생의 기록을 한 번에 등록하거나, 특정 학생/전체 기록을 엑셀로 백업합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => document.getElementById("record-upload")?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              기록 일괄 등록
            </Button>
            <input type="file" id="record-upload" accept=".csv" onChange={handleRecordCsvUpload} className="hidden" />
            <Button variant="link" onClick={() => exportToZip("기록_등록_템플릿.zip", [{ name: "기록_등록_템플릿.csv", data: [{ school, grade: "1", classNum: "1", studentNum: "1", name: "홍길동", item: "50m 달리기", value: 9.5, date: format(new Date(), 'yyyy-MM-dd')}] }, { name: "등록된_종목_목록.csv", data: items.map(item => ({ '종목명': item.name, '단위': item.unit })) }])}>
              기록용 템플릿(Zip) 다운로드
            </Button>
          </div>
          
          <div className="space-y-2 pt-2">
            <Label>특정 학생 기록 추출</Label>
            <div className="flex flex-wrap gap-2 items-center">
                <Input placeholder="학생 이름..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="w-full sm:w-auto" onKeyDown={e => e.key === 'Enter' && handleSearchStudent()} />
                <Button variant="secondary" onClick={handleSearchStudent}><Search className="h-4 w-4 mr-2" />학생 찾기</Button>
                <Button variant="outline" onClick={handleDownloadStudentRecords} disabled={!foundStudent}><FileDown className="mr-2 h-4 w-4" />{foundStudent ? `${foundStudent.name} 기록 추출` : '기록 추출'}</Button>
                <Button variant="outline" onClick={() => exportToCsv(`${school}_전체_기록.csv`, records.map(r => { const s = students.find(st => st.id === r.studentId); return { 학교: school, 학년: s?.grade, 반: s?.classNum, 번호: s?.studentNum, 이름: s?.name, 성별: s?.gender, 측정종목: r.item, 기록: r.value, 측정일: r.date } }))}>
                    <FileDown className="mr-2 h-4 w-4" />전체 기록 백업
                </Button>
            </div>
          </div>
        </div>

        {/* 3. 기록 일괄 삭제 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-2">기록 일괄 삭제</h3>
          <p className="text-sm text-muted-foreground mb-4">특정 날짜에 잘못 입력된 종목의 모든 기록을 한 번에 삭제합니다.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={deleteDate} onValueChange={setDeleteDate}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="삭제할 날짜 선택" /></SelectTrigger>
              <SelectContent>{recordDates.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={deleteItem} onValueChange={setDeleteItem}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="삭제할 종목 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 종목</SelectItem>
                {items.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!deleteDate || !deleteItem || isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  일괄 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle><AlertDialogDescription>{deleteDate}의 선택한 기록이 영구 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete}>삭제</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* 4. 기타 유틸리티 */}
        <div>
          <h3 className="text-lg font-semibold mb-2">데이터 정리 및 복구</h3>
          <p className="text-sm text-muted-foreground mb-4">
            중복 기록을 정리하거나, 시스템 오류 등으로 누락된 학생의 접속 코드를 일괄 생성합니다.
            <br />
            <span className="text-xs text-blue-600 font-medium">* 새로 생성된 코드는 '학생 관리' 탭의 명단에서 확인하실 수 있습니다. (신규 등록 학생은 자동 생성되므로 보통은 사용하실 필요가 없습니다.)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => { setIsProcessing(true); await cleanUpDuplicateRecords(school!); onUpdate(); setIsProcessing(false); }} disabled={isProcessing}>
              <Sparkles className="mr-2 h-4 w-4" /> 중복 데이터 정리
            </Button>
            <Button variant="outline" onClick={async () => { setIsProcessing(true); await assignMissingAccessCodes(school!); onUpdate(); setIsProcessing(false); }} disabled={isProcessing}>
              <KeyRound className="mr-2 h-4 w-4" /> 미할당 접속 코드 생성
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
