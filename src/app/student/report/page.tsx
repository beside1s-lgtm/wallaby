
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
    const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);
    
    const [abilityScores, setAbilityScores] = useState<{ item: string; score: number }[]>([]);
    const [scoutingReport, setScoutingReport] = useState<ScoutingReportOutput | null>(null);
    const [isReportLoading, setIsReportLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            document.body.classList.add('report-body');
        }
        return () => {
            if (typeof window !== 'undefined') {
                document.body.classList.remove('report-body');
            }
        };
    }, []);

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
                         const itemRanks = allRanks[itemName];
                         let score = 0;
                         if (itemRanks && itemRanks.length > 0) {
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
            toast({
                variant: 'destructive',
                title: '분석 불가',
                description: 'AI 분석을 위한 데이터가 부족합니다.',
            });
            return;
        }

        setIsBriefingLoading(true);
        setIsAiButtonDisabled(true);
        setTimeout(() => setIsAiButtonDisabled(false), 10000);

        try {
            const result = await getReportBriefing({
                studentName: fullStudent.name,
                overallGrade,
                papsSummary,
            });
            setAiBriefing(result.briefing);
        } catch (error) {
            console.error('AI 리포트 요약 요청 실패:', error);
            toast({
                variant: 'destructive',
                title: 'AI 분석 오류',
                description: '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            });
        } finally {
            setIsBriefingLoading(false);
        }
    };

    const handleGetScoutingReport = async () => {
        if (!fullStudent || abilityScores.length === 0 || !school) {
            toast({ variant: 'destructive', title: '리포트 생성 불가', description: '분석을 위한 능력치 데이터가 부족합니다.' });
            return;
        }
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
                abilityScores: abilityScores.map(s => {
                    const itemInfo = allItems.find(i => i.name === s.item);
                    return {
                        ...s,
                        category: itemInfo?.category || (itemInfo?.isPaps ? 'PAPS' : '기타'),
                    }
                }),
                ranks: studentRanks,
                allItems: allItems
            });
            setScoutingReport(result);
        } catch (error) {
            console.error("스카우팅 리포트 생성 실패:", error);
            toast({ variant: 'destructive', title: 'AI 리포트 생성 실패' });
        } finally {
            setIsReportLoading(false);
        }
    }
    
    if (isAuthLoading || isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    if (!fullStudent) {
        return <div className="flex h-screen items-center justify-center">학생 정보를 찾을 수 없습니다.</div>;
    }

    return (
        <div id="print-area" className="report-container mx-auto max-w-4xl bg-white p-8">
            {/* --- PAGE 1 --- */}
            <div className="report-page">
                <header className="report-header mb-8 flex items-center justify-between">
                    <h1 className="text-4xl font-bold">개인 성장 리포트</h1>
                    <div className="print-buttons flex gap-2">
                        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> 인쇄</Button>
                    </div>
                </header>

                <section className="mb-8">
                    <h2 className="report-section-title">기본 정보</h2>
                    <div className="mt-4 flex flex-col md:flex-row gap-8 items-start">
                        <Avatar className="h-40 w-32 rounded-lg">
                            <AvatarImage src={fullStudent.photoUrl || ''} alt={fullStudent.name} />
                            <AvatarFallback className="rounded-lg text-4xl">
                                <UserIcon />
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-lg flex-1">
                            <div><strong className="w-24 inline-block">이름:</strong> {fullStudent.name}</div>
                            <div><strong className="w-24 inline-block">학교:</strong> {school}</div>
                            <div><strong className="w-24 inline-block">학년:</strong> {fullStudent.grade}</div>
                            <div><strong className="w-24 inline-block">반:</strong> {fullStudent.classNum}</div>
                            <div><strong className="w-24 inline-block">번호:</strong> {fullStudent.studentNum}</div>
                            <div><strong className="w-24 inline-block">성별:</strong> {fullStudent.gender}</div>
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                     <h2 className="report-section-title">PAPS 종합 분석</h2>
                     <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={papsRadarChartData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" />
                                    <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
                                    <Radar name="점수" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col items-center justify-center gap-4">
                            <div className="text-center">
                                <p className="text-muted-foreground">종합 등급</p>
                                <p className="text-8xl font-bold text-primary">{overallGrade.charAt(0)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-muted-foreground">종합 점수</p>
                                <p className="text-4xl font-semibold">{overallScore} / 100</p>
                            </div>
                        </div>
                     </div>
                </section>

                 <section className="mb-8">
                    <h2 className="report-section-title">AI 종합 평가</h2>
                    <div className="mt-4">
                        {isBriefingLoading ? (
                            <div className="flex items-center justify-center h-24">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : aiBriefing ? (
                            <p className="text-base leading-relaxed p-4 bg-muted rounded-md">{aiBriefing}</p>
                        ) : (
                            <div className="text-center p-4 border-2 border-dashed rounded-md print-hidden">
                                <p className="text-muted-foreground mb-4">아래 버튼을 눌러 나의 체력 수준에 대한 AI 분석을 받아보세요.</p>
                                <Button onClick={handleGetBriefing} disabled={isAiButtonDisabled}>
                                    <Wand2 className="mr-2 h-4 w-4" />
                                    {isAiButtonDisabled ? '10초 후에 다시 시도하세요' : 'AI 분석 요청'}
                                </Button>
                            </div>
                        )}
                    </div>
                </section>
                
                <section className="mb-8">
                    <h2 className="report-section-title">PAPS 요인별 성장 기록</h2>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {papsGrowthData.map(({ item, records }) => (
                            <Card key={item.id}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{item.name} 변화</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={records}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" fontSize={12} />
                                            <YAxis />
                                            <Tooltip formatter={(value, name) => [`${value}${item.unit}`, '기록']} />
                                            <Bar dataKey="value" name="기록" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
                <div className="text-center text-sm text-muted-foreground mt-8">1 / 2</div>
            </div>

            {/* --- PAGE 2 --- */}
            <div className="report-page">
                 <header className="report-header mb-8 flex items-center justify-between">
                    <h1 className="text-4xl font-bold">개인 성장 리포트 (스포츠)</h1>
                </header>

                {abilityScores.length > 0 && (
                    <section className="mb-8">
                        <h2 className="report-section-title">운동선수 잠재력 분석</h2>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={abilityScores}>
                                        <PolarGrid />
                                        <PolarAngleAxis dataKey="item" fontSize={12}/>
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="능력치" dataKey="score" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                            <div>
                                {isReportLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                ) : scoutingReport ? (
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <h4 className="font-bold text-primary">핵심 강점</h4>
                                            <p className="whitespace-pre-wrap">{scoutingReport.strengths}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-destructive">보완점</h4>
                                            <p className="whitespace-pre-wrap">{scoutingReport.weaknesses}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-bold">종합 평가</h4>
                                            <p className="whitespace-pre-wrap">{scoutingReport.assessment}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-bold">추천 포지션</h4>
                                            <p className="whitespace-pre-wrap">{scoutingReport.position}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 border-2 border-dashed rounded-md print-hidden h-full flex flex-col justify-center">
                                        <p className="text-muted-foreground mb-4">나의 능력치 기반 AI 스카우팅 리포트를 받아보세요.</p>
                                        <Button onClick={handleGetScoutingReport} disabled={isReportLoading}>
                                            <Wand2 className="mr-2 h-4 w-4" />
                                            AI 스카우팅 리포트 생성
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}
                 <section className="mb-8">
                    <h2 className="report-section-title">스포츠/기타 종목 성장 기록</h2>
                    {customGrowthData.length > 0 ? (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {customGrowthData.map(({ item, records }) => (
                                <Card key={item.id}>
                                    <CardHeader>
                                        <CardTitle className="text-lg">{item.name} 변화</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={records}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" fontSize={12} />
                                                <YAxis domain={[0, 100]} unit="%" name="목표달성률" />
                                                <Tooltip formatter={(value, name) => [`${value}%`, '달성률']} />
                                                <Bar dataKey="achievement" name="목표달성률" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-center text-muted-foreground">스포츠 또는 기타 종목의 측정 기록이 없습니다.</p>
                    )}
                </section>
                <div className="text-center text-sm text-muted-foreground mt-8">2 / 2</div>
            </div>

            <style jsx global>{`
                .report-body {
                    background-color: hsl(var(--muted));
                }
                .dark .report-container {
                    background-color: hsl(var(--card));
                    color: hsl(var(--card-foreground));
                }
                .dark .report-table th {
                    background-color: hsl(var(--secondary));
                }
                .report-page {
                    page-break-after: always;
                }
                @media print {
                    @page {
                        size: A4;
                        margin: 20mm;
                    }
                    .print-hidden {
                        display: none !important;
                    }
                    .report-body {
                        background-color: white !important;
                    }
                    .report-container {
                        box-shadow: none;
                        border-radius: 0;
                        border: none;
                        margin: 0;
                        padding: 0;
                        max-width: 100%;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
                .report-container {
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                    border-radius: 8px;
                }
                .report-section-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    padding-bottom: 0.5rem;
                    border-bottom: 2px solid hsl(var(--primary));
                    color: hsl(var(--primary));
                }
                .report-table th, .report-table td {
                    border: 1px solid hsl(var(--border));
                    padding: 0.75rem;
                }
                .report-table th {
                    background-color: hsl(var(--muted));
                }
                .report-table-wrapper {
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid hsl(var(--border));
                }
            `}</style>
        </div>
    );
}
