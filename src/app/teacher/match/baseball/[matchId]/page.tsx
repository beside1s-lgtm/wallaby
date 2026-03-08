
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

type StatCategory = 'batting' | 'baserunning' | 'throwing' | 'catching';
type PlayerStats = { [key in StatCategory]: { attempt: number, success: number } };
type InningStats = Record<string, PlayerStats>;
type MatchStats = Record<string, InningStats>;

export default function BaseballMatchPage() {
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
  const [selectedInning, setSelectedInning] = useState('1');
  
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
      const newStats = { ...prev };
      const current = newStats[selectedInning] || {};
      let changed = false;
      currentRoster.forEach(p => {
        if (!current[p.id]) {
          current[p.id] = { batting: { attempt: 0, success: 0 }, baserunning: { attempt: 0, success: 0 }, throwing: { attempt: 0, success: 0 }, catching: { attempt: 0, success: 0 } };
          changed = true;
        }
      });
      if (changed) { newStats[selectedInning] = current; return newStats; }
      return prev;
    });
  }, [selectedInning, currentRoster]);

  const handleStatChange = (playerId: string, category: StatCategory, type: 'attempt' | 'success', value: string) => {
    const num = parseInt(value, 10);
    setMatchStats(prev => {
      const next = { ...prev };
      const currentInning = { ...(next[selectedInning] || {}) };
      const ps = { ...(currentInning[playerId] || { batting: { attempt: 0, success: 0 }, baserunning: { attempt: 0, success: 0 }, throwing: { attempt: 0, success: 0 }, catching: { attempt: 0, success: 0 } }) };
      ps[category] = { ...ps[category], [type]: isNaN(num) ? 0 : num };
      currentInning[playerId] = ps;
      next[selectedInning] = currentInning;
      return next;
    });
  };

  const handleSave = async () => {
    if (!school || !tournament) return;
    setIsSubmitting(true);
    const recordsToSave: any[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const catToItem: Record<StatCategory, string> = { batting: '타격', baserunning: '주루', throwing: '송구', catching: '포구' };
    const currentInningStats = matchStats[selectedInning];
    if (!currentInningStats) { setIsSubmitting(false); return; }
    currentRoster.forEach(p => {
      const ps = currentInningStats[p.id];
      if (ps) (Object.keys(ps) as StatCategory[]).forEach(cat => {
        if (ps[cat].attempt > 0) recordsToSave.push({ studentId: p.id, school, item: catToItem[cat], value: Math.round((ps[cat].success / ps[cat].attempt) * 10), date: recordDate });
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
        <h1 className="text-3xl font-bold">야구 경기 기록지</h1>
      </div>
      <Card className="mb-6 print-hidden">
        <CardContent className="p-4 flex flex-wrap gap-4">
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent>{teamA && <SelectItem value={teamA.id}>{teamA.name}</SelectItem>}{teamB && <SelectItem value={teamB.id}>{teamB.name}</SelectItem>}</SelectContent></Select>
          <Select value={selectedInning} onValueChange={setSelectedInning}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5,6,7,8,9].map(i => <SelectItem key={i} value={String(i)}>{i}회</SelectItem>)}</SelectContent></Select>
          <Button onClick={() => window.print()} className="ml-auto"><Printer className="w-4 h-4 mr-2" />인쇄</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>선수명</TableHead><TableHead colSpan={2} className="text-center border-l">타격</TableHead><TableHead colSpan={2} className="text-center border-l">주루</TableHead><TableHead colSpan={2} className="text-center border-l">송구</TableHead><TableHead colSpan={2} className="text-center border-l">포구</TableHead></TableRow></TableHeader>
            <TableBody>
              {currentRoster.map(p => {
                const ps = (matchStats[selectedInning] || {})[p.id];
                if (!ps) return null;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    {(['batting', 'baserunning', 'throwing', 'catching'] as StatCategory[]).map(cat => (
                      <React.Fragment key={cat}>
                        <TableCell className="border-l"><Input type="number" className="h-8 text-center" value={ps[cat].attempt || ''} onChange={e => handleStatChange(p.id, cat, 'attempt', e.target.value)} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-center" value={ps[cat].success || ''} onChange={e => handleStatChange(p.id, cat, 'success', e.target.value)} /></TableCell>
                      </React.Fragment>
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
