
'use client';
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { calculateRanks, getRecordsByStudent, deleteRecord } from "@/lib/store";
import { Student, MeasurementRecord, MeasurementItem, SportsClub } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Wand2, X as XIcon, ArrowUpDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPapsGrade, getCustomItemGrade, normalizePapsRecord, normalizeCustomRecord } from "@/lib/paps";
import AiWelcome from "../AiWelcome";
import { getScoutingReport } from "@/ai/flows/scouting-report-flow";
import { EditRecordDialog } from "./EditRecordDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const chartConfig = {
  target: { label: "선택 대상", color: "hsl(var(--chart-1))" },
  average: { label: "학년 평균", color: "hsl(var(--chart-2))" },
};

const CustomBarTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 text-sm bg-background/90 border rounded-md shadow-lg">
        <p className="font-bold">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            <p>{`${p.name}: ${p.value}% (${
              p.payload.originalRecords[p.dataKey]?.value || "N/A"
            }${p.payload.originalRecords[p.dataKey]?.unit || ""})`}</p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ClassAnalytics({ allStudents, allItems, allRecords, onRecordUpdate, sportsClubs }: { allStudents: Student[], allItems: MeasurementItem[], allRecords: MeasurementRecord[], onRecordUpdate: any, sportsClubs: SportsClub[] }) {
  const { school } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClassNum, setSelectedClassNum] = useState("all");
  const [selectedClubId, setSelectedClubId] = useState("");

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<MeasurementRecord[]>([]);
  const [progressChartItem, setProgressChartItem] = useState<string>("");

  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);

  const [sortedStudents, setSortedStudents] = useState<any[] | null>(null);
  const [sortItem, setSortItem] = useState("");
  const [sortType, setSortType] = useState<"record" | "averageGrade" | null>(null);

  const [comparisonType, setComparisonType] = useState<"paps" | "custom">("paps");
  const studentDetailRef = useRef<HTMLDivElement>(null);

  const activeItems = useMemo(() => allItems.filter(i => !i.isArchived && !i.isDeactivated), [allItems]);

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort();
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [...new Set(allStudents.filter((s) => s.grade === grade).map((s) => s.classNum))].sort();
    });
    return { grades, classNumsByGrade };
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    if (selectedClubId) {
        const club = sportsClubs.find(c => c.id === selectedClubId);
        if (club) return allStudents.filter(s => club.memberIds.includes(s.id));
    }
    if (selectedGrade) {
      let students = allStudents.filter((s) => s.grade === selectedGrade);
      if (selectedClassNum !== "all") students = students.filter((s) => s.classNum === selectedClassNum);
      return students.sort((a, b) => parseInt(a.studentNum) - parseInt(b.studentNum));
    }
    return [];
  }, [allStudents, selectedGrade, selectedClassNum, selectedClubId, sportsClubs]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setStudentRecords(allRecords.filter(r => r.studentId === student.id));
    setAiAnalysis(null);
    setTimeout(() => {
      studentDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSearch = () => {
    if (!searchTerm) return;
    const found = allStudents.filter(s => s.name.includes(searchTerm));
    if (found.length === 1) {
      handleSelectStudent(found[0]);
      setSelectedGrade(""); setSelectedClubId("");
    } else if (found.length > 1) {
      toast({ title: "여러 명의 학생이 검색됨", description: "학년/반 필터를 이용해 선택해주세요." });
    } else {
      toast({ variant: "destructive", title: "학생을 찾을 수 없습니다." });
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!school) return;
    try {
      await deleteRecord(school, recordId);
      onRecordUpdate();
      toast({ title: "기록 삭제 완료" });
    } catch (e) { toast({ variant: "destructive", title: "삭제 실패" }); }
  };

  const handleAiAnalysis = async () => {
    if (!selectedStudent || !school) return;
    setIsAiLoading(true);
    setIsAiButtonDisabled(true);
    setTimeout(() => setIsAiButtonDisabled(false), 10000);
    try {
      const allItemRanks = calculateRanks(school, allItems, allRecords, allStudents, selectedStudent.grade);
      const abilityScores = allRecords.filter(r => r.studentId === selectedStudent.id).map(r => {
        const itemRanks = allItemRanks[r.item] || [];
        const rank = itemRanks.find(rk => rk.studentId === selectedStudent.id);
        const score = rank ? Math.round((1 - (rank.rank - 1) / itemRanks.length) * 100) : 0;
        return { item: r.item, score };
      });
      const result = await getScoutingReport({ 
        studentName: selectedStudent.name, 
        abilityScores: abilityScores.map(s => ({...s, category: '기타'})), 
        ranks: {}, 
        allItems 
      });
      setAiAnalysis(result);
    } catch (e) { toast({ variant: "destructive", title: "AI 분석 실패" }); }
    finally { setIsAiLoading(false); }
  };

  const calculateAverageGrades = (studentList: Student[], isPaps: boolean) => {
    if (studentList.length === 0) return {};
    const itemsToAnalyze = isPaps ? allItems.filter((i) => i.isPaps) : allItems.filter((i) => !i.isPaps && i.goal);
    const averageData: Record<string, any> = {};

    itemsToAnalyze.forEach((item) => {
      let totalP = 0, totalV = 0, count = 0;
      studentList.forEach((student) => {
        const latest = allRecords.filter(r => r.studentId === student.id && r.item === item.name).sort((a,b) => b.date.localeCompare(a.date))[0];
        if (latest) {
          const p = isPaps ? normalizePapsRecord(getPapsGrade(item.name, student, latest.value) || 5, latest.value, item.name, student) : normalizeCustomRecord(item, latest.value);
          totalP += p; totalV += latest.value; count++;
        }
      });
      if (count > 0) averageData[item.name] = { percentage: totalP / count, avgValue: totalV / count, unit: item.unit };
    });
    return averageData;
  };

  const comparisonData = useMemo(() => {
    if (!school || (!selectedGrade && !selectedClubId && !selectedStudent)) return { data: [], targetLabel: "대상" };
    const itemsToAnalyze = comparisonType === "paps" ? allItems.filter((i) => i.isPaps) : allItems.filter((i) => !i.isPaps && i.goal);
    let targetData: Record<string, any> = {};
    let label = "선택 대상";

    if (selectedStudent) {
      label = selectedStudent.name;
      itemsToAnalyze.forEach(item => {
        const latest = allRecords.filter(r => r.studentId === selectedStudent.id && r.item === item.name).sort((a,b) => b.date.localeCompare(a.date))[0];
        if (latest) {
          const p = comparisonType === 'paps' ? normalizePapsRecord(getPapsGrade(item.name, selectedStudent, latest.value) || 5, latest.value, item.name, selectedStudent) : normalizeCustomRecord(item, latest.value);
          targetData[item.name] = { percentage: p, avgValue: latest.value, unit: item.unit };
        }
      });
    } else {
      label = selectedClubId ? sportsClubs.find(c=>c.id === selectedClubId)?.name || '클럽' : (selectedClassNum === 'all' ? `${selectedGrade}학년 전체` : `${selectedGrade}학년 ${selectedClassNum}반`);
      targetData = calculateAverageGrades(filteredStudents, comparisonType === "paps");
    }

    const gradeAvg = calculateAverageGrades(allStudents.filter(s => s.grade === (selectedStudent?.grade || selectedGrade || '5')), comparisonType === "paps");

    return {
      data: itemsToAnalyze.map(item => ({
        name: item.name,
        target: targetData[item.name]?.percentage || 0,
        average: gradeAvg[item.name]?.percentage || 0,
        originalRecords: {
          target: { value: targetData[item.name]?.avgValue, unit: targetData[item.name]?.unit },
          average: { value: gradeAvg[item.name]?.avgValue, unit: gradeAvg[item.name]?.unit }
        }
      })).filter(d => d.target > 0 || d.average > 0),
      targetLabel: label
    };
  }, [selectedStudent, selectedGrade, selectedClassNum, selectedClubId, allRecords, allItems, comparisonType, filteredStudents, allStudents]);

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>학생/학급별 분석</CardTitle>
        <CardDescription>학급을 선택하여 평균치를 비교하거나, 학생을 검색하여 개별 성장 리포트를 확인하세요.</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Input placeholder="이름 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full sm:w-auto" />
          <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> 검색</Button>
          <span className="text-muted-foreground text-sm mx-2">또는</span>
          <Select value={selectedClubId} onValueChange={v => { setSelectedClubId(v); setSelectedGrade(""); setSelectedStudent(null); }}><SelectTrigger className="w-[150px]"><SelectValue placeholder="클럽" /></SelectTrigger><SelectContent>{sportsClubs.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedClubId(""); setSelectedClassNum("all"); setSelectedStudent(null); }}><SelectTrigger className="w-[120px]"><SelectValue placeholder="학년" /></SelectTrigger><SelectContent>{grades.map(g=><SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent></Select>
          <Select value={selectedClassNum} onValueChange={v => { setSelectedClassNum(v); setSelectedStudent(null); }} disabled={!selectedGrade}><SelectTrigger className="w-[120px]"><SelectValue placeholder="반" /></SelectTrigger><SelectContent><SelectItem value="all">전체</SelectItem>{classNumsByGrade[selectedGrade]?.map(c=><SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent></Select>
          {(selectedGrade || selectedClubId || selectedStudent) && <Button variant="ghost" size="icon" onClick={() => { setSelectedGrade(""); setSelectedClubId(""); setSelectedStudent(null); setSearchTerm(""); }}><XIcon className="h-5 w-5" /></Button>}
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {(selectedGrade || selectedClubId || selectedStudent) && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-2 border-primary/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">성취도 비교 분석</CardTitle>
                    <CardDescription>{comparisonData.targetLabel} vs 학년 평균</CardDescription>
                  </div>
                  <Select value={comparisonType} onValueChange={v => setComparisonType(v as any)}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="paps">PAPS</SelectItem><SelectItem value="custom">기타</SelectItem></SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.data}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} />
                      <YAxis domain={[0, 100]} unit="%" />
                      <Tooltip content={<CustomBarTooltipContent />} />
                      <Legend />
                      <Bar dataKey="target" name={comparisonData.targetLabel} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="average" name="학년 평균" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
                {!selectedStudent && (
                  <CardFooter className="bg-primary/5 p-4 border-t">
                    <AiWelcome title="학급/클럽 AI 브리핑" allStudents={allStudents} classStudents={filteredStudents} items={allItems} records={allRecords} />
                  </CardFooter>
                )}
              </Card>

              {selectedStudent && (
                <Card className="border-2 border-primary/10" ref={studentDetailRef}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedStudent.name} 성장 분석</CardTitle>
                      <CardDescription>개별 성취도 및 AI 코칭</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedStudent(null)}><XIcon className="h-4 w-4" /></Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={allRecords.filter(r => r.studentId === selectedStudent.id).sort((a,b)=>a.date.localeCompare(b.date))}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={10} />
                          <YAxis domain={[0, 'auto']} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-sm">
                      {isAiLoading ? (
                        <div className="flex items-center justify-center py-4"><Loader2 className="animate-spin mr-2 h-4 w-4" /> AI 분석 중...</div>
                      ) : aiAnalysis ? (
                        <p className="whitespace-pre-wrap">{aiAnalysis.assessment}</p>
                      ) : (
                        <div className="text-center">
                          <p className="mb-2 text-muted-foreground">이 학생을 위한 맞춤형 AI 리포트를 생성할 수 있습니다.</p>
                          <Button size="sm" onClick={handleAiAnalysis} disabled={isAiButtonDisabled}><Wand2 className="mr-2 h-4 w-4" />AI 스카우팅 리포트</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>번호</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>성별</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map(s => (
                <TableRow key={s.id} className={cn(selectedStudent?.id === s.id && "bg-primary/5")}>
                  <TableCell>{s.studentNum}</TableCell>
                  <TableCell className="font-bold">{s.name}</TableCell>
                  <TableCell>{s.gender}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" size="sm" onClick={() => handleSelectStudent(s)}>상세 분석</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredStudents.length && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">대상을 선택해주세요.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
