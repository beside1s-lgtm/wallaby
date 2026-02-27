'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getItems, addOrUpdateRecord, getRecordsByStudent, getStudentById, calculateRanks, deleteRecord, getLatestTeamGroupForStudent, getTeamGroups, getLatestTournamentForStudent, getStudents, getQuizAssignments, getSportsClubs, getRecords } from '@/lib/store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { getStudentFeedback } from '@/ai/flows/student-ai-feedback';
import { getScoutingReport } from '@/ai/flows/scouting-report-flow';
import { getTeamAnalysis } from '@/ai/flows/team-analysis-flow';
import type { ScoutingReportOutput } from '@/ai/flows/scouting-report-flow';
import { Loader2, Wand2, Trash2, Users, User as UserIcon, Swords, Bot, Printer, Crown, Medal, Trophy, BookOpen, ChevronRight, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import type { Student, MeasurementRecord, MeasurementItem, TeamGroup, Tournament, Match, QuizAssignment } from '@/lib/types';
import { getPapsGrade, getCustomItemGrade, normalizePapsRecord, normalizeCustomRecord } from '@/lib/paps';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';

const chartConfig = {
  score: { label: "등급", color: "hsl(var(--chart-2))" },
  achievement: { label: "기록 성취도", color: "hsl(var(--chart-1))" },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const scorePayload = payload.find(p => p.dataKey === 'score');
    const achievementPayload = payload.find(p => p.dataKey === 'achievement');

    return (
      <div className="p-2 text-sm bg-background/90 border rounded-md shadow-lg">
        <p className="font-bold">{label} ({data.itemName})</p>
        {scorePayload && <p style={{ color: scorePayload.color }}>{`등급: ${data.grade}등급`}</p>}
        {achievementPayload && <p style={{ color: achievementPayload.color }}>{`기록: ${data.value}${data.unit}`}</p>}
        {data.rank && <p className="text-muted-foreground mt-1">{data.rank}</p>}
      </div>
    );
  }
  return null;
};

type AiReport = {
  type: 'scouting' | 'team';
  data: ScoutingReportOutput;
}

