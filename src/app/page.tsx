'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Rocket } from 'lucide-react';
import { initializeData, cleanUpDuplicateRecords, assignMissingAccessCodes } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const teacherLoginSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
});

type TeacherLoginValues = z.infer<typeof teacherLoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const teacherForm = useForm<TeacherLoginValues>({
    resolver: zodResolver(teacherLoginSchema),
    defaultValues: {
      school: '',
    },
  });

  const handleTeacherLogin = async (values: TeacherLoginValues) => {
    setIsSubmitting(true);
    try {
      await initializeData(values.school);
      await cleanUpDuplicateRecords(values.school);
      await assignMissingAccessCodes(values.school);
      // For now, teacher login is simple. We can add verification later if needed.
      login('teacher', { name: '교사', school: values.school }, values.school);
      router.push('/teacher/dashboard');
    } catch (error) {
      console.error("Login failed: ", error);
      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: '데이터베이스 초기화 또는 연결 중 오류가 발생했습니다. 다시 시도해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-4 mb-8 text-4xl font-bold text-primary">
        <Rocket className="w-12 h-12" />
        <h1 className="font-headline">체육 성장 기록 시스템</h1>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>교사 로그인</CardTitle>
          <CardDescription>
            학교명을 입력하여 로그인하고 학생들의 기록을 관리하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...teacherForm}>
            <form onSubmit={teacherForm.handleSubmit(handleTeacherLogin)} className="space-y-4">
              <FormField
                control={teacherForm.control}
                name="school"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학교 이름</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 테스트초등학교" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  '교사로 로그인'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col items-center gap-4">
          <Separator />
          <div className="text-center text-sm text-muted-foreground">
            학생 또는 다른 역할로 접속하시나요?
          </div>
          <div className="flex w-full gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/student-login">학생 로그인</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/teacher/dashboard">학급별 측정 기록</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
