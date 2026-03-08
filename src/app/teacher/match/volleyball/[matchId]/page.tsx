
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

type StatCategory = 'spike' | 'receive' | 'toss' | 'serve';
type PlayerStats = { [key in StatCategory]: { attempt: number, success: number } };
type SetStats = Record<string, PlayerStats>;
type MatchStats = Record<string, SetStats>;

export default function VolleyballMatchPage() {
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
        const parentTournament = tournaments.find(t => {
          const m = t.matches.find(m => m.id === matchId);
          if (m) { foundMatch = m; return true; }
          return false;
        });

        if (parentTournament && foundMatch) {
          setTournament(parentTournament);
          setMatch(foundMatch);
          const teamAData = parentTournament.teams.find(t => t.id === foundMatch.teamAId);
          const teamBData = parentTournament.teams.find(t => t.id === foundMatch.teamBId);
          setTeamA(teamAData || null);
          setTeamB(teamBData || null);
          if (teamAData) setSelectedTeamId(teamAData.id);
          const allStudents = await getStudents(school);
          const studentMap = new Map(allStudents.map(s => [s.id, s]));
          const newRosters: Record<string, Student[]> = {};
          if (teamAData?.memberIds) newRosters[teamAData.id] = teamAData.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s);
          if (teamBData?.memberIds) newRosters[teamBData.id] = teamBData.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s);
          setRosters(newRosters);
        }
      } finally { setIsLoading(false); }
    }
    fetchData();
  }, [school, matchId, toast]);
  
  const currentRoster = useMemo(() => rosters[selectedTeamId] || [], [rosters, selectedTeamId]);

  useEffect(() => {
    setMatchStats(prevStats => {
      const newStats = { ...prevStats };
      const currentSetStats = newStats[selectedSet] || {};
      let changed = false;
      currentRoster.forEach(player => {
        if (!currentSetStats[player.id]) {
          currentSetStats[player.id] = { spike: { attempt: 0, success: 0 }, receive: { attempt: 0, success: 0 }, toss: { attempt: 0, success: 0 }, serve: { attempt: 0, success: 0 } };
          changed = true;
        }
      });
      if (changed) { newStats[selectedSet] = currentSetStats; return newStats; }
      return prevStats;
    });
  }, [selectedSet, currentRoster]);

  const handleStatChange = (playerId: string, category: StatCategory, type: 'attempt' | 'success', value: string) => {
    const numValue = parseInt(value, 10);
    setMatchStats(prev => {
      const newMatchStats = { ...prev };
      const newSetStats = { ...(newMatchStats[selectedSet] || {}) };
      const newPlayerStats = { ...(newSetStats[playerId] || { spike: { attempt: 0, success: 0 }, receive: { attempt: 0, success: 0 }, toss: { attempt: 0, success: 0 }, serve: { attempt: 0, success: 0 } }) };
      newPlayerStats[category] = { ...newPlayerStats[category], [type]: isNaN(numValue) ? 0 : numValue };
      newSetStats[playerId] = newPlayerStats;
      newMatchStats[selectedSet] = newSetStats;
      return newMatchStats;
    });
  };

  const displayedStats = useMemo(() => {
    if (printView === 'final') {
      const finalStats: Record<string, PlayerStats> = {};
      currentRoster.forEach(p => { finalStats[p.id] = { spike: { attempt: 0, success: 0 }, receive: { attempt: 0, success: 0 }, toss: { attempt: 0, success: 0 }, serve: { attempt: 0, success: 0 } }; });
      Object.values(matchStats).forEach(setStats => {
        currentRoster.forEach(p => {
          if (setStats[p.id]) (Object.keys(finalStats[p.id]) as StatCategory[]).forEach(cat => {
            finalStats[p.id][cat].attempt += setStats[p.id][cat].attempt;
            finalStats[p.id][cat].success += setStats[p.id][cat].success;
          });
        });
      });
      return finalStats;
    }
    return matchStats[printView] || {};
  }, [printView, matchStats, currentRoster]);

  const handleSave = async () => {
    if (!school || !tournament) return;
    setIsSubmitting(true);
    const recordsToSave: any[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const catToItem: Record<StatCategory, string> = { spike: '스파이크', receive: '리시브', toss: '토스', serve: '서브' };
    const currentSetPlayerStats = matchStats[selectedSet];
    if (!currentSetPlayerStats) { setIsSubmitting(false); return; }
    currentRoster.forEach(player => {
      const ps = currentSetPlayerStats[player.id];
      if (ps) (Object.keys(ps) as StatCategory[]).forEach(cat => {
        if (ps[cat].attempt > 0) recordsToSave.push({ studentId: player.id, school, item: catToItem[cat], value: Math.round((ps[cat].success / ps[cat].attempt) * 10), date: recordDate });
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
        <h1 className="text-3xl font-bold">배구 경기 기록지</h1>
      </div>
      <Card className="mb-6 print-hidden">
        <CardContent className="p-4 flex flex-wrap gap-4">
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent>{teamA && <SelectItem value={teamA.id}>{teamA.name}</SelectItem>}{teamB && <SelectItem value={teamB.id}>{teamB.name}</SelectItem>}</SelectContent></Select>
          <Select value={selectedSet} onValueChange={setSelectedSet}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1세트</SelectItem><SelectItem value="2">2세트</SelectItem><SelectItem value="3">3세트</SelectItem></SelectContent></Select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />인쇄</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>선수</TableHead><TableHead colSpan={2} className="text-center border-l">스파이크</TableHead><TableHead colSpan={2} className="text-center border-l">리시브</TableHead><TableHead colSpan={2} className="text-center border-l">토스</TableHead><TableHead colSpan={2} className="text-center border-l">서브</TableHead></TableRow></TableHeader>
            <TableBody>
              {currentRoster.map(player => {
                const ps = (matchStats[selectedSet] || {})[player.id];
                if (!ps) return null;
                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-semibold">{player.name}</TableCell>
                    {(['spike', 'receive', 'toss', 'serve'] as StatCategory[]).map(cat => (
                      <React.Fragment key={cat}>
                        <TableCell className="border-l"><Input type="number" className="h-8 text-center" value={ps[cat].attempt || ''} onChange={e => handleStatChange(player.id, cat, 'attempt', e.target.value)} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-center" value={ps[cat].success || ''} onChange={e => handleStatChange(player.id, cat, 'success', e.target.value)} /></TableCell>
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
