'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  setStudents as setStudentsInDb,
  setRecords as setRecordsInDb,
  getRecords,
  addStudent,
  addOrUpdateRecords,
  getItems,
  deleteRecordsByDateAndItem,
  cleanUpDuplicateRecords,
  assignMissingAccessCodes,
} from '@/lib/store';
import type { Student, StudentToAdd, MeasurementItem } from '@/lib/types';
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
} from "@/components/ui/alert-dialog"
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
import { UserPlus, Trash2, FileUp, FileDown, Loader2, CalendarIcon, Sparkles, KeyRound } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface StudentManagementProps {
  students: Student[];
  onStudentsUpdate: () => void;
}

export default function StudentManagement({ students, onStudentsUpdate }: StudentManagementProps) {
  const { school } = useAuth();
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('');

  // Bulk delete states
  const [deleteDate, setDeleteDate] = useState<Date | undefined>();
  const [deleteItem, setDeleteItem] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [allItems, setAllItems] = useState<MeasurementItem[]>([]);

  useEffect(() => {
    if (school) {
      getItems(school).then(setAllItems);
    }
  }, [school]);

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(students.map(s => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach(grade => {
        classNumsByGrade[grade] = [...new Set(students.filter(s => s.grade === grade).map(s => s.classNum))].sort((a,b) => parseInt(a) - parseInt(b));
    });
    return { grades, classNumsByGrade };
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!selectedGrade) return students;
    let filtered = students.filter(s => s.grade === selectedGrade);
    if (selectedClassNum) {
      filtered = filtered.filter(s => s.classNum === selectedClassNum);
    }
    return filtered;
  }, [students, selectedGrade, selectedClassNum]);

  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
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
  }, [filteredStudents]);

  const selectedIds = useMemo(
    () => Object.keys(selection).filter((id) => selection[id]),
    [selection]
  );

  const handleAddStudent = async (studentData: StudentToAdd) => {
    if (!school) return;
    await addStudent(school, studentData, students);
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
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        try {
          const newStudents = parseCsv<Omit<Student, 'id' | 'accessCode'>>(text);
          if (newStudents.length === 0) throw new Error("No data in CSV");
          
          let count = 0;
          
          const addPromises = newStudents.map(studentFromFile => {
            const studentSchool = studentFromFile.school || school;
            if (studentSchool && studentFromFile.grade && studentFromFile.classNum && studentFromFile.studentNum && studentFromFile.name && studentFromFile.gender) {
              const studentExists = students.some(s => 
                s.grade === studentFromFile.grade &&
                s.classNum === studentFromFile.classNum &&
                s.studentNum === studentFromFile.studentNum &&
                s.name === studentFromFile.name
              );
              
              if (!studentExists) {
                  count++;
                  return addStudent(school, { ...studentFromFile, school: studentSchool }, students);
              }
            }
            return Promise.resolve();
          });

          await Promise.all(addPromises);
          
          onStudentsUpdate();
          toast({ title: '학생 일괄 등록 완료', description: `${count}명의 새로운 학생을 등록했습니다.` });
        } catch (error) {
          toast({ variant: 'destructive', title: '파일이 잘못 되었습니다', description: 'CSV 파일 형식이나 내용을 확인해주세요.' });
        } finally {
          setIsUploading(false);
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

  const handleDownloadClassList = () => {
    if (!school || !selectedGrade || !selectedClassNum) return;
    const dataToExport = sortedStudents.map(s => ({
        학년: s.grade,
        반: s.classNum,
        번호: s.studentNum,
        이름: s.name,
        성별: s.gender,
        접속코드: s.accessCode
    }));
    exportToCsv(`${school}_${selectedGrade}-${selectedClassNum}_학생명단.csv`, dataToExport);
    toast({ title: '다운로드 시작', description: `${selectedGrade}학년 ${selectedClassNum}반 학생 명단을 다운로드합니다.` });
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

  const handleBulkDelete = async () => {
    if (!school || !deleteDate || !deleteItem) {
        toast({ variant: 'destructive', title: '선택 오류', description: '삭제할 날짜와 종목을 모두 선택해주세요.' });
        return;
    }
    setIsDeleting(true);
    try {
        const dateStr = format(deleteDate, 'yyyy-MM-dd');
        const deletedCount = await deleteRecordsByDateAndItem(school, dateStr, deleteItem);
        
        onStudentsUpdate(); // Refresh all data

        toast({
            title: '삭제 완료',
            description: `${dateStr}의 ${deleteItem} 기록 ${deletedCount}건이 삭제되었습니다.`,
        });

        setDeleteDate(undefined);
        setDeleteItem('');

    } catch (error) {
        console.error('Failed to bulk delete records:', error);
        toast({ variant: 'destructive', title: '삭제 실패', description: '기록 삭제 중 오류가 발생했습니다.' });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleCleanDuplicates = async () => {
    if (!school) return;
    setIsProcessing(true);
    try {
      const count = await cleanUpDuplicateRecords(school);
      await onStudentsUpdate();
      toast({
        title: '중복 기록 정리 완료',
        description: `중복된 기록 ${count}건을 정리했습니다.`,
      });
    } catch (error) {
      console.error('Failed to clean duplicates', error);
      toast({ variant: 'destructive', title: '정리 실패', description: '중복 기록 정리 중 오류가 발생했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleAssignCodes = async () => {
    if (!school) return;
    setIsProcessing(true);
    try {
      await assignMissingAccessCodes(school);
      await onStudentsUpdate();
      toast({
        title: '접속 코드 할당 완료',
        description: '접속 코드가 없는 모든 학생에게 새 코드를 할당했습니다.',
      });
    } catch (error) {
      console.error('Failed to assign codes', error);
      toast({ variant: 'destructive', title: '할당 실패', description: '접속 코드 할당 중 오류가 발생했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  }


  if (!school) return null;

  return (
    <>
      <Card className="mb-6">
          <CardHeader>
              <CardTitle>데이터 관리</CardTitle>
              <CardDescription>
                CSV 파일을 사용해 기록을 일괄 등록/다운로드하거나, 특정 날짜의 기록을 일괄 삭제합니다. CSV 파일은 UTF-8 형식으로 저장해주세요.
              </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className='border-b pb-6'>
                <h3 className="text-lg font-semibold mb-2">기록 등록 및 다운로드</h3>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => document.getElementById('record-csv-upload')?.click()} disabled={isUploading}>
                        {isUploading ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 등록 중... </> ) : ( <> <FileUp className="mr-2 h-4 w-4" /> 기록 일괄 등록 </> )}
                    </Button>
                    <input type="file" id="record-csv-upload" accept=".csv" onChange={handleRecordCsvUpload} style={{ display: 'none' }} />
                    <Button variant="link" onClick={handleDownloadRecordTemplate}>기록 템플릿</Button>
                    <Button variant="outline" onClick={handleDownloadAllRecords} className="ml-auto">
                        <FileDown className="mr-2 h-4 w-4" /> 전체 기록 다운로드
                    </Button>
                </div>
              </div>

              <div className='border-b pb-6'>
                <h3 className="text-lg font-semibold mb-2">기록 일괄 삭제</h3>
                <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !deleteDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {deleteDate ? format(deleteDate, "PPP") : <span>삭제할 날짜 선택</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={deleteDate} onSelect={setDeleteDate} initialFocus />
                        </PopoverContent>
                    </Popover>

                     <Select value={deleteItem} onValueChange={setDeleteItem}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="삭제할 종목 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
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
                        <AlertDialogHeader>
                          <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {deleteDate && `${format(deleteDate, "yyyy-MM-dd")}`}의 {deleteItem} 기록 전체가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDelete}>삭제</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">데이터베이스 유틸리티</h3>
                 <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleCleanDuplicates} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        중복 기록 정리
                    </Button>
                     <Button variant="outline" onClick={handleAssignCodes} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                        미할당 접속 코드 생성
                    </Button>
                 </div>
              </div>
          </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>학생 명단 관리</CardTitle>
          <CardDescription>
            학생을 개별 또는 일괄 등록하고, 선택하여 삭제합니다. 학급별로 명단을 필터링하고 다운로드할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
                <AddStudentDialog onAddStudent={handleAddStudent} />
                <Button variant="outline" onClick={() => document.getElementById('student-csv-upload')?.click()} disabled={isUploading}>
                    {isUploading ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 등록 중... </> ) : ( <> <FileUp className="mr-2 h-4 w-4" /> 학생 일괄 등록 </> )}
                </Button>
                <input type="file" id="student-csv-upload" accept=".csv" onChange={handleStudentCsvUpload} style={{ display: 'none' }} />
                <Button variant="link" onClick={handleDownloadStudentTemplate}>학생 템플릿</Button>
            </div>

            <div className="ml-auto flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Select value={selectedGrade} onValueChange={(value) => { setSelectedGrade(value); setSelectedClassNum(''); }}>
                    <SelectTrigger className="w-full sm:w-[120px]">
                        <SelectValue placeholder="학년 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        {grades.map(grade => <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}>
                    <SelectTrigger className="w-full sm:w-[120px]">
                        <SelectValue placeholder="반 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        {classNumsByGrade[selectedGrade]?.map(classNum => <SelectItem key={classNum} value={classNum}>{classNum}반</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
              <Button onClick={handleDownloadClassList} disabled={!selectedGrade || !selectedClassNum}>
                  <FileDown className="mr-2 h-4 w-4" />
                  학급 명단 다운로드
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
                      checked={sortedStudents.length > 0 && selectedIds.length === sortedStudents.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>학년</TableHead>
                  <TableHead>반</TableHead>
                  <TableHead>번호</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>성별</TableHead>
                  <TableHead>접속 코드</TableHead>
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
                      <TableCell>{student.accessCode}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {selectedGrade ? '해당 학급에 등록된 학생이 없습니다.' : '등록된 학생이 없습니다.'}
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


function AddStudentDialog({ onAddStudent }: { onAddStudent: (data: StudentToAdd) => Promise<void> }) {
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
