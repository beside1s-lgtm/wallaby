
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * @fileOverview 매치 ID만 전달된 경우를 위한 폴백 페이지입니다.
 */
export default function GenericMatchFallbackPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/teacher/dashboard?tab=competition')} size="icon">
          <ArrowLeft />
        </Button>
        <h1 className="text-3xl font-bold">경기 상세 정보</h1>
      </div>
      <Card className="p-6">
        <p className="text-muted-foreground mb-4">경기 ID: {id}</p>
        <p>상세 기록을 확인하시려면 종목 정보가 포함된 링크를 이용해 주세요.</p>
        <Button className="mt-4" onClick={() => router.push('/teacher/dashboard?tab=competition')}>
          대회 목록으로 돌아가기
        </Button>
      </Card>
    </div>
  );
}
