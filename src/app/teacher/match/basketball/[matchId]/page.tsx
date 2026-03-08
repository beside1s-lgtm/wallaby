
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

type StatCategory = 'shot' | 'assist' | 'rebound' | 'steal';
type PlayerStats = { [key in StatCategory]: number };
type QuarterStats = Record<string, PlayerStats>;
type MatchStats = Record<string, QuarterStats>;

export default function BasketballMatchPage() {
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
  const [selectedQuarter, setSelectedQuarter] = useState('1');
  
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
          if (m) {
            foundMatch = m;
            return true;
          }
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
      const currentQuarterStats = newStats[selectedQuarter] || {};
      let changed = false;
      currentRoster.forEach(player => {
        if (!currentQuarterStats[player.id]) {
          currentQuarterStats[player.id] = { shot: 0, assist: 0, rebound: 0, steal: 0 };
          changed = true;
        }
      });
      if (changed) { newStats[selectedQuarter] = currentQuarterStats; return newStats; }
      return prevStats;
    });
  }, [selectedQuarter, currentRoster]);

  const handleStatChange = (playerId: string, category: StatCategory, value: string) => {
    const numValue = parseInt(value, 10);
    setMatchStats(prev => {
      const newMatchStats = { ...prev };
      const newQuarterStats = { ...(newMatchStats[selectedQuarter] || {}) };
      const newPlayerStats = { ...(newQuarterStats[playerId] || { shot: 0, assist: 0, rebound: 0, steal: 0 }) };
      newPlayerStats[category] = isNaN(numValue) ? 0 : numValue;
      newQuarterStats[playerId] = newPlayerStats;
      newMatchStats[selectedQuarter] = newQuarterStats;
      return newMatchStats;
    });
  };

  const displayedStats = useMemo(() => {
    if (printView === 'final') {
      const finalStats: Record<string, PlayerStats> = {};
      currentRoster.forEach(player => { finalStats[player.id] = { shot: 0, assist: 0, rebound: 0, steal: 0 }; });
      Object.values(matchStats).forEach(quarterStats => {
        currentRoster.forEach(player => {
          const playerQuarterStats = quarterStats[player.id];
          if (playerQuarterStats) (Object.keys(finalStats[player.id]) as StatCategory[]).forEach(cat => { finalStats[player.id][cat] += playerQuarterStats[cat]; });
        });
      });
      return finalStats;
    }
    return matchStats[printView] || {};
  }, [printView, matchStats, currentRoster]);

  const tableTotals = useMemo(() => {
    const statsToTotal = printView === 'final' ? displayedStats : (matchStats[selectedQuarter] || {});
    const totals: PlayerStats = { shot: 0, assist: 0, rebound: 0, steal: 0 };
    currentRoster.forEach(player => {
      const playerStats = statsToTotal[player.id];
      if (playerStats) (Object.keys(totals) as StatCategory[]).forEach(cat => { totals[cat] += playerStats[cat]; });
    });
    return totals;
  }, [selectedQuarter, matchStats, currentRoster, printView, displayedStats]);

  const handleSave = async () => {
    if (!school || !tournament) return;
    setIsSubmitting(true);
    const recordsToSave: any[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const categoryToItemName: Record<StatCategory, string> = { shot: '슛', assist: '어시스트', rebound: '리바운드', steal: '스틸' };
    const multiplier: Record<StatCategory, number> = { shot: 2, assist: 1, rebound: 1, steal: 1 };
    const currentQuarterPlayerStats = matchStats[selectedQuarter];
    if (!currentQuarterPlayerStats) { setIsSubmitting(false); return; }
    currentRoster.forEach(player => {
      const playerStats = currentQuarterPlayerStats[player.id];
      if (playerStats) (Object.keys(playerStats) as StatCategory[]).forEach(cat => {
        if (playerStats[cat] > 0) recordsToSave.push({ studentId: player.id, school, item: categoryToItemName[cat], value: playerStats[cat] * multiplier[cat], date: recordDate });
      });
    });
    try {
      if(recordsToSave.length > 0) await addOrUpdateRecords(school, currentRoster, recordsToSave);
      toast({ title: '기록 저장 완료' });
    } finally { setIsSubmitting(false); }
  };
  
  const handleGoBack = () => router.push('/teacher/dashboard?tab=competition');

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!tournament || !match) return <div className="container mx-auto p-8"><Button variant="outline" onClick={handleGoBack} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> 뒤로 가기</Button></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
      <div className="flex items-center gap-4 mb-4 print-hidden">
        <Button variant="ghost" onClick={handleGoBack} size="icon"><ArrowLeft /></Button>
        <h1 className="text-3xl font-bold">농구 경기 기록지</h1>
      </div>
      <Card className="mb-6 print-hidden">
        <CardContent className="p-4 flex flex-wrap gap-4">
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent>{teamA && <SelectItem value={teamA.id}>{teamA.name}</SelectItem>}{teamB && <SelectItem value={teamB.id}>{teamB.name}</SelectItem>}</SelectContent></Select>
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1쿼터</SelectItem><SelectItem value="2">2쿼터</SelectItem><SelectItem value="3">3쿼터</SelectItem><SelectItem value="4">4쿼터</SelectItem></SelectContent></Select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select value={printView} onValueChange={setPrintView}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="final">최종 합계</SelectItem><SelectItem value="1">1쿼터</SelectItem><SelectItem value="2">2쿼터</SelectItem><SelectItem value="3">3쿼터</SelectItem><SelectItem value="4">4쿼터</SelectItem></SelectContent></Select>
            <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />인쇄</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>선수명</TableHead><TableHead className="text-center border-l">슛</TableHead><TableHead className="text-center border-l">어시스트</TableHead><TableHead className="text-center border-l">리바운드</TableHead><TableHead className="text-center border-l">스틸</TableHead></TableRow></TableHeader>
            <TableBody>
              {currentRoster.map(player => {
                const ps = (matchStats[selectedQuarter] || {})[player.id] || { shot: 0, assist: 0, rebound: 0, steal: 0 };
                const dps = displayedStats[player.id] || { shot: 0, assist: 0, rebound: 0, steal: 0 };
                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-semibold">{player.name}</TableCell>
                    {(['shot', 'assist', 'rebound', 'steal'] as StatCategory[]).map(cat => (
                      <TableCell key={cat} className="border-l">
                        <Input type="number" className="h-8 text-center print-hidden" value={ps[cat] || ''} onChange={e => handleStatChange(player.id, cat, e.target.value)} />
                        <span className="print-only hidden">{dps[cat]}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
              <TableRow className="bg-muted font-bold"><TableCell className="text-center">합계</TableCell><TableCell className="text-center border-l">{tableTotals.shot}</TableCell><TableCell className="text-center border-l">{tableTotals.assist}</TableCell><TableCell className="text-center border-l">{tableTotals.rebound}</TableCell><TableCell className="text-center border-l">{tableTotals.steal}</TableCell></TableRow>
            </TableBody>
          </Table>
          <div className="flex justify-end mt-6 print-hidden"><Button onClick={handleSave} disabled={isSubmitting}><Save className="mr-2 h-4 w-4" />기록 저장</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
