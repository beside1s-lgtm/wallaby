
"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateRanks,
  saveTeamGroup,
  deleteTeamGroup,
  updateTeamGroup,
} from "@/lib/store";
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, Team, TeamGroupInput, SportsClub } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import {
  FileDown,
  Shuffle,
  Loader2,
  Wand2,
  Send,
  Trash2,
  RefreshCw,
  Move,
  Search,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getScoutingReport } from "@/ai/flows/scouting-report-flow";
import type { ScoutingReportOutput } from "@/ai/flows/scouting-report-flow";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn, exportToCsv } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { v4 as uuidv4 } from 'uuid';

interface TeamBalancerProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  teamGroups: TeamGroup[];
  onTeamGroupUpdate: (newGroup: TeamGroup) => void;
  onTeamGroupDelete: (groupId: string) => void;
  sportsClubs: SportsClub[];
}

type ClassSelection = {
  [grade: string]: {
    all: boolean;
    classes: {
      [classNum: string]: boolean;
    }
  }
}

type MovingStudentState = {
  studentId: string;
  sourceTeamId: string;
} | null;

export default function TeamBalancer({ allStudents, allItems, allRecords, teamGroups, onTeamGroupUpdate, onTeamGroupDelete, sportsClubs }: TeamBalancerProps) {
  const { school } = useAuth();
  const { toast } = useToast();

  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState<string>('');
  const [classSelection, setClassSelection] = useState<ClassSelection>({});
  const [clubSelection, setClubSelection] = useState<Record<string, boolean>>({});
  const [selectedGender, setSelectedGender] = useState<"all" | "남" | "여" | "separate">("all");
  const [excludeNonParticipants, setExcludeNonParticipants] = useState(true);
  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [membersPerTeam, setMembersPerTeam] = useState(4);
  const [divideBy, setDivideBy] = useState<"teams" | "members" | "single">("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [leftoverStudents, setLeftoverStudents] = useState<Student[]>([]);
  const [studentScores, setStudentScores] = useState<Map<string, { totalScore: number; scores: { item: string; score: number }[] }>>(new Map());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [balanceStrategy, setBalanceStrategy] = useState<"uniform" | "level">("uniform");
  const [balancingSelection, setBalancingSelection] = useState<Record<string, boolean>>({});
  const [teamGroupName, setTeamGroupName] = useState("");
  const [movingStudent, setMovingStudent] = useState<MovingStudentState>(null);
  const [scoutingReport, setScoutingReport] = useState<ScoutingReportOutput | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [foundStudentsForSelection, setFoundStudentsForSelection] = useState<Student[]>([]);
  const [isStudentSelectionDialogOpen, setIsStudentSelectionDialogOpen] = useState(false);

  const studentRowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());

  const { grades, classNumsByGrade, groupedItems } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      const classes = [...new Set(allStudents.filter((s) => s.grade === grade).map((s) => s.classNum))].sort((a,b) => parseInt(a) - parseInt(b));
      classNumsByGrade[grade] = classes;
    });
    const grouped: Record<string, MeasurementItem[]> = { PAPS: [] };
    allItems.forEach((item) => {
      const category = item.category || (item.isPaps ? "PAPS" : "기타");
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    return { grades, classNumsByGrade, groupedItems: grouped };
  }, [allStudents, allItems]);

  useEffect(() => {
    if (Object.keys(classSelection).length === 0 && grades.length > 0) {
        const initialSelection: ClassSelection = {};
        grades.forEach((grade) => {
            initialSelection[grade] = { all: false, classes: {} };
            classNumsByGrade[grade]?.forEach(classNum => {
                initialSelection[grade].classes[classNum] = false;
            });
        });
        setClassSelection(initialSelection);
    }
  }, [grades, classNumsByGrade, classSelection]);

  const resetToNewTeam = () => {
    setSelectedTeamGroupId('');
    setTeamGroupName('');
    setTeams([]);
    setLeftoverStudents([]);
    setStudentScores(new Map());
    setBalancingSelection({});
    setSelectedStudentId(null);
  };
  
  const handleLoadTeamGroup = (groupId: string) => {
    const group = teamGroups.find(g => g.id === groupId);
    if (!group) return;
    setSelectedTeamGroupId(groupId);
    setTeamGroupName(group.description);
    const studentMap = new Map(allStudents.map(s => [s.id, s]));
    const teamsWithMembers = group.teams.map(team => ({
        ...team,
        members: team.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s)
    }));
    setTeams(teamsWithMembers);
    setSelectedGender(group.gender || 'all');
    setSelectedItemNames(group.itemNamesForBalancing || []);
    setDivideBy(group.divideBy || 'teams');
    setNumTeams(group.numTeams || 2);
    setMembersPerTeam(group.membersPerTeam || 4);
    setLeftoverStudents([]);
    toast({ title: "팀 편성 로드 완료" });
  };

  const handleDeleteTeamGroup = async () => {
    if (!school || !selectedTeamGroupId) return;
    await deleteTeamGroup(school, selectedTeamGroupId);
    onTeamGroupDelete(selectedTeamGroupId);
    resetToNewTeam();
    toast({ title: "팀 편성 삭제 완료" });
  };

  const targetStudents = useMemo(() => {
    const selectedStudentIds = new Set<string>();
    Object.entries(classSelection).forEach(([grade, selection]) => {
      Object.entries(selection.classes).forEach(([classNum, isSelected]) => {
        if (isSelected) allStudents.forEach(s => { if (s.grade === grade && s.classNum === classNum) selectedStudentIds.add(s.id); });
      });
    });
    Object.entries(clubSelection).forEach(([clubId, isSelected]) => {
        if (isSelected) sportsClubs.find(c => c.id === clubId)?.memberIds.forEach(id => selectedStudentIds.add(id));
    });
    let students = Array.from(selectedStudentIds).map(id => allStudents.find(s => s.id === id)).filter((s): s is Student => !!s);
    if (selectedGender !== "all" && selectedGender !== "separate") students = students.filter((s) => s.gender === selectedGender);
    return students;
  }, [classSelection, clubSelection, sportsClubs, selectedGender, allStudents]);

  useEffect(() => {
    if (school && targetStudents.length > 0 && selectedItemNames.length > 0) {
      const studentIdToRawScores = new Map<string, { totalScore: number; scores: { item: string; score: number }[] }>();
      const studentsForAnalysis = targetStudents.filter(s => !excludeNonParticipants || selectedItemNames.some(name => allRecords.some(r => r.studentId === s.id && r.item === name)));
      const ranksByGrade = new Map();
      [...new Set(studentsForAnalysis.map(s => s.grade))].forEach(g => ranksByGrade.set(g, calculateRanks(school, allItems, allRecords, allStudents, g)));
      
      selectedItemNames.forEach(name => {
        studentsForAnalysis.forEach(student => {
            const gradeRanks = ranksByGrade.get(student.grade);
            const itemRanks = gradeRanks?.[name];
            let score = 0;
            if (itemRanks) {
                const rankInfo = itemRanks.find((r: any) => r.studentId === student.id);
                if (rankInfo) score = Math.round((1 - (rankInfo.rank - 1) / itemRanks.length) * 100);
            }
            if (!studentIdToRawScores.has(student.id)) studentIdToRawScores.set(student.id, { totalScore: 0, scores: [] });
            studentIdToRawScores.get(student.id)!.scores.push({ item: name, score });
        });
      });

      studentIdToRawScores.forEach(data => { data.totalScore = data.scores.reduce((acc, s) => acc + s.score, 0); });
      const finalScores = new Map();
      const maxRaw = studentIdToRawScores.size > 0 ? Math.max(...Array.from(studentIdToRawScores.values()).map(d => d.totalScore)) : 0;
      studentIdToRawScores.forEach((data, id) => finalScores.set(id, { ...data, totalScore: maxRaw > 0 ? Math.round((data.totalScore / maxRaw) * 100) : 0 }));
      setStudentScores(finalScores);
      if (!Object.keys(balancingSelection).length) {
          const newSel: Record<string, boolean> = {};
          finalScores.forEach((_, id) => newSel[id] = true);
          setBalancingSelection(newSel);
      }
    }
  }, [targetStudents, selectedItemNames, excludeNonParticipants, allRecords, allItems, school, allStudents]);

  const handleBalanceTeams = () => {
    const ids = Object.entries(balancingSelection).filter(([, s]) => s).map(([id]) => id);
    if (!ids.length) { toast({ variant: "destructive", title: "학생을 선택하세요" }); return; }
    
    const studentsToBalance = allStudents.filter(s => ids.includes(s.id));
    const sorted = studentsToBalance.map(s => ({ s, score: studentScores.get(s.id)?.totalScore || 0 })).sort((a,b) => b.score - a.score).map(x => x.s);
    
    let balancedArrays: Student[][] = [];
    if (divideBy === 'teams') {
        balancedArrays = Array.from({ length: numTeams }, () => []);
        let dir = 1, idx = 0;
        sorted.forEach(s => {
            balancedArrays[idx].push(s);
            idx += dir;
            if (idx < 0 || idx >= numTeams) { dir *= -1; idx += dir; }
        });
    } else if (divideBy === 'members') {
        const count = Math.floor(sorted.length / membersPerTeam);
        balancedArrays = Array.from({ length: count }, () => []);
        const toDist = sorted.slice(0, count * membersPerTeam);
        let dir = 1, idx = 0;
        toDist.forEach(s => {
            balancedArrays[idx].push(s);
            idx += dir;
            if (idx < 0 || idx >= count) { dir *= -1; idx += dir; }
        });
        setLeftoverStudents(sorted.slice(count * membersPerTeam));
    } else {
        balancedArrays = [studentsToBalance];
    }

    setTeams(balancedArrays.map((arr, i) => ({
        id: uuidv4(),
        name: `${arr[0]?.grade || ''}-${arr[0]?.classNum || ''} 팀 ${i+1}`,
        teamIndex: i,
        memberIds: arr.map(s => s.id),
        members: arr
    })));
    toast({ title: "팀 편성 완료" });
  };

  const handleRenameTeam = (id: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  };

  const handleMoveStudent = (studentId: string, fromId: string, toId: string) => {
    setTeams(prev => {
        let student: Student | undefined;
        const next = prev.map(t => {
            if (t.id === fromId) {
                student = t.members?.find(s => s.id === studentId);
                return { ...t, members: t.members?.filter(s => s.id !== studentId), memberIds: t.memberIds.filter(id => id !== studentId) };
            }
            return t;
        });
        if (!student) return prev;
        return next.map(t => t.id === toId ? { ...t, members: [...(t.members || []), student!], memberIds: [...t.memberIds, studentId] } : t);
    });
    setMovingStudent(null);
  };

  const handleSendTeams = async () => {
    if (!school || !teams.length || !teamGroupName) { toast({ variant: "destructive", title: "정보 부족" }); return; }
    setIsSending(true);
    try {
      const input: TeamGroupInput = {
        school, description: teamGroupName, analysisScope: 'class', gender: selectedGender, divideBy, numTeams, membersPerTeam, itemNamesForBalancing: selectedItemNames,
        teams: teams.map(t => ({ id: t.id, teamIndex: t.teamIndex, memberIds: t.memberIds, name: t.name }))
      };
      const res = selectedTeamGroupId ? await updateTeamGroup(selectedTeamGroupId, input) : await saveTeamGroup(input);
      onTeamGroupUpdate(res);
      toast({ title: res.id === selectedTeamGroupId ? "업데이트 완료" : "전달 완료" });
    } finally { setIsSending(false); }
  };

  const teamAverages = useMemo(() => {
    const map = new Map();
    teams.forEach(t => {
        const avgScores = selectedItemNames.map(name => {
            const scores = t.members?.map(m => studentScores.get(m.id)?.scores.find(s => s.item === name)?.score || 0) || [];
            return { item: name, score: scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0 };
        });
        map.set(t.id, avgScores);
    });
    return map;
  }, [teams, studentScores, selectedItemNames]);

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shuffle /> 팀 자동 편성</CardTitle>
        <div className="flex flex-wrap gap-2 pt-4 p-4 border rounded-md bg-muted/50">
            <Select onValueChange={handleLoadTeamGroup} value={selectedTeamGroupId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="저장된 편성 불러오기..." /></SelectTrigger>
                <SelectContent>{teamGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.description}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={resetToNewTeam}><RefreshCw className="mr-2 h-4 w-4"/>새 편성</Button>
            <Button variant="destructive" disabled={!selectedTeamGroupId} onClick={handleDeleteTeamGroup}><Trash2 className="h-4 w-4"/></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-md space-y-4">
            <h3 className="font-bold">1. 편성 대상 및 기준</h3>
            <div className="flex flex-wrap gap-4">
                <Accordion type="multiple" className="w-full sm:w-[400px] border rounded-md p-2 bg-background">
                    {grades.map(g => (
                        <AccordionItem key={g} value={g}>
                            <div className="flex items-center gap-2 p-2">
                                <Checkbox checked={classSelection[g]?.all || false} onCheckedChange={c => {
                                    const next = { ...classSelection };
                                    next[g].all = !!c;
                                    Object.keys(next[g].classes).forEach(cn => next[g].classes[cn] = !!c);
                                    setClassSelection(next);
                                }} />
                                <Label>{g}학년</Label><AccordionTrigger className="ml-auto" />
                            </div>
                            <AccordionContent className="grid grid-cols-3 gap-2 pl-8">
                                {classNumsByGrade[g]?.map(cn => (
                                    <div key={cn} className="flex items-center gap-2">
                                        <Checkbox checked={classSelection[g]?.classes[cn] || false} onCheckedChange={c => {
                                            const next = { ...classSelection };
                                            next[g].classes[cn] = !!c;
                                            next[g].all = Object.values(next[g].classes).every(Boolean);
                                            setClassSelection(next);
                                        }} />
                                        <Label>{cn}반</Label>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                <div className="space-y-4">
                    <Select value={selectedGender} onValueChange={v=>setSelectedGender(v as any)}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">전체(혼성)</SelectItem><SelectItem value="separate">성별 분리</SelectItem><SelectItem value="남">남학생만</SelectItem><SelectItem value="여">여학생만</SelectItem></SelectContent></Select>
                    <div className="flex items-center gap-2"><Checkbox id="ex" checked={excludeNonParticipants} onCheckedChange={c=>setExcludeNonParticipants(!!c)}/><Label htmlFor="ex">기록 없는 학생 제외</Label></div>
                </div>
            </div>
            <div className="space-y-2">
                <Label className="font-bold">밸런스 기준 종목</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                    {allItems.filter(i=>!i.isArchived && !i.isDeactivated).map(i => (
                        <div key={i.id} className="flex items-center gap-2 bg-secondary/50 p-1 px-2 rounded-full">
                            <Checkbox checked={selectedItemNames.includes(i.name)} onCheckedChange={c => setSelectedItemNames(prev => c ? [...prev, i.name] : prev.filter(n=>n!==i.name))} />
                            <Label className="text-xs">{i.name}</Label>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {teams.length > 0 && (
            <div className="p-4 border rounded-md space-y-4" onClick={() => setMovingStudent(null)}>
                <div className="flex flex-wrap gap-4 items-end border-b pb-4">
                    <div className="space-y-2"><Label>팀 편성 이름</Label><Input value={teamGroupName} onChange={e=>setTeamGroupName(e.target.value)} placeholder="예: 5학년 축구 리그" className="w-[200px]" /></div>
                    <Button onClick={handleBalanceTeams} variant="secondary"><Shuffle className="mr-2 h-4 w-4" />다시 편성</Button>
                    <Button onClick={handleSendTeams} disabled={isSending} className="ml-auto">{isSending ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}전달하기</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map((t, idx) => (
                        <Card key={t.id} className={cn("cursor-pointer transition-all", movingStudent && movingStudent.sourceTeamId !== t.id ? "ring-2 ring-dashed ring-primary" : "hover:border-primary")} onClick={() => movingStudent && movingStudent.sourceTeamId !== t.id ? handleMoveStudent(movingStudent.studentId, movingStudent.sourceTeamId, t.id) : null}>
                            <CardHeader className="p-3 border-b bg-muted/30">
                                <div className="flex items-center gap-2 px-2">
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <Input 
                                        value={t.name} 
                                        onChange={e => handleRenameTeam(t.id, e.target.value)} 
                                        className="h-8 text-center font-bold bg-background border-primary/20 focus:border-primary shadow-sm" 
                                        placeholder="팀 이름 입력"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-3 space-y-3">
                                <div className="h-[120px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={teamAverages.get(t.id)}><PolarGrid /><PolarAngleAxis dataKey="item" tick={{fontSize: 8}} /><Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} /></RadarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-1">
                                    {t.members?.map(m => (
                                        <div key={m.id} className={cn("flex items-center gap-2 p-1 px-2 rounded text-sm", movingStudent?.studentId === m.id ? "bg-primary text-white" : "hover:bg-muted")} onClick={(e) => { e.stopPropagation(); setMovingStudent({ studentId: m.id, sourceTeamId: t.id }); }}>
                                            <span className="font-medium">{m.name}</span>
                                            <span className="text-[10px] opacity-70 ml-auto">{studentScores.get(m.id)?.totalScore}점</span>
                                            {movingStudent?.studentId === m.id && <Move className="h-3 w-3" />}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )}
        {!teams.length && targetStudents.length > 0 && <Button onClick={handleBalanceTeams} className="w-full h-12 text-lg">팀 편성 시작하기</Button>}
      </CardContent>
    </Card>
  );
}
