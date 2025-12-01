'use client';

import { useParams } from 'next/navigation';

export default function SoccerMatchPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold">축구 경기 기록 페이지</h1>
      <p className="text-muted-foreground">경기 ID: {id}</p>
      {/* 여기에 축구 경기 기록을 입력하고 상세 정보를 표시하는 UI가 추가될 예정입니다. */}
    </div>
  );
}
