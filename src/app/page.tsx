"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Loader2, Settings, School, Lock, ArrowRight } from 'lucide-react';
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
  const { login, role } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);

  useEffect(() => {
    if (role === 'teacher') router.replace('/teacher/dashboard');
    if (role === 'student') router.replace('/student/dashboard');
  }, [role, router]);

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
      const schoolData = await getSchoolByName(values.school);

      if (!schoolData) {
        toast({ variant: 'destructive', title: '로그인 실패', description: '등록되지 않은 학교입니다. 신규 등록을 진행해주세요.' });
        setIsSubmitting(false);
        return;
      }
      
      if (!schoolData.password) {
        toast({ variant: 'destructive', title: '로그인 실패', description: '비밀번호가 설정되지 않은 학교입니다. 관리자에게 문의하세요.' });
        setIsSubmitting(false);
        return;
      }

      if (schoolData.password !== values.password) {
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

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background with blurry accents */}
      <div className="absolute inset-0 bg-transparent z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md z-10"
      >
        <div className="flex flex-col items-center gap-6 mb-10 text-center">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125" />
              <Image src="/200x200.png" alt="Logo" width={96} height={96} className="relative rounded-3xl shadow-2xl border-4 border-background/50" />
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <h1 className="text-3xl sm:text-4xl font-black text-primary font-headline tracking-tight mb-2">체육 성장 기록 시스템</h1>
              <p className="text-muted-foreground font-medium text-lg italic">"데이터로 열어가는 아이들의 건강한 내일"</p>
            </motion.div>
        </div>

        <Card className="premium-card overflow-hidden transition-all duration-300">
            <CardHeader className="space-y-1 pb-6 text-center border-b border-border/50 bg-primary/[0.03]">
              <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                <School className="h-6 w-6 text-primary" />
                교사 대시보드 로그인
              </CardTitle>
              <CardDescription className="text-base">학교 관리를 위해 교사 계정 정보를 입력하세요.</CardDescription>
            </CardHeader>
            <CardContent className="pt-10">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleTeacherLogin)} className="space-y-6">
                <FormField
                    control={loginForm.control}
                    name="school"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">학교 명칭</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <School className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input placeholder="예: 서울송정초등학교" className="pl-12 h-14 rounded-2xl text-lg bg-background border-border/60 focus-visible:ring-primary focus-visible:border-primary shadow-inner" {...field} />
                          </div>
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
                        <FormLabel className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">관리 비밀번호</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input type="password" placeholder="••••••••" className="pl-12 h-14 rounded-2xl text-lg bg-background border-border/60 focus-visible:ring-primary focus-visible:border-primary shadow-inner" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-lg font-black text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.03] active:scale-95 group" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin text-white" /> : "로그인"}
                    {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex-col items-center gap-8 bg-muted/20 border-t border-border/50 py-10">
              <div className="flex flex-col items-center gap-4 w-full">
                <p className="text-sm font-bold text-muted-foreground">새로운 학교이신가요?</p>
                <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full h-12 rounded-2xl border-2 border-primary/20 bg-background/50 hover:bg-primary/5 hover:text-primary font-black transition-all">신규 학교 시스템 등록</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px] rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black font-headline text-primary">신규 학교 시스템 등록</DialogTitle>
                            <DialogDescription className="text-base pt-2">
                                학교를 등록하면 독자적인 학생 체력 관리 DB와 분석 대시보드가 즉시 제공됩니다.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...registerForm}>
                            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-5 pt-6">
                                <FormField
                                    control={registerForm.control}
                                    name="school"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-black text-sm text-muted-foreground">학교 정식 명칭</FormLabel>
                                            <FormControl>
                                                <Input placeholder="예: 서울OO초등학교" className="h-12 rounded-xl bg-muted/30" {...field} />
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
                                            <FormLabel className="font-black text-sm text-muted-foreground">사용할 관리 비밀번호 (4자 이상)</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="학교 관리용 비밀번호를 설정하세요." className="h-12 rounded-xl bg-muted/30" {...field} />
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
                                            <FormLabel className="font-black text-sm text-muted-foreground">비밀번호 확인</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="설정한 비밀번호를 다시 입력하세요." className="h-12 rounded-xl bg-muted/30" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="pt-8">
                                    <DialogClose asChild>
                                        <Button type="button" variant="ghost" className="font-bold">취소</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isRegistering} className="h-12 px-8 bg-primary hover:bg-primary/90 font-black rounded-xl">
                                        {isRegistering ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "학교 등록 완료"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
              </div>
              
              <div className="w-full space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><Separator /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-muted-foreground font-black">또는</span></div>
                </div>
                
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-bold text-muted-foreground">학생으로 접속하여 기록을 확인하세요.</p>
                  <Button asChild variant="link" className="w-full text-xl font-black text-primary hover:scale-[1.05] transition-transform hover:no-underline flex items-center justify-center gap-1">
                      <Link href="/student-login">
                         학생 로그인 바로가기
                         <ArrowRight className="h-6 w-6" />
                      </Link>
                  </Button>
                </div>
              </div>
            </CardFooter>
        </Card>
      </motion.div>

      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1, duration: 1 }}
        className="mt-16 text-muted-foreground text-xs font-bold tracking-widest uppercase z-10"
      >
        © 2026 PE Record AI Solution • All Rights Reserved
      </motion.footer>

      <div className="fixed bottom-8 right-8 z-20">
          <Link href="/admin">
              <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-background/50 backdrop-blur-md border border-border/50 hover:bg-primary/10 hover:text-primary transition-all">
                  <Settings className="h-6 w-6" />
              </Button>
          </Link>
      </div>
    </div>
  );
}
