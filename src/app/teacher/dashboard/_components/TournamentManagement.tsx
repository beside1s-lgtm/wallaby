
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  getTournaments,
  updateTournament,
  saveTournament,
  deleteTournament,
} from '@/lib/store';
import { Tournament, Match, Team, TeamGroup, Student } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Trash2,
  RefreshCw,
  Swords,
  Printer,
  FileSpreadsheet,
  Trophy as TrophyIcon,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { v4 as uuidv4 } from 'uuid';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const nextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 1;
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
};

function generateTournamentBracket(teams: Team[]): { matches: Match[] } {
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  const numTeams = shuffledTeams.length;
  let allMatches: Match[] = [];

  if (numTeams < 2) return { matches: [] };

  const totalSlots = nextPowerOfTwo(numTeams);
  const numByes = totalSlots - numTeams;
  const numRound1Matches = (numTeams - numByes) / 2;

  const round1Matches: Match[] = [];
  const byeTeams = shuffledTeams.slice(0, numByes);
  const playingTeams = shuffledTeams.slice(numByes);

  for (let i = 0; i < numRound1Matches; i++) {
    const match: Match = {
      id: uuidv4(),
      round: 1,
      matchNumber: i + 1,
      teamAId: playingTeams[i * 2].id,
      teamBId: playingTeams[i * 2 + 1].id,
      scoresA: [0],
      scoresB: [0],
      winnerId: null,
      status: 'scheduled',
      nextMatchId: null,
      nextMatchSlot: null,
    };
    round1Matches.push(match);
  }
  allMatches.push(...round1Matches);

  let round2Entrants: ({ type: 'winner'; matchId: string } | { type: 'bye'; teamId: string })[] = [];
  round1Matches.forEach((match) => round2Entrants.push({ type: 'winner', matchId: match.id }));
  byeTeams.forEach((team) => round2Entrants.push({ type: 'bye', teamId: team.id }));

  const distributedEntrants = [];
  let byeIndex = 0;
  let winnerIndex = 0;
  const byeEntrants = round2Entrants.filter((e) => e.type === 'bye');
  const winnerEntrants = round2Entrants.filter((e) => e.type === 'winner');

  while (byeIndex < byeEntrants.length || winnerIndex < winnerEntrants.length) {
    if (winnerIndex < winnerEntrants.length) distributedEntrants.push(winnerEntrants[winnerIndex++]);
    if (byeIndex < byeEntrants.length) distributedEntrants.push(byeEntrants[byeIndex++]);
  }

  let currentRoundEntrants = distributedEntrants;
  let currentRound = 2;

  while (currentRoundEntrants.length > 1) {
    const nextRoundMatches: Match[] = [];
    for (let i = 0; i < currentRoundEntrants.length / 2; i++) {
      const entrantA = currentRoundEntrants[i * 2];
      const entrantB = currentRoundEntrants[i * 2 + 1];

      const newMatch: Match = {
        id: uuidv4(),
        round: currentRound,
        matchNumber: i + 1,
        teamAId: null,
        teamBId: null,
        scoresA: [0],
        scoresB: [0],
        winnerId: null,
        status: 'scheduled',
        nextMatchId: null,
        nextMatchSlot: null,
      };

      if (entrantA.type === 'bye') {
        newMatch.teamAId = entrantA.teamId;
      } else {
        const prevMatch = allMatches.find((m) => m.id === entrantA.matchId);
        if (prevMatch) {
          prevMatch.nextMatchId = newMatch.id;
          prevMatch.nextMatchSlot = 'A';
        }
      }

      if (entrantB.type === 'bye') {
        newMatch.teamBId = entrantB.teamId;
      } else {
        const prevMatch = allMatches.find((m) => m.id === entrantB.matchId);
        if (prevMatch) {
          prevMatch.nextMatchId = newMatch.id;
          prevMatch.nextMatchSlot = 'B';
        }
      }

      nextRoundMatches.push(newMatch);
    }
    allMatches.push(...nextRoundMatches);
    currentRoundEntrants = nextRoundMatches.map((m) => ({ type: 'winner', matchId: m.id }));
    currentRound++;
  }

  return { matches: allMatches };
}

