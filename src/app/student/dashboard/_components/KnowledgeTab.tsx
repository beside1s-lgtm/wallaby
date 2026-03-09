'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose 
} from '@/components/ui/dialog';
import { BookOpen, Award, CheckCircle2, XCircle, Youtube, ChevronRight, ChevronLeft, Loader2, Send } from 'lucide-react';
import { saveQuizResult } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { QuizAssignment, QuizResult, Student } from '@/lib/types';

interface KnowledgeTabProps {
  quizzes: QuizAssignment[];
  results: QuizResult[];
  student: Student | null;
}

export function KnowledgeTab({ quizzes, results, student }: KnowledgeTabProps) {
  const [selectedQuiz, setSelectedQuiz] = useState<QuizAssignment | null>(null);
  const [currentStep, setCurrentStep] = useState<'video' | 'questions'>('video');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  const startQuiz = (quiz: QuizAssignment) => {
    setSelectedQuiz(quiz);
    setCurrentStep(quiz.videoUrl ? 'video' : 'questions');
    setAnswers({});
    setShowResult(false);
  };

  const handleSubmit = async () => {
    if (!selectedQuiz || !student || !selectedQuiz.questions) return;
    
    setIsSubmitting(true);
    let score = 0;
    selectedQuiz.questions.forEach((q, i) => {
      if (answers[i] === q.answer) score++;
    });

    const total = selectedQuiz.questions.length;
    const passed = (score / total) >= 0.6; // 60% 이상 통과

    const result = {
      assignmentId: selectedQuiz.id,
      studentId: student.id,
      score,
      total,
      passed,
    };

    try {
      await saveQuizResult(student.school, result);
      setLastResult(result as QuizResult);
      setShowResult(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="text-primary" />
            체육 지식 인증관
          </CardTitle>
          <CardDescription>배포된 이론 평가를 완료하고 인증 배지를 획득하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.length > 0 ? quizzes.map((q) => {
              const result = results.find(r => r.assignmentId === q.id);
              const isPassed = result?.passed;
              return (
                <Card key={q.id} className={cn("transition-all hover:border-primary", isPassed ? "bg-yellow-50/30 border-yellow-200" : "")}>
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-base font-bold line-clamp-2">{q.quizTitle}</CardTitle>
                      {isPassed && <Badge className="bg-yellow-500 shrink-0">인증 완료</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex justify-center py-6">
                    {isPassed ? (
                      <div className="relative">
                        <Award className="h-16 w-16 text-yellow-500 animate-in zoom-in duration-500" />
                        <CheckCircle2 className="absolute -bottom-1 -right-1 h-6 w-6 text-green-600 bg-white rounded-full" />
                      </div>
                    ) : (
                      <BookOpen className="h-16 w-16 text-muted-foreground/30" />
                    )}
                  </CardContent>
                  <CardFooter className="p-4 border-t bg-muted/10">
                    <Button 
                      variant={isPassed ? "outline" : "default"} 
                      className="w-full" 
                      onClick={() => startQuiz(q)}
                    >
                      {isPassed ? '다시 도전하기' : '평가 시작하기'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            }) : (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                현재 진행 중인 이론 평가가 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quiz Dialog */}
      <Dialog open={!!selectedQuiz} onOpenChange={(open) => !open && setSelectedQuiz(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl">{selectedQuiz?.quizTitle}</DialogTitle>
            <DialogDescription>문제를 잘 읽고 정답을 선택하세요.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {!showResult ? (
              <div className="space-y-8">
                {currentStep === 'video' && selectedQuiz?.videoUrl && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-primary/5 p-4 rounded-lg border flex items-center gap-3">
                      <Youtube className="text-red-600 h-6 w-6" />
                      <p className="text-sm font-medium">문제를 풀기 전, 아래 영상을 시청하면 큰 도움이 됩니다!</p>
                    </div>
                    <div className="aspect-video w-full rounded-lg overflow-hidden border-2 bg-black shadow-lg">
                      <iframe
                        width="100%" height="100%"
                        src={getYouTubeEmbedUrl(selectedQuiz.videoUrl)!}
                        title="참고 영상" frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                    <Button className="w-full py-6 text-lg" onClick={() => setCurrentStep('questions')}>
                      시청 완료! 이제 문제 풀기 <ChevronRight className="ml-2" />
                    </Button>
                  </div>
                )}

                {currentStep === 'questions' && selectedQuiz?.questions?.map((q, idx) => (
                  <div key={idx} className="space-y-4 p-4 rounded-xl border bg-card/50">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <h4 className="text-base font-bold leading-tight">{q.question}</h4>
                    </div>

                    <RadioGroup 
                      value={answers[idx]} 
                      onValueChange={(v) => setAnswers({...answers, [idx]: v})}
                      className="grid grid-cols-1 gap-2 pl-9"
                    >
                      {q.type === 'multiple-choice' && q.options?.map((opt, oi) => (
                        <div key={oi} className={cn(
                          "flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                          answers[idx] === opt ? "border-primary bg-primary/5 ring-1 ring-primary" : ""
                        )}>
                          <RadioGroupItem value={opt} id={`q${idx}-o${oi}`} />
                          <Label htmlFor={`q${idx}-o${oi}`} className="flex-1 cursor-pointer font-medium">{opt}</Label>
                        </div>
                      ))}
                      {q.type === 'ox' && ['O', 'X'].map((opt) => (
                        <div key={opt} className={cn(
                          "flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                          answers[idx] === opt ? "border-primary bg-primary/5 ring-1 ring-primary" : ""
                        )}>
                          <RadioGroupItem value={opt} id={`q${idx}-o${opt}`} />
                          <Label htmlFor={`q${idx}-o${opt}`} className="flex-1 cursor-pointer font-bold text-lg">{opt}</Label>
                        </div>
                      ))}
                      {(q.type === 'short-answer' || q.type === 'fill-in-the-blanks') && (
                        <div className="space-y-2">
                          <Input 
                            placeholder="정답을 입력하세요" 
                            value={answers[idx] || ''} 
                            onChange={(e) => setAnswers({...answers, [idx]: e.target.value})}
                            className="h-12"
                          />
                          {q.type === 'fill-in-the-blanks' && q.options && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <span className="text-xs text-muted-foreground font-bold">[보기]:</span>
                              {q.options.map((opt, i) => (
                                <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setAnswers({...answers, [idx]: opt})}>
                                  {opt}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
                {lastResult?.passed ? (
                  <>
                    <div className="bg-green-100 p-6 rounded-full">
                      <Award className="h-24 w-24 text-green-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-black text-green-700">축하합니다! 통과!</h3>
                      <p className="text-xl font-bold">인증 배지를 획득했습니다.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-destructive/10 p-6 rounded-full">
                      <XCircle className="h-24 w-24 text-destructive" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-black text-destructive">아쉬워요! 미통과</h3>
                      <p className="text-lg text-muted-foreground">조금 더 공부해서 다시 도전해볼까요?</p>
                    </div>
                  </>
                )}
                
                <div className="bg-muted/50 p-6 rounded-2xl border w-full max-w-sm space-y-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>나의 점수</span>
                    <span className={lastResult?.passed ? "text-green-600" : "text-destructive"}>
                      {lastResult?.score} / {lastResult?.total}점
                    </span>
                  </div>
                  <Progress value={(lastResult?.score || 0) / (lastResult?.total || 1) * 100} className="h-3" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-muted/5">
            {!showResult ? (
              <div className="flex w-full gap-2">
                {currentStep === 'questions' && selectedQuiz?.videoUrl && (
                  <Button variant="outline" onClick={() => setCurrentStep('video')}>
                    <ChevronLeft className="mr-2" /> 영상 다시보기
                  </Button>
                )}
                <Button 
                  className="flex-1 h-12 text-lg font-bold" 
                  disabled={isSubmitting || (currentStep === 'questions' && Object.keys(answers).length < (selectedQuiz?.questions?.length || 0))}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2" />}
                  최종 결과 제출하기
                </Button>
              </div>
            ) : (
              <DialogClose asChild>
                <Button className="w-full h-12 text-lg font-bold">확인 완료</Button>
              </DialogClose>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
