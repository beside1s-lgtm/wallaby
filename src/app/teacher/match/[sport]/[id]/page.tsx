
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getTournaments } from '@/lib/store';
import { Tournament } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function GenericMatchPage() {
  const params = useParams();
  const router = useRouter();
  const { school } = useAuth();
  const id = params.id as string;
  const sport = params.sport as string;

  const [isLoading, setIsLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<any | null>(null);

  useEffect(() => {
    async function load() {
      if (!school || !id) return;
      try {
        const tournaments = await getTournaments(school);
        let foundMatch = null;
        const parentT = tournaments.find(t => {
          const m = t.matches.find(m => m.id === id);
          if (m) {
            foundMatch = m;
            return true;
          }
          return false;
        });
        if (parentT && foundMatch) {
          setTournament(parentT);
          setMatch(foundMatch);
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [school, id]);

  const handleGoBack = () => {
    router.push('/teacher/dashboard?tab=competition');
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={handleGoBack} size="icon"><ArrowLeft /></Button>
        <div>
          <h1 className="text-3xl font-bold">경기 상세 기록</h1>
          <p className="text-muted-foreground">{sport?.toUpperCase() || '일반'} 종목 기록지</p>
        </div>
      </div>

      <Card className="border-2 border-dashed">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black text-primary">'{sport}' 기록지 준비 중</CardTitle>
          <CardDescription>해당 종목의 전용 기록지 인터페이스를 준비하고 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-12 gap-6">
          <div className="bg-muted p-6 rounded-full">
            <Info className="h-16 w-16 text-muted-foreground opacity-20" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <p className="font-bold">현재 축구, 농구, 배구, 야구, 피구 종목의 전용 기록지가 활성화되어 있습니다.</p>
            <p className="text-sm text-muted-foreground">이 종목은 일반적인 경기 결과(승패 및 점수)를 대회 관리 화면에서 직접 입력해주시기 바랍니다.</p>
          </div>
          <Button onClick={handleGoBack} className="mt-4">대회 관리로 돌아가기</Button>
        </CardContent>
      </Card>
    </div>
  );
}