function generateRoundRobinMatches(teams: Team[]): { matches: Match[] } {
  if (teams.length < 2) return { matches: [] };
  let matchPairs: [Team, Team][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchPairs.push([teams[i], teams[j]]);
    }
  }
  const allMatches: Match[] = matchPairs.map((pair, index) => ({
    id: uuidv4(),
    round: 1,
    matchNumber: index + 1,
    teamAId: pair[0].id,
    teamBId: pair[1].id,
    scoresA: [0],
    scoresB: [0],
    winnerId: null,
    status: 'scheduled',
    nextMatchId: null,
    nextMatchSlot: null,
  }));
  return { matches: allMatches };
}

interface TournamentManagementProps {
  onTournamentUpdate: () => void;
  allTeamGroups: TeamGroup[];
  allStudents: Student[];
}

export default function TournamentManagement({ onTournamentUpdate, allTeamGroups, allStudents }: TournamentManagementProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [selectedSport, setSelectedSport] = useState<Tournament['sport']>('soccer');
  const [tournamentType, setTournamentType] = useState<'tournament' | 'league'>('tournament');
  const [tournamentDate, setTournamentDate] = useState<Date | undefined>(new Date());
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState('');
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  
  const [isUpdatingMatch, setIsUpdatingMatch] = useState(false);

  useEffect(() => {
    async function load() {
      if (!school) return;
      setIsLoading(true);
      try {
        const data = await getTournaments(school);
        setTournaments(data);
      } finally { setIsLoading(false); }
    }
    load();
  }, [school]);

  const handleCreateTournament = async () => {
    if (!school || !tournamentName || !selectedTeamGroupId) {
      toast({ variant: 'destructive', title: '입력 부족', description: '이름, 종목, 팀 그룹을 모두 선택해주세요.' });
      return;
    }
    
    setIsLoading(true);
    try {
      const group = allTeamGroups.find(g => g.id === selectedTeamGroupId);
      if (!group) throw new Error("Team group not found");

      const teamsForBracket = group.teams.map((t, i) => ({ 
        ...t, 
        id: uuidv4(), 
        name: t.name || `${group.description} 팀 ${i+1}` 
      }));

      const { matches } = tournamentType === 'tournament' 
        ? generateTournamentBracket(teamsForBracket)
        : generateRoundRobinMatches(teamsForBracket);

      const newT = await saveTournament({
        school, 
        name: tournamentName, 
        sport: selectedSport,
        type: tournamentType, 
        teams: teamsForBracket, 
        matches,
        teamGroupId: selectedTeamGroupId,
        date: tournamentDate ? format(tournamentDate, 'yyyy-MM-dd') : undefined,
      });
      
      setTournaments([newT, ...tournaments]);
      setCurrentTournament(newT);
      setSelectedTournamentId(newT.id);
      toast({ title: "대회 생성 완료" });
      onTournamentUpdate();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '대회 생성 실패' });
    } finally { setIsLoading(false); }
  };

  const handleLoadTournament = (id: string) => {
    const t = tournaments.find(x => x.id === id);
    if (t) {
      setCurrentTournament(t);
      setSelectedTournamentId(t.id);
      setTournamentName(t.name);
      setSelectedSport(t.sport || 'soccer');
      setTournamentType(t.type);
    }
  };

  const handleDeleteTournament = async () => {
    if (!school || !selectedTournamentId) return;
    setIsLoading(true);
    try {
      await deleteTournament(school, selectedTournamentId);
      setTournaments(prev => prev.filter(t => t.id !== selectedTournamentId));
      setCurrentTournament(null);
      setSelectedTournamentId('');
      toast({ title: "대회 삭제 완료" });
      onTournamentUpdate();
    } catch (error) {
      console.error("Failed to delete tournament:", error);
      toast({ variant: 'destructive', title: "삭제 실패" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMatchScore = async (matchId: string, team: 'A' | 'B', value: string) => {
    if (!currentTournament) return;
    const score = parseInt(value) || 0;
    const updatedMatches = currentTournament.matches.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          [team === 'A' ? 'scoresA' : 'scoresB']: [score]
        };
      }
      return m;
    });
    setCurrentTournament({ ...currentTournament, matches: updatedMatches });
  };

  const handleCompleteMatch = async (matchId: string) => {
    if (!currentTournament || !school) return;
    setIsUpdatingMatch(true);
    
    try {
      const matchIndex = currentTournament.matches.findIndex(m => m.id === matchId);
      const match = currentTournament.matches[matchIndex];
      
      const scoreA = (match.scoresA || [0]).reduce((a, b) => a + b, 0);
      const scoreB = (match.scoresB || [0]).reduce((a, b) => a + b, 0);
      
      if (scoreA === scoreB && currentTournament.type === 'tournament') {
        toast({ variant: 'destructive', title: '무승부 불가', description: '토너먼트에서는 반드시 승자가 결정되어야 합니다.' });
        setIsUpdatingMatch(false);
        return;
      }

      const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId;
      const updatedMatch: Match = { ...match, winnerId, status: 'completed' };
      
      let newMatches = [...currentTournament.matches];
      newMatches[matchIndex] = updatedMatch;

      if (currentTournament.type === 'tournament' && updatedMatch.nextMatchId) {
        const nextMatchIndex = newMatches.findIndex(m => m.id === updatedMatch.nextMatchId);
        if (nextMatchIndex !== -1) {
          const nextMatch = { ...newMatches[nextMatchIndex] };
          if (updatedMatch.nextMatchSlot === 'A') {
            nextMatch.teamAId = winnerId;
          } else {
            nextMatch.teamBId = winnerId;
          }
          newMatches[nextMatchIndex] = nextMatch;
        }
      }

      await updateTournament(school, currentTournament.id, { matches: newMatches });
      setCurrentTournament({ ...currentTournament, matches: newMatches });
      toast({ title: '경기 결과 저장 완료' });
    } catch (e) {
      toast({ variant: 'destructive', title: '저장 실패' });
    } finally {
      setIsUpdatingMatch(false);
    }
  };

  const handleResetMatch = async (matchId: string) => {
    if (!currentTournament || !school) return;
    setIsUpdatingMatch(true);
    try {
      const newMatches = currentTournament.matches.map(m => {
        if (m.id === matchId) {
          return { ...m, winnerId: null, status: 'scheduled' as const, scoresA: [0], scoresB: [0] };
        }
        return m;
      });
      await updateTournament(school, currentTournament.id, { matches: newMatches });
      setCurrentTournament({ ...currentTournament, matches: newMatches });
      toast({ title: '경기 정보 초기화 완료' });
    } finally {
      setIsUpdatingMatch(false);
    }
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return '미정';
    return currentTournament?.teams.find(t => t.id === teamId)?.name || '알 수 없음';
  };

  const sportDisplayMap: Record<string, string> = {
    soccer: '축구',
    basketball: '농구',
    volleyball: '배구',
    baseball: '야구',
    dodgeball: '피구',
    etc: '일반'
  };

  return (
    <div className="space-y-6">
      <Card className="bg-transparent shadow-none border-none">
        <CardHeader>
          <CardTitle>대회 관리 및 실시간 기록</CardTitle>
          <CardDescription>종목별 대회를 생성하고, 경기 현장에서 바로 결과를 입력하여 대진표를 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2 items-center p-4 border rounded-md bg-muted/50">
            <Select onValueChange={handleLoadTournament} value={selectedTournamentId}>
              <SelectTrigger className="flex-1 min-w-[200px]"><SelectValue placeholder="진행 중인 대회 선택" /></SelectTrigger>
              <SelectContent>{tournaments.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setCurrentTournament(null); setSelectedTournamentId(''); setTournamentName(''); }}><RefreshCw className="mr-2 h-4 w-4" />새 대회 생성</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!selectedTournamentId || isLoading}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  대회 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>정말로 이 대회를 삭제하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    대회 정보와 모든 경기 기록이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {!currentTournament && (
            <div className="space-y-4 p-4 border rounded-md bg-card animate-in fade-in slide-in-from-top-2">
              <h3 className="font-bold text-lg">새로운 대회 만들기</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>대회 이름</Label>
                  <Input value={tournamentName} onChange={e => setTournamentName(e.target.value)} placeholder="예: 5학년 배구 리그" />
                </div>
                <div className="space-y-2">
                  <Label>종목 선택</Label>
                  <Select value={selectedSport} onValueChange={v => setSelectedSport(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soccer">축구</SelectItem>
                      <SelectItem value="basketball">농구</SelectItem>
                      <SelectItem value="volleyball">배구</SelectItem>
                      <SelectItem value="baseball">야구</SelectItem>
                      <SelectItem value="dodgeball">피구</SelectItem>
                      <SelectItem value="etc">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>대회 방식</Label>
                  <Select value={tournamentType} onValueChange={v => setTournamentType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tournament">토너먼트 (승자진출)</SelectItem>
                      <SelectItem value="league">리그 (풀리그)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>참가 팀 그룹</Label>
                  <Select value={selectedTeamGroupId} onValueChange={setSelectedTeamGroupId}>
                    <SelectTrigger><SelectValue placeholder="팀 그룹 선택" /></SelectTrigger>
                    <SelectContent>
                      {allTeamGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.description}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{tournamentDate ? format(tournamentDate, 'yyyy-MM-dd') : '날짜 선택'}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={tournamentDate} onSelect={setTournamentDate} initialFocus /></PopoverContent>
                </Popover>
                <Button onClick={handleCreateTournament} disabled={isLoading} className="px-8">대회 생성 및 대진표 확정</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {currentTournament && (
        <Card className="p-6 border-2 border-primary/10 shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <Badge variant="outline" className="mb-1">{sportDisplayMap[currentTournament.sport || 'etc']}</Badge>
              <h2 className="text-2xl font-black text-primary flex items-center gap-2">
                <TrophyIcon className="h-6 w-6 text-yellow-500" /> {currentTournament.name} 경기 관리
              </h2>
              <p className="text-sm text-muted-foreground font-medium">경기 점수를 입력하고 결과를 확정하세요. 각 경기의 [기록지] 버튼을 통해 상세 데이터를 기록할 수 있습니다.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />대진표 인쇄</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {currentTournament.matches.map(m => (
              <Card key={m.id} className={cn(
                "overflow-hidden transition-all border-2",
                m.status === 'completed' ? "bg-muted/30 border-muted" : "border-primary/10 hover:border-primary/30"
              )}>
                <div className="bg-muted/50 p-2 text-[10px] font-black uppercase tracking-widest flex justify-between items-center border-b">
                  <span>{currentTournament.type === 'tournament' ? `라운드 ${m.round} - 경기 ${m.matchNumber}` : `경기 ${m.matchNumber}`}</span>
                  {m.status === 'completed' && <Badge className="h-4 text-[8px] bg-green-600">종료</Badge>}
                </div>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className={cn(
                        "font-bold text-sm truncate flex-1",
                        m.winnerId === m.teamAId ? "text-primary" : "text-foreground/70"
                      )}>{getTeamName(m.teamAId)}</span>
                      <Input 
                        type="number" 
                        className="w-14 h-8 text-center font-black" 
                        value={m.scoresA?.[0] || 0} 
                        onChange={e => handleUpdateMatchScore(m.id, 'A', e.target.value)}
                        disabled={m.status === 'completed'}
                      />
                    </div>
                    <div className="flex items-center justify-center py-1 opacity-20"><Swords className="h-4 w-4" /></div>
                    <div className="flex justify-between items-center gap-2">
                      <span className={cn(
                        "font-bold text-sm truncate flex-1",
                        m.winnerId === m.teamBId ? "text-primary" : "text-foreground/70"
                      )}>{getTeamName(m.teamBId)}</span>
                      <Input 
                        type="number" 
                        className="w-14 h-8 text-center font-black" 
                        value={m.scoresB?.[0] || 0} 
                        onChange={e => handleUpdateMatchScore(m.id, 'B', e.target.value)}
                        disabled={m.status === 'completed'}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t mt-4">
                    {m.status === 'completed' ? (
                      <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => handleResetMatch(m.id)} disabled={isUpdatingMatch}>수정하기</Button>
                    ) : (
                      <Button variant="default" size="sm" className="flex-1 text-xs font-bold" onClick={() => handleCompleteMatch(m.id)} disabled={isUpdatingMatch || !m.teamAId || !m.teamBId}>경기 종료</Button>
                    )}
                    <Button variant="outline" size="sm" asChild className="px-2">
                      <Link href={`/teacher/match/${(currentTournament.sport || 'etc').toLowerCase()}/${m.id}`} title="상세 기록지 입력">
                        <FileSpreadsheet className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
