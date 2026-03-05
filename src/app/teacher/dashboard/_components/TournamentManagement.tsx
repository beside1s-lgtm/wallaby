
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  getTournaments,
  updateTournament,
  getStudents,
  saveTournament,
  deleteTournament,
} from '@/lib/store';
import { Tournament, Match, Team, TeamGroup, Student, IndividualLeagueParticipant } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Trash2,
  RefreshCw,
  Swords,
  Save,
  RotateCcw,
  Shuffle,
  Pencil,
  Plus,
  Send,
  Calendar as CalendarIcon,
  Crown,
  Medal,
  Trophy as TrophyIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { v4 as uuidv4 } from 'uuid';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

/* -------------------------------------------------------
 * Utils
 * ----------------------------------------------------- */
const nextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 1;
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
};

/* -------------------------------------------------------
 * Bracket/League Generation
 * ----------------------------------------------------- */
function generateTournamentBracket(teams: Team[], format: 'single-elimination' | 'double-elimination' = 'single-elimination'): { matches: Match[] } {
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
      scoresA: [],
      scoresB: [],
      winnerId: null,
      status: 'scheduled',
      nextMatchId: null,
      nextMatchSlot: null,
    };
    round1Matches.push(match);
  }
  allMatches.push(...round1Matches);

  let round2Entrants: (
    | { type: 'winner'; matchId: string }
    | { type: 'bye'; teamId: string }
  )[] = [];
  round1Matches.forEach((match) =>
    round2Entrants.push({ type: 'winner', matchId: match.id })
  );
  byeTeams.forEach((team) =>
    round2Entrants.push({ type: 'bye', teamId: team.id })
  );

  const distributedEntrants = [];
  let byeIndex = 0;
  let winnerIndex = 0;
  const byeEntrants = round2Entrants.filter((e) => e.type === 'bye');
  const winnerEntrants = round2Entrants.filter((e) => e.type === 'winner');

  while (byeIndex < byeEntrants.length || winnerIndex < winnerEntrants.length) {
    if (winnerIndex < winnerEntrants.length)
      distributedEntrants.push(winnerEntrants[winnerIndex++]);
    if (byeIndex < byeEntrants.length)
      distributedEntrants.push(byeEntrants[byeIndex++]);
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
        scoresA: [],
        scoresB: [],
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
        scoresA: [],
        scoresB: [],
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
  const [tournamentType, setTournamentType] = useState<'tournament' | 'league' | 'individual-league'>('tournament');
  const [tournamentFormat, setTournamentFormat] = useState<'single-elimination' | 'double-elimination'>('single-elimination');
  const [bestOf, setBestOf] = useState<1 | 3 | 5 | 7>(1);
  const [tournamentDate, setTournamentDate] = useState<Date | undefined>(new Date());
  const [teamSource, setTeamSource] = useState<'manual' | 'group'>('manual');
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState('');
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, { scoresA: string[]; scoresB: string[] }>>({});

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
    if (!school || !tournamentName) return;
    setIsLoading(true);
    try {
      let teamsForBracket: Team[] = [];
      if (teamSource === 'group' && selectedTeamGroupId) {
        const group = allTeamGroups.find(g => g.id === selectedTeamGroupId);
        if (group) teamsForBracket = group.teams.map((t, i) => ({ ...t, id: uuidv4(), name: `${t.name || `팀 ${i+1}`}` }));
      } else { teamsForBracket = teamList; }

      const { matches } = tournamentType === 'tournament' 
        ? generateTournamentBracket(teamsForBracket, tournamentFormat)
        : generateRoundRobinMatches(teamsForBracket);

      const newT = await saveTournament({
        school, name: tournamentName, type: tournamentType, teams: teamsForBracket, matches,
        date: tournamentDate ? format(tournamentDate, 'yyyy-MM-dd') : undefined,
        tournamentFormat, bestOf
      });
      setTournaments([newT, ...tournaments]);
      setCurrentTournament(newT);
      toast({ title: "대회 생성 완료" });
    } finally { setIsLoading(false); }
  };

  const handleLoadTournament = (id: string) => {
    const t = tournaments.find(x => x.id === id);
    if (t) {
      setCurrentTournament(t);
      setSelectedTournamentId(t.id);
      setTournamentName(t.name);
      setTournamentType(t.type);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-transparent shadow-none border-none">
        <CardHeader><CardTitle>대회 관리</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2 items-center p-4 border rounded-md bg-muted/50">
            <Select onValueChange={handleLoadTournament} value={selectedTournamentId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="대회 선택" /></SelectTrigger>
              <SelectContent>{tournaments.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setCurrentTournament(null); setSelectedTournamentId(''); }}><RefreshCw className="mr-2 h-4 w-4" />새 대회</Button>
          </div>
          <div className="space-y-4 p-4 border rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>대회 이름</Label><Input value={tournamentName} onChange={e => setTournamentName(e.target.value)} /></div>
              <div className="space-y-2"><Label>날짜</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{tournamentDate ? format(tournamentDate, 'PPP') : '선택'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={tournamentDate} onSelect={setTournamentDate} initialFocus /></PopoverContent></Popover></div>
            </div>
            {!currentTournament && (
              <Button onClick={handleCreateTournament} disabled={isLoading || !tournamentName} className="w-full"><Save className="mr-2 h-4 w-4" />대회 생성</Button>
            )}
          </div>
        </CardContent>
      </Card>
      {currentTournament && (
        <Card className="p-6">
          <CardTitle className="mb-4 text-center">{currentTournament.name} 경기 관리</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentTournament.matches.map(m => (
              <Card key={m.id} className="p-4 space-y-2">
                <div className="text-xs font-bold text-muted-foreground">라운드 {m.round} - 경기 {m.matchNumber}</div>
                <div className="flex justify-between items-center text-sm">
                  <span className={cn(m.winnerId === m.teamAId && "font-bold text-primary")}>{currentTournament.teams.find(t => t.id === m.teamAId)?.name || '미정'}</span>
                  <span>vs</span>
                  <span className={cn(m.winnerId === m.teamBId && "font-bold text-primary")}>{currentTournament.teams.find(t => t.id === m.teamBId)?.name || '미정'}</span>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
