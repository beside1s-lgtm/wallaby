import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentManagement from './_components/StudentManagement';
import MeasurementManagement from './_components/MeasurementManagement';
import ClassAnalytics from './_components/ClassAnalytics';
import Ranking from './_components/Ranking';
import AiWelcome from './_components/AiWelcome';
import { Users, ClipboardList, BarChart3, Bot, Trophy } from 'lucide-react';
import { DashboardHeaderContents } from '@/components/DashboardHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';


export default function TeacherDashboardPage() {
  return (
    <>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <DashboardHeaderContents />
        
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot />
                    AI 수업 브리핑
                </CardTitle>
                <CardDescription>PAPS 종목 또는 기타 종목의 전체 평균 데이터를 기반으로 AI가 생성한 요약 및 조언을 확인하세요.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
                <AiWelcome itemType='paps' title="PAPS 종목 브리핑" />
                <AiWelcome itemType='custom' title="기타 종목 브리핑" />
            </CardContent>
        </Card>

        <Tabs defaultValue="class-analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 mb-6">
            <TabsTrigger value="class-analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              학급별 분석
            </TabsTrigger>
             <TabsTrigger value="ranking">
              <Trophy className="mr-2 h-4 w-4" />
              종목별 순위
            </TabsTrigger>
            <TabsTrigger value="students">
              <Users className="mr-2 h-4 w-4" />
              학생 관리
            </TabsTrigger>
            <TabsTrigger value="measurements">
              <ClipboardList className="mr-2 h-4 w-4" />
              측정 종목 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="class-analytics">
            <ClassAnalytics />
          </TabsContent>

          <TabsContent value="ranking">
            <Ranking />
          </TabsContent>

          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          <TabsContent value="measurements">
            <MeasurementManagement />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
