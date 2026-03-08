
'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Save, Printer, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect, useMemo } from 'react';
import { getTournaments, getStudents, addOrUpdateRecords } from '@/lib/store';
import { Tournament, Student, Team, MeasurementRecord } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type StatCategory = 'attack' | 'pass' | 'catch' | 'dodge';
type PlayerStats = { [key in StatCategory]: number };
type SetStats = Record<string, PlayerStats>;
type MatchStats = Record<string, SetStats>;

export default function DodgeballMatchPage() {
  const params = useParams();
  const router = useRouter();
  const { school } = useAuth();
  const { toast } = useToast();
  const matchId = params.matchId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<any | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSet, setSelectedSet] = useState('1');
  
  const [rosters, setRosters] = useState<Record<string, Student[]>>({});
  const [matchStats, setMatchStats] = useState<MatchStats>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printView, setPrintView] = useState('final');

  useEffect(() => {
    async function fetchData() {
      if (!school || !matchId) return;
      setIsLoading(true);
      try {
        const tournaments = await getTournaments(school);
        let foundMatch: any = null;
        const parentT = tournaments.find(t => {
          const m = t.matches.find(m => m.id === matchId);
          if (m) { foundMatch = m; return true; }
          return false;
        });

        if (parentT && foundMatch) {
          setTournament(parentT);
          setMatch(foundMatch);
          const tA = parentT.teams.find(t => t.id === foundMatch.teamAId);
          const tB = parentT.teams.find(t => t.id === foundMatch.teamBId);
          setTeamA(tA || null); setTeamB(tB || null);
          if (tA) setSelectedTeamId(tA.id);
          const allStudents = await getStudents(school);
          const sMap = new Map(allStudents.map(s => [s.id, s]));
          const newRosters: Record<string, Student[]> = {};
          if (tA?.memberIds) newRosters[tA.id] = tA.memberIds.map(id => sMap.get(id)).filter((s): s is Student => !!s);
          if (tB?.memberIds) newRosters[tB.id] = tB.memberIds.map(id => sMap.get(id)).filter((s): s is Student => !!s);
          setRosters(newRosters);
        }
      } finally { setIsLoading(false); }
    }
    fetchData();
  }, [school, matchId, toast]);
  
  const currentRoster = useMemo(() => rosters[selectedTeamId] || [], [rosters, selectedTeamId]);

  useEffect(() => {
    setMatchStats(prev => {
      const next = { ...prev };
      const current = next[selectedSet] || {};
      let changed = false;
      currentRoster.forEach(p => {
        if (!current[p.id]) {
          current[p.id] = { attack: 0, pass: 0, catch: 0, dodge: 0 };
          changed = true;
        }
      });
      if (changed) { next[selectedSet] = current; return next; }
      return prev;
    });
  }, [selectedSet, currentRoster]);

  const handleStatChange = (playerId: string, category: StatCategory, value: string) => {
    const num = parseInt(value, 10);
    setMatchStats(prev => {
      const next = { ...prev };
      const currentSet = { ...(next[selectedSet] || {}) };
      const ps = { ...(currentSet[playerId] || { attack: 0, pass: 0, catch: 0, dodge: 0 }) };
      ps[category] = isNaN(num) ? 0 : num;
      currentSet[playerId] = ps;
      next[selectedSet] = currentSet;
      return next;
    });
  };

  const handleSave = async () => {
    if (!school || !tournament) return;
    setIsSubmitting(true);
    const recordsToSave: any[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const catToItem: Record<StatCategory, string> = { attack: '공격성공', pass: '패스성공', catch: '포구', dodge: '회피성공' };
    const multiplier: Record<StatCategory, number> = { attack: 2, pass: 1, catch: 2, dodge: 1 };
    const currentSetStats = matchStats[selectedSet];
    if (!currentSetStats) { setIsSubmitting(false); return; }
    currentRoster.forEach(p => {
      const ps = currentSetStats[p.id];
      if (ps) (Object.keys(ps) as StatCategory[]).forEach(cat => {
        if (ps[cat] > 0) recordsToSave.push({ studentId: p.id, school, item: catToItem[cat], value: ps[cat] * multiplier[cat], date: recordDate });
      });
    });
    try {
      if(recordsToSave.length > 0) await addOrUpdateRecords(school, currentRoster, recordsToSave);
      toast({ title: '저장 완료' });
    } finally { setIsSubmitting(false); }
  };
  
  const handleGoBack = () => router.push('/teacher/dashboard?tab=competition');

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!tournament || !match) return <div className="container mx-auto p-8"><Button variant="outline" onClick={handleGoBack} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> 뒤로 가기</Button></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
      <div className="flex items-center gap-4 mb-4 print-hidden">
        <Button variant="ghost" onClick={handleGoBack} size="icon"><ArrowLeft /></Button>
        <h1 className="text-3xl font-bold">피구 경기 기록지</h1>
      </div>
      <Card className="mb-6 print-hidden">
        <CardContent className="p-4 flex flex-wrap gap-4">
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent>{teamA && <SelectItem value={teamA.id}>{teamA.name}</SelectItem>}{teamB && <SelectItem value={teamB.id}>{teamB.name}</SelectItem>}</SelectContent></Select>
          <Select value={selectedSet} onValueChange={setSelectedSet}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1세트</SelectItem><SelectItem value="2">2세트</SelectItem><SelectItem value="3">3세트</SelectItem></SelectContent></Select>
          <Button onClick={() => window.print()} className="ml-auto"><Printer className="w-4 h-4 mr-2" />인쇄</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>선수명</TableHead><TableHead className="text-center border-l">공격 성공</TableHead><TableHead className="text-center border-l">패스 성공</TableHead><TableHead className="text-center border-l">포구</TableHead><TableHead className="text-center border-l">회피 성공</TableHead></TableRow></TableHeader>
            <TableBody>
              {currentRoster.map(p => {
                const ps = (matchStats[selectedSet] || {})[p.id];
                if (!ps) return null;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    {(['attack', 'pass', 'catch', 'dodge'] as StatCategory[]).map(cat => (
                      <TableCell key={cat} className="border-l">
                        <Input type="number" className="h-8 text-center" value={ps[cat] || ''} onChange={e => handleStatChange(p.id, cat, e.target.value)} />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end mt-6 print-hidden"><Button onClick={handleSave} disabled={isSubmitting}><Save className="mr-2 h-4 w-4" />기록 저장</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
