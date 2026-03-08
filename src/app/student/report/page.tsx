'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudentById, getItems, getRecordsByStudent, calculateRanks, getStudents, getRecords, getLatestTeamGroupForStudent } from '@/lib/store';
import type { Student, MeasurementItem, MeasurementRecord, TeamGroup } from '@/lib/types';
import type { ScoutingReportOutput } from '@/ai/flows/scouting-report-flow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User as UserIcon, Printer, Wand2 } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, BarChart, XAxis, YAxis, CartesianGrid, Legend, Bar } from 'recharts';
import { getPapsGrade, calculatePapsScore, normalizePapsRecord, normalizeCustomRecord } from '@/lib/paps';
import { getReportBriefing } from '@/ai/flows/report-briefing-flow';
import { getScoutingReport } from '@/ai/flows/scouting-report-flow';
import { useToast } from '@/hooks/use-toast';

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
        <div id="print-area" className="report-container mx-auto max-w-4xl px-6 py-4">
            {/* --- PAGE 1: PAPS 리포트 --- */}
            <div className="report-page bg-white">
                <header className="flex items-center justify-between border-b-2 border-primary pb-2 mb-4">
                    <div>
                        <h1 className="text-3xl font-black text-primary">체육 성장 리포트 (PAPS)</h1>
                        <p className="text-sm font-bold text-muted-foreground">{school}</p>
                    </div>
                    <div className="print-hidden flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> 인쇄하기</Button>
                    </div>
                </header>

                <section className="mb-4 bg-muted/10 p-3 rounded-xl border">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <Avatar className="h-28 w-24 rounded-lg border-2 border-white shadow-sm">
                            <AvatarImage src={fullStudent?.photoUrl || ''} alt={fullStudent?.name} />
                            <AvatarFallback className="rounded-lg text-2xl bg-primary/5"><UserIcon /></AvatarFallback>
                        </Avatar>
                        <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm flex-1">
                            <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase">이름</span><span className="font-bold text-lg">{fullStudent?.name}</span></div>
                            <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase">학년/반/번호</span><span className="font-bold text-lg">{fullStudent?.grade}-{fullStudent?.classNum} {fullStudent?.studentNum}번</span></div>
                            <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase">성별</span><span className="font-bold text-lg">{fullStudent?.gender}</span></div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <section className="border rounded-xl p-3 bg-card shadow-sm">
                        <h2 className="text-xs font-black text-primary mb-2 flex items-center gap-1 uppercase tracking-tighter"><div className="w-1 h-3 bg-primary rounded-full" /> PAPS 요인별 종합 분석</h2>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={papsRadarChartData}>
                                    <PolarGrid strokeOpacity={0.2} />
                                    <PolarAngleAxis dataKey="subject" tick={{fontSize: 9, fontWeight: 700}} />
                                    <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
                                    <Radar name="점수" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                                    <Tooltip contentStyle={{fontSize: '10px', borderRadius: '8px'}} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    <section className="border rounded-xl p-3 bg-primary/5 flex flex-col justify-center items-center gap-2">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-primary uppercase">종합 체력 등급</p>
                            <p className="text-7xl font-black text-primary leading-none">{overallGrade.charAt(0)}</p>
                        </div>
                        <div className="w-full h-px bg-primary/10 my-1" />
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">종합 점수</p>
                            <p className="text-2xl font-black">{overallScore} <span className="text-xs text-muted-foreground">/ 100</span></p>
                        </div>
                    </section>
                </div>

                <section className="mb-4">
                    <h2 className="text-xs font-black text-primary mb-2 flex items-center gap-1 uppercase tracking-tighter"><div className="w-1 h-3 bg-primary rounded-full" /> AI 체력 종합 평가</h2>
                    <div className="p-3 bg-muted/30 rounded-xl border border-dashed min-h-[60px]">
                        {aiBriefing ? (
                            <p className="text-xs font-medium leading-relaxed italic text-foreground/80">{aiBriefing}</p>
                        ) : (
                            <div className="text-center py-2 print-hidden">
                                <Button size="sm" variant="ghost" onClick={handleGetBriefing} disabled={isBriefingLoading} className="text-[10px] font-bold">
                                    {isBriefingLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                                    AI 분석 리포트 생성하기
                                </Button>
                            </div>
                        )}
                    </div>
                </section>
                
                <section className="mb-2">
                    <h2 className="text-xs font-black text-primary mb-2 flex items-center gap-1 uppercase tracking-tighter"><div className="w-1 h-3 bg-primary rounded-full" /> PAPS 종목별 성장 기록</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {papsGrowthData.map(({ item, records }) => (
                            <div key={item.id} className="p-2 border rounded-xl bg-card shadow-sm">
                                <p className="text-[10px] font-bold text-center mb-1 text-primary">{item.name}</p>
                                <div className="h-[100px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={records}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                            <XAxis dataKey="date" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip labelClassName="text-[10px]" contentStyle={{fontSize: '10px'}} formatter={(v) => [`${v}${item.unit}`, '기록']} />
                                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                <div className="text-center text-[9px] font-bold text-muted-foreground mt-4 border-t pt-2">1 / 2 - 체력 성장 기록 시스템</div>
            </div>

            {/* --- PAGE 2: 스포츠 리포트 --- */}
            <div className="report-page bg-white mt-10 pt-10">
                <header className="flex items-center justify-between border-b-2 border-chart-2 pb-2 mb-4">
                    <div>
                        <h1 className="text-3xl font-black text-chart-2">체육 성장 리포트 (스포츠)</h1>
                        <p className="text-sm font-bold text-muted-foreground">{school}</p>
                    </div>
                </header>

                {abilityScores.length > 0 && (
                    <section className="mb-6">
                        <h2 className="text-xs font-black text-chart-2 mb-3 flex items-center gap-1 uppercase tracking-tighter"><div className="w-1 h-3 bg-chart-2 rounded-full" /> 운동선수 잠재력 (AI 스카우팅)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
                            <div className="md:col-span-2 border rounded-2xl p-3 bg-chart-2/5">
                                <div className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={abilityScores}>
                                            <PolarGrid strokeOpacity={0.2} />
                                            <PolarAngleAxis dataKey="item" tick={{fontSize: 9, fontWeight: 700}} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar name="능력치" dataKey="score" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.5} />
                                            <Tooltip contentStyle={{fontSize: '10px'}} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="md:col-span-3 space-y-3">
                                {isReportLoading ? (
                                    <div className="flex items-center justify-center h-[220px]"><Loader2 className="h-8 w-8 animate-spin text-chart-2" /></div>
                                ) : scoutingReport ? (
                                    <div className="grid grid-cols-1 gap-2">
                                        <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                            <h4 className="text-[10px] font-black text-green-700 uppercase mb-1">핵심 강점</h4>
                                            <p className="text-xs font-medium leading-relaxed">{scoutingReport.strengths}</p>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                            <h4 className="text-[10px] font-black text-red-700 uppercase mb-1">보완점</h4>
                                            <p className="text-xs font-medium leading-relaxed">{scoutingReport.weaknesses}</p>
                                        </div>
                                        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                            <h4 className="text-[10px] font-black text-primary uppercase mb-1">종합 평가 & 포지션</h4>
                                            <p className="text-xs font-bold italic">{scoutingReport.assessment}</p>
                                            <p className="text-xs font-black text-primary mt-1">추천 포지션: {scoutingReport.position}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-6 border-2 border-dashed rounded-2xl h-[220px] flex flex-col justify-center items-center print-hidden">
                                        <p className="text-xs text-muted-foreground mb-4">데이터를 기반으로 AI 스카우팅 리포트를 생성합니다.</p>
                                        <Button size="sm" onClick={handleGetScoutingReport} className="bg-chart-2 hover:bg-chart-2/90">
                                            <Wand2 className="mr-2 h-4 w-4" /> 리포트 생성
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                <section className="mb-4">
                    <h2 className="text-xs font-black text-chart-3 mb-3 flex items-center gap-1 uppercase tracking-tighter"><div className="w-1 h-3 bg-chart-3 rounded-full" /> 스포츠 및 기타 종목 성장 추이</h2>
                    {customGrowthData.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {customGrowthData.map(({ item, records }) => (
                                <div key={item.id} className="p-2 border rounded-xl bg-card shadow-sm">
                                    <p className="text-[10px] font-bold text-center mb-1 text-chart-3">{item.name}</p>
                                    <div className="h-[100px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={records}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                                <XAxis dataKey="date" hide />
                                                <YAxis hide domain={[0, 100]} />
                                                <Tooltip labelClassName="text-[10px]" contentStyle={{fontSize: '10px'}} formatter={(v) => [`${v}%`, '달성률']} />
                                                <Bar dataKey="achievement" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 border-2 border-dashed rounded-2xl text-center">
                            <p className="text-xs text-muted-foreground">기록된 스포츠 또는 기타 활동 데이터가 없습니다.</p>
                        </div>
                    )}
                </section>
                
                <div className="text-center text-[9px] font-bold text-muted-foreground mt-auto border-t pt-2">2 / 2 - 체육 성장 기록 시스템</div>
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    body {
                        background: white !important;
                    }
                    .report-page {
                        page-break-after: always;
                        min-height: 260mm;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .report-page:last-child {
                        page-break-after: avoid;
                    }
                    .print-hidden {
                        display: none !important;
                    }
                }
                .report-page {
                    position: relative;
                }
            `}</style>
        </div>
    );
}
