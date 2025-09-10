'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  getStudents,
  setStudents,
  getRecords,
  setRecords,
  addStudent,
} from '@/lib/store';
import type { Student, StudentLogin } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { parseCsv, exportToCsv } from '@/lib/utils';
import { UserPlus, Trash2, FileUp, FileDown } from 'lucide-react';

export default function StudentManagement() {
  const [students, setStudentsState] = useState<Student[]>([]);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    setStudentsState(getStudents());
  }, []);

  const selectedIds = useMemo(
    () => Object.keys(selection).filter((id) => selection[id]),
    [selection]
  );

  const handleAddStudent = (studentData: StudentLogin) => {
    addStudent(studentData);
    setStudentsState(getStudents());
    toast({ title: '학생 추가 완료', description: `${studentData.name} 학생을 등록했습니다.` });
  };

  const handleDeleteSelected = () => {
    const studentsToDelete = getStudents().filter(s => selectedIds.includes(s.id));
    const studentNames = studentsToDelete.map(s => s.name).join(', ');

    const currentStudents = getStudents().filter(s => !selectedIds.includes(s.id));
    setStudents(currentStudents);
    setStudentsState(currentStudents);

    const currentRecords = getRecords().filter(r => !selectedIds.includes(r.studentId));
    setRecords(currentRecords);

    setSelection({});
    toast({
      variant: 'destructive',
      title: '삭제 완료',
      description: `${studentNames} 학생 정보를 삭제했습니다.`,
    });
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
      students.forEach((s) => (newSelection[s.id] = true));
    }
    setSelection(newSelection);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelection((prev) => ({ ...prev, [id]: checked }));
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const newStudents = parseCsv<StudentLogin>(text);
          let count = 0;
          newStudents.forEach(student => {
            if (student.grade && student.classNum && student.studentNum && student.name) {
              addStudent(student);
              count++;
            }
          });
          setStudentsState(getStudents());
          toast({ title: '일괄 등록 완료', description: `${count}명의 학생을 등록했습니다.` });
        } catch (error) {
          toast({ variant: 'destructive', title: 'CSV 파싱 오류', description: '파일 형식이 올바르지 않습니다.' });
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
    event.target.value = ''; // Reset file input
  };
  
  const handleDownloadAllRecords = () => {
    const allRecords = getRecords();
    const allStudents = getStudents();
    if(allRecords.length === 0){
        toast({variant: 'destructive', title: '데이터 없음', description: '다운로드할 기록이 없습니다.'})
        return;
    }
    
    const studentMap = new Map(allStudents.map(s => [s.id, s]));
    
    const dataToExport = allRecords.map(record => {
        const student = studentMap.get(record.studentId);
        return {
            학년: student?.grade || '',
            반: student?.classNum || '',
            번호: student?.studentNum || '',
            이름: student?.name || '알수없음',
            측정종목: record.item,
            기록: record.value,
            측정일: record.date,
        }
    });
    
    exportToCsv('all_student_records.csv', dataToExport);
    toast({ title: '다운로드 시작', description: '전체 학생 기록을 CSV 파일로 다운로드합니다.'});
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>학생 관리</CardTitle>
        <CardDescription>학생을 등록, 삭제하고 전체 기록을 관리합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <AddStudentDialog onAddStudent={handleAddStudent} />
          <Button variant="outline" onClick={() => document.getElementById('csv-upload')?.click()}>
            <FileUp className="mr-2 h-4 w-4" />
            CSV 일괄 등록
          </Button>
          <input type="file" id="csv-upload" accept=".csv" onChange={handleCsvUpload} style={{ display: 'none' }} />
          <a href="/template.csv" download className="text-sm text-muted-foreground hover:text-primary underline">템플릿 다운로드</a>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadAllRecords}>
              <FileDown className="mr-2 h-4 w-4" />
              전체 기록 다운로드
            </Button>
            <Button
              variant="destructive"
              disabled={selectedIds.length === 0}
              onClick={handleDeleteSelected}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              선택 삭제 ({selectedIds.length})
            </Button>
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={students.length > 0 && selectedIds.length === students.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>학년</TableHead>
                <TableHead>반</TableHead>
                <TableHead>번호</TableHead>
                <TableHead>이름</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length > 0 ? (
                students.map((student) => (
                  <TableRow key={student.id} data-state={selection[student.id] && 'selected'}>
                    <TableCell>
                      <Checkbox
                        checked={selection[student.id] || false}
                        onCheckedChange={(checked) => handleSelectRow(student.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell>{student.classNum}</TableCell>
                    <TableCell>{student.studentNum}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    등록된 학생이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}


function AddStudentDialog({ onAddStudent }: { onAddStudent: (data: StudentLogin) => void }) {
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [name, setName] = useState('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!grade || !classNum || !studentNum || !name) {
      toast({ variant: 'destructive', title: '입력 오류', description: '모든 필드를 입력해주세요.' });
      return;
    }
    onAddStudent({ grade, classNum, studentNum, name });
    setGrade('');
    setClassNum('');
    setStudentNum('');
    setName('');
    document.getElementById('add-student-dialog-close')?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" /> 개별 등록</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>학생 개별 등록</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="grade" className="text-right">학년</Label>
            <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="classNum" className="text-right">반</Label>
            <Input id="classNum" value={classNum} onChange={(e) => setClassNum(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="studentNum" className="text-right">번호</Label>
            <Input id="studentNum" value={studentNum} onChange={(e) => setStudentNum(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">이름</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button id="add-student-dialog-close" variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>등록</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
