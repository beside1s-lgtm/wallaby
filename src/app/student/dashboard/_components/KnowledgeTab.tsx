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
      <Card className="border-2 border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="flex items-center gap-2 text-primary font-black">
            <BookOpen className="h-6 w-6" />
            체육 지식 인증관
          </CardTitle>
          <CardDescription className="font-medium">배포된 이론 평가를 완벽히 통과하고 인증 배지를 획득하세요.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.length > 0 ? quizzes.map((q) => {
              const result = results.find(r => r.assignmentId === q.id);
              const isPerfect = result && result.score === result.total;
              const hasAttempted = !!result;

              return (
                <Card key={q.id} className={cn(
                  "transition-all duration-300 overflow-hidden border-2", 
                  isPerfect ? "bg-amber-50/30 border-amber-200 shadow-md" : "hover:border-primary/30"
                )}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-base font-black line-clamp-2 leading-tight">{q.quizTitle}</CardTitle>
                      {isPerfect && (
                        <Badge className="bg-yellow-500 text-white font-black shrink-0 shadow-sm">
                          인증 완료
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex justify-center py-8">
                    {isPerfect ? (
                      <div className="relative animate-in zoom-in duration-700">
                        <Award className="h-20 w-20 text-yellow-500" />
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                          <CheckCircle2 className="h-7 w-7 text-green-600" />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/30 rounded-full p-6">
                        <BookOpen className={cn("h-12 w-12", hasAttempted ? "text-primary/40" : "text-muted-foreground/20")} />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 border-t bg-muted/5">
                    {isPerfect ? (
                      <div className="w-full text-center py-2.5 text-sm font-black text-yellow-700 flex items-center justify-center gap-1.5 bg-yellow-100/50 rounded-lg">
                        <CheckCircle2 className="h-4 w-4" /> 학습 완료
                      </div>
                    ) : (
                      <Button 
                        variant={hasAttempted ? "outline" : "default"} 
                        className={cn("w-full h-11 font-black", !hasAttempted && "shadow-md")} 
                        onClick={() => startQuiz(q)}
                      >
                        {hasAttempted ? '재응시하기' : '평가 시작하기'}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            }) : (
              <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl bg-muted/5">
                <p className="font-bold text-lg">현재 진행 중인 이론 평가가 없습니다.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quiz Dialog */}
      <Dialog open={!!selectedQuiz} onOpenChange={(open) => !open && setSelectedQuiz(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 pb-4 bg-primary text-primary-foreground">
            <div className="flex justify-between items-center pr-8">
              <DialogTitle className="text-2xl font-black">{selectedQuiz?.quizTitle}</DialogTitle>
              <Badge variant="secondary" className="bg-white/20 text-white border-none font-bold">
                총 {selectedQuiz?.questions?.length || 0}문제
              </Badge>
            </div>
            <DialogDescription className="text-white/70 font-medium">문제를 잘 읽고 정답을 선택하세요. 만점을 받으면 인증 배지가 부여됩니다!</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background">
            {!showResult ? (
              <div className="space-y-10">
                {currentStep === 'video' && selectedQuiz?.videoUrl && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-4">
                      <div className="bg-white p-2 rounded-full shadow-sm">
                        <Youtube className="text-red-600 h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-amber-900 leading-tight">문제를 풀기 전, 아래 영상을 시청하면 큰 도움이 됩니다!</p>
                    </div>
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border-4 border-muted bg-black shadow-xl">
                      <iframe
                        width="100%" height="100%"
                        src={getYouTubeEmbedUrl(selectedQuiz.videoUrl)!}
                        title="참고 영상" frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                    <Button className="w-full py-8 text-xl font-black rounded-2xl shadow-xl hover:scale-[1.01] transition-transform" onClick={() => setCurrentStep('questions')}>
                      시청 완료! 이제 문제 풀기 <ChevronRight className="ml-2 h-6 w-6" />
                    </Button>
                  </div>
                )}

                {currentStep === 'questions' && selectedQuiz?.questions?.map((q, idx) => (
                  <div key={idx} className="space-y-5 p-6 rounded-2xl border-2 border-muted bg-card transition-all hover:border-primary/20">
                    <div className="flex items-start gap-4">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-black shrink-0 mt-0.5 shadow-md">
                        {idx + 1}
                      </span>
                      <h4 className="text-lg font-black leading-snug pt-0.5">{q.question}</h4>
                    </div>

                    <RadioGroup 
                      value={answers[idx]} 
                      onValueChange={(v) => setAnswers({...answers, [idx]: v})}
                      className="grid grid-cols-1 gap-3 pl-12"
                    >
                      {q.type === 'multiple-choice' && q.options?.map((opt, oi) => (
                        <div key={oi} className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer hover:bg-muted/50",
                          answers[idx] === opt ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-muted"
                        )} onClick={() => setAnswers({...answers, [idx]: opt})}>
                          <RadioGroupItem value={opt} id={`q${idx}-o${oi}`} className="sr-only" />
                          <span className="flex-1 cursor-pointer font-bold text-base">{opt}</span>
                          {answers[idx] === opt && <CheckCircle2 className="h-5 w-5 text-primary" />}
                        </div>
                      ))}
                      {q.type === 'ox' && (
                        <div className="grid grid-cols-2 gap-4">
                          {['O', 'X'].map((opt) => (
                            <div key={opt} className={cn(
                              "flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer hover:bg-muted/50 gap-2",
                              answers[idx] === opt ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-muted"
                            )} onClick={() => setAnswers({...answers, [idx]: opt})}>
                              <RadioGroupItem value={opt} id={`q${idx}-o${opt}`} className="sr-only" />
                              <span className={cn("text-4xl font-black", opt === 'O' ? "text-primary" : "text-destructive")}>{opt}</span>
                              <span className="text-xs font-bold text-muted-foreground">{opt === 'O' ? '그렇다' : '아니다'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {(q.type === 'short-answer' || q.type === 'fill-in-the-blanks') && (
                        <div className="space-y-3">
                          <Input 
                            placeholder="정답을 입력하세요" 
                            value={answers[idx] || ''} 
                            onChange={(e) => setAnswers({...answers, [idx]: e.target.value})}
                            className="h-14 text-lg font-bold rounded-xl border-2 focus-visible:ring-primary/20"
                          />
                          {q.type === 'fill-in-the-blanks' && q.options && (
                            <div className="flex flex-wrap gap-2 pt-1 bg-muted/30 p-3 rounded-xl border border-dashed">
                              <span className="text-xs text-muted-foreground font-black uppercase tracking-widest mr-1">[ 보기 ]</span>
                              {q.options.map((opt, i) => (
                                <Badge key={i} variant="secondary" className="cursor-pointer px-3 py-1 font-bold text-sm hover:bg-primary hover:text-white transition-colors" onClick={() => setAnswers({...answers, [idx]: opt})}>
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
              <div className="py-12 flex flex-col items-center text-center space-y-8 animate-in zoom-in-95 duration-500">
                {lastResult?.score === lastResult?.total ? (
                  <>
                    <div className="bg-yellow-100 p-8 rounded-full shadow-inner ring-8 ring-yellow-50">
                      <Award className="h-32 w-32 text-yellow-600 animate-bounce" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-4xl font-black text-yellow-700">축하합니다! 만점!</h3>
                      <p className="text-xl font-bold text-foreground/70">체육 지식 인증 배지를 획득했습니다.</p>
                    </div>
                  </>
                ) : lastResult?.passed ? (
                  <>
                    <div className="bg-green-100 p-8 rounded-full shadow-inner ring-8 ring-green-50">
                      <CheckCircle2 className="h-32 w-32 text-green-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-4xl font-black text-green-700">좋은 시도예요! 통과!</h3>
                      <p className="text-lg font-bold text-muted-foreground">만점에 도전해서 인증 배지를 받아볼까요?</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-destructive/10 p-8 rounded-full shadow-inner ring-8 ring-destructive/5">
                      <XCircle className="h-32 w-32 text-destructive" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-4xl font-black text-destructive">아쉬워요! 미통과</h3>
                      <p className="text-lg text-muted-foreground">조금 더 공부해서 다시 도전해볼까요?</p>
                    </div>
                  </>
                )}
                
                <div className="bg-muted/20 p-8 rounded-3xl border-2 border-dashed w-full max-w-md space-y-6">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">나의 성적</span>
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-5xl font-black", lastResult?.score === lastResult?.total ? "text-yellow-600" : "text-primary")}>
                        {lastResult?.score}
                      </span>
                      <span className="text-xl font-bold text-muted-foreground">/ {lastResult?.total}점</span>
                    </div>
                  </div>
                  <Progress value={(lastResult?.score || 0) / (lastResult?.total || 1) * 100} className="h-4 rounded-full bg-muted shadow-inner" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-muted/5">
            {!showResult ? (
              <div className="flex w-full gap-3">
                {currentStep === 'questions' && selectedQuiz?.videoUrl && (
                  <Button variant="outline" className="h-14 px-6 rounded-xl font-bold" onClick={() => setCurrentStep('video')}>
                    <ChevronLeft className="mr-2 h-5 w-5" /> 영상 다시보기
                  </Button>
                )}
                <Button 
                  className="flex-1 h-14 text-xl font-black rounded-xl shadow-lg transition-all active:scale-95" 
                  disabled={isSubmitting || (currentStep === 'questions' && Object.keys(answers).length < (selectedQuiz?.questions?.length || 0))}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Send className="mr-2 h-6 w-6" />}
                  최종 결과 제출하기
                </Button>
              </div>
            ) : (
              <DialogClose asChild>
                <Button className="w-full h-14 text-xl font-black rounded-xl shadow-md">확인 완료</Button>
              </DialogClose>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
