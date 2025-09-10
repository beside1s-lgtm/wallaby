import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentManagement from './_components/StudentManagement';
import MeasurementManagement from './_components/MeasurementManagement';
import Analytics from './_components/Analytics';
import AiWelcome from './_components/AiWelcome';
import { Users, ClipboardList, BarChart3 } from 'lucide-react';

export default function TeacherDashboardPage() {
  return (
    <>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <h1 className="text-3xl font-bold mb-6 text-primary font-headline">교사 대시보드</h1>
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6">
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              기록 조회 및 분석
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

          <TabsContent value="analytics">
            <Analytics />
          </TabsContent>

          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          <TabsContent value="measurements">
            <MeasurementManagement />
          </TabsContent>
        </Tabs>
      </div>
      <AiWelcome />
    </>
  );
}