export default function StudentDashboardPage() {
  const { user, school, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const student = user as Student;

  const [measurementItems, setMeasurementItems] = useState<MeasurementItem[]>([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [value, setValue] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [aiFeedback, setAiFeedback] = useState('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);

  const [chartFilter, setChartFilter] = useState<'all' | 'paps' | 'custom'>('all');
  const [chartItemFilter, setChartItemFilter] = useState('');
  
  const [fullStudent, setFullStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allRecords, setAllRecords] = useState<MeasurementRecord[]>([]);

  const [teamGroup, setTeamGroup] = useState<TeamGroup | null>(null);
  const [myTeam, setMyTeam] = useState<{ teamIndex: number, members: Student[] } | null>(null);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [abilityScores, setAbilityScores] = useState<{ item: string; score: number }[]>([]);
  const [teamAverageScores, setTeamAverageScores] = useState<{ item: string; score: number }[]>([]);
  
  const [tournament, setTournament] = useState<Tournament | null>(null);

  const [activeReport, setActiveReport] = useState<AiReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("growth-record");

  const [assignedQuizzes, setAssignedQuizzes] = useState<QuizAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<QuizAssignment | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<{ score: number, total: number, corrections: boolean[] } | null>(null);

  useEffect(() => {
    const body = document.body;
    const originalClasses = body.className;
    const tabBackgrounds: { [key: string]: string } = {
        'growth-record': 'measurement-bg',
        'measurement-input': 'data-bg',
        'my-competition': 'competition-bg',
        'physical-knowledge': 'watermark-bg',
    };

    Object.values(tabBackgrounds).forEach(bgClass => {
        body.classList.remove(bgClass);
    });
    body.classList.remove('watermark-bg');
    
    const bgClass = tabBackgrounds[activeTab] || 'watermark-bg';
    body.classList.add(bgClass);

    return () => {
        body.className = originalClasses;
    };
  }, [activeTab]);
  
  useEffect(() => {
    async function loadData() {
        if (isAuthLoading || !student?.id || !school) {
            return;
        }
        setIsDataLoading(true);
        try {
            const [items, recs, stud, allStuds, allRecs, teamData, allTeamGroups, allClubs, allAssignments] = await Promise.all([
                getItems(school),
                getRecordsByStudent(school, student.id),
                getStudentById(school, student.id),
                getStudents(school),
                getRecords(school),
                getLatestTeamGroupForStudent(school, student.id),
                getTeamGroups(school),
                getSportsClubs(school),
                getQuizAssignments(school),
            ]);
            const tournamentData = await getLatestTournamentForStudent(school, student.id, allStuds, allTeamGroups);
            setTournament(tournamentData);
            setMeasurementItems(items);
            setRecords(recs);
            setFullStudent(stud || null);
            setAllStudents(allStuds);
            setAllRecords(allRecs);

            const studentClubs = allClubs.filter(c => c.memberIds.includes(student.id));
            const studentClubIds = new Set(studentClubs.map(c => c.id));

            const studentAssignments = allAssignments.filter(a => {
                if (a.targetType === 'class') {
                    return a.targetGrade === stud?.grade && a.targetClassNum === stud?.classNum;
                } else {
                    return a.targetClubId && studentClubIds.has(a.targetClubId);
                }
            });
            setAssignedQuizzes(studentAssignments);
            
            if (teamData) {
                const studentMap = new Map(allStuds.map(s => [s.id, s]));
                const populatedTeamGroup: TeamGroup = {
                    ...teamData,
                    teams: teamData.teams.map(team => ({
                        ...team,
                        name: `팀 ${team.teamIndex + 1}`,
                        members: team.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s)
                    }))
                };
                setTeamGroup(populatedTeamGroup);
                
                const studentTeam = populatedTeamGroup.teams.find(t => t.memberIds.includes(student.id));
                
                if (stud && teamData.itemNamesForBalancing && teamData.itemNamesForBalancing.length > 0) {
                    const allRanks = calculateRanks(school, items, allRecs, allStuds, stud.grade);
                    const itemNames = teamData.itemNamesForBalancing;

                    const getScoresForStudent = (targetStudent: Student) => {
                        return itemNames.map(itemName => {
                            const itemRanks = allRanks[itemName];
                            let score = 0;
                            if (itemRanks && itemRanks.length > 0) {
                                const rankInfo = itemRanks.find(r => r.studentId === targetStudent.id);
                                if (rankInfo) {
                                    score = Math.round((1 - (rankInfo.rank - 1) / itemRanks.length) * 100);
                                }
                            }
                            return { item: itemName, score };
                        });
                    };

                    setAbilityScores(getScoresForStudent(stud));
                    
                    if (studentTeam) {
                        setMyTeam(studentTeam);
                        setSelectedTeamIndex(studentTeam.teamIndex);

                        const otherTeamMembers = studentTeam.members;
                        if (otherTeamMembers && otherTeamMembers.length > 0) {
                            const teamScores: Record<string, number[]> = {};
                            itemNames.forEach(name => { teamScores[name] = [] });

                            otherTeamMembers.forEach(member => {
                                const memberScores = getScoresForStudent(member);
                                memberScores.forEach(({ item, score }) => {
                                    teamScores[item].push(score);
                                });
                            });

                            const avgScores = itemNames.map(itemName => {
                                const scores = teamScores[itemName];
                                const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                                return { item: itemName, score: Math.round(average) };
                            });
                            setTeamAverageScores(avgScores);
                        } else {
                            setTeamAverageScores(getScoresForStudent(stud));
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Failed to load student data", error);
            toast({ variant: 'destructive', title: '데이터 로딩 실패' });
        } finally {
            setIsDataLoading(false);
        }
    }
    loadData();
  }, [student?.id, school, toast, isAuthLoading]);

    const matchesByRound = useMemo(() => {
        if (!tournament?.matches) return {};
        return tournament.matches.reduce((acc, match) => {
        const round = match.round || 1;
        if (!acc[round]) acc[round] = [];
        acc[round].push(match);
        acc[round].sort((a, b) => a.matchNumber - b.matchNumber);
        return acc;
        }, {} as Record<number, Match[]>);
    }, [tournament]);

    const teamNameMap = useMemo(() => {
        if (!tournament?.teams) return new Map<string, string>();
        return new Map(tournament.teams.map((team) => [team.id, team.name]));
    }, [tournament]);
  
  const selectedItem = useMemo(() => {
      return measurementItems.find(item => item.name === selectedItemName);
  }, [selectedItemName, measurementItems]);

  const inputPlaceholder = useMemo(() => {
    if (!selectedItem) return "측정 결과 (숫자만 입력)";
    return `결과 (${selectedItem.unit})`;
  }, [selectedItem]);

  const fetchRecords = async () => {
      if (!school || !student) return;
      const updatedRecords = await getRecordsByStudent(school, student.id);
      const updatedAllRecords = await getRecords(school);
      setRecords(updatedRecords);
      setAllRecords(updatedAllRecords);
  }

  const handleSubmit = async () => {
    if (!selectedItemName || !school || !student) {
      toast({ variant: 'destructive', title: '입력 오류', description: '측정 종목을 선택해주세요.' });
      return;
    }
    
    let valueToSave: number | null = null;
    if (selectedItem?.isCompound) {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) {
        toast({ variant: 'destructive', title: '입력 오류', description: '유효한 키와 몸무게를 입력해주세요.' });
        return;
      }
      const heightInMeters = h / 100;
      valueToSave = parseFloat((w / (heightInMeters * heightInMeters)).toFixed(2));
    } else {
      if (!value) {
        toast({ variant: 'destructive', title: '입력 오류', description: '결과를 입력해주세요.' });
        return;
      }
      const numericValue = parseFloat(value);
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
            studentId: student.id,
            school: school,
            item: selectedItemName,
            value: valueToSave,
            date: format(new Date(), 'yyyy-MM-dd'),
        });

        await fetchRecords();
        setAiFeedback('');
        
        toast({
            title: '기록 저장 완료',
            description: `${selectedItemName} 기록이 저장/업데이트되었습니다.`,
        });
        
        setValue('');
        setHeight('');
        setWeight('');
        setSelectedItemName('');
    } catch(error) {
        console.error("Failed to save record:", error);
        toast({ variant: 'destructive', title: '저장 실패', description: '기록 저장 중 오류가 발생했습니다.'})
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!school) return;
    try {
        await deleteRecord(school, recordId);
        await fetchRecords();
        toast({
            title: '기록 삭제 완료',
            description: '선택한 기록이 삭제되었습니다.',
        });
    } catch (error) {
        console.error("Failed to delete record:", error);
        toast({ variant: 'destructive', title: '삭제 실패', description: '기록 삭제 중 오류가 발생했습니다.'})
    }
  };
  
  const handleGetFeedback = async () => {
    if (!fullStudent || records.length === 0 || !school) {
        toast({
            variant: 'destructive',
            title: '피드백 생성 불가',
            description: '피드백을 생성하려면 먼저 기록을 하나 이상 입력해주세요.',
        });
        return;
    }
    
    setIsFeedbackLoading(true);
    setIsAiButtonDisabled(true);
    setTimeout(() => setIsAiButtonDisabled(false), 10000);

    try {
      const latestRecord = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const itemInfo = measurementItems.find(i => i.name === latestRecord.item);
      if (!itemInfo) throw new Error("Item info not found");

      const allItemRanks = calculateRanks(school, measurementItems, allRecords, allStudents, fullStudent.grade);
      const ranksForItem = allItemRanks[latestRecord.item] || [];
      const rankInfo = ranksForItem.find(r => r.studentId === fullStudent.id && r.value === latestRecord.value);
      
      const feedbackInput = {
        school: school,
        studentName: fullStudent.name,
        grade: fullStudent.grade,
        classNumber: fullStudent.classNum,
        studentNumber: fullStudent.studentNum,
        gender: fullStudent.gender,
        exerciseType: latestRecord.item,
        performanceResult: `${latestRecord.value}${itemInfo.unit || ''}`,
        rank: rankInfo ? `${ranksForItem.length}명 중 ${rankInfo.rank}등` : undefined,
      };

      const result = await getStudentFeedback(feedbackInput);
      setAiFeedback(result.feedback);
    } catch (error) {
      console.error('AI 피드백 요청 실패:', error);
      toast({
        variant: 'destructive',
        title: 'AI 피드백 오류',
        description: '피드백을 생성하는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsFeedbackLoading(false);
    }
  };

   const handleGetScoutingReport = async () => {
    if (!fullStudent || abilityScores.length === 0 || !school) {
        toast({
            variant: 'destructive',
            title: '리포트 생성 불가',
            description: '팀 편성을 위한 능력치 데이터가 있어야 리포트를 생성할 수 있습니다.',
        });
        return;
    }
    
    setIsReportLoading(true);
    setIsAiButtonDisabled(true);
    setTimeout(() => setIsAiButtonDisabled(false), 10000);
    setActiveReport(null);
    try {
      const allItemRanks = calculateRanks(school, measurementItems, allRecords, allStudents, fullStudent.grade);
      const studentRanks: Record<string, string> = {};
       Object.entries(allItemRanks).forEach(([item, ranks]) => {
            const rankInfo = ranks.find(r => r.studentId === fullStudent.id);
            if(rankInfo && abilityScores.some(s => s.item === item)) {
                studentRanks[item] = `${ranks.length}명 중 ${rankInfo.rank}등`;
            }
       });

      const input = {
        studentName: fullStudent.name,
        abilityScores: abilityScores.map(s => {
          const itemInfo = measurementItems.find(i => i.name === s.item);
          return {
            ...s,
            category: itemInfo?.category || (itemInfo?.isPaps ? 'PAPS' : '기타'),
          }
        }),
        ranks: studentRanks,
        allItems: measurementItems
      };

      const result = await getScoutingReport(input);
      setActiveReport({type: 'scouting', data: result});

    } catch (error) {
      console.error('AI 스카우팅 리포트 요청 실패:', error);
      toast({
        variant: 'destructive',
        title: 'AI 리포트 오류',
        description: '리포트를 생성하는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleGetTeamReport = async () => {
    if (teamAverageScores.length === 0 || !myTeam) {
        toast({ variant: 'destructive', title: '팀 분석 불가', description: '팀 편성 및 분석 데이터가 필요합니다.' });
        return;
    }
    
    setIsReportLoading(true);
    setIsAiButtonDisabled(true);
    setTimeout(() => setIsAiButtonDisabled(false), 10000);
    setActiveReport(null);
    try {
        const teamName = `팀 ${myTeam.teamIndex + 1}`;
        const result = await getTeamAnalysis({
            teamName,
            abilityScores: teamAverageScores
        });
        const reportData: ScoutingReportOutput = {
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          assessment: result.assessment,
          position: result.strategy,
          suggestedTrainingMethods: '',
        }
        setActiveReport({ type: 'team', data: reportData });
    } catch(error) {
        console.error('AI 팀 분석 요청 실패:', error);
        toast({ variant: 'destructive', title: 'AI 팀 분석 오류', description: '팀 분석 리포트를 생성하는 중 오류가 발생했습니다.'});
    } finally {
      setIsReportLoading(false);
    }
  }

  const availableItems = useMemo(() => {
    if (!fullStudent || isAuthLoading) return [];
    
    const studentMeasuredItemNames = new Set(records.map(r => r.item));
    
    return measurementItems.filter(item => {
        const isMeasured = studentMeasuredItemNames.has(item.name);
        if (!isMeasured) return false;
        
        if (chartFilter === 'paps') return item.isPaps;
        if (chartFilter === 'custom') return !item.isPaps;
        return true;
    });
  }, [measurementItems, records, chartFilter, fullStudent, isAuthLoading]);

  const chartData = useMemo(() => {
    if (!fullStudent || !school || !chartItemFilter || isAuthLoading) return [];

    const itemInfo = measurementItems.find(i => i.name === chartItemFilter);
    if (!itemInfo) return [];

    const recordsForItem = records.filter(record => record.item === chartItemFilter);
    if (recordsForItem.length === 0) return [];

    const allItemRanks = calculateRanks(school, measurementItems, allRecords, allStudents, fullStudent.grade);
    const itemRanks = allItemRanks[chartItemFilter] || [];

    return recordsForItem
      .map(record => {
        let grade: number | null = null;
        let achievement: number | null = null;
        if (itemInfo.isPaps) {
            grade = getPapsGrade(record.item, fullStudent, record.value);
            if (grade) achievement = normalizePapsRecord(grade, record.value, record.item, fullStudent);
        } else {
            grade = getCustomItemGrade(itemInfo, record.value);
            if (grade) achievement = normalizeCustomRecord(itemInfo, record.value);
        }

        if (grade === null) return null;

        const rankInfo = itemRanks.find(r => r.studentId === fullStudent.id && r.value === record.value);

        return {
            date: record.date,
            itemName: record.item,
            grade: grade,
            score: 6 - grade,
            achievement: achievement,
            value: record.value,
            unit: itemInfo.unit,
            rank: rankInfo ? `같은 학년 ${itemRanks.length}명 중 ${rankInfo.rank}등` : undefined
        };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(a.date).getTime());
  }, [records, chartItemFilter, measurementItems, fullStudent, school, allRecords, allStudents, isAuthLoading]);

  useEffect(() => {
    if (availableItems.length > 0) {
        const isCurrentValid = availableItems.some(i => i.name === chartItemFilter);
        if (!isCurrentValid) {
            setChartItemFilter(availableItems[0].name);
        }
    } else {
        setChartItemFilter('');
    }
  }, [availableItems, chartItemFilter]);

  const hallOfFameData = useMemo(() => {
    if (!school || !fullStudent) return [];
    
    const measurementWeekItems = measurementItems.filter(item => item.isMeasurementWeek && !item.isArchived && !item.isDeactivated);
    if (measurementWeekItems.length === 0) return [];
    
    const allRanks = calculateRanks(school, measurementItems, allRecords, allStudents);
    const studentMap = new Map(allStudents.map(s => [s.id, s]));

    return measurementWeekItems.map(item => {
      const itemRanks = allRanks[item.name] || [];
      const top3 = itemRanks.slice(0, 3).map(rankInfo => {
        const student = studentMap.get(rankInfo.studentId);
        return {
          rank: rankInfo.rank,
          name: student?.name || '알 수 없음',
          value: `${rankInfo.value}${item.unit}`
        };
      });
      const myRankInfo = itemRanks.find(r => r.studentId === fullStudent.id);
      return { 
        itemName: item.name, 
        topStudents: top3,
        myRank: myRankInfo ? `${itemRanks.length}명 중 ${myRankInfo.rank}등` : '기록 없음'
      };
    });

  }, [measurementItems, allRecords, allStudents, school, fullStudent]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);

  const displayedTeam = useMemo(() => {
    if (!teamGroup || selectedTeamIndex === null) return null;
    return teamGroup.teams.find(t => t.teamIndex === selectedTeamIndex) || null;
  }, [teamGroup, selectedTeamIndex]);
  
  const myTotalScore = useMemo(() => {
    if (abilityScores.length === 0) return 0;
    const total = abilityScores.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / abilityScores.length);
  }, [abilityScores]);

  const teamTotalScore = useMemo(() => {
    if (teamAverageScores.length === 0) return 0;
    const total = teamAverageScores.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / teamAverageScores.length);
  }, [teamAverageScores]);

  const handleStartQuiz = (assignment: QuizAssignment) => {
    setSelectedAssignment(assignment);
    setQuizAnswers({});
    setQuizResult(null);
    setIsQuizModalOpen(true);
  };

  const handleQuizAnswerChange = (questionIndex: number, answer: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };

  const handleSubmitQuiz = () => {
    if (!selectedAssignment || !selectedAssignment.questions) return;
    
    let score = 0;
    const corrections = selectedAssignment.questions.map((q, idx) => {
        const studentAnswer = (quizAnswers[idx] || '').trim();
        const correctAnswer = (q.answer || '').trim();
        
        let isCorrect = false;
        if (q.type === 'multiple-choice' && q.options) {
            // Check if the student selected the text of the answer OR the index matching the answer text
            const selectedOptionIndex = parseInt(studentAnswer) - 1;
            const selectedOptionText = q.options[selectedOptionIndex];
            isCorrect = (selectedOptionText === correctAnswer) || (studentAnswer === correctAnswer);
        } else {
            isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
        }
        
        if (isCorrect) score++;
        return isCorrect;
    });

    setQuizResult({
        score,
        total: selectedAssignment.questions.length,
        corrections
    });
  };


  if (isDataLoading || !fullStudent || !school) {
    return (
         <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
         </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
                <AvatarImage src={fullStudent.photoUrl || undefined} alt={fullStudent.name} />
                <AvatarFallback>
                    {fullStudent.name ? fullStudent.name.charAt(0) : <UserIcon />}
                </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-primary font-headline">
                {school} {fullStudent.name} 학생 대시보드
              </h1>
               <p className="text-muted-foreground">{fullStudent.grade}학년 {fullStudent.classNum}반</p>
            </div>
        </div>
        <Button asChild>
          <Link href="/student/report" target="_blank">
            <Printer className="mr-2 h-4 w-4" />
            성장 리포트 출력
          </Link>
        </Button>
      </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-card/90 backdrop-blur-sm">
                <TabsTrigger value="growth-record">성장 기록</TabsTrigger>
                <TabsTrigger value="measurement-input">측정결과 입력</TabsTrigger>
                <TabsTrigger value="my-competition">나의 대회</TabsTrigger>
                <TabsTrigger value="physical-knowledge">체육 지식</TabsTrigger>
            </TabsList>
            <TabsContent value="growth-record" className="space-y-8 mt-6">
                <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>나의 성장 기록</CardTitle>
                            <CardDescription>측정 결과의 등급(막대)과 실제 기록의 성취도(선)를 함께 확인해보세요.</CardDescription>
                        </div>
                        <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
                            <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1 w-full sm:w-auto">
                                <Button variant={chartFilter === 'all' ? 'outline-active' : 'ghost'} size="sm" onClick={() => setChartFilter('all')} className="bg-background data-[active]:bg-primary data-[active]:text-primary-foreground">전체</Button>
                                <Button variant={chartFilter === 'paps' ? 'outline-active' : 'ghost'} size="sm" onClick={() => setChartFilter('paps')} className="bg-background data-[active]:bg-primary data-[active]:text-primary-foreground">PAPS</Button>
                                <Button variant={chartFilter === 'custom' ? 'outline-active' : 'ghost'} size="sm" onClick={() => setChartFilter('custom')} className="bg-background data-[active]:bg-primary data-[active]:text-primary-foreground">기타</Button>
                            </div>
                            <Select onValueChange={setChartItemFilter} value={chartItemFilter}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder={availableItems.length > 0 ? "종목 선택" : "측정 종목 없음"} />
                                </SelectTrigger>
                                <SelectContent>
                                {availableItems.length > 0 ? (
                                    availableItems.map(item => (
                                        <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="none" disabled>측정 종목 없음</SelectItem>
                                )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    </CardHeader>
                    <CardContent>
                    {chartData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[400px] w-full">
                        <ResponsiveContainer>
                            <ComposedChart data={chartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-2))" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={(value) => `${6 - value}등급`} name="등급" />
                            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-1))" domain={[0, 100]} unit="%" name="성취도" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="score" yAxisId="left" fill="var(--color-score)" name="등급" radius={[4, 4, 0, 0]} barSize={20} />
                            <Line dataKey="achievement" yAxisId="right" type="monotone" stroke="var(--color-achievement)" strokeWidth={2} dot={true} name="성취도" />
                            </ComposedChart>
                        </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                        <p>{availableItems.length > 0 ? '그래프를 표시할 종목을 선택해주세요.' : '측정된 기록이 없습니다.'}</p>
                        </div>
                    )}
                    </CardContent>
                </Card>
                {hallOfFameData.length > 0 && (
                    <Card className="bg-yellow-50/80 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                                <Trophy /> 명예의 전당
                            </CardTitle>
                            <CardDescription>현재 측정 주간으로 설정된 종목의 전체 학년 1-3위 학생입니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {hallOfFameData.map(({ itemName, topStudents, myRank }) => (
                                <div key={itemName} className="p-4 rounded-lg bg-background/80 shadow">
                                    <h3 className="font-bold text-lg text-center mb-3">{itemName}</h3>
                                    {topStudents.length > 0 ? (
                                        <ul className="space-y-2">
                                            {topStudents.map((s, index) => (
                                                <li key={index} className="flex items-center justify-between text-sm">
                                                    <span className="flex items-center font-semibold">
                                                        {index === 0 && <Crown className="w-5 h-5 text-yellow-500 mr-1"/>}
                                                        {index === 1 && <Medal className="w-5 h-5 text-gray-400 mr-1"/>}
                                                        {index === 2 && <Trophy className="w-5 h-5 text-orange-400 mr-1"/>}
                                                        {s.rank}위: {s.name}
                                                    </span>
                                                    <span className="text-muted-foreground">{s.value}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                    <p className="text-sm text-center text-muted-foreground py-4">기록이 없습니다.</p>
                                    )}
                                    <div className="border-t mt-3 pt-2 text-sm font-semibold text-center text-primary">
                                        나의 순위: {myRank}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
                 <Card className="flex flex-col bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>AI 피드백</CardTitle>
                        <CardDescription>가장 최근의 운동 수행 결과를 바탕으로 AI가 피드백을 제공합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        {isFeedbackLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                        ) : aiFeedback ? (
                        <p className="text-sm whitespace-pre-wrap">{aiFeedback}</p>
                        ) : (
                        <p className="text-sm text-muted-foreground">AI 피드백 받기 버튼을 눌러 피드백을 받아보세요.</p>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button
                        onClick={handleGetFeedback}
                        disabled={isFeedbackLoading || records.length === 0 || isAiButtonDisabled}
                        className="w-full"
                        variant="outline"
                        >
                        <Wand2 className="mr-2 h-4 w-4" />
                        {isFeedbackLoading ? '피드백 생성 중...' : isAiButtonDisabled ? '10초 후에 다시 시도하세요' : '최신 기록 AI 피드백 받기'}
                        </Button>
                    </CardFooter>
                </Card>
                <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                    <CardTitle>전체 측정 기록</CardTitle>
                    <CardDescription>지금까지의 모든 측정 기록입니다. 잘못 입력된 기록은 삭제할 수 있습니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>날짜</TableHead>
                            <TableHead>종목</TableHead>
                            <TableHead>기록</TableHead>
                            <TableHead className="text-right">작업</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {sortedRecords.length > 0 ? (
                            sortedRecords.map((record) => {
                            const item = measurementItems.find(i => i.name === record.item);
                            return (
                                <TableRow key={record.id}>
                                <TableCell>{record.date}</TableCell>
                                <TableCell>{record.item}</TableCell>
                                <TableCell>{record.value}{item?.unit}</TableCell>
                                <TableCell className="text-right">
                                    <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            이 작업은 되돌릴 수 없습니다. 이 기록이 영구적으로 삭제됩니다.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteRecord(record.id)}>삭제</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                                </TableRow>
                            );
                            })
                        ) : (
                            <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                측정된 기록이 없습니다.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="measurement-input" className="space-y-8 mt-6">
                 <Card className="flex flex-col bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>측정 결과 입력</CardTitle>
                        <CardDescription>오늘의 측정 결과를 입력하세요. 같은 날짜에 다시 입력하면 덮어쓰기됩니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-4">
                        <Select onValueChange={setSelectedItemName} value={selectedItemName}>
                        <SelectTrigger>
                            <SelectValue placeholder="측정 종목 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            {measurementItems.map(item => (
                            <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        {selectedItem?.isCompound ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="height">키 (cm)</Label>
                                    <Input id="height" type="number" value={height} onChange={e => setHeight(e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="weight">몸무게 (kg)</Label>
                                    <Input id="weight" type="number" value={weight} onChange={e => setWeight(e.target.value)} />
                                </div>
                            </div>
                        ) : (
                            <div>
                            <Label htmlFor="value">결과 ({selectedItem?.unit})</Label>
                            <Input
                                id="value"
                                placeholder={inputPlaceholder}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                type="number"
                            />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        결과 저장
                        </Button>
                    </CardFooter>
                </Card>
            </TabsContent>
            <TabsContent value="my-competition" className="space-y-8 mt-6">
                <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader className="text-center">
                    <CardTitle className="flex items-center justify-center gap-2">
                        <Swords /> {tournament?.name || "나의 대회"}
                    </CardTitle>
                    <CardDescription>
                        {tournament
                        ? "현재 진행 중인 대회 대진표입니다."
                        : "참가 중인 대회가 없습니다."}
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto p-4">
                    {tournament && Object.keys(matchesByRound).length > 0 ? (
                        <div className="flex justify-center min-w-max">
                        <div className="flex items-start space-x-8">
                            {Object.entries(matchesByRound).map(([round, matches]) => (
                                <div
                                key={round}
                                className="flex flex-col space-y-4 min-w-[180px]"
                                >
                                <h4 className="font-bold text-center text-lg">
                                    {parseInt(round) ===
                                    Math.max(...Object.keys(matchesByRound).map(Number))
                                    ? "결승"
                                    : `${matches.length * 2}강`}
                                </h4>
                                <div className="flex flex-col justify-around h-full space-y-4">
                                    {matches.map((match) => {
                                    const winnerIsA =
                                        !!match.winnerId &&
                                        match.winnerId === match.teamAId;
                                    const winnerIsB =
                                        !!match.winnerId &&
                                        match.winnerId === match.teamBId;

                                    return (
                                        <Card key={match.id} className="p-2 bg-card/80">
                                        <CardContent className="p-1 space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                            <span
                                                className={`truncate ${
                                                winnerIsA ? "font-bold text-primary" : ""
                                                }`}
                                            >
                                                {match.teamAId
                                                ? teamNameMap.get(match.teamAId) ?? "미정"
                                                : "미정"}
                                            </span>
                                            <span className="font-semibold ml-2">
                                                {match.scoresA?.reduce((a, b) => a + b, 0) ?? "-"}
                                            </span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                            <span
                                                className={`truncate ${
                                                winnerIsB ? "font-bold text-primary" : ""
                                                }`}
                                            >
                                                {match.teamBId
                                                ? teamNameMap.get(match.teamBId) ?? "미정"
                                                : match.status === "bye"
                                                ? "(부전승)"
                                                : "미정"}
                                            </span>
                                            <span className="font-semibold ml-2">
                                                 {match.scoresB?.reduce((a, b) => a + b, 0) ?? "-"}
                                            </span>
                                            </div>
                                        </CardContent>
                                        </Card>
                                    );
                                    })}
                                </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-24 text-muted-foreground">
                        <p>선생님이 대회를 생성하고 전달하면 여기에 표시됩니다.</p>
                        </div>
                    )}
                    </CardContent>
                </Card>
                <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader className='flex-row items-start justify-between'>
                        <div>
                            <CardTitle className="flex items-center gap-2"><Users /> 나의 팀 확인</CardTitle>
                            <CardDescription>{teamGroup?.description || '전달된 팀 편성 정보가 없습니다.'}</CardDescription>
                        </div>
                        {teamGroup && (
                            <Select
                                value={selectedTeamIndex !== null ? String(selectedTeamIndex) : undefined}
                                onValueChange={(value) => setSelectedTeamIndex(Number(value))}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="팀 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teamGroup.teams.map(team => (
                                        <SelectItem key={team.teamIndex} value={String(team.teamIndex)}>
                                            팀 {team.teamIndex + 1} {myTeam?.teamIndex === team.teamIndex ? '(나의 팀)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </CardHeader>
                    <CardContent>
                        {isDataLoading ? (
                            <div className="flex items-center justify-center h-24">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="order-2 md:order-1">
                                    {displayedTeam ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {displayedTeam.members && displayedTeam.members.map(member => (
                                                <div key={member.id} className={`p-3 rounded-md text-center ${member.id === student.id ? 'bg-primary/20' : 'bg-secondary'}`}>
                                                <p className="font-semibold">{member.name}</p>
                                                <p className="text-sm text-muted-foreground">{member.grade}-{member.classNum}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-8">팀 정보가 없습니다. 선생님이 팀을 편성하고 전달할 때까지 기다려주세요.</p>
                                    )}
                                </div>
                                <div className="order-1 md:order-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {abilityScores.length > 0 && (
                                        <div className='text-center h-[350px] flex flex-col'>
                                            <h4 className="font-semibold mb-2">나의 능력치</h4>
                                            <div className="flex-grow">
                                                <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={abilityScores}>
                                                    <PolarGrid />
                                                    <PolarAngleAxis dataKey="item" tick={{ fontSize: 12 }} />
                                                    <PolarRadiusAxis axisLine={false} tick={false} domain={[0, 100]} />
                                                    <Radar name="나" dataKey="score" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                                                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}/>
                                                </RadarChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <p className="font-bold text-lg mt-2">총점: {myTotalScore} / 100</p>
                                        </div>
                                    )}
                                    {teamAverageScores.length > 0 && (
                                        <div className='text-center h-[350px] flex flex-col'>
                                            <h4 className="font-semibold mb-2">팀 평균 능력치</h4>
                                            <div className="flex-grow">
                                                <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={teamAverageScores}>
                                                    <PolarGrid />
                                                    <PolarAngleAxis dataKey="item" tick={{ fontSize: 12 }} />
                                                    <PolarRadiusAxis axisLine={false} tick={false} domain={[0, 100]} />
                                                    <Radar name="팀 평균" dataKey="score" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6}/>
                                                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}/>
                                                </RadarChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <p className="font-bold text-lg mt-2">총점: {teamTotalScore} / 100</p>
                                        </div>
                                    )}
                                    {abilityScores.length === 0 && teamAverageScores.length === 0 && (
                                        <div className="col-span-2 flex items-center justify-center h-full text-sm text-muted-foreground">
                                            팀 편성 시 사용된 능력치 데이터가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex-col gap-4">
                        <div className="flex flex-col sm:flex-row w-full gap-4">
                           <Button onClick={handleGetScoutingReport} disabled={isReportLoading || abilityScores.length === 0 || isAiButtonDisabled} className="flex-1">
                                <Bot className="mr-2 h-4 w-4" />
                                {isReportLoading && activeReport?.type !== 'scouting' ? "리포트 생성 중..." : isAiButtonDisabled ? '10초 후에 다시 시도하세요' : "나의 스카우팅 리포트"}
                           </Button>
                           <Button onClick={handleGetTeamReport} disabled={isReportLoading || teamAverageScores.length === 0 || isAiButtonDisabled} className="flex-1">
                                <Users className="mr-2 h-4 w-4" />
                                {isReportLoading && activeReport?.type !== 'team' ? "팀 분석 중..." : isAiButtonDisabled ? '10초 후에 다시 시도하세요' : "우리 팀 전력 분석"}
                            </Button>
                        </div>
                        {isReportLoading && (
                            <div className="flex justify-center items-center w-full p-4">
                                <Loader2 className="animate-spin" />
                            </div>
                        )}
                        {activeReport && (
                            <Card className="w-full bg-secondary">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                      {activeReport.type === 'scouting' ? <Bot /> : <Users />}
                                      {activeReport.type === 'scouting' ? 'AI 스카우팅 리포트' : 'AI 팀 전력 분석'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div>
                                        <h4 className="font-bold text-primary">핵심 강점</h4>
                                        <p className="whitespace-pre-wrap">{activeReport.data.strengths}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-destructive">보완점</h4>
                                        <p className="whitespace-pre-wrap">{activeReport.data.weaknesses}</p>
                                    </div>
                                     <div>
                                        <h4 className="font-bold">종합 평가 (선수 유형)</h4>
                                        <p className="whitespace-pre-wrap">{(activeReport.data as ScoutingReportOutput).assessment}</p>
                                    </div>
                                    { activeReport.type === 'scouting' &&
                                    <>
                                        <div>
                                            <h4 className="font-bold">추천 포지션</h4>
                                            <p className="whitespace-pre-wrap">{(activeReport.data as ScoutingReportOutput).position}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-bold">추천 훈련 방법</h4>
                                            <p className="whitespace-pre-wrap">{(activeReport.data as ScoutingReportOutput).suggestedTrainingMethods}</p>
                                        </div>
                                    </>
                                    }
                                    { activeReport.type === 'team' &&
                                     <div>
                                        <h4 className="font-bold">추천 전략</h4>
                                        <p className="whitespace-pre-wrap">{(activeReport.data as any).position}</p>
                                    </div>
                                    }
                                </CardContent>
                            </Card>
                        )}
                    </CardFooter>
                </Card>
            </TabsContent>
            <TabsContent value="physical-knowledge" className="space-y-8 mt-6">
                <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookOpen /> 체육 지식 퀴즈</CardTitle>
                        <CardDescription>선생님이 배포하신 퀴즈를 풀고 실력을 확인해보세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {assignedQuizzes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {assignedQuizzes.map(assignment => (
                                    <Card key={assignment.id} className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => handleStartQuiz(assignment)}>
                                        <CardHeader>
                                            <CardTitle className="text-lg">{assignment.quizTitle}</CardTitle>
                                            <CardDescription>배포일: {assignment.createdAt?.toDate ? format(assignment.createdAt.toDate(), 'yyyy-MM-dd') : '-'}</CardDescription>
                                        </CardHeader>
                                        <CardFooter>
                                            <Button variant="outline" className="w-full">퀴즈 풀기 <ChevronRight className="ml-2 h-4 w-4" /></Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>아직 배포된 퀴즈가 없습니다.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        {/* Quiz Modal */}
        <Dialog open={isQuizModalOpen} onOpenChange={setIsQuizModalOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{selectedAssignment?.quizTitle}</DialogTitle>
                    <DialogDescription>문제를 잘 읽고 정답을 선택하세요.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-8 py-4">
                    {selectedAssignment && selectedAssignment.questions && selectedAssignment.questions.length > 0 ? (
                        selectedAssignment.questions.map((q, qIdx) => (
                            <div key={qIdx} className="space-y-4 p-4 rounded-lg bg-secondary/20">
                                <div className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                        {qIdx + 1}
                                    </span>
                                    <h4 className="font-semibold text-lg">{q.question}</h4>
                                </div>

                                {quizResult && (
                                    <div className="ml-9">
                                        {quizResult.corrections[qIdx] ? (
                                            <Badge className="bg-green-100 text-green-700 border-green-200">정답입니다!</Badge>
                                        ) : (
                                            <Badge variant="destructive">오답 (정답: {q.answer})</Badge>
                                        )}
                                    </div>
                                )}

                                <div className="ml-9 space-y-2">
                                    {q.type === 'multiple-choice' && q.options && (
                                        <RadioGroup value={quizAnswers[qIdx]} onValueChange={(val) => handleQuizAnswerChange(qIdx, val)} disabled={!!quizResult}>
                                            {q.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-center space-x-2 p-2 rounded hover:bg-background/50">
                                                    <RadioGroupItem value={String(oIdx + 1)} id={`q${qIdx}-o${oIdx}`} />
                                                    <Label htmlFor={`q${qIdx}-o${oIdx}`} className="flex-grow cursor-pointer">{oIdx + 1}. {opt}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    )}

                                    {q.type === 'ox' && (
                                        <RadioGroup value={quizAnswers[qIdx]} onValueChange={(val) => handleQuizAnswerChange(qIdx, val)} className="flex gap-4" disabled={!!quizResult}>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="O" id={`q${qIdx}-o`} />
                                                <Label htmlFor={`q${qIdx}-o`} className="text-xl font-bold">O</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="X" id={`q${qIdx}-x`} />
                                                <Label htmlFor={`q${qIdx}-x`} className="text-xl font-bold">X</Label>
                                            </div>
                                        </RadioGroup>
                                    )}

                                    {(q.type === 'short-answer' || q.type === 'fill-in-the-blanks') && (
                                        <div className="space-y-2">
                                            {q.type === 'fill-in-the-blanks' && q.options && (
                                                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/50 rounded-md">
                                                    <span className="text-xs text-muted-foreground font-medium mr-2">[ 보기 ]</span>
                                                    {q.options.map((opt, i) => <Badge key={i} variant="secondary">{opt}</Badge>)}
                                                </div>
                                            )}
                                            <Input 
                                                placeholder="정답을 입력하세요" 
                                                value={quizAnswers[qIdx] || ''} 
                                                onChange={(e) => handleQuizAnswerChange(qIdx, e.target.value)}
                                                disabled={!!quizResult}
                                            />
                                        </div>
                                    )}
                                </div>

                                {quizResult && !quizResult.corrections[qIdx] && (
                                    <div className="ml-9 p-3 bg-primary/5 border-l-2 border-primary rounded text-sm mt-2">
                                        <p className="font-bold text-primary flex items-center gap-1 mb-1"><HelpCircle className="h-3 w-3" /> 해설</p>
                                        <p className="text-muted-foreground">{q.explanation}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>문제를 불러오는 중이거나 데이터가 없습니다.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
                    {quizResult ? (
                        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2 font-bold text-xl">
                                <Trophy className="text-yellow-500" />
                                점수: {quizResult.score} / {quizResult.total}
                            </div>
                            <DialogClose asChild>
                                <Button className="w-full sm:w-auto">닫기</Button>
                            </DialogClose>
                        </div>
                    ) : (
                        <div className="w-full flex gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" className="flex-1">그만두기</Button>
                            </DialogClose>
                            <Button className="flex-1" onClick={handleSubmitQuiz} disabled={!selectedAssignment?.questions || selectedAssignment.questions.length === 0}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> 제출하기
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
