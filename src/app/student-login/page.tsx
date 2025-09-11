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
import { Loader2, Rocket } from 'lucide-react';
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

export default function StudentLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleStudentLogin = async (values: StudentLoginValues) => {
    setIsSubmitting(true);
    try {
      await initializeData(values.school);
      const student = await getStudent(values);

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
    } catch (error) {
      console.error("Login failed: ", error);
      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: '데이터베이스 연결 중 오류가 발생했습니다. 다시 시도해주세요.',
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
                render={({ field }) autofocus => (
                  <FormItem>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 홍길동" {...field} />
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
                    '학생으로 로그인'
                  )
                }
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
