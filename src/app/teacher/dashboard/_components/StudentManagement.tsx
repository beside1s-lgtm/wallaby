'use client';
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  setStudents as setStudentsInDb,
  setRecords as setRecordsInDb,
  getRecords,
  addStudent,
  addOrUpdateRecords,
  getItems,
} from '@/lib/store';
import type { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { parseCsv, exportToCsv, exportToZip } from '@/lib/utils';
import { UserPlus, Trash2, FileUp, FileDown, Loader2 } from 'lucide-react';

interface StudentManagementProps {
  students: Student[];
  onStudentsUpdate: () => void;
}

export default function StudentManagement({ students, onStudentsUpdate }: StudentManagementProps) {
  const { school } = useAuth();
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const gradeA = parseInt(a.grade);
      const gradeB = parseInt(b.grade);
      if (gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      const classA = parseInt(a.classNum);
      const classB = parseInt(b.classNum);
      if (classA !== classB) {
        return classA - classB;
      }
      const numA = parseInt(a.studentNum);
      const numB = parseInt(b.studentNum);
      return numA - numB;
    });
  }, [students]);

  const selectedIds = useMemo(
    () => Object.keys(selection).filter((id) => selection[id]),
    [selection]
  );

  const handleAddStudent = async (studentData: Omit<Student, 'id' | 'school'>) => {
    if (!school) return;
    await addStudent({ ...studentData, school });
    onStudentsUpdate(); // Refresh data in parent
    toast({ title: '학생 추가 완료', description: `${studentData.name} 학생을 등록했습니다.` });
  };

  const handleDeleteSelected = async () => {
    if (!school) return;
    const studentsToDelete = students.filter(s => selectedIds.includes(s.id));
    const studentNames = studentsToDelete.map(s => s.name).join(', ');

    const currentStudents = students.filter(s => !selectedIds.includes(s.id));
    await setStudentsInDb(school, currentStudents);
    
    const currentRecords = await getRecords(school);
    const updatedRecords = currentRecords.filter(r => !selectedIds.includes(r.studentId));
    await setRecordsInDb(school, updatedRecords);

    setSelection({});
    onStudentsUpdate(); // Refresh data in parent
    toast({
      variant: 'destructive',
      title: '삭제 완료',
      description: `${studentNames} 학생 정보를 삭제했습니다.`,
    });
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
      sortedStudents.forEach((s) => (newSelection[s.id] = true));
    }
    setSelection(newSelection);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelection((prev) => ({ ...prev, [id]: checked }));
  };

  const handleStudentCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        try {
          const newStudents = parseCsv<Omit<Student, 'id'>>(text);
          if (newStudents.length === 0) throw new Error("No data in CSV");
          
          let count = 0;
          
          const addPromises = newStudents.map(student => {
            const studentSchool = student.school || school;
            if (studentSchool && student.grade && student.classNum && student.studentNum && student.name && student.gender) {
              const studentExists = students.some(s => 
                s.grade === student.grade &&
                s.classNum === student.classNum &&
                s.studentNum === student.studentNum &&
                s.name === student.name
              );
              
              if (!studentExists) {
                  count++;
                  return addStudent({ ...student, school: studentSchool });
              }
            }
            return Promise.resolve();
          });

          await Promise.all(addPromises);
          
          onStudentsUpdate();
          toast({ title: '학생 일괄 등록 완료', description: `${count}명의 새로운 학생을 등록했습니다.` });
        } catch (error) {
          toast({ variant: 'destructive', title: '파일이 잘못 되었습니다', description: 'CSV 파일 형식이나 내용을 확인해주세요.' });
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
    event.target.value = ''; // Reset file input
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
                    onStudentsUpdate();
                    toast({ title: '등록 되었습니다', description: `기록 일괄 등록이 완료되었습니다.` });
                } catch (error) {
                    console.error('CSV 처리 오류', error);
                    toast({ variant: 'destructive', title: '파일이 잘못 되었습니다', description: 'CSV 파일 형식이나 내용을 확인해주세요.' });
                } finally {
                  setIsUploading(false);
                }
            };
            reader.readAsText(file, 'UTF-8');
        }
        event.target.value = ''; // Reset file input
    };

  const handleDownloadAllRecords = async () => {
    if (!school) return;
    const allRecords = await getRecords(school);
    if(allRecords.length === 0){
        toast({variant: 'destructive', title: '데이터 없음', description: '다운로드할 기록이 없습니다.'})
        return;
    }
    
    const studentMap = new Map(students.map(s => [s.id, s]));
    
    const dataToExport = allRecords.map(record => {
        const student = studentMap.get(record.studentId);
        return {
            학교: record.school,
            학년: student?.grade || '',
            반: student?.classNum || '',
            번호: student?.studentNum || '',
            이름: student?.name || '알수없음',
            성별: student?.gender || '',
            측정종목: record.item,
            기록: record.value,
            측정일: record.date,
        }
    });
    
    exportToCsv(`${school}_전체_학생_기록.csv`, dataToExport);
    toast({ title: '다운로드 시작', description: '전체 학생 기록을 CSV 파일로 다운로드합니다.'});
  }

  const handleDownloadStudentTemplate = () => {
    if (!school) return;
    const templateData = [{
      school,
      grade: '1',
      classNum: '1',
      studentNum: '1',
      name: '홍길동',
      gender: '남',
    }];
    exportToCsv(`${school}_학생_등록_템플릿.csv`, templateData);
  }

  const handleDownloadRecordTemplate = async () => {
    if(!school) return;
    const templateData = [{
      school: school,
      grade: '1',
      classNum: '1',
      studentNum: '1',
      name: '홍길동',
      item: '50m 달리기',
      value: 9.5,
      date: '2024-01-01'
    }];
    
    const items = await getItems(school);
    const itemsData = items.map(item => ({
        종목명: item.name,
        단위: item.unit
    }));
    
    const files = [
        { name: '기록_등록_템플릿.csv', data: templateData },
        { name: '등록된_종목_목록.csv', data: itemsData },
    ];
    
    exportToZip('기록_등록_템플릿.zip', files);
    toast({ title: '다운로드 시작', description: '템플릿과 종목 목록을 ZIP 파일로 다운로드합니다.'});
  }


  if (!school) return null;

  return (
    <>
      <Card className="mb-6">
          <CardHeader>
              <CardTitle>측정 기록 일괄 관리</CardTitle>
              <CardDescription>
                CSV 파일을 사용하여 여러 학생의 기록을 한 번에 등록하거나, 전체 학생 기록을 다운로드합니다. CSV 파일은 한글 깨짐 방지를 위해 반드시 UTF-8 형식으로 저장해주세요.
              </CardDescription>
          </CardHeader>
          <CardFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => document.getElementById('record-csv-upload')?.click()} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      기록 일괄 등록
                    </>
                  )}
              </Button>
              <input type="file" id="record-csv-upload" accept=".csv" onChange={handleRecordCsvUpload} style={{ display: 'none' }} />
              <Button variant="link" onClick={handleDownloadRecordTemplate}>기록 템플릿</Button>
              <Button variant="outline" onClick={handleDownloadAllRecords} className="ml-auto">
                <FileDown className="mr-2 h-4 w-4" />
                전체 기록 다운로드
              </Button>
          </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>학생 명단 관리</CardTitle>
          <CardDescription>
            학생을 개별 또는 일괄 등록하고, 선택하여 삭제합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <AddStudentDialog onAddStudent={handleAddStudent} />
            <Button variant="outline" onClick={() => document.getElementById('student-csv-upload')?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              학생 일괄 등록
            </Button>
            <input type="file" id="student-csv-upload" accept=".csv" onChange={handleStudentCsvUpload} style={{ display: 'none' }} />
            <Button variant="link" onClick={handleDownloadStudentTemplate}>학생 템플릿</Button>

            <div className="ml-auto flex items-center gap-2">
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
                      checked={sortedStudents.length > 0 && selectedIds.length === sortedStudents.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>학년</TableHead>
                  <TableHead>반</TableHead>
                  <TableHead>번호</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>성별</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStudents.length > 0 ? (
                  sortedStudents.map((student) => (
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
                      <TableCell>{student.gender}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      등록된 학생이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}


function AddStudentDialog({ onAddStudent }: { onAddStudent: (data: Omit<Student, 'id' | 'school'>) => Promise<void> }) {
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'남' | '여' | ''>('');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!grade || !classNum || !studentNum || !name || !gender) {
      toast({ variant: 'destructive', title: '입력 오류', description: '모든 필드를 입력해주세요.' });
      return;
    }
    setIsSubmitting(true);
    await onAddStudent({ grade, classNum, studentNum, name, gender });
    setGrade('');
    setClassNum('');
    setStudentNum('');
    setName('');
    setGender('');
    setIsSubmitting(false);
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
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gender" className="text-right">성별</Label>
             <Select onValueChange={(value) => setGender(value as '남' | '여')} value={gender}>
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="성별 선택" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="남">남</SelectItem>
                    <SelectItem value="여">여</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button id="add-student-dialog-close" variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
