'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function BasketballMatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">농구 경기 기록 페이지</h1>
      </div>
      <p className="text-muted-foreground">경기 ID: {id}</p>
      {/* 여기에 농구 경기 기록을 입력하고 상세 정보를 표시하는 UI가 추가될 예정입니다. */}
    </div>
  );
}
