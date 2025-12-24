
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudentById, getItems, getRecordsByStudent } from '@/lib/store';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User as UserIcon, Printer, Wand2 } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { getPapsGrade, calculatePapsScore } from '@/lib/paps';
import { getReportBriefing } from '@/ai/flows/report-briefing-flow';
import { useToast } from '@/hooks/use-toast';

const papsFactors: Record<string, string> = {
    '왕복오래달리기': '심폐지구력', '오래달리기': '심폐지구력',
    '윗몸 말아올리기': '근력/근지구력', '팔굽혀펴기': '근력/근지구력', '무릎 대고 팔굽혀펴기': '근력/근지구력', '악력': '근력/근지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '50m 달리기': '순발력', '제자리 멀리뛰기': '순발력',
    '체질량지수(BMI)': '체질량지수'
};

const factorOrder = ['심폐지구력', '근력/근지구력', '순발력', '유연성', '체질량지수'];

export default function ReportCardPage() {
    const { user, school, isLoading: isAuthLoading } = useAuth();
    const student = user as Student;
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [fullStudent, setFullStudent] = useState<Student | null>(null);
    const [items, setItems] = useState<MeasurementItem[]>([]);
    const [records, setRecords] = useState<MeasurementRecord[]>([]);

    const [aiBriefing, setAiBriefing] = useState('');
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);


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
                const [studentData, itemData, recordData] = await Promise.all([
                    getStudentById(school, student.id),
                    getItems(school),
                    getRecordsByStudent(school, student.id),
                ]);
                setFullStudent(studentData || null);
                setItems(itemData || []);
                setRecords(recordData || []);
            } catch (error) {
                console.error("리포트 데이터 로딩 실패:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [student?.id, school]);

    const { papsSummary, radarChartData, overallGrade, overallScore } = useMemo(() => {
        if (!fullStudent || items.length === 0 || records.length === 0) {
            return { papsSummary: [], radarChartData: [], overallGrade: '-', overallScore: 0 };
        }

        const summary: { factor: string; itemName: string; value: number; unit: string; grade: number | null; score: number | null; }[] = [];
        const latestRecords: Record<string, MeasurementRecord> = {};

        records.forEach(record => {
            if (!latestRecords[record.item] || new Date(record.date) > new Date(latestRecords[record.item].date)) {
                latestRecords[record.item] = record;
            }
        });

        let totalScore = 0;
        let factorCount = 0;

        factorOrder.forEach(factor => {
            const factorItems = items.filter(item => papsFactors[item.name] === factor && item.isPaps);
            let latestRecord: MeasurementRecord | undefined;
            let latestItem: MeasurementItem | undefined;

            factorItems.forEach(item => {
                const record = latestRecords[item.name];
                if (record) {
                    if (!latestRecord || new Date(record.date) > new Date(latestRecord.date)) {
                        latestRecord = record;
                        latestItem = item;
                    }
                }
            });

            if (latestRecord && latestItem) {
                const grade = getPapsGrade(latestItem.name, fullStudent, latestRecord.value);
                const score = calculatePapsScore(latestItem.name, fullStudent, latestRecord.value);
                summary.push({
                    factor,
                    itemName: latestItem.name,
                    value: latestRecord.value,
                    unit: latestItem.unit,
                    grade,
                    score,
                });
                if (score !== null) {
                    totalScore += score;
                    factorCount++;
                }
            }
        });

        const radarData = factorOrder.map(factor => {
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
        
        return { papsSummary: summary, radarChartData: radarData, overallGrade: finalGrade, overallScore: Math.round(finalScore) };
    }, [fullStudent, items, records]);

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
    
    if (isAuthLoading || isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    if (!fullStudent) {
        return <div className="flex h-screen items-center justify-center">학생 정보를 찾을 수 없습니다.</div>;
    }

    return (
        <div className="report-container mx-auto max-w-4xl bg-white p-8">
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
                 <h2 className="report-section-title">신체능력 분석</h2>
                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
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
                        <div className="text-center p-4 border-2 border-dashed rounded-md">
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
                <h2 className="report-section-title">PAPS 요인별 상세</h2>
                <div className="report-table-wrapper mt-4">
                    <table className="report-table w-full text-center">
                        <thead>
                            <tr>
                                <th>체력요인</th>
                                <th>측정종목</th>
                                <th>기록</th>
                                <th>점수 (20점)</th>
                                <th>등급</th>
                            </tr>
                        </thead>
                        <tbody>
                            {factorOrder.map(factor => {
                                const data = papsSummary.find(s => s.factor === factor);
                                return (
                                    <tr key={factor}>
                                        <td>{factor}</td>
                                        <td>{data?.itemName || '-'}</td>
                                        <td>{data ? `${data.value} ${data.unit}` : '-'}</td>
                                        <td>{data?.score ?? '-'}</td>
                                        <td>{data?.grade ? `${data.grade}등급` : '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

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
                @media print {
                    .print-buttons {
                        display: none;
                    }
                    .report-body {
                        background-color: white !important;
                    }
                    .report-container {
                        box-shadow: none;
                        border-radius: 0;
                        border: none;
                    }
                    @page {
                        size: A4;
                        margin: 20mm;
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
