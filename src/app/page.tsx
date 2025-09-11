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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Rocket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStudent, initializeData } from '@/lib/store';

const studentLoginSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
  grade: z.string().min(1, '학년을 입력해주세요.'),
  classNum: z.string().min(1, '반을 입력해주세요.'),
  studentNum: z.string().min(1, '번호를 입력해주세요.'),
  name: z.string().min(1, '이름을 입력해주세요.'),
});

type StudentLoginValues = z.infer<typeof studentLoginSchema>;

const teacherLoginSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
});

type TeacherLoginValues = z.infer<typeof teacherLoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('teacher');

  const studentForm = useForm<StudentLoginValues>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: {
      school: '',
      grade: '',
      classNum: '',
      studentNum: '',
      name: '',
    },
  });

  const teacherForm = useForm<TeacherLoginValues>({
    resolver: zodResolver(teacherLoginSchema),
    defaultValues: {
      school: '',
    },
  });

  const handleTeacherLogin = (values: TeacherLoginValues) => {
    initializeData(values.school);
    login('teacher', { name: '교사', school: values.school }, values.school);
    router.push('/teacher/dashboard');
  };

  const handleStudentLogin = (values: StudentLoginValues) => {
    const student = getStudent(values);
    if (student) {
      login('student', student, values.school);
      router.push('/student/dashboard');
    } else {
      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: '학생 정보가 존재하지 않습니다. 학교 정보를 확인하거나 교사에게 문의하세요.',
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-4 mb-8 text-4xl font-bold text-primary">
        <Rocket className="w-12 h-12" />
        <h1 className="font-headline">체육 성장 기록 시스템</h1>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="teacher">교사</TabsTrigger>
          <TabsTrigger value="student">학생</TabsTrigger>
        </TabsList>
        <TabsContent value="teacher">
          <Card>
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
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                    교사로 로그인
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="student">
          <Card>
            <CardHeader>
              <CardTitle>학생 로그인</CardTitle>
              <CardDescription>
                개인 정보를 입력하여 기록을 확인하고 입력하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...studentForm}>
                <form
                  onSubmit={studentForm.handleSubmit(handleStudentLogin)}
                  className="space-y-4"
                >
                  <FormField
                    control={studentForm.control}
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
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={studentForm.control}
                      name="grade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>학년</FormLabel>
                          <FormControl>
                            <Input placeholder="예: 1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={studentForm.control}
                      name="classNum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>반</FormLabel>
                          <FormControl>
                            <Input placeholder="예: 3" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={studentForm.control}
                    name="studentNum"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>번호</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={studentForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>이름</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 홍길동" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                    학생으로 로그인
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
