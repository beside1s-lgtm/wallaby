
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function KnowledgeTab({ quizzes, results }: any) {
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen />체육 지식 인증관</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quizzes.length > 0 ? quizzes.map((q:any) => {
          const pass = results.find((r:any)=>r.assignmentId === q.id)?.passed;
          return (
            <Card key={q.id} className={pass ? "border-yellow-400 bg-yellow-50/20" : ""}>
              <CardHeader><CardTitle className="text-lg">{q.quizTitle}</CardTitle>{pass && <Badge className="bg-yellow-500">인증 완료</Badge>}</CardHeader>
              <CardContent className="flex justify-center py-4">{pass ? <Award className="h-12 w-12 text-yellow-500" /> : <BookOpen className="h-12 w-12 text-muted-foreground" />}</CardContent>
            </Card>
          );
        }) : <div className="col-span-3 text-center py-12 text-muted-foreground">배포된 퀴즈가 없습니다.</div>}
      </CardContent>
    </Card>
  );
}
