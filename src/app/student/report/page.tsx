'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getStudentById, getItems, getRecords, getRecordsByStudent, getStudents } from '@/lib/store';
import { analyzeStudentPerformance } from '@/ai/flows/teacher-ai-assistant';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User as UserIcon, Printer, Download } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { getPapsGrade, calculatePapsScore } from '@/lib/paps';

const papsFactors: Record<string, string> = {
    '왕복오래달리기': '심폐지구력', '오래달리기': '심폐지구력',
    '윗몸 말아올리기': '근력/근지구력', '팔굽혀펴기': '근력/근지구력', '무릎 대고 팔굽혀펴기': '근력/근지구력', '악력': '근력/근지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '50m 달리기': '순발력', '제자리 멀리뛰기': '순발력',
    '체질량지수(BMI)': '체질량지수'
};

const factorOrder = ['심폐지구력', '근력/근지구력', '순발력', '유연성', '체질량지수'];

type AnalysisData = {
    strengths: string;
    weaknesses: string;
    suggestedTrainingMethods: string;
}

export default function ReportCardPage() {
    const { user, school, isLoading: isAuthLoading } = useAuth();
    const student = user as Student;
    const [isLoading, setIsLoading] = useState(true);

    const [fullStudent, setFullStudent] = useState<Student | null>(null);
    const [items, setItems] = useState<MeasurementItem[]>([]);
    const [records, setRecords] = useState<MeasurementRecord[]>([]);
    const [analysis, setAnalysis] = useState<AnalysisData | null>(null);

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
                    getRecordsByStudent(school, student.id)
                ]);
                setFullStudent(studentData || null);
                setItems(itemData || []);
                setRecords(recordData || []);

                if (studentData && recordData.length > 0) {
                    const allRecordsForRank = await getRecords(school);
                    const allStudentsForRank = await getStudents(school);
                    const ranks = getRanksForStudent(school, studentData, itemData, allRecordsForRank, allStudentsForRank);
                    
                    const papsRecords = recordData.filter(r => {
                        const itemInfo = itemData.find(item => item.name === r.item);
                        return itemInfo?.isPaps;
                    });
                    
                    if (papsRecords.length > 0) {
                        const performanceData = JSON.stringify(
                            papsRecords.map(r => ({ item: r.item, value: r.value, date: r.date }))
                        );
                        const aiResult = await analyzeStudentPerformance({
                            school: school,
                            studentName: studentData.name,
                            performanceData,
                            ranks: ranks
                        });
                        setAnalysis(aiResult);
                    }
                }
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
            
            <section>
                 <h2 className="report-section-title">AI 코칭 조언</h2>
                 {analysis ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                         <Card>
                            <CardHeader><CardTitle>강점</CardTitle></CardHeader>
                            <CardContent className="whitespace-pre-wrap">{analysis.strengths}</CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>약점</CardTitle></CardHeader>
                            <CardContent className="whitespace-pre-wrap">{analysis.weaknesses}</CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>추천 훈련</CardTitle></CardHeader>
                            <CardContent className="whitespace-pre-wrap">{analysis.suggestedTrainingMethods}</CardContent>
                        </Card>
                    </div>
                 ) : (
                    <div className="mt-4 text-center text-muted-foreground">AI 분석 데이터가 없습니다.</div>
                 )}
            </section>

            <style jsx global>{`
                @media print {
                    .print-buttons {
                        display: none;
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
                .report-body {
                    background-color: #f0f2f5;
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

// Helper function
function getRanksForStudent(school: string, student: Student, allItems: MeasurementItem[], allRecords: MeasurementRecord[], allStudents: Student[]) {
    const ranks: Record<string, string> = {};

    const itemLatestRecords: Record<string, { value: number, studentId: string }[]> = {};

    allItems.forEach(item => {
        const itemRecords = allRecords.filter(r => r.item === item.name);
        const latestRecords: Record<string, MeasurementRecord> = {};

        itemRecords.forEach(record => {
            const studentOfRecord = allStudents.find(s => s.id === record.studentId);
            if (studentOfRecord?.grade !== student.grade) return;
            
            if (!latestRecords[record.studentId] || new Date(record.date) > new Date(latestRecords[record.studentId].date)) {
                latestRecords[record.studentId] = record;
            }
        });
        itemLatestRecords[item.name] = Object.values(latestRecords).map(r => ({ value: r.value, studentId: r.studentId }));

        if (item.recordType === 'time') {
            itemLatestRecords[item.name].sort((a,b) => a.value - b.value);
        } else {
            itemLatestRecords[item.name].sort((a,b) => b.value - a.value);
        }

        const studentRankIndex = itemLatestRecords[item.name].findIndex(r => r.studentId === student.id);
        if (studentRankIndex !== -1) {
            let rank = studentRankIndex + 1;
            // Handle ties
            for (let i = studentRankIndex - 1; i >= 0; i--) {
                if (itemLatestRecords[item.name][i].value === itemLatestRecords[item.name][studentRankIndex].value) {
                    rank = i + 1;
                } else {
                    break;
                }
            }
            ranks[item.name] = `${itemLatestRecords[item.name].length}명 중 ${rank}등`;
        }
    });

    return ranks;
}
