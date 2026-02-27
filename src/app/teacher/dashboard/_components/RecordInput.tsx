'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord, addOrUpdateRecords } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from '@/lib/types';
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
import { Loader2, Search, Calendar as CalendarIcon, User, X, Youtube, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


interface RecordInputProps {
    allStudents: Student[];
    allItems: MeasurementItem[];
    onRecordUpdate: (records: MeasurementRecord[] | string, action: 'update' | 'delete') => void;
    allTeamGroups: TeamGroup[];
    sportsClubs: SportsClub[];
}

export default function RecordInput({ allStudents, allItems, onRecordUpdate, allTeamGroups, sportsClubs }: RecordInputProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [selectedItemName, setSelectedItemName] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');


  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState(''); 
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [batchRecordItem, setBatchRecordItem] = useState('');
  const [batchRecordDate, setBatchRecordDate] = useState<Date | undefined>(new Date());
  const [batchRecords, setBatchRecords] = useState<Record<string, { value?: string, height?: string, weight?: string }>>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);

  // For YouTube video
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  // Only items that are NOT archived and NOT deactivated should be visible for recording
  const activeItems = useMemo(() => allItems.filter(item => !item.isArchived && !item.isDeactivated), [allItems]);

  const studentMap = useMemo(() => new Map(allStudents.map(s => [s.id, s])), [allStudents]);

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(allStudents.map(s => s.grade))].sort();
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach(grade => {
        classNumsByGrade[grade] = [...new Set(allStudents.filter(s => s.grade === grade).map(s => s.classNum))].sort();
    });
    return { grades, classNumsByGrade };
  }, [allStudents]);
  
  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    const teamGroup = allTeamGroups.find(g => g.id === selectedGroupId);
    if (teamGroup) return { type: 'teamGroup', data: teamGroup };

    const sportsClub = sportsClubs.find(c => c.id === selectedGroupId);
    if (sportsClub) return { type: 'sportsClub', data: sportsClub };
    
    return null;
  }, [selectedGroupId, allTeamGroups, sportsClubs]);

  const studentsForBatch = useMemo(() => {
    if (selectedGroupId && selectedGroup) {
        if (selectedGroup.type === 'teamGroup') {
            const teamGroup = selectedGroup.data as TeamGroup;
            const teamToShow = selectedTeamId ? teamGroup.teams.find(t => t.id === selectedTeamId) : null;
            const teamsToProcess = teamToShow ? [teamToShow] : teamGroup.teams;
            
            return teamsToProcess.flatMap((team) => {
                 return team.memberIds.map(memberId => studentMap.get(memberId))
                    .filter((s): s is Student => !!s);
            }).sort((a,b) => parseInt(a.studentNum) - parseInt(b.studentNum));

        } else if (selectedGroup.type === 'sportsClub') {
            const club = selectedGroup.data as SportsClub;
             return club.memberIds.map(memberId => studentMap.get(memberId))
                .filter((s): s is Student => !!s)
                .sort((a,b) => {
                    if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
                    if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
                    return parseInt(a.studentNum) - parseInt(b.studentNum);
                });
        }
    } else if (selectedGrade) {
        let students = allStudents.filter(s => s.grade === selectedGrade);
        if (selectedClassNum !== "all") {
            students = students.filter(s => s.classNum === selectedClassNum);
        }
        return students.sort((a,b) => parseInt(a.studentNum) - parseInt(b.studentNum));
    }
    return [];
  }, [allStudents, selectedGrade, selectedClassNum, selectedGroupId, selectedTeamId, selectedGroup, studentMap]);
  
  useEffect(() => {
    setBatchRecords({}); 
    if(selectedGroupId) {
        setSelectedGrade('');
        setSelectedClassNum('all');
    }
    if(!selectedGroupId){
        setSelectedTeamId('');
    }
  }, [selectedGrade, selectedClassNum, batchRecordItem, selectedGroupId]);

  useEffect(() => {
    setRecordValue('');
    setHeight('');
    setWeight('');
  }, [selectedItemName, selectedStudent]);


  useEffect(() => {
    if (activeItems.length > 0) {
        const bmiItem = activeItems.find(i => i.isCompound);
        if (bmiItem) {
            setBatchRecordItem(bmiItem.name);
            setSelectedItemName(bmiItem.name);
        } else {
            const firstPapsItem = activeItems.find(i => i.isPaps);
            if (firstPapsItem) {
                setBatchRecordItem(firstPapsItem.name);
                setSelectedItemName(firstPapsItem.name);
            } else if (activeItems.length > 0) {
                const firstItem = activeItems[0].name;
                setSelectedItemName(firstItem);
                setBatchRecordItem(firstItem);
            }
        }
    }
  }, [activeItems]);

  const selectedItemForSingleAdd = useMemo(() => {
      return activeItems.find(item => item.name === selectedItemName);
  }, [selectedItemName, activeItems]);
  
  const selectedItemForBatchAdd = useMemo(() => {
    return activeItems.find(item => item.name === batchRecordItem);
  }, [batchRecordItem, activeItems]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedItemForSingleAdd) return "측정 결과 (숫자만 입력)";
    return `결과 (${selectedItemForSingleAdd.unit})`;
  }, [selectedItemForSingleAdd]);


  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setRecordValue('');
    setHeight('');
    setWeight('');
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
        const updatedRecord = await addOrUpdateRecord({
          studentId: selectedStudent.id,
          school: school,
          item: selectedItemName,
          value: valueToSave,
          date: format(recordDate, 'yyyy-MM-dd'),
        });

        onRecordUpdate([updatedRecord], 'update');
        
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
        const recordsToProcess: (Omit<MeasurementRecord, 'id'> & { student: Student })[] = [];
        
        for (const studentId of Object.keys(batchRecords)) {
            const values = batchRecords[studentId];
            if (!values) continue;
            
            const hasValue = (selectedItemForBatchAdd?.isCompound && (values.height || values.weight)) || (!selectedItemForBatchAdd?.isCompound && values.value);
            if (!hasValue) continue;

            const student = studentsForBatch.find(s => s.id === studentId);
            if (!student) continue;

            let valueToSave: number | null = null;
            
            if (selectedItemForBatchAdd?.isCompound) {
                const h = parseFloat(values.height || '');
                const w = parseFloat(values.weight || '');
                if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
                    const heightInMeters = h / 100;
                    valueToSave = parseFloat((w / (heightInMeters * heightInMeters)).toFixed(2));
                }
            } else {
                if (values.value) {
                    const numericValue = parseFloat(values.value);
                    if (!isNaN(numericValue)) {
                        valueToSave = numericValue;
                    }
                }
            }

            if (valueToSave !== null) {
                recordsToProcess.push({
                    student,
                    studentId: student.id,
                    school,
                    item: batchRecordItem,
                    value: valueToSave,
                    date: format(batchRecordDate, 'yyyy-MM-dd'),
                });
            }
        }
        
        if (recordsToProcess.length > 0) {
            const updatedRecords = await addOrUpdateRecords(school, studentsForBatch, recordsToProcess);
            onRecordUpdate(updatedRecords, 'update');
            toast({ title: '저장 완료', description: `${batchRecordItem}에 대한 ${recordsToProcess.length}개의 기록이 저장/업데이트되었습니다.` });
            setBatchRecords({}); 
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

  
    const calculateBmi = (heightCm?: string, weightKg?: string): string => {
        const h = parseFloat(heightCm || '');
        const w = parseFloat(weightKg || '');
        if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
            const heightInMeters = h / 100;
            return (w / (heightInMeters * heightInMeters)).toFixed(2);
        }
        return '';
    };

    const clearFilters = () => {
        setSelectedGrade('');
        setSelectedClassNum('all');
        setSelectedGroupId('');
        setSelectedTeamId('');
    };

    const getYouTubeEmbedUrl = (url: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
        return null;
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
            <TabsTrigger value="batch">학급/팀별 기록</TabsTrigger>
            <TabsTrigger value="individual">개별 기록</TabsTrigger>
        </TabsList>
        <TabsContent value="batch">
             <Card className="bg-transparent shadow-none border-none">
                <CardHeader>
                    <CardTitle>학급/팀별 측정 기록</CardTitle>
                    <CardDescription>수업 중 측정한 결과를 학급 전체 또는 팀별로 한 번에 입력하고 저장할 수 있습니다.</CardDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-4">
                        <Select value={selectedGrade} onValueChange={(value) => { setSelectedGrade(value); setSelectedClassNum('all'); setSelectedGroupId(''); }}>
                            <SelectTrigger className="w-full sm:w-[120px]">
                                <SelectValue placeholder="학년 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {grades.map(grade => <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={selectedClassNum} onValueChange={v => { setSelectedClassNum(v); setSelectedGroupId(''); }} disabled={!selectedGrade}>
                            <SelectTrigger className="w-full sm:w-[120px]">
                                <SelectValue placeholder="반 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 반</SelectItem>
                                {classNumsByGrade[selectedGrade]?.map(classNum => <SelectItem key={classNum} value={classNum}>{classNum}반</SelectItem>)}
                            </SelectContent>
                        </Select>
                        
                        <span className="text-sm text-muted-foreground mx-2">또는</span>

                        <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); setSelectedClassNum('all'); setSelectedTeamId(''); }}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="팀/클럽 그룹 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {allTeamGroups.length > 0 && allTeamGroups.map(group => (
                                    <SelectItem key={group.id} value={group.id}>{group.description}</SelectItem>
                                ))}
                                 {sportsClubs.length > 0 && sportsClubs.map(club => (
                                    <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                                ))}
                                {(allTeamGroups.length === 0 && sportsClubs.length === 0) && <SelectItem value="none" disabled>저장된 그룹이 없습니다.</SelectItem>}
                            </SelectContent>
                        </Select>
                         
                        {(selectedGrade || selectedGroupId) && <Button variant="ghost" size="icon" onClick={clearFilters}><X className="h-4 w-4" /></Button>}
                        
                        <div className="flex-grow min-w-[240px]">
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !batchRecordDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {batchRecordDate ? format(batchRecordDate, "PPP") : <span>날짜 선택</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={batchRecordDate} onSelect={setBatchRecordDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Select value={batchRecordItem} onValueChange={setBatchRecordItem}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="측정 종목 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleSaveBatchRecords} disabled={isBatchSubmitting || studentsForBatch.length === 0} className="ml-auto">
                            {isBatchSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            일괄 저장
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* YouTube Video Section */}
                    <div className="p-4 border rounded-lg bg-primary/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Youtube className="h-5 w-5 text-red-600" />
                                <h3 className="font-semibold">측정 예시 영상 시청</h3>
                            </div>
                            {youtubeUrl && (
                                <Button variant="ghost" size="sm" onClick={() => setYoutubeUrl('')}>
                                    <X className="h-4 w-4 mr-1" /> 영상 닫기
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input 
                                    placeholder="유튜브 영상 주소를 입력하세요 (예: https://www.youtube.com/watch?v=...)" 
                                    value={youtubeUrl} 
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                    className="pr-10"
                                />
                                {youtubeUrl && (
                                    <button 
                                        onClick={() => setYoutubeUrl('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <Button variant="secondary" className="shrink-0" disabled={!youtubeUrl}>
                                <Play className="h-4 w-4 mr-2" /> 영상 로드
                            </Button>
                        </div>
                        {getYouTubeEmbedUrl(youtubeUrl) && (
                            <div className="aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden border shadow-lg bg-black">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    src={getYouTubeEmbedUrl(youtubeUrl)!}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        )}
                    </div>

                  <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>사진</TableHead>
                            <TableHead>학년-반</TableHead>
                            <TableHead>번호</TableHead>
                            <TableHead>이름</TableHead>
                            {selectedItemForBatchAdd?.isCompound ? (
                                <>
                                    <TableHead>키(cm)</TableHead>
                                    <TableHead>몸무게(kg)</TableHead>
                                    <TableHead>BMI</TableHead>
                                </>
                            ) : (
                                <>
                                    <TableHead>기록 ({selectedItemForBatchAdd?.unit})</TableHead>
                                    <TableHead>결과</TableHead>
                                </>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsForBatch.length > 0 ? (
                        studentsForBatch.map(student => {
                            const studentRecords = batchRecords[student.id] || {};
                            return (
                                <TableRow key={student.id}>
                                <TableCell>
                                    <Avatar>
                                        <AvatarImage src={student.photoUrl || undefined} alt={student.name} />
                                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </TableCell>
                                <TableCell>{student.grade}-{student.classNum}</TableCell>
                                <TableCell>{student.studentNum}</TableCell>
                                <TableCell>{student.name}</TableCell>
                                {selectedItemForBatchAdd?.isCompound ? (
                                    <>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                placeholder="키(cm)"
                                                value={studentRecords.height || ''}
                                                onChange={(e) => handleBatchRecordChange(student.id, 'height', e.target.value)}
                                                className="max-w-[120px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                placeholder="몸무게(kg)"
                                                value={studentRecords.weight || ''}
                                                onChange={(e) => handleBatchRecordChange(student.id, 'weight', e.target.value)}
                                                className="max-w-[120px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                readOnly
                                                value={calculateBmi(studentRecords.height, studentRecords.weight)}
                                                placeholder="BMI"
                                                className="max-w-[120px] bg-muted"
                                            />
                                        </TableCell>
                                    </>
                                ) : (
                                     <>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                placeholder={selectedItemForBatchAdd?.unit || '기록'}
                                                value={studentRecords.value || ''}
                                                onChange={(e) => handleBatchRecordChange(student.id, 'value', e.target.value)}
                                                className="max-w-[120px]"
                                            />
                                        </TableCell>
                                         <TableCell>
                                            <Input
                                                readOnly
                                                value={studentRecords.value || ''}
                                                placeholder="결과"
                                                className="max-w-[120px] bg-muted"
                                            />
                                        </TableCell>
                                    </>
                                )}
                                </TableRow>
                            );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={selectedItemForBatchAdd?.isCompound ? 7 : 6} className="h-24 text-center">
                            기록을 입력할 학급 또는 팀/클럽 그룹을 선택해주세요.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="individual">
             <Card className="bg-transparent shadow-none border-none">
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
                           <div className="flex items-center gap-4 text-sm ml-4 p-2 bg-secondary rounded-md">
                                <Avatar>
                                    <AvatarImage src={selectedStudent.photoUrl || undefined} />
                                    <AvatarFallback>
                                        {selectedStudent.name ? selectedStudent.name.charAt(0) : <User />}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <span className="font-semibold block">{selectedStudent.name}</span>
                                    <span className="text-muted-foreground">{selectedStudent.grade}-{selectedStudent.classNum}</span>
                                </div>
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
                                    {activeItems.map(item => (
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
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
