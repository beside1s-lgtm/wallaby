'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudentById, getItems, getRecordsByStudent, calculateRanks, getStudents, getRecords, getLatestTeamGroupForStudent } from '@/lib/store';
import type { Student, MeasurementItem, MeasurementRecord, TeamGroup } from '@/lib/types';
import type { ScoutingReportOutput } from '@/ai/flows/scouting-report-flow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User as UserIcon, Printer, Wand2, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, BarChart, XAxis, YAxis, CartesianGrid, Legend, Bar } from 'recharts';
import { getPapsGrade, calculatePapsScore, normalizePapsRecord, normalizeCustomRecord } from '@/lib/paps';
import { getReportBriefing } from '@/ai/flows/report-briefing-flow';
import { getScoutingReport } from '@/ai/flows/scouting-report-flow';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const papsFactors: Record<string, string> = {
    '왕복오래달리기': '심폐지구력', '오래달리기': '심폐지구력',
    '윗몸 말아올리기': '근력/근지구력', '팔굽혀펴기': '근력/근지구력', '무릎 대고 팔굽혀펴기': '근력/근지구력', '악력': '근력/근지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '50m 달리기': '순발력', '제자리 멀리뛰기': '순발력',
    '체질량지수(BMI)': '신체구성'
};

const factorOrder = ['심폐지구력', '근력/근지구력', '순발력', '유연성', '신체구성'];

