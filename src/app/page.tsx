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
import { Rocket } from 'lucide-react';
import { initializeData } from '@/lib/store';

const teacherLoginSchema = z.object({
  school: z.string().min(1, '학교 이름을 입력해주세요.'),
});

type TeacherLoginValues = z.infer<typeof teacherLoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

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
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                교사로 로그인
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
