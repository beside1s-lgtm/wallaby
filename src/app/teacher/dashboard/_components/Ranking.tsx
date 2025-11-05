'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { calculateRanks, exportToCsv } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import { FileDown, Users, Shuffle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RankedStudent = {
  rank: number;
  id: string;
  name: string;
  grade: string;
  classNum: string;
  studentNum: string;
  value: string;
};

interface RankingProps {
    allStudents: Student[];
    allItems: MeasurementItem[];
    allRecords: MeasurementRecord[];
}

export default function Ranking({ allStudents, allItems, allRecords }: RankingProps) {
  const { school } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [rankedStudents, setRankedStudents] = useState<RankedStudent[]>([]);
  
  const grades = useMemo(() => [...new Set(allStudents.map(s => s.grade))].sort(), [allStudents]);

  useEffect(() => {
    if (school && selectedGrade && selectedItem) {
      const ranksByItem = calculateRanks(school, allItems, allRecords, allStudents, selectedGrade);
      const itemRanks = ranksByItem[selectedItem];
      const itemInfo = allItems.find(i => i.name === selectedItem);
      
      if (itemRanks && itemInfo) {
        const studentMap = new Map(allStudents.map(s => [s.id, s]));
        const sortedRankedStudents = itemRanks
          .map(rankInfo => {
            const student = studentMap.get(rankInfo.studentId);
            if (!student) return null;
            return {
              rank: rankInfo.rank,
              id: student.id,
              name: student.name,
              grade: student.grade,
              classNum: student.classNum,
              studentNum: student.studentNum,
              value: itemInfo.recordType === 'level' ? 
                     (rankInfo.value === 1 ? '상' : rankInfo.value === 2 ? '중' : '하') : 
                     `${rankInfo.value}${itemInfo.unit}`,
            };
          })
          .filter((s): s is RankedStudent => s !== null);

        setRankedStudents(sortedRankedStudents);
      } else {
        setRankedStudents([]);
      }
    } else {
      setRankedStudents([]);
    }
  }, [school, selectedGrade, selectedItem, allStudents, allItems, allRecords]);
  
  if (!school) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>종목별 순위 조회</CardTitle>
          <CardDescription>학년과 종목을 선택하여 전체 학생 순위를 확인합니다. 종목별 우수 학생과 부진 학생을 쉽게 파악할 수 있습니다.</CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                {grades.map(grade => <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedItem} onValueChange={setSelectedItem} disabled={!selectedGrade}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="종목 선택" />
              </SelectTrigger>
              <SelectContent>
                {allItems.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>등수</TableHead>
                <TableHead>학년</TableHead>
                <TableHead>반</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>기록</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedStudents.length > 0 ? (
                rankedStudents.map(student => (
                  <TableRow key={student.id}>
                    <TableCell className="font-bold">{student.rank}등</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell>{student.classNum}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.value}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    조회할 학년과 종목을 선택해주세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TeamBalancer 
        allStudents={allStudents}
        allItems={allItems}
        allRecords={allRecords}
        grades={grades}
      />
    </div>
  );
}


function TeamBalancer({ allStudents, allItems, allRecords, grades }: RankingProps & { grades: string[] }) {
  const { school } = useAuth();
  const { toast } = useToast();

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [teams, setTeams] = useState<Student[][]>([]);
  const [studentScores, setStudentScores] = useState<Map<string, { totalScore: number, scores: { item: string, score: number }[] }>>(new Map());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const customItems = useMemo(() => allItems.filter(item => !item.isPaps), [allItems]);

  const handleToggleItem = (itemName: string) => {
    setSelectedItemNames(prev => 
      prev.includes(itemName) ? prev.filter(name => name !== itemName) : [...prev, itemName]
    );
  };
  
  useEffect(() => {
    if (selectedGrade && selectedItemNames.length > 0) {
      const gradeStudents = allStudents.filter(s => s.grade === selectedGrade);
      const studentIdToScores = new Map<string, { totalScore: number, scores: { item: string, score: number }[] }>();

      selectedItemNames.forEach(itemName => {
        const itemInfo = allItems.find(i => i.name === itemName);
        if (!itemInfo) return;

        const ranksByItem = calculateRanks(school, allItems, allRecords, allStudents, selectedGrade);
        const itemRanks = ranksByItem[itemName];
        
        if (itemRanks) {
          const totalInRank = itemRanks.length;
          itemRanks.forEach(rankInfo => {
            const score = Math.round((1 - (rankInfo.rank - 1) / totalInRank) * 100);
            if (!studentIdToScores.has(rankInfo.studentId)) {
              studentIdToScores.set(rankInfo.studentId, { totalScore: 0, scores: [] });
            }
            const studentData = studentIdToScores.get(rankInfo.studentId)!;
            studentData.scores.push({ item: itemName, score: score });
          });
        }
      });
      
      // Calculate total score and add students who might not have scores for all selected items
      gradeStudents.forEach(student => {
        const studentData = studentIdToScores.get(student.id) || { totalScore: 0, scores: [] };
        
        // Add 0 score for missing items
        selectedItemNames.forEach(itemName => {
            if (!studentData.scores.some(s => s.item === itemName)) {
                studentData.scores.push({ item: itemName, score: 0 });
            }
        });

        studentData.totalScore = studentData.scores.reduce((acc, s) => acc + s.score, 0);
        studentIdToScores.set(student.id, studentData);
      });

      setStudentScores(studentIdToScores);
    } else {
      setStudentScores(new Map());
    }
    setTeams([]);
    setSelectedStudentId(null);
  }, [selectedGrade, selectedItemNames, allStudents, allItems, allRecords, school]);

  const selectedStudentData = useMemo(() => {
    if (!selectedStudentId) return null;
    const scores = studentScores.get(selectedStudentId);
    return scores ? scores.scores : null;
  }, [selectedStudentId, studentScores]);

  const handleBalanceTeams = () => {
    if (studentScores.size === 0 || numTeams < 2) {
      toast({
        variant: 'destructive',
        title: '팀 편성 불가',
        description: '학년, 종목을 선택하고 팀 수를 2 이상으로 설정해주세요.',
      });
      return;
    }

    const sortedStudents = [...studentScores.entries()]
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalScore - a.totalScore);
    
    const newTeams: Student[][] = Array.from({ length: numTeams }, () => []);
    let direction = 1;
    let teamIndex = 0;

    const studentMap = new Map(allStudents.map(s => [s.id, s]));

    sortedStudents.forEach(scoredStudent => {
      const student = studentMap.get(scoredStudent.id);
      if (student) {
        newTeams[teamIndex].push(student);
      }
      
      if (teamIndex + direction >= numTeams || teamIndex + direction < 0) {
        direction *= -1;
      }
      teamIndex += direction;
    });

    setTeams(newTeams);
    toast({ title: '팀 편성 완료', description: `${numTeams}개의 팀이 자동으로 편성되었습니다.` });
  };

  const handleDownloadTeams = () => {
    if (teams.length === 0) {
      toast({ variant: 'destructive', title: '다운로드 실패', description: '먼저 팀을 편성해주세요.' });
      return;
    }

    const dataToExport = teams.flatMap((team, index) => 
      team.map(student => ({
        '팀 번호': index + 1,
        '이름': student.name,
        '학년': student.grade,
        '반': student.classNum,
        '번호': student.studentNum,
        '총점': studentScores.get(student.id)?.totalScore || 0
      }))
    );
    
    exportToCsv(`${school}_${selectedGrade}학년_자동편성팀.csv`, dataToExport);
  };

  return (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shuffle /> 팀 자동 편성</CardTitle>
            <CardDescription>
                기타 기능 종목의 기록을 바탕으로 학생별 능력치를 분석하고, 균형잡힌 팀을 자동으로 편성합니다.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold">1. 분석 대상 설정</h3>
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <Label>학년 선택</Label>
                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                            <SelectTrigger className="w-full sm:w-[120px]">
                                <SelectValue placeholder="학년" />
                            </SelectTrigger>
                            <SelectContent>
                                {grades.map(grade => <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>종목 선택 (기타 종목)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 border rounded-md mt-1">
                            {customItems.map(item => (
                                <div key={item.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`item-${item.id}`}
                                        checked={selectedItemNames.includes(item.name)}
                                        onCheckedChange={() => handleToggleItem(item.name)}
                                        disabled={!selectedGrade}
                                    />
                                    <Label htmlFor={`item-${item.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {item.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {studentScores.size > 0 && (
                <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="font-semibold">2. 학생별 능력치 확인 (100점 만점)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <Label>학생 선택</Label>
                            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''}>
                                <SelectTrigger>
                                    <SelectValue placeholder="학생을 선택하여 능력치 그래프 보기" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[...studentScores.keys()].map(studentId => {
                                        const student = allStudents.find(s => s.id === studentId);
                                        return student ? <SelectItem key={student.id} value={student.id}>{student.name} ({student.classNum}반 {student.studentNum}번)</SelectItem> : null;
                                    })}
                                </SelectContent>
                            </Select>
                            {selectedStudentData && (
                                <div className="mt-4 h-[300px]">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedStudentData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="item" />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                            <Radar name="능력치" dataKey="score" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                                            <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                        <div className="max-h-[350px] overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-muted">
                                    <TableRow>
                                        <TableHead>이름</TableHead>
                                        <TableHead>총점</TableHead>
                                        {selectedItemNames.map(name => <TableHead key={name}>{name}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {[...studentScores.entries()]
                                      .sort((a,b) => b[1].totalScore - a[1].totalScore)
                                      .map(([studentId, data]) => {
                                      const student = allStudents.find(s => s.id === studentId);
                                      if (!student) return null;
                                      return (
                                          <TableRow key={studentId} onClick={() => setSelectedStudentId(studentId)} className="cursor-pointer" data-state={selectedStudentId === studentId ? 'selected' : ''}>
                                              <TableCell>{student.name}</TableCell>
                                              <TableCell className="font-bold">{data.totalScore}</TableCell>
                                              {selectedItemNames.map(itemName => (
                                                  <TableCell key={itemName}>
                                                      {data.scores.find(s => s.item === itemName)?.score || 0}
                                                  </TableCell>
                                              ))}
                                          </TableRow>
                                      );
                                  })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
             
            {studentScores.size > 0 && (
                 <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="font-semibold">3. 팀 편성</h3>
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <Label htmlFor="num-teams">팀 수</Label>
                            <Input
                                id="num-teams"
                                type="number"
                                value={numTeams}
                                onChange={e => setNumTeams(Math.max(2, parseInt(e.target.value) || 2))}
                                min="2"
                                className="w-[100px]"
                            />
                        </div>
                        <Button onClick={handleBalanceTeams}><Shuffle /> 팀 나누기</Button>
                        <Button onClick={handleDownloadTeams} variant="outline" disabled={teams.length === 0}><FileDown /> 팀 명단 다운로드</Button>
                    </div>

                    {teams.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                            {teams.map((team, index) => (
                                <div key={index} className="border rounded-md p-3">
                                    <h4 className="font-bold mb-2 border-b pb-2">팀 {index + 1}</h4>
                                    <ul className="space-y-1 text-sm">
                                        {team.map(student => (
                                            <li key={student.id}>{student.name} ({studentScores.get(student.id)?.totalScore || 0}점)</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
            )}
        </CardContent>
    </Card>
  );
}