export default function ReportCardPage() {
    const { user, school, isLoading: isAuthLoading } = useAuth();
    const student = user as Student;
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [fullStudent, setFullStudent] = useState<Student | null>(null);
    const [allItems, setAllItems] = useState<MeasurementItem[]>([]);
    const [studentRecords, setStudentRecords] = useState<MeasurementRecord[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [allRecords, setAllRecords] = useState<MeasurementRecord[]>([]);

    const [aiBriefing, setAiBriefing] = useState('');
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    
    const [abilityScores, setAbilityScores] = useState<{ item: string; score: number }[]>([]);
    const [scoutingReport, setScoutingReport] = useState<ScoutingReportOutput | null>(null);
    const [isReportLoading, setIsReportLoading] = useState(false);

    useEffect(() => {
        async function loadData() {
            if (!student?.id || !school) return;
            setIsLoading(true);
            try {
                const [studentData, itemData, studRecords, allStuds, allRecs, teamData] = await Promise.all([
                    getStudentById(school, student.id),
                    getItems(school),
                    getRecordsByStudent(school, student.id),
                    getStudents(school),
                    getRecords(school),
                    getLatestTeamGroupForStudent(school, student.id)
                ]);
                setFullStudent(studentData || null);
                setAllItems(itemData || []);
                setStudentRecords(studRecords || []);
                setAllStudents(allStuds || []);
                setAllRecords(allRecs || []);
                
                if (studentData && teamData && teamData.itemNamesForBalancing && teamData.itemNamesForBalancing.length > 0) {
                     const allRanks = calculateRanks(school, itemData, allRecs, allStuds, studentData.grade);
                     const itemNames = teamData.itemNamesForBalancing;

                     const scores = itemNames.map(itemName => {
                         const itemRanks = allRanks[itemName] || [];
                         let score = 0;
                         if (itemRanks.length > 0) {
                             const rankInfo = itemRanks.find(r => r.studentId === studentData.id);
                             if (rankInfo) {
                                 score = Math.round((1 - (rankInfo.rank - 1) / itemRanks.length) * 100);
                             }
                         }
                         return { item: itemName, score };
                     });
                    setAbilityScores(scores);
                }

            } catch (error) {
                console.error("리포트 데이터 로딩 실패:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [student?.id, school]);

    const { papsSummary, papsRadarChartData, overallGrade, overallScore, papsGrowthData } = useMemo(() => {
        if (!fullStudent || allItems.length === 0 || studentRecords.length === 0) {
            return { papsSummary: [], papsRadarChartData: [], overallGrade: '-', overallScore: 0, papsGrowthData: [] };
        }

        const summary: { factor: string; itemName: string; value: number; unit: string; grade: number | null; score: number | null; }[] = [];
        const latestRecords: Record<string, MeasurementRecord> = {};

        studentRecords.forEach(record => {
            if (!latestRecords[record.item] || new Date(record.date) > new Date(latestRecords[record.item].date)) {
                latestRecords[record.item] = record;
            }
        });

        let totalScore = 0;
        let factorCount = 0;

        factorOrder.forEach(factor => {
            const factorItems = allItems.filter(item => papsFactors[item.name] === factor && item.isPaps);
            let latestRecordForFactor: MeasurementRecord | undefined;
            let latestItemForFactor: MeasurementItem | undefined;

            factorItems.forEach(item => {
                const record = latestRecords[item.name];
                if (record) {
                    if (!latestRecordForFactor || new Date(record.date) > new Date(latestRecordForFactor.date)) {
                        latestRecordForFactor = record;
                        latestItemForFactor = item;
                    }
                }
            });

            if (latestRecordForFactor && latestItemForFactor) {
                const grade = getPapsGrade(latestItemForFactor.name, fullStudent, latestRecordForFactor.value);
                const score = calculatePapsScore(latestItemForFactor.name, fullStudent, latestRecordForFactor.value);
                summary.push({
                    factor,
                    itemName: latestItemForFactor.name,
                    value: latestRecordForFactor.value,
                    unit: latestItemForFactor.unit,
                    grade,
                    score,
                });
                if (score !== null && factor !== '신체구성') {
                    totalScore += score;
                    factorCount++;
                }
            }
        });

        const papsRadarData = factorOrder.map(factor => {
            const factorData = summary.find(s => s.factor === factor);
            return {
                subject: factor,
                score: factorData?.score ?? 0,
            };
        });

        const finalScore = factorCount > 0 ? (totalScore / (factorCount * 20)) * 100 : 0;
        
        let finalGrade = '-';
        if (factorCount > 0) {
            if (finalScore >= 80) finalGrade = '1등급';
            else if (finalScore >= 60) finalGrade = '2등급';
            else if (finalScore >= 40) finalGrade = '3등급';
            else if (finalScore >= 20) finalGrade = '4등급';
            else finalGrade = '5등급';
        }

        const papsGrowth = allItems
            .filter(item => item.isPaps)
            .map(item => {
                const recordsForItem = studentRecords
                    .filter(r => r.item === item.name)
                    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(record => {
                        const grade = getPapsGrade(record.item, fullStudent, record.value);
                        return { ...record, grade };
                    });
                return { item, records: recordsForItem };
            })
            .filter(data => data.records.length > 0);
        
        return { papsSummary: summary, papsRadarChartData: papsRadarData, overallGrade: finalGrade, overallScore: Math.round(finalScore), papsGrowthData: papsGrowth };
    }, [fullStudent, allItems, studentRecords]);


     const { customGrowthData } = useMemo(() => {
        if (!fullStudent || allItems.length === 0 || studentRecords.length === 0) {
            return { customGrowthData: [] };
        }
        const customGrowth = allItems
            .filter(item => !item.isPaps && item.goal)
            .map(item => {
                const recordsForItem = studentRecords
                    .filter(r => r.item === item.name)
                    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(record => ({
                        date: record.date,
                        value: record.value,
                        achievement: normalizeCustomRecord(item, record.value),
                        unit: item.unit
                    }));
                return { item, records: recordsForItem };
            })
            .filter(data => data.records.length > 0);
        
        return { customGrowthData: customGrowth };
    }, [fullStudent, allItems, studentRecords]);

    const handleGetBriefing = async () => {
        if (!fullStudent || papsSummary.length === 0) {
            toast({ variant: 'destructive', title: '분석 불가', description: '데이터가 부족합니다.' });
            return;
        }
        setIsBriefingLoading(true);
        try {
            const result = await getReportBriefing({ studentName: fullStudent.name, overallGrade, papsSummary });
            setAiBriefing(result.briefing);
        } catch (error) {
            toast({ variant: 'destructive', title: 'AI 분석 오류' });
        } finally {
            setIsBriefingLoading(false);
        }
    };

    const handleGetScoutingReport = async () => {
        if (!fullStudent || abilityScores.length === 0 || !school) return;
        setIsReportLoading(true);
        try {
            const ranks = calculateRanks(school, allItems, allRecords, allStudents, fullStudent.grade);
            const studentRanks: Record<string, string> = {};
            Object.entries(ranks).forEach(([item, itemRanks]) => {
                const rankInfo = itemRanks.find(r => r.studentId === fullStudent.id);
                if (rankInfo && abilityScores.some(s => s.item === item)) {
                    studentRanks[item] = `${itemRanks.length}명 중 ${rankInfo.rank}등`;
                }
            });
            const result = await getScoutingReport({
                studentName: fullStudent.name,
                abilityScores: abilityScores.map(s => ({ ...s, category: allItems.find(i => i.name === s.item)?.category || '기타' })),
                ranks: studentRanks,
                allItems: allItems
            });
            setScoutingReport(result);
        } catch (error) {
            toast({ variant: 'destructive', title: '리포트 생성 실패' });
        } finally {
            setIsReportLoading(false);
        }
    }
    
    if (isAuthLoading || isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    return (
        <div id="print-area" className="report-container mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
            {/* --- PAGE 1: PAPS 리포트 --- */}
            <div className="report-page bg-card border shadow-xl rounded-2xl overflow-hidden mb-10 print:shadow-none print:border-none print:rounded-none">
                <header className="bg-primary/5 p-6 flex items-center justify-between border-b print:bg-white print:p-0 print:mb-6">
                    <div className="flex items-center gap-4">
                        <img src="/200x200.png" alt="Logo" className="w-12 h-12 rounded-xl shadow-sm" />
                        <div>
                            <h1 className="text-3xl font-black text-primary leading-tight">체육 성장 리포트 (PAPS)</h1>
                            <p className="text-sm font-bold text-muted-foreground">{school}</p>
                        </div>
                    </div>
                    <div className="print-hidden">
                        <Button variant="default" size="lg" onClick={() => window.print()} className="font-bold shadow-lg"><Printer className="mr-2 h-5 w-5" /> 리포트 출력하기</Button>
                    </div>
                </header>

                <div className="p-6 md:p-8 space-y-8 print:p-0">
                    {/* Top Row: Student Info & Comprehensive Analysis */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 print-grid-header">
                        {/* 1. Student Profile Card (40%) */}
                        <Card className="md:col-span-2 border-2 border-primary/10 shadow-sm bg-muted/5 print-col-2">
                            <CardContent className="p-6 flex flex-col items-center">
                                <Avatar className="h-40 w-32 rounded-2xl border-4 border-background shadow-md overflow-hidden mb-6">
                                    <AvatarImage src={fullStudent?.photoUrl || ''} className="object-cover" />
                                    <AvatarFallback className="rounded-2xl text-4xl bg-primary/10"><UserIcon className="w-12 h-12 text-primary/40" /></AvatarFallback>
                                </Avatar>
                                <div className="w-full grid grid-cols-2 gap-y-4 gap-x-2 text-center border-t pt-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">이름</p>
                                        <p className="text-xl font-bold">{fullStudent?.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">학년/반/번호</p>
                                        <p className="text-xl font-bold">{fullStudent?.grade}-{fullStudent?.classNum} {fullStudent?.studentNum}번</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">성별</p>
                                        <p className="text-xl font-bold">{fullStudent?.gender}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">출력 일자</p>
                                        <p className="text-sm font-bold text-muted-foreground mt-1.5">{format(new Date(), 'yyyy.MM.dd')}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Comprehensive Analysis Card (60%) */}
                        <Card className="md:col-span-3 border-2 border-primary/10 shadow-sm overflow-hidden flex flex-col print-col-3">
                            <CardHeader className="bg-primary/5 py-3 border-b text-center">
                                <CardTitle className="text-sm font-black text-primary uppercase tracking-tighter">PAPS 요인별 종합 분석 및 등급</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
                                <div className="h-[220px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={papsRadarChartData}>
                                            <PolarGrid strokeOpacity={0.2} />
                                            <PolarAngleAxis dataKey="subject" tick={{fontSize: 11, fontWeight: 800, fill: 'currentColor'}} />
                                            <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
                                            <Radar name="점수" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                                            <Tooltip contentStyle={{fontSize: '12px', borderRadius: '12px'}} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-full flex items-center justify-around border-t pt-6 bg-primary/5 rounded-2xl p-4">
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-primary uppercase mb-1">종합 체력 등급</p>
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-6xl font-black text-primary">{overallGrade.charAt(0)}</span>
                                            <span className="text-xl font-bold text-primary mt-4">등급</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-16 bg-primary/10" />
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">종합 환산 점수</p>
                                        <div className="flex items-baseline justify-center gap-1">
                                            <span className="text-4xl font-black">{overallScore}</span>
                                            <span className="text-sm font-bold text-muted-foreground">/ 100</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* AI Briefing Section */}
                    <section className="space-y-3">
                        <h2 className="text-base font-black text-primary flex items-center gap-2 uppercase"><CheckCircle2 className="h-5 w-5" /> AI 체력 종합 진단 리포트</h2>
                        <div className={cn(
                            "p-6 rounded-2xl border-2 border-dashed transition-all",
                            aiBriefing ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-muted"
                        )}>
                            {aiBriefing ? (
                                <p className="text-sm md:text-base font-medium leading-relaxed italic text-foreground/80 whitespace-pre-wrap">{aiBriefing}</p>
                            ) : (
                                <div className="text-center py-4 print-hidden">
                                    <p className="text-sm text-muted-foreground mb-4">PAPS 데이터를 바탕으로 AI 코치의 상세 분석을 받아보세요.</p>
                                    <Button size="sm" variant="outline" onClick={handleGetBriefing} disabled={isBriefingLoading} className="font-bold border-primary text-primary hover:bg-primary/10">
                                        {isBriefingLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                                        AI 분석 리포트 생성하기
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>
                    
                    {/* PAPS Growth Records Section */}
                    <section className="space-y-4">
                        <h2 className="text-base font-black text-primary flex items-center gap-2 uppercase"><TrendingUp className="h-5 w-5" /> PAPS 종목별 성장 추이</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {papsGrowthData.map(({ item, records }) => (
                                <Card key={item.id} className="border-2 border-primary/10 shadow-sm overflow-hidden bg-card">
                                    <div className="bg-primary/10 py-2 px-3 text-center border-b">
                                        <p className="text-xs font-black text-primary">{item.name}</p>
                                    </div>
                                    <div className="p-4 h-[140px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={records}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                                <XAxis dataKey="date" hide />
                                                <YAxis hide domain={['auto', 'auto']} />
                                                <Tooltip labelClassName="text-xs" contentStyle={{fontSize: '11px', borderRadius: '8px'}} formatter={(v) => [`${v}${item.unit}`, '기록']} />
                                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>
                </div>
                <footer className="bg-muted/30 p-4 text-center border-t">
                    <p className="text-[10px] font-black text-muted-foreground tracking-tighter">{format(new Date(), 'yyyy.MM.dd')} - 1 / 2 - 체육 성장 기록 시스템 (PAPS REPORT)</p>
                </footer>
            </div>

            {/* --- PAGE 2: 스포츠 리포트 --- */}
            <div className="report-page bg-card border shadow-xl rounded-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
                <header className="bg-chart-2/5 p-6 flex items-center gap-4 border-b print:bg-white print:p-0 print:mb-6">
                    <img src="/200x200.png" alt="Logo" className="w-12 h-12 rounded-xl shadow-sm" />
                    <div>
                        <h1 className="text-3xl font-black text-chart-2 leading-tight">체육 성장 리포트 (스포츠 잠재력)</h1>
                        <p className="text-sm font-bold text-muted-foreground">{school}</p>
                    </div>
                </header>

                <div className="p-6 md:p-8 space-y-10 print:p-0">
                    {/* Athlete Potential Section */}
                    {abilityScores.length > 0 && (
                        <section className="space-y-6">
                            <h2 className="text-base font-black text-chart-2 flex items-center gap-2 uppercase tracking-tighter"><div className="w-1.5 h-5 bg-chart-2 rounded-full" /> 운동선수 잠재력 (AI 스카우팅 리포트)</h2>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start print-grid-header">
                                <Card className="md:col-span-2 border-2 border-chart-2/20 bg-chart-2/5 shadow-sm p-4 print-col-2">
                                    <div className="h-[260px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={abilityScores}>
                                                <PolarGrid strokeOpacity={0.2} />
                                                <PolarAngleAxis dataKey="item" tick={{fontSize: 10, fontWeight: 800, fill: 'currentColor'}} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                <Radar name="능력치" dataKey="score" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.5} />
                                                <Tooltip contentStyle={{fontSize: '12px', borderRadius: '12px'}} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-xl text-center">
                                        <p className="text-[10px] font-black text-chart-2 uppercase mb-1">평균 잠재력 점수</p>
                                        <p className="text-3xl font-black">{Math.round(abilityScores.reduce((acc,s)=>acc+s.score,0)/abilityScores.length)}점</p>
                                    </div>
                                </Card>
                                <div className="md:col-span-3 space-y-4 print-col-3">
                                    {isReportLoading ? (
                                        <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                                            <Loader2 className="h-10 w-10 animate-spin text-chart-2 opacity-50" />
                                            <p className="text-sm font-bold text-muted-foreground animate-pulse">잠재력을 분석하는 중입니다...</p>
                                        </div>
                                    ) : scoutingReport ? (
                                        <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                            <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 shadow-sm">
                                                <h4 className="text-xs font-black text-green-700 dark:text-green-400 uppercase mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> 핵심 강점</h4>
                                                <p className="text-sm font-medium leading-relaxed">{scoutingReport.strengths}</p>
                                            </div>
                                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 shadow-sm">
                                                <h4 className="text-xs font-black text-red-700 dark:text-red-400 uppercase mb-2 flex items-center gap-1.5"><Info className="h-4 w-4" /> 보완점</h4>
                                                <p className="text-sm font-medium leading-relaxed">{scoutingReport.weaknesses}</p>
                                            </div>
                                            <div className="p-5 bg-primary/5 rounded-2xl border-2 border-primary/10 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="text-xs font-black text-primary uppercase flex items-center gap-1.5"><Wand2 className="h-4 w-4" /> 종합 평가 & 추천 포지션</h4>
                                                </div>
                                                <p className="text-base font-bold italic mb-2">"{scoutingReport.assessment}"</p>
                                                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full inline-block text-sm font-black shadow-md">
                                                    추천 포지션: {scoutingReport.position}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-10 border-4 border-dashed rounded-3xl h-full flex flex-col justify-center items-center print-hidden bg-muted/10">
                                            <Wand2 className="h-16 w-16 text-chart-2 mb-4 opacity-20" />
                                            <p className="text-muted-foreground mb-6 font-bold">측정 데이터를 기반으로<br/>AI 스카우팅 리포트를 생성할 수 있습니다.</p>
                                            <Button size="lg" onClick={handleGetScoutingReport} className="bg-chart-2 hover:bg-chart-2/90 font-black shadow-xl">
                                                지금 분석 시작하기
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Custom Items Section */}
                    <section className="space-y-6">
                        <h2 className="text-base font-black text-chart-3 flex items-center gap-2 uppercase tracking-tighter"><div className="w-1.5 h-5 bg-chart-3 rounded-full" /> 스포츠 및 기타 종목 성장 추이</h2>
                        {customGrowthData.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {customGrowthData.map(({ item, records }) => (
                                    <Card key={item.id} className="border-2 border-chart-3/20 shadow-sm overflow-hidden bg-card">
                                        <div className="bg-chart-3/10 py-2 px-3 text-center border-b">
                                            <p className="text-xs font-black text-chart-3">{item.name}</p>
                                        </div>
                                        <div className="p-4 h-[140px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={records}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                                    <XAxis dataKey="date" hide />
                                                    <YAxis hide domain={[0, 100]} />
                                                    <Tooltip labelClassName="text-xs" contentStyle={{fontSize: '11px', borderRadius: '8px'}} formatter={(v) => [`${v}%`, '목표 달성률']} />
                                                    <Bar dataKey="achievement" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="p-16 border-4 border-dashed rounded-3xl text-center bg-muted/5">
                                <p className="text-muted-foreground font-bold italic">기록된 스포츠 또는 기타 활동 데이터가 아직 없습니다.</p>
                            </div>
                        )}
                    </section>
                </div>
                
                <footer className="bg-muted/30 p-4 text-center border-t mt-auto">
                    <p className="text-[10px] font-black text-muted-foreground tracking-tighter">{format(new Date(), 'yyyy.MM.dd')} - 2 / 2 - 체육 성장 기록 시스템 (SPORTS REPORT)</p>
                </footer>
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .report-container {
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .report-page {
                        page-break-after: always;
                        min-height: 277mm;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                    }
                    .report-page:last-child {
                        page-break-after: avoid;
                    }
                    .print-hidden {
                        display: none !important;
                    }
                    .card {
                        border: 1px solid #e2e8f0 !important;
                        background: white !important;
                    }
                    .bg-primary\/5, .bg-muted\/5, .bg-muted\/30, .bg-chart-2\/5 {
                        background-color: transparent !important;
                        border: 1px solid #f1f5f9 !important;
                    }
                    .text-primary, .text-chart-2, .text-chart-3 {
                        color: black !important;
                    }
                    
                    /* Force side-by-side layout in print */
                    .print-grid-header {
                        display: grid !important;
                        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                        gap: 1.5rem !important;
                    }
                    .print-col-2 {
                        grid-column: span 2 / span 2 !important;
                    }
                    .print-col-3 {
                        grid-column: span 3 / span 3 !important;
                    }
                }
            `}</style>
        </div>
    );
}