'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Rocket } from 'lucide-react';
import { initializeData, getSchoolByName } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { signIn } from '@/lib/firebase';
import Link from 'next/link';

const loginSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

type LoginValues = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
  password: z.string().min(4, '비밀번호는 4자 이상이어야 합니다.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
});

type RegisterValues = z.infer<typeof registerSchema>;


export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      school: '',
      password: '',
    },
  });
  
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      school: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleTeacherLogin = async (values: LoginValues) => {
    setIsSubmitting(true);
    try {
      await signIn();
      const school = await getSchoolByName(values.school);

      if (!school) {
        toast({ variant: 'destructive', title: '로그인 실패', description: '등록되지 않은 학교입니다. 신규 등록을 진행해주세요.' });
        setIsSubmitting(false);
        return;
      }
      
      if (!school.password) {
        toast({ variant: 'destructive', title: '로그인 실패', description: '비밀번호가 설정되지 않은 학교입니다. 관리자에게 문의하세요.' });
        setIsSubmitting(false);
        return;
      }

      if (school.password !== values.password) {
        toast({ variant: 'destructive', title: '로그인 실패', description: '비밀번호가 일치하지 않습니다.' });
        setIsSubmitting(false);
        return;
      }
      
      login('teacher', { name: '교사', school: values.school });
      router.push('/teacher/dashboard');

    } catch (error) {
      console.error("Login failed: ", error);
      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: '오류가 발생했습니다. 다시 시도해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (values: RegisterValues) => {
    setIsRegistering(true);
    try {
      await signIn();
      const existingSchool = await getSchoolByName(values.school);

      if (existingSchool) {
        toast({ variant: 'destructive', title: '등록 실패', description: '이미 등록된 학교 이름입니다. 다른 이름을 사용해주세요.' });
        setIsRegistering(false);
        return;
      }

      await initializeData(values.school, values.password);
      
      login('teacher', { name: '교사', school: values.school });

      toast({
        title: '등록 성공',
        description: `${values.school}이(가) 성공적으로 등록되었습니다. 초기 데이터가 설정됩니다.`
      });

      setIsRegisterDialogOpen(false);
      router.push('/teacher/dashboard');

    } catch (error) {
      console.error("Registration failed: ", error);
      toast({
        variant: 'destructive',
        title: '등록 실패',
        description: '오류가 발생했습니다. 다시 시도해주세요.',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleIconClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svgElement = e.currentTarget.outerHTML;
    const blob = new Blob([svgElement], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rocket-icon.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-4 mb-8 text-4xl font-bold text-primary">
        <a href="#" title="Download Rocket Icon">
          <Rocket className="w-12 h-12 cursor-pointer" onClick={handleIconClick} />
        </a>
        <h1 className="font-headline">체육 성장 기록 시스템</h1>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>교사 로그인</CardTitle>
          <CardDescription>
            등록된 학교 이름과 비밀번호로 로그인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleTeacherLogin)} className="space-y-4">
              <FormField
                control={loginForm.control}
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
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                로그인
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col items-center gap-4">
           <div className="text-center text-sm text-muted-foreground">
             학교가 아직 등록되지 않았나요?
           </div>
           
           <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
              <DialogTrigger asChild>
                 <Button variant="outline" className="w-full">신규 학교 등록하기</Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>신규 학교 등록</DialogTitle>
                      <DialogDescription>
                          새로운 학교를 등록하고 교사 계정을 생성합니다.
                      </DialogDescription>
                  </DialogHeader>
                  <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                          <FormField
                              control={registerForm.control}
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
                              control={registerForm.control}
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
                              control={registerForm.control}
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
                          <DialogFooter>
                              <DialogClose asChild>
                                  <Button type="button" variant="outline">취소</Button>
                              </DialogClose>
                              <Button type="submit" disabled={isRegistering}>
                                  {isRegistering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  등록 및 로그인
                              </Button>
                          </DialogFooter>
                      </form>
                  </Form>
              </DialogContent>
           </Dialog>

           <Separator className="my-4" />
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
