'use client';

import { useState, useEffect } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { FirestorePermissionError } from '@/lib/errors';
import { signIn } from '@/lib/firebase';
import type { School } from '@/lib/types';

const loginSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
  password: z.string().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [existingSchool, setExistingSchool] = useState<School | null | undefined>(undefined);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      school: '',
      password: '',
    },
  });

  const schoolName = form.watch('school');

  useEffect(() => {
    // Debounce to prevent excessive DB calls while typing
    const debounce = setTimeout(() => {
      if (schoolName) {
        getSchoolByName(schoolName).then(setExistingSchool);
      } else {
        setExistingSchool(undefined);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [schoolName]);

  const handleTeacherLogin = async (values: LoginValues) => {
    setIsSubmitting(true);
    
    // Define dynamic schema for validation inside the handler
    const dynamicLoginSchema = z.object({
        school: z.string().min(1, '학교 이름을 입력해주세요.'),
        password: existingSchool?.password
            ? z.string().min(1, '비밀번호를 입력해주세요.')
            : (existingSchool === null 
                ? z.string().min(4, '새 비밀번호는 4자 이상이어야 합니다.')
                : z.string().optional()),
    });

    try {
      dynamicLoginSchema.parse(values);

      await signIn();

      if (existingSchool) { // Existing school
        if (existingSchool.password && existingSchool.password !== values.password) {
          toast({ variant: 'destructive', title: '로그인 실패', description: '비밀번호가 일치하지 않습니다.' });
          setIsSubmitting(false);
          return;
        }
        // If password matches or no password is required, proceed to login
      } else { // New school
        await initializeData(values.school, values.password);
      }
      
      login('teacher', { name: '교사', school: values.school }, values.school);
      router.push('/teacher/dashboard');
    } catch (error) {
       if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          form.setError(err.path[0] as keyof LoginValues, { message: err.message });
        });
       } else if (error instanceof FirestorePermissionError) {
        throw error;
      } else {
        console.error("Login failed: ", error);
        toast({
          variant: 'destructive',
          title: '로그인 실패',
          description: '데이터베이스 연결 중 오류가 발생했습니다. 다시 시도해주세요.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const showPasswordInput = existingSchool === null || !!existingSchool?.password;

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
            {existingSchool === undefined && "학교명을 입력하여 로그인하세요."}
            {existingSchool === null && "새로운 학교입니다. 사용할 비밀번호를 설정하세요."}
            {existingSchool && !existingSchool.password && "등록된 학교입니다. 비밀번호 없이 로그인할 수 있습니다."}
            {existingSchool && existingSchool.password && "등록된 학교입니다. 비밀번호를 입력하여 로그인하세요."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleTeacherLogin)} className="space-y-4">
              <FormField
                control={form.control}
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
              {showPasswordInput && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{existingSchool === null ? '새 비밀번호 설정 (4자 이상)' : '비밀번호'}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {existingSchool === null ? '등록 및 로그인 중...' : '로그인 중...'}
                  </>
                ) : (
                  existingSchool === null ? '신규 등록 및 로그인' : '교사로 로그인'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col items-center gap-4">
          <Separator />
          <div className="text-center text-sm text-muted-foreground pt-4">
            학생으로 접속하시나요?
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/student-login">학생 로그인</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
