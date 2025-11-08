'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord, addOrUpdateRecords, getRecordsByStudent } from '@/lib/store';
import { Student, MeasurementRecord, MeasurementItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Loader2, Search, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface RecordInputProps {
    allStudents: Student[];
    allItems: MeasurementItem[];
    onRecordUpdate: () => void;
}

export default function RecordInput({ allStudents, allItems, onRecordUpdate }: RecordInputProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // States for adding a new record (for single student)
  const [selectedItemName, setSelectedItemName] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');


  // States for batch recording
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('');
  const [batchRecordItem, setBatchRecordItem] = useState('');
  const [batchRecordDate, setBatchRecordDate] = useState<Date | undefined>(new Date());
  const [batchRecords, setBatchRecords] = useState<Record<string, { value?: string, height?: string, weight?: string }>>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(allStudents.map(s => s.grade))].sort();
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach(grade => {
        classNumsByGrade[grade] = [...new Set(allStudents.filter(s => s.grade === grade).map(s => s.classNum))].sort();
    });
    return { grades, classNumsByGrade };
  }, [allStudents]);

  const filteredStudentsByClass = useMemo(() => {
    if (!selectedGrade || !selectedClassNum) return [];
    const classStudents = allStudents.filter(s => s.grade === selectedGrade && s.classNum === selectedClassNum);
    return classStudents.sort((a,b) => parseInt(a.studentNum) - parseInt(b.studentNum));
  }, [allStudents, selectedGrade, selectedClassNum]);
  
  useEffect(() => {
    setBatchRecords({}); // Clear batch records on class change
  }, [selectedGrade, selectedClassNum]);


  useEffect(() => {
    if (allItems.length > 0) {
        const bmiItem = allItems.find(i => i.isCompound);
        if (bmiItem) {
            setBatchRecordItem(bmiItem.name);
            setSelectedItemName(bmiItem.name);
        } else {
            const firstPapsItem = allItems.find(i => i.isPaps);
            if (firstPapsItem) {
                setBatchRecordItem(firstPapsItem.name);
                setSelectedItemName(firstPapsItem.name);
            } else if (allItems.length > 0) {
                const firstItem = allItems[0].name;
                setSelectedItemName(firstItem);
                setBatchRecordItem(firstItem);
            }
        }
    }
  }, [allItems]);

  const selectedItemForSingleAdd = useMemo(() => {
      return allItems.find(item => item.name === selectedItemName);
  }, [selectedItemName, allItems]);
  
  const selectedItemForBatchAdd = useMemo(() => {
    return allItems.find(item => item.name === batchRecordItem);
  }, [batchRecordItem, allItems]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedItemForSingleAdd) return "측정 결과 (숫자만 입력)";
    if (selectedItemForSingleAdd.recordType === 'level') return "결과 (예: 1=상, 2=중, 3=하)";
    return `결과 (${selectedItemForSingleAdd.unit})`;
  }, [selectedItemForSingleAdd]);


  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
  }

  const handleSearch = () => {
    if (!school) return;
    if (!searchTerm) {
        setSelectedStudent(null);
        return;
    }
  
    const matchingStudents = allStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
    if (matchingStudents.length === 0) {
      setSelectedStudent(null);
      toast({
        variant: 'destructive',
        title: '검색 실패',
        description: '해당 학생을 찾을 수 없습니다.'
      });
    } else if (matchingStudents.length === 1) {
      handleSelectStudent(matchingStudents[0]);
    } else {
      setFoundStudents(matchingStudents);
      setIsSelectionDialogOpen(true);
    }
  };

  const handleStudentSelectionFromDialog = (student: Student) => {
    handleSelectStudent(student);
    setIsSelectionDialogOpen(false);
    setFoundStudents([]);
  };

  const handleAddRecord = async () => {
    if (!selectedItemName || !school || !selectedStudent || !recordDate) {
      toast({ variant: 'destructive', title: '입력 오류', description: '날짜, 측정 종목을 모두 입력해주세요.' });
      return;
    }
    
    let valueToSave: number | null = null;
    if (selectedItemForSingleAdd?.isCompound) {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) {
        toast({ variant: 'destructive', title: '입력 오류', description: '유효한 키와 몸무게를 입력해주세요.' });
        return;
      }
      const heightInMeters = h / 100;
      valueToSave = parseFloat((w / (heightInMeters * heightInMeters)).toFixed(2));
    } else {
      if (!recordValue) {
        toast({ variant: 'destructive', title: '입력 오류', description: '결과를 입력해주세요.' });
        return;
      }
      const numericValue = parseFloat(recordValue);
      if (isNaN(numericValue)) {
        toast({ variant: 'destructive', title: '입력 오류', description: '결과는 숫자로 입력해주세요.' });
        return;
      }
      valueToSave = numericValue;
    }

    if (valueToSave === null) return;
    
    setIsSubmitting(true);
    
    try {
        await addOrUpdateRecord({
          studentId: selectedStudent.id,
          school: school,
          item: selectedItemName,
          value: valueToSave,
          date: format(recordDate, 'yyyy-MM-dd'),
        });

        await onRecordUpdate();
        
        toast({
          title: '기록 저장 완료',
          description: `${selectedStudent.name} 학생의 ${selectedItemName} 기록이 저장/업데이트되었습니다.`,
        });
        
        setRecordValue('');
        setHeight('');
        setWeight('');

    } catch(error) {
         console.error("Failed to save record:", error);
        toast({ variant: 'destructive', title: '저장 실패', description: '기록 저장 중 오류가 발생했습니다.'})
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleBatchRecordChange = (studentId: string, field: 'value' | 'height' | 'weight', inputValue: string) => {
    setBatchRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: inputValue,
      },
    }));
  };

    const handleSaveBatchRecords = async () => {
        if (!school || !batchRecordItem || !batchRecordDate || Object.keys(batchRecords).length === 0) {
            toast({ variant: 'destructive', title: '입력 오류', description: '날짜, 종목을 선택하고 하나 이상의 기록을 입력해주세요.' });
            return;
        }

        setIsBatchSubmitting(true);
        try {
            const recordsToSave = Object.entries(batchRecords)
                .map(([studentId, values]) => {
                    const student = filteredStudentsByClass.find(s => s.id === studentId);
                    if (!student) return null;

                    let valueToSave: number | null = null;

                    if (selectedItemForBatchAdd?.isCompound) {
                        const h = parseFloat(values.height || '');
                        const w = parseFloat(values.weight || '');
                        if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
                            const heightInMeters = h / 100;
                            valueToSave = parseFloat((w / (heightInMeters * heightInMeters)).toFixed(2));
                        }
                    } else {
                        const numericValue = parseFloat(values.value || '');
                        if (!isNaN(numericValue)) {
                            valueToSave = numericValue;
                        }
                    }

                    if (valueToSave === null) return null;

                    return {
                        ...student,
                        item: batchRecordItem,
                        value: valueToSave,
                        date: format(batchRecordDate, 'yyyy-MM-dd'),
                    };
                })
                .filter((r): r is (Student & { item: string; value: number; date: string; }) => r !== null);
            
            if (recordsToSave.length > 0) {
                await addOrUpdateRecords(school, allStudents, recordsToSave);
                await onRecordUpdate();
                toast({ title: '저장 완료', description: `${batchRecordItem}에 대한 ${recordsToSave.length}개의 기록이 저장/업데이트되었습니다.` });
                setBatchRecords({}); // Clear inputs after saving
            } else {
                toast({ variant: 'destructive', title: '저장할 기록 없음', description: '유효한 기록을 입력해주세요.' });
            }
        } catch (error) {
            console.error('Failed to save batch records:', error);
            toast({ variant: 'destructive', title: '일괄 저장 실패', description: '기록 저장 중 오류가 발생했습니다.' });
        } finally {
            setIsBatchSubmitting(false);
        }
    };
  

  if (!school) return null;

  return (
    <>
      <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>동명이인 학생 선택</DialogTitle>
                  <DialogDescription>
                      검색된 학생 중 한 명을 선택해주세요.
                  </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>이름</TableHead>
                              <TableHead>학년</TableHead>
                              <TableHead>반</TableHead>
                              <TableHead>번호</TableHead>
                              <TableHead></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {foundStudents.map((student) => (
                              <TableRow key={student.id}>
                                  <TableCell>{student.name}</TableCell>
                                  <TableCell>{student.grade}</TableCell>
                                  <TableCell>{student.classNum}</TableCell>
                                  <TableCell>{student.studentNum}</TableCell>
                                  <TableCell className="text-right">
                                      <Button size="sm" onClick={() => handleStudentSelectionFromDialog(student)}>
                                          선택
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </div>
          </DialogContent>
      </Dialog>
      <Tabs defaultValue="batch">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="batch">학급별 기록</TabsTrigger>
            <TabsTrigger value="individual">개별 기록</TabsTrigger>
        </TabsList>
        <TabsContent value="batch">
             <Card>
                <CardHeader>
                    <CardTitle>학급별 측정 기록</CardTitle>
                    <CardDescription>수업 중 측정한 결과를 학급 전체에 대해 한 번에 입력하고 저장할 수 있습니다.</CardDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-4">
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
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !batchRecordDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {batchRecordDate ? format(batchRecordDate, "PPP") : <span>날짜 선택</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={batchRecordDate} onSelect={setBatchRecordDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Select value={batchRecordItem} onValueChange={setBatchRecordItem}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="측정 종목 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleSaveBatchRecords} disabled={isBatchSubmitting || filteredStudentsByClass.length === 0} className="ml-auto">
                            {isBatchSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            학급 전체 기록 저장
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>번호</TableHead>
                                <TableHead>이름</TableHead>
                                {selectedItemForBatchAdd?.isCompound ? (
                                    <>
                                        <TableHead>키(cm)</TableHead>
                                        <TableHead>몸무게(kg)</TableHead>
                                        <TableHead>BMI</TableHead>
                                    </>
                                ) : (
                                    <TableHead>기록 ({selectedItemForBatchAdd?.unit})</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStudentsByClass.length > 0 ? (
                                filteredStudentsByClass.map(student => {
                                    const studentRecords = batchRecords[student.id] || {};
                                    if (selectedItemForBatchAdd?.isCompound) {
                                        let bmiResult = '';
                                        const h = parseFloat(studentRecords.height || '');
                                        const w = parseFloat(studentRecords.weight || '');
                                        if (!isNaN(h) && !isNaN(w) && h > 0) {
                                            bmiResult = (w / ((h / 100) * (h / 100))).toFixed(2);
                                        }
                                        return (
                                            <TableRow key={student.id}>
                                                <TableCell>{student.studentNum}</TableCell>
                                                <TableCell>{student.name}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={studentRecords.height || ''}
                                                        onChange={(e) => handleBatchRecordChange(student.id, 'height', e.target.value)}
                                                        className="max-w-[100px]"
                                                        placeholder="키 입력"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={studentRecords.weight || ''}
                                                        onChange={(e) => handleBatchRecordChange(student.id, 'weight', e.target.value)}
                                                        className="max-w-[100px]"
                                                        placeholder="몸무게 입력"
                                                    />
                                                </TableCell>
                                                <TableCell>{bmiResult}</TableCell>
                                            </TableRow>
                                        );
                                    } else {
                                        return (
                                            <TableRow key={student.id}>
                                                <TableCell>{student.studentNum}</TableCell>
                                                <TableCell>{student.name}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={studentRecords.value || ''}
                                                        onChange={(e) => handleBatchRecordChange(student.id, 'value', e.target.value)}
                                                        className="max-w-[120px]"
                                                        placeholder={selectedItemForBatchAdd?.recordType === 'level' ? '1:상, 2:중, 3:하' : `기록 (${selectedItemForBatchAdd?.unit})`}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={selectedItemForBatchAdd?.isCompound ? 5 : 3} className="h-24 text-center">
                                        기록을 입력할 학급을 선택해주세요.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="individual">
             <Card>
                <CardHeader>
                    <CardTitle>개별 학생 기록 추가/수정</CardTitle>
                    <CardDescription>학생을 검색하여 특정 날짜의 기록을 추가하거나, 기존 날짜의 기록을 수정합니다.</CardDescription>
                     <div className="flex flex-wrap items-center gap-2 pt-4">
                        <Input 
                            type="text" 
                            placeholder="학생 이름 검색..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full sm:w-auto"
                        />
                        <Button type="button" onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> 검색</Button>
                        {selectedStudent && (
                            <div className="flex items-center gap-2 text-sm ml-4">
                                <span className="font-semibold">선택된 학생:</span>
                                <span>{selectedStudent.name} ({selectedStudent.grade}-{selectedStudent.classNum})</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                {selectedStudent ? (
                    <>
                        <CardContent className="space-y-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !recordDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {recordDate ? format(recordDate, "PPP") : <span>날짜 선택</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={recordDate}
                                    onSelect={setRecordDate}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <Select onValueChange={setSelectedItemName} value={selectedItemName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="측정 종목 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allItems.map(item => (
                                    <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedItemForSingleAdd?.isCompound ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="height-single">키 (cm)</Label>
                                        <Input id="height-single" type="number" value={height} onChange={e => setHeight(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="weight-single">몸무게 (kg)</Label>
                                        <Input id="weight-single" type="number" value={weight} onChange={e => setWeight(e.target.value)} />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <Label>{selectedItemForSingleAdd?.unit ? `기록 (${selectedItemForSingleAdd.unit})` : '기록'}</Label>
                                    <Input
                                        placeholder={inputPlaceholder}
                                        value={recordValue}
                                        onChange={e => setRecordValue(e.target.value)}
                                        type="number"
                                    />
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleAddRecord} disabled={isSubmitting} className="w-full">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                결과 저장
                            </Button>
                        </CardFooter>
                    </>
                ) : (
                    <CardContent>
                         <div className="text-center text-muted-foreground py-10">
                            <p>기록을 입력할 학생을 먼저 검색해주세요.</p>
                        </div>
                    </CardContent>
                )}
            </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
