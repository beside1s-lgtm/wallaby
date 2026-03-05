
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords, Users } from 'lucide-react';

export function CompetitionTab({ tournament }: any) {
  return (
    <div className="space-y-8 mt-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Swords />나의 대회</CardTitle></CardHeader>
        <CardContent className="text-center py-12 text-muted-foreground">
          {tournament ? <p>{tournament.name}가 진행 중입니다.</p> : <p>참가 중인 대회가 없습니다.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users />나의 팀</CardTitle></CardHeader>
        <CardContent className="text-center py-8">팀 정보가 표시됩니다.</CardContent>
      </Card>
    </div>
  );
}
