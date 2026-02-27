'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrainCircuit, FileText, Loader2, Sparkles, Printer, Copy, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateQuiz, QuizOutput } from "@/ai/flows/quiz-generation-flow";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function TheoryExamManagement() {
    const { toast } = useToast();
    const [content, setContent] = useState('');
    const [questionCount, setQuestionCount] = useState('5');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQuiz, setGeneratedQuiz] = useState<QuizOutput | null>(null);
    const [showAnswers, setShowAnswers] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'text/plain') {
                toast({ variant: 'destructive', title: '파일 형식 오류', description: '.txt 형식의 텍스트 파일만 지원합니다.' });
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                setContent(text);
                toast({ title: '파일 로드 완료', description: '텍스트 파일의 내용이 입력창에 복사되었습니다.' });
            };
            reader.readAsText(file);
        }
    };

    const handleGenerate = async () => {
        if (!content.trim()) {
            toast({ variant: 'destructive', title: '입력 부족', description: '문제를 생성할 기반 텍스트를 입력해주세요.' });
            return;
        }

        setIsGenerating(true);
        setGeneratedQuiz(null);
        setShowAnswers(false);

        try {
            const result = await generateQuiz({
                content: content.trim(),
                count: parseInt(questionCount)
            });
            setGeneratedQuiz(result);
            toast({ title: '퀴즈 생성 완료', description: `${result.questions.length}개의 문제가 생성되었습니다.` });
        } catch (error) {
            console.error("Quiz generation failed:", error);
            toast({ variant: 'destructive', title: '생성 실패', description: 'AI 문제 생성 중 오류가 발생했습니다. 나중에 다시 시도해주세요.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!generatedQuiz) return;
        const text = generatedQuiz.questions.map((q, i) => {
            let qText = `${i + 1}. ${q.question}\n`;
            if (q.options && q.options.length > 0) {
                qText += q.options.map((opt, oi) => `   ${oi + 1}) ${opt}`).join('\n') + '\n';
            }
            return qText;
        }).join('\n');
        
        navigator.clipboard.writeText(text);
        toast({ title: '복사 완료', description: '문제 내용이 클립보드에 복사되었습니다.' });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'multiple-choice': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">4지선다</Badge>;
            case 'short-answer': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">단답형</Badge>;
            case 'ox': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">OX형</Badge>;
            case 'fill-in-the-blanks': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">빈칸채우기</Badge>;
            default: return null;
        }
    };

    return (
        <Card className="bg-transparent shadow-none border-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                    <BrainCircuit className="h-6 w-6 text-primary" />
                    AI 이론 평가 문제 생성기
                </CardTitle>
                <CardDescription>
                    체육 학습 자료를 입력하면 AI가 자동으로 퀴즈를 만들어줍니다. (텍스트 입력 또는 .txt 파일 업로드)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Input Section */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="content-input">학습 자료 내용</Label>
                            <Textarea 
                                id="content-input"
                                placeholder="종목의 규칙, 역사, 기술 설명 등 문제를 만들 텍스트를 이곳에 붙여넣으세요..."
                                className="min-h-[300px] resize-none"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="file-upload">파일에서 가져오기 (.txt)</Label>
                            <Input 
                                id="file-upload" 
                                type="file" 
                                accept=".txt"
                                onChange={handleFileUpload}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>출제 문항 수</Label>
                            <Select value={questionCount} onValueChange={setQuestionCount}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5문항</SelectItem>
                                    <SelectItem value="10">10문항</SelectItem>
                                    <SelectItem value="15">15문항</SelectItem>
                                    <SelectItem value="20">20문항</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button 
                            className="w-full py-6 text-lg font-bold" 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 생성 중...</>
                            ) : (
                                <><Sparkles className="mr-2 h-5 w-5" /> AI 문제 생성하기</>
                            )}
                        </Button>
                    </div>

                    {/* Result Section */}
                    <div className="lg:col-span-2">
                        {generatedQuiz ? (
                            <Card className="h-full border-2 border-primary/20">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl">{generatedQuiz.quizTitle}</CardTitle>
                                        <CardDescription>{generatedQuiz.questions.length}개의 문제가 출제되었습니다.</CardDescription>
                                    </div>
                                    <div className="flex gap-2 print:hidden">
                                        <Button variant="outline" size="sm" onClick={() => setShowAnswers(!showAnswers)}>
                                            {showAnswers ? '정답 숨기기' : '정답 확인'}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleCopy}>
                                            <Copy className="h-4 w-4 mr-1" /> 복사
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                                            <Printer className="h-4 w-4 mr-1" /> 인쇄
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-8 max-h-[600px] overflow-y-auto pr-4">
                                    {generatedQuiz.questions.map((q, idx) => (
                                        <div key={idx} className="space-y-3 p-4 rounded-lg bg-secondary/20 relative group">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    <h4 className="font-semibold text-lg">{q.question}</h4>
                                                </div>
                                                {getTypeBadge(q.type)}
                                            </div>

                                            {q.type === 'multiple-choice' && q.options && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                                                    {q.options.map((opt, oi) => (
                                                        <div key={oi} className="flex items-center gap-2 text-sm p-2 rounded border bg-background">
                                                            <span className="font-bold text-primary">{oi + 1}.</span> {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type === 'fill-in-the-blanks' && q.options && (
                                                <div className="flex flex-wrap gap-2 pl-8 items-center text-sm">
                                                    <span className="text-muted-foreground font-medium">[ 보기 ] : </span>
                                                    {q.options.map((opt, oi) => (
                                                        <Badge key={oi} variant="secondary">{opt}</Badge>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type === 'ox' && (
                                                <div className="flex gap-4 pl-8">
                                                    <div className="flex items-center justify-center w-12 h-12 rounded-lg border-2 border-primary/30 text-2xl font-bold text-primary opacity-50">O</div>
                                                    <div className="flex items-center justify-center w-12 h-12 rounded-lg border-2 border-destructive/30 text-2xl font-bold text-destructive opacity-50">X</div>
                                                </div>
                                            )}

                                            {showAnswers && (
                                                <div className="mt-4 p-3 bg-primary/5 border-l-4 border-primary rounded animate-in fade-in slide-in-from-left-2">
                                                    <div className="flex items-center gap-2 text-primary font-bold mb-1">
                                                        <CheckCircle2 className="h-4 w-4" /> 정답: {q.answer}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[400px] border-2 border-dashed rounded-xl bg-muted/30">
                                <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                                    <HelpCircle className="h-10 w-10 text-muted-foreground opacity-50" />
                                </div>
                                <h3 className="text-lg font-semibold mb-1">학습 자료를 입력해주세요</h3>
                                <p className="text-sm text-muted-foreground text-center max-w-xs">
                                    왼쪽 입력창에 내용을 넣고 생성 버튼을 누르면 AI가 문제를 만들어줍니다.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
            <style jsx global>{`
                @media print {
                    .print-hidden { display: none !important; }
                    header, footer, .sidebar, .tabs-list { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                    .max-h-[600px] { max-height: none !important; overflow: visible !important; }
                }
            `}</style>
        </Card>
    );
}
