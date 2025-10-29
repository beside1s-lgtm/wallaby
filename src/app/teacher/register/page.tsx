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
import { initializeData, getSchoolByName } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { signIn } from '@/lib/firebase';

const registerSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
  password: z.string().min(4, '비밀번호는 4자 이상이어야 합니다.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      school: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleRegister = async (values: RegisterValues) => {
    setIsSubmitting(true);
    try {
      await signIn();
      const existingSchool = await getSchoolByName(values.school);

      if (existingSchool) {
        toast({ variant: 'destructive', title: '등록 실패', description: '이미 등록된 학교 이름입니다. 다른 이름을 사용해주세요.' });
        return;
      }

      await initializeData(values.school, values.password);
      
      login('teacher', { name: '교사', school: values.school });

      toast({
        title: '등록 성공',
        description: `${values.school}이(가) 성공적으로 등록되었습니다. 초기 데이터가 설정됩니다.`
      });

      router.push('/teacher/dashboard');
    } catch (error) {
      console.error("Registration failed: ", error);
      toast({
        variant: 'destructive',
        title: '등록 실패',
        description: '오류가 발생했습니다. 다시 시도해주세요.',
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
          <CardTitle>신규 학교 등록</CardTitle>
          <CardDescription>
            새로운 학교를 등록하고 교사 계정을 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-4">
              <FormField
                control={form.control}
                name="school"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학교 이름</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 행복초등학교" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>새 비밀번호 (4자 이상)</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호 확인</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                등록 및 로그인
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center">
            <Button asChild variant="link">
                <Link href="/">로그인 페이지로 돌아가기</Link>
            </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
