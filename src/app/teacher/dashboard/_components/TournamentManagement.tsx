'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  calculateRanks,
  exportToCsv,
  saveTeamGroup,
  deleteTeamGroup,
  updateTeamGroup,
  getTournaments,
  updateTournament,
  getStudents,
  saveTournament,
  deleteTournament,
} from '@/lib/store';
import { Tournament, Match, Team, TeamGroup, Student, IndividualLeagueParticipant, TeamGroupInput } from '@/lib/types';
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
  Calendar,
  UserPlus,
  Crown,
  Medal,
  Trophy as TrophyIcon,
  FileDown,
  Move,
  Search,
  ArrowLeft,
  ClipboardList,
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
import Link from 'next/link';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Student as StudentType, MeasurementItem, MeasurementRecord } from '@/lib/types';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import { getScoutingReport } from "@/ai/flows/scouting-report-flow";
import type { ScoutingReportOutput } from "@/ai/flows/scouting-report-flow";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TeamBalancer from "./TeamBalancer";
import BasketballMatchPage from "../../match/basketball/[id]/page";
import VolleyballMatchPage from "../../match/volleyball/[id]/page";
import SoccerMatchPage from "../../match/soccer/[id]/page";
import BaseballMatchPage from "../../match/baseball/[id]/page";
import DodgeballMatchPage from "../../match/dodgeball/[id]/page";
import GenericMatchPage from "../../match/[id]/page";

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

const getSportFromTournamentName = (name: string): string => {
  if (name.includes('농구')) return 'basketball';
  if (name.includes('축구')) return 'soccer';
  if (name.includes('배구')) return 'volleyball';
  if (name.includes('피구')) return 'dodgeball';
  if (name.includes('야구')) return 'baseball';
  return 'default';
};

/* -------------------------------------------------------
 * Bracket/League Generation
 * ----------------------------------------------------- */
function generateTournamentBracket(teams: Team[], format: 'single-elimination' | 'double-elimination' = 'single-elimination'): { matches: Match[] } {
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  const numTeams = shuffledTeams.length;
  let allMatches: Match[] = [];

  if (numTeams < 2) return { matches: [] };

  // --- Single Elimination Logic ---
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
  let roundMatches = round1Matches;

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

      if (newMatch.teamAId && newMatch.teamBId) {
        // Normal match
      } else if (
        newMatch.teamAId &&
        !newMatch.teamBId &&
        entrantB.type === 'bye'
      ) {
        newMatch.teamBId = entrantB.teamId;
      }

      nextRoundMatches.push(newMatch);
    }
    allMatches.push(...nextRoundMatches);

    currentRoundEntrants = nextRoundMatches.map((m) => ({
      type: 'winner',
      matchId: m.id,
    }));
    roundMatches = nextRoundMatches;
    currentRound++;
  }

  // Double elimination logic would go here, modifying `allMatches`
  // This is a complex feature and is stubbed for now.

  return { matches: allMatches };
}

function generateRoundRobinMatches(teams: Team[]): Match[] {
    if (teams.length < 2) return [];

    let matchPairs: [Team, Team][] = [];
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            matchPairs.push([teams[i], teams[j]]);
        }
    }
    
    // For a single round-robin, this generates one match for each pair.
    if (matchPairs.length === 0) return [];
    
    const singleRoundMatches = matchPairs.map((pair, index) => ({
        id: uuidv4(),
        round: 1, // All in a single logical round for the league
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
    
    let allMeetings: Match[] = [...singleRoundMatches];
    
    // Optimize schedule to avoid back-to-back games
    if (allMeetings.length > 0) {
        let finalOrder: Match[] = [];
        let remainingMatches = [...allMeetings];

        if (remainingMatches.length > 0) {
            finalOrder.push(remainingMatches[0]);
            let lastMatchTeams = new Set([remainingMatches[0].teamAId, remainingMatches[0].teamBId]);
            remainingMatches.splice(0, 1);
    
            while (remainingMatches.length > 0) {
                let nextMatchIndex = remainingMatches.findIndex(
                    (match) =>
                    match.teamAId && match.teamBId && !lastMatchTeams.has(match.teamAId) && !lastMatchTeams.has(match.teamBId)
                );
    
                if (nextMatchIndex === -1) {
                    nextMatchIndex = remainingMatches.findIndex(
                    (match) =>
                        match.teamAId && match.teamBId && (!lastMatchTeams.has(match.teamAId) || !lastMatchTeams.has(match.teamBId))
                    );
                }
                if (nextMatchIndex === -1) {
                    nextMatchIndex = 0;
                }
    
                const nextMatch = remainingMatches[nextMatchIndex];
                finalOrder.push(nextMatch);
                lastMatchTeams = new Set([nextMatch.teamAId, nextMatch.teamBId]);
                remainingMatches.splice(nextMatchIndex, 1);
            }
        }
        return finalOrder;
    }

    return allMeetings;
}


/* -------------------------------------------------------
 * 메인 컴포넌트
 * ----------------------------------------------------- */
interface TournamentManagementProps {
  onTournamentUpdate: () => void;
  allTeamGroups: TeamGroup[];
  allStudents: Student[];
}
export default function TournamentManagement({
  onTournamentUpdate,
  allTeamGroups,
  allStudents,
}: TournamentManagementProps) {
  const { school } = useAuth();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentType, setTournamentType] = useState<
    'tournament' | 'league' | 'individual-league'
  >('tournament');
  const [tournamentFormat, setTournamentFormat] = useState<'single-elimination' | 'double-elimination'>('single-elimination');
  const [bestOf, setBestOf] = useState<1 | 3 | 5 | 7>(1);

  const [meetingsPerTeam, setMeetingsPerTeam] = useState(1);
  const [tournamentDate, setTournamentDate] = useState<Date | undefined>(
    new Date()
  );

  const [teamSource, setTeamSource] = useState<'manual' | 'group'>('manual');
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState('');

  const [teamList, setTeamList] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());

  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(
    null
  );
  const [matchResults, setMatchResults] = useState<
    Record<string, { scoresA: string[]; scoresB: string[] }>
  >({});
  
  // For Individual League
  const [pointsPerWin, setPointsPerWin] = useState(3);
  const [membersPerTeam, setMembersPerTeam] = useState(2);


  useEffect(() => {
    async function loadTournaments() {
      if (!school) return;
      setIsLoading(true);
      try {
        const data = await getTournaments(school);
        setTournaments(data);
      } catch (error) {
        toast({ variant: 'destructive', title: '대회 목록 로딩 실패' });
      } finally {
        setIsLoading(false);
      }
    }
    loadTournaments();
  }, [school, toast]);

  const teamNameMap = useMemo(() => {
    if (!currentTournament?.teams) return new Map<string, string>();
    return new Map(currentTournament.teams.map((team) => [team.id, team.name]));
  }, [currentTournament]);

  const handleAddTeam = () => {
    if (!newTeamName.trim()) {
      toast({ variant: 'destructive', title: '팀 이름을 입력해주세요.' });
      return;
    }
    if (teamList.some((team) => team.name === newTeamName.trim())) {
      toast({ variant: 'destructive', title: '이미 존재하는 팀 이름입니다.' });
      return;
    }
    const newTeam: Team = {
      id: uuidv4(),
      name: newTeamName.trim(),
      teamIndex: teamList.length,
      memberIds: [],
    };
    setTeamList((prev) => [...prev, newTeam]);
    setNewTeamName('');
    setCurrentTournament(null); // Reset bracket if teams change
  };

  const handleRemoveTeam = (teamId: string) => {
    setTeamList((prev) => prev.filter((team) => team.id !== teamId));
    setCurrentTournament(null); // Reset bracket if teams change
  };
   const handleParticipantToggle = (studentId: string, checked: boolean) => {
    setParticipantIds(prev => {
        const newSet = new Set(prev);
        if (checked) {
            newSet.add(studentId);
        } else {
            newSet.delete(studentId);
        }
        return newSet;
    });
    setCurrentTournament(null);
  };
  
  const handleSelectAllParticipants = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(allStudents.map(s => s.id));
      setParticipantIds(allIds);
    } else {
      setParticipantIds(new Set());
    }
    setCurrentTournament(null);
  };


  const handleCreateOrUpdateTournament = async () => {
    if (!school || !tournamentName) {
      toast({
        variant: 'destructive',
        title: '정보 부족',
        description: '대회 이름을 입력해주세요.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const tournamentDataToUpdate: Partial<Tournament> = {
        name: tournamentName,
        date: tournamentDate ? format(tournamentDate, 'yyyy-MM-dd') : undefined,
      };

      if (currentTournament) {
        let changed = false;
        if(currentTournament.name !== tournamentName) {
          tournamentDataToUpdate.name = tournamentName;
          changed = true;
        }
        const newDate = tournamentDataToUpdate.date;
        if (currentTournament.date !== newDate) {
          tournamentDataToUpdate.date = newDate;
          changed = true;
        }

        if (changed) {
          await updateTournament(
            school,
            currentTournament.id,
            tournamentDataToUpdate
          );
          const updatedTournament = {
            ...currentTournament,
            ...tournamentDataToUpdate,
          };
          setCurrentTournament(updatedTournament);
          setTournaments((prev) =>
            prev.map((t) =>
              t.id === currentTournament.id ? updatedTournament : t
            )
          );
          toast({ title: '대회 정보 변경 완료' });
        } else {
          toast({ title: '변경 사항 없음' });
        }
      } else {
        let teamsForBracket: Team[] = [];
        let participantsForLeague: IndividualLeagueParticipant[] = [];

        if (tournamentType === 'individual-league') {
            if (participantIds.size < 2) {
                toast({ variant: 'destructive', title: '참가자 부족', description: '개인 리그를 생성하려면 최소 2명의 참가자가 필요합니다.' });
                setIsLoading(false);
                return;
            }
            const shuffledParticipants = Array.from(participantIds).sort(() => Math.random() - 0.5);
            participantsForLeague = shuffledParticipants.map((id, index) => {
                const student = allStudents.find(s => s.id === id);
                return {
                    id: student?.id || uuidv4(),
                    name: student?.name || '참가자',
                    totalPoints: 0,
                    status: 'active',
                    initialRank: index + 1
                }
            });
        } else if (teamSource === 'group' && selectedTeamGroupId) {
          const group = allTeamGroups.find((g) => g.id === selectedTeamGroupId);
          if (group) {
            const studentMap = new Map(allStudents.map((s) => [s.id, s]));
            teamsForBracket = group.teams.map((t) => {
              const firstStudent =
                t.memberIds.length > 0 ? studentMap.get(t.memberIds[0]) : null;
              const genderDisplay =
                group.gender === 'separate'
                  ? firstStudent?.gender === '남'
                    ? '(남)'
                    : '(여)'
                  : '';

              const teamsInClass = group.teams.filter((team) => {
                const fs =
                  team.memberIds.length > 0
                    ? studentMap.get(team.memberIds[0])
                    : null;
                if (!fs || !firstStudent) return false;
                return (
                  fs.grade === firstStudent.grade &&
                  fs.classNum === firstStudent.classNum &&
                  (group.gender !== 'separate' || fs.gender === firstStudent.gender)
                );
              });

              const teamToFind = teamsInClass.find(
                (team) => JSON.stringify(team.memberIds) === JSON.stringify(t.memberIds)
              );
              const relativeIndex = teamToFind
                ? teamsInClass.indexOf(teamToFind)
                : -1;

              const teamName = firstStudent
                ? `${firstStudent.grade}-${firstStudent.classNum}반 ${genderDisplay} 팀 ${relativeIndex + 1}`.trim()
                : `팀 ${t.teamIndex + 1}`;

              return { ...t, id: uuidv4(), name: teamName };
            });
          }
        } else {
          teamsForBracket = teamList;
        }

        if (tournamentType !== 'individual-league' && teamsForBracket.length < 2) {
          toast({
            variant: 'destructive',
            title: '팀 부족',
            description: '대진표를 생성하려면 최소 2개의 팀이 필요합니다.',
          });
          setIsLoading(false);
          return;
        }

        const { matches } =
          tournamentType === 'tournament'
            ? generateTournamentBracket(teamsForBracket, tournamentFormat)
            : generateRoundRobinMatches(teamsForBracket);

        let tournamentData: Omit<Tournament, 'id' | 'createdAt'> = {
          school,
          name: tournamentName,
          type: tournamentType,
          teams: teamsForBracket,
          matches: tournamentType === 'individual-league' ? [] : matches,
          date: tournamentDate
            ? format(tournamentDate, 'yyyy-MM-dd')
            : undefined,
        };
        
        if (tournamentType === 'tournament') {
            tournamentData.tournamentFormat = tournamentFormat;
            tournamentData.bestOf = bestOf;
        }

        if (tournamentType === 'individual-league') {
            tournamentData = {
                ...tournamentData,
                participants: participantsForLeague,
                teams: [], // 팀은 동적으로 생성됨
                pointsPerWin,
                membersPerTeam,
                currentRound: 0,
                isFinished: false,
            }
        } else if (teamSource === 'group' && selectedTeamGroupId) {
          tournamentData = { ...tournamentData, teamGroupId: selectedTeamGroupId };
        }
        if (tournamentType === 'league') {
          tournamentData = {
            ...tournamentData,
            meetingsPerTeam: meetingsPerTeam,
          };
        }

        const newTournament = await saveTournament(tournamentData);
        setTournaments((prev) => [newTournament, ...prev]);
        handleLoadTournament(newTournament.id, newTournament);

        toast({ title: '새로운 대회 생성 완료' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '저장 실패' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomizeBracket = async () => {
    if (!school || !currentTournament) return;
    setIsLoading(true);
    try {
      const { matches: newMatches } = generateTournamentBracket(
        currentTournament.teams,
        currentTournament.tournamentFormat
      );
      await updateTournament(school, currentTournament.id, {
        matches: newMatches,
      });

      const reloadedTournament = { ...currentTournament, matches: newMatches };
      setTournaments((prev) =>
        prev.map((t) => (t.id === reloadedTournament.id ? reloadedTournament : t))
      );
      handleLoadTournament(reloadedTournament.id, reloadedTournament);

      toast({ title: '대진표 재추첨 완료' });
    } catch (error) {
      console.error('Failed to randomize bracket:', error);
      toast({ variant: 'destructive', title: '재추첨 실패' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTournamentId('');
    setTournamentName('');
    setTournamentType('tournament');
    setTournamentFormat('single-elimination');
    setBestOf(1);
    setTournamentDate(new Date());
    setCurrentTournament(null);
    setMatchResults({});
    setTeamList([]);
    setNewTeamName('');
    setTeamSource('manual');
    setSelectedTeamGroupId('');
    setMeetingsPerTeam(1);
    setParticipantIds(new Set());
    setMembersPerTeam(2);
  };

  const handleLoadTournament = (id: string, tournamentData?: Tournament) => {
    const tournament = tournamentData || tournaments.find((t) => t.id === id);
    if (tournament) {
      setCurrentTournament(tournament);
      setSelectedTournamentId(tournament.id);
      setTournamentName(tournament.name);
      setTournamentType(tournament.type);
      setTournamentFormat(tournament.tournamentFormat || 'single-elimination');
      setBestOf(tournament.bestOf || 1);
      setMeetingsPerTeam(tournament.meetingsPerTeam || 1);
      setTournamentDate(
        tournament.date ? new Date(tournament.date) : new Date()
      );
      if (tournament.type === 'individual-league') {
        setParticipantIds(new Set(tournament.participants?.map(p => p.id)));
        setPointsPerWin(tournament.pointsPerWin || 3);
        setMembersPerTeam(tournament.membersPerTeam || 2);
      } else {
        setTeamList(tournament.teams);
        setTeamSource(tournament.teamGroupId ? 'group' : 'manual');
        setSelectedTeamGroupId(tournament.teamGroupId || '');
      }


      const initialResults: Record<
        string,
        { scoresA: string[]; scoresB: string[] }
      > = {};
      tournament.matches?.forEach((match) => {
        initialResults[match.id] = {
          scoresA: match.scoresA?.map(s => String(s)) || [],
          scoresB: match.scoresB?.map(s => String(s)) || [],
        };
      });
      setMatchResults(initialResults);
    }
  };

  const handleDelete = async () => {
    if (!school || !currentTournament) return;
    const tournamentIdToDelete = currentTournament.id;
    setIsLoading(true);
    try {
      await deleteTournament(school, tournamentIdToDelete);
      setTournaments((prev) => prev.filter((t) => t.id !== tournamentIdToDelete));
      resetForm();
      toast({ title: '대회 삭제 완료' });
    } catch (error) {
      toast({ variant: 'destructive', title: '삭제 실패' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTeamName = async (teamId: string, newName: string) => {
    if (!school || !currentTournament || !newName.trim()) return;

    const updatedTeams = currentTournament.teams.map((t) =>
      t.id === teamId ? { ...t, name: newName.trim() } : t
    );

    setIsLoading(true);
    try {
      await updateTournament(school, currentTournament.id, {
        teams: updatedTeams,
      });
      const updatedTournament = { ...currentTournament, teams: updatedTeams };
      setCurrentTournament(updatedTournament);
      setTournaments((prev) =>
        prev.map((t) => (t.id === updatedTournament.id ? updatedTournament : t))
      );
      toast({ title: '팀 이름 변경 완료' });
    } catch (error) {
      console.error('Failed to update team name:', error);
      toast({ variant: 'destructive', title: '이름 변경 실패' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatchResultChange = (
    matchId: string,
    team: 'A' | 'B',
    gameIndex: number,
    score: string
  ) => {
    setMatchResults((prev) => {
      const newResults = { ...prev };
      const currentScores = newResults[matchId] || { scoresA: [], scoresB: [] };
      const newScoresA = [...currentScores.scoresA];
      const newScoresB = [...currentScores.scoresB];

      if (team === 'A') {
        newScoresA[gameIndex] = score;
      } else {
        newScoresB[gameIndex] = score;
      }
      
      newResults[matchId] = { scoresA: newScoresA, scoresB: newScoresB };
      return newResults;
    });
  };

  const handleUpdateMatch = async (matchId: string) => {
    if (!school || !currentTournament) return;
    
    // Detailed page scores take precedence
    const detailedMatch = currentTournament.matches.find(m => m.id === matchId);
    const hasDetailedScores = (detailedMatch?.scoresA?.length || 0) > 0 || (detailedMatch?.scoresB?.length || 0) > 0;
    
    let scoresA: number[] = [];
    let scoresB: number[] = [];

    if (hasDetailedScores) {
        scoresA = detailedMatch?.scoresA || [];
        scoresB = detailedMatch?.scoresB || [];
    } else {
        const results = matchResults[matchId];
        if (!results) return;
        scoresA = results.scoresA.map(s => parseInt(s, 10)).filter(s => !isNaN(s));
        scoresB = results.scoresB.map(s => parseInt(s, 10)).filter(s => !isNaN(s));
    }


    setIsLoading(true);
    try {
      const tournamentToUpdate = JSON.parse(
        JSON.stringify(currentTournament)
      ) as Tournament;
      let matchToUpdate = tournamentToUpdate.matches.find(
        (m) => m.id === matchId
      );

      if (matchToUpdate) {
        matchToUpdate.scoresA = scoresA;
        matchToUpdate.scoresB = scoresB;
        
        let winsA = 0;
        let winsB = 0;
        for (let i = 0; i < Math.max(scoresA.length, scoresB.length); i++) {
            if ((scoresA[i] || 0) > (scoresB[i] || 0)) winsA++;
            else if ((scoresB[i] || 0) > (scoresA[i] || 0)) winsB++;
        }

        const requiredWins = Math.ceil((currentTournament.bestOf || 1) / 2);

        if (winsA >= requiredWins || winsB >= requiredWins) {
            matchToUpdate.status = 'completed';
            matchToUpdate.winnerId = winsA > winsB ? matchToUpdate.teamAId : matchToUpdate.teamBId;
        } else {
            matchToUpdate.status = 'scheduled';
            matchToUpdate.winnerId = null;
        }


        // For tournaments, propagate winner to the next match
        if (tournamentType === 'tournament') {
          let currentMatch = matchToUpdate;
          while (currentMatch && currentMatch.winnerId && currentMatch.nextMatchId) {
            const nextMatch = tournamentToUpdate.matches.find(
              (m) => m.id === currentMatch!.nextMatchId
            );
            if (nextMatch) {
              if (currentMatch.nextMatchSlot === 'A') {
                nextMatch.teamAId = currentMatch.winnerId;
              } else {
                nextMatch.teamBId = currentMatch.winnerId;
              }

              if (nextMatch.teamAId && nextMatch.teamBId) {
                nextMatch.status = 'scheduled';
              }
               currentMatch = nextMatch;
            } else {
              break;
            }
          }
        }
      }

      await updateTournament(school, currentTournament.id, {
        matches: tournamentToUpdate.matches,
      });
      setCurrentTournament(tournamentToUpdate);
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournamentToUpdate.id ? tournamentToUpdate : t))
      );
      toast({ title: '경기 결과 저장 완료' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '결과 저장 실패' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetMatch = async (matchId: string) => {
    if (!school || !currentTournament) return;
    setIsLoading(true);
    try {
      const tournamentToUpdate = JSON.parse(
        JSON.stringify(currentTournament)
      ) as Tournament;

      const resetMatchRecursive = (mId: string | null): boolean => {
        if (!mId) return true;
        const matchToReset = tournamentToUpdate.matches.find(
          (m) => m.id === mId
        );
        if (
          !matchToReset ||
          (matchToReset.status !== 'completed' && matchToReset.status !== 'bye')
        )
          return true;

        if (matchToReset.nextMatchId) {
          const nextMatch = tournamentToUpdate.matches.find(
            (m) => m.id === matchToReset.nextMatchId
          );
          if (nextMatch) {
            if (nextMatch.status !== 'scheduled') {
              if (!resetMatchRecursive(nextMatch.id)) return false;
            }
            if (matchToReset.nextMatchSlot === 'A') nextMatch.teamAId = null;
            else nextMatch.teamBId = null;

            nextMatch.status = 'scheduled';
            nextMatch.winnerId = null;
          }
        }

        matchToReset.scoresA = [];
        matchToReset.scoresB = [];
        if (matchToReset.teamBId !== null) {
          // Don't change bye status on original byes
          matchToReset.winnerId = null;
          matchToReset.status = 'scheduled';
        } else {
          matchToReset.winnerId = matchToReset.teamAId;
          matchToReset.status = 'bye';
        }

        setMatchResults((prev) => ({
          ...prev,
          [mId]: { scoresA: [], scoresB: [] },
        }));
        return true;
      };

      if (resetMatchRecursive(matchId)) {
        await updateTournament(school, currentTournament.id, {
          matches: tournamentToUpdate.matches,
        });
        setCurrentTournament(tournamentToUpdate);
        setTournaments((prev) =>
          prev.map((t) => (t.id === tournamentToUpdate.id ? tournamentToUpdate : t))
        );
        toast({ title: '경기 결과 초기화 완료' });
      } else {
        toast({ variant: 'destructive', title: '초기화 실패' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: '초기화 실패' });
    } finally {
      setIsLoading(false);
    }
  };

  const matchesByRound = useMemo(() => {
    if (!currentTournament?.matches || currentTournament.type !== 'tournament')
      return {};
    return currentTournament.matches.reduce((acc, match) => {
      const round = match.round || 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      acc[round].sort((a, b) => a.matchNumber - b.matchNumber);
      return acc;
    }, {} as Record<number, Match[]>);
  }, [currentTournament]);
  
  const leagueStandings = useMemo(() => {
    if (!currentTournament || (currentTournament.type !== 'league' && currentTournament.type !== 'individual-league')) return [];
    
    if (currentTournament.type === 'individual-league') {
        const sortedParticipants = [...(currentTournament.participants || [])].sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) {
                return b.totalPoints - a.totalPoints;
            }
            return a.initialRank - b.initialRank;
        });
        return sortedParticipants;
    }

    const stats: Record<
      string,
      Team & {
        matchesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        points: number;
      }
    > = {};
    currentTournament.teams.forEach((team) => {
      stats[team.id] = {
        ...team,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
      };
    });

    currentTournament.matches.forEach((match) => {
      if (match.status === 'completed' && match.teamAId && match.teamBId) {
        const teamA = stats[match.teamAId];
        const teamB = stats[match.teamBId];
        if (!teamA || !teamB) return;

        teamA.matchesPlayed++;
        teamB.matchesPlayed++;
        
        let teamAWins = 0;
        let teamBWins = 0;
        const scoresA = match.scoresA || [];
        const scoresB = match.scoresB || [];

        for(let i=0; i < Math.max(scoresA.length, scoresB.length); i++){
            if((scoresA[i] || 0) > (scoresB[i] || 0)) teamAWins++;
            else if((scoresB[i] || 0) > (scoresA[i] || 0)) teamBWins++;
        }

        const requiredWins = Math.ceil((currentTournament.bestOf || 1) / 2);
        
        if (teamAWins >= requiredWins) {
          teamA.wins++;
          teamB.losses++;
          teamA.points += 3;
        } else if (teamBWins >= requiredWins) {
          teamB.wins++;
          teamA.losses++;
          teamB.points += 3;
        } else {
          // This logic might need adjustment based on specific league rules for draws
          teamA.draws++;
          teamB.draws++;
          teamA.points += 1;
          teamB.points += 1;
        }
      }
    });

    return Object.values(stats).sort((a, b) => b.points - a.points);
  }, [currentTournament]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords /> 대회 관리
          </CardTitle>
          <CardDescription>
            새로운 리그나 토너먼트를 생성하거나, 기존 대회를 불러와 수정하고
            결과를 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold">대회 불러오기 또는 새로 만들기</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <Select
                onValueChange={(id) => handleLoadTournament(id)}
                value={selectedTournamentId}
              >
                <SelectTrigger className="flex-1 min-w-[200px]">
                  <SelectValue placeholder="저장된 대회를 선택하세요..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>
                      로딩 중...
                    </SelectItem>
                  ) : tournaments.length > 0 ? (
                    tournaments.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      저장된 대회가 없습니다.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={resetForm}>
                <RefreshCw className="mr-2 h-4 w-4" />새 대회
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={!currentTournament}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    대회 삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 작업은 되돌릴 수 없습니다. 대회 정보가 영구적으로
                      삭제됩니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-semibold">대회 정보 설정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tournament-name">대회 이름</Label>
                <Input
                  id="tournament-name"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="예: 2학기 5학년 피구 리그"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tournament-date">대회 날짜</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !tournamentDate && 'text-muted-foreground'
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {tournamentDate ? (
                        format(tournamentDate, 'PPP')
                      ) : (
                        <span>날짜 선택</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={tournamentDate}
                      onSelect={setTournamentDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tournament-type">대회 종류</Label>
                <Select
                  onValueChange={(v) =>
                    setTournamentType(v as 'tournament' | 'league' | 'individual-league')
                  }
                  value={tournamentType}
                  disabled={!!currentTournament}
                >
                  <SelectTrigger id="tournament-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tournament">토너먼트</SelectItem>
                    <SelectItem value="league">팀 리그</SelectItem>
                    <SelectItem value="individual-league">개인 승점 리그</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tournamentType === 'league' && !currentTournament && (
                <div className="space-y-2">
                  <Label htmlFor="meetings-per-team">팀당 경기 수</Label>
                  <Input
                    id="meetings-per-team"
                    type="number"
                    min="1"
                    value={meetingsPerTeam}
                    onChange={(e) =>
                      setMeetingsPerTeam(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                </div>
              )}
            </div>
            
            {tournamentType === 'tournament' && (
              <div className="space-y-4 pt-4 border-t">
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                     <div className="space-y-2">
                      <Label>대진 방식</Label>
                      <Select value={tournamentFormat} onValueChange={v => setTournamentFormat(v as any)} disabled={!!currentTournament}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single-elimination">싱글 엘리미네이션</SelectItem>
                          <SelectItem value="double-elimination" disabled>더블 엘리미네이션 (준비중)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                     <div className="space-y-2">
                      <Label>경기 방식</Label>
                      <Select value={String(bestOf)} onValueChange={v => setBestOf(Number(v) as any)}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">단판</SelectItem>
                          <SelectItem value="3">3전 2선승</SelectItem>
                          <SelectItem value="5">5전 3선승</SelectItem>
                          <SelectItem value="7">7전 4선승</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </div>
            )}

            {!currentTournament && (
              <div className="space-y-4 pt-4 border-t">
                <Label>참가팀/참가자 설정</Label>
                 {tournamentType !== 'individual-league' ? (
                 <>
                    <Select
                        value={teamSource}
                        onValueChange={(v) => setTeamSource(v as 'manual' | 'group')}
                        disabled={!!currentTournament}
                    >
                        <SelectTrigger className="w-[280px]">
                        <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="manual">팀 이름 직접 추가</SelectItem>
                        <SelectItem value="group">
                            저장된 팀 편성 그룹에서 가져오기
                        </SelectItem>
                        </SelectContent>
                    </Select>

                    {teamSource === 'manual' ? (
                        <div className="space-y-2">
                            <div className="flex gap-2">
                            <Input
                                placeholder="팀 이름을 입력하세요"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                            />
                            <Button onClick={handleAddTeam}>
                                <Plus className="h-4 w-4 mr-2" />
                                추가
                            </Button>
                            </div>
                            {teamList.length > 0 && (
                            <div className="p-2 border rounded-md max-h-48 overflow-y-auto">
                                <ul className="space-y-1">
                                {teamList.map((team) => (
                                    <li
                                    key={team.id}
                                    className="flex justify-between items-center text-sm p-1 bg-background rounded"
                                    >
                                    <span>{team.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleRemoveTeam(team.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    </li>
                                ))}
                                </ul>
                            </div>
                            )}
                        </div>
                        ) : (
                        <Select
                            value={selectedTeamGroupId}
                            onValueChange={setSelectedTeamGroupId}
                            disabled={!!currentTournament}
                        >
                            <SelectTrigger className="w-full">
                            <SelectValue placeholder="팀 편성 그룹 선택" />
                            </SelectTrigger>
                            <SelectContent>
                            {allTeamGroups.length > 0 ? (
                                allTeamGroups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                    {group.description}
                                </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="none" disabled>
                                저장된 팀 편성 그룹이 없습니다.
                                </SelectItem>
                            )}
                            </SelectContent>
                        </Select>
                        )}
                    </>
                    ) : (
                       <IndividualLeagueSetup 
                          allStudents={allStudents}
                          participantIds={participantIds}
                          onParticipantToggle={handleParticipantToggle}
                          onSelectAll={handleSelectAllParticipants}
                          pointsPerWin={pointsPerWin}
                          setPointsPerWin={setPointsPerWin}
                          membersPerTeam={membersPerTeam}
                          setMembersPerTeam={setMembersPerTeam}
                       />
                    )}
              </div>
            )}

            <div className="flex justify-end pt-4 gap-2 flex-wrap">
              <Button
                onClick={handleCreateOrUpdateTournament}
                disabled={isLoading}
              >
                <Save className="mr-2 h-4 w-4" />
                {currentTournament ? '정보 변경 저장' : '대회 생성'}
              </Button>
              {currentTournament && currentTournament.type === 'tournament' && (
                <Button
                  variant="outline"
                  onClick={handleRandomizeBracket}
                  disabled={isLoading}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  대진표 재추첨
                </Button>
              )}
              <SendTournamentDialog
                tournament={currentTournament}
                onUpdate={onTournamentUpdate}
                school={school || ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {currentTournament && currentTournament.type === 'individual-league' && (
        <IndividualLeagueInterface
          tournament={currentTournament}
          onUpdateTournament={(updated) => {
            setCurrentTournament(updated);
            setTournaments(prev => prev.map(t => t.id === updated.id ? updated : t));
          }}
        />
      )}

      {currentTournament &&
        currentTournament.type === 'tournament' &&
        Object.keys(matchesByRound).length > 0 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>{currentTournament.name} 대진표</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-4">
              <div className="flex justify-center min-w-max">
                <div className="flex items-start space-x-8">
                  {Object.entries(matchesByRound).map(([round, matches]) => {
                    const roundNumber = parseInt(round, 10);
                    const teamCount = Math.max(
                      currentTournament?.teams?.length ?? 0,
                      2
                    );
                    const bracketSize = 2 ** Math.ceil(Math.log2(teamCount));
                    const totalRounds = Math.log2(bracketSize);

                    const label =
                      roundNumber === totalRounds
                        ? '결승'
                        : roundNumber === totalRounds - 1
                        ? '준결승'
                        : `${bracketSize / 2 ** (roundNumber - 1)}강`;

                    return (
                      <div
                        key={round}
                        className="flex flex-col space-y-4 min-w-[200px]"
                      >
                        <h4 className="font-bold text-center text-lg">{label}</h4>
                        <div className="flex flex-col justify-around h-full space-y-4">
                          {matches.map((match) => (
                            <MatchNode
                              key={match.id}
                              match={match}
                              tournament={currentTournament}
                              teamNameMap={teamNameMap}
                              onResultChange={handleMatchResultChange}
                              onUpdateMatch={handleUpdateMatch}
                              onResetMatch={handleResetMatch}
                              onUpdateTeamName={handleUpdateTeamName}
                              matchResults={matchResults}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      {currentTournament && currentTournament.type === 'league' && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{currentTournament.name} 경기 정보</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-2 text-center">
                경기 목록
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {currentTournament.matches.map((match) => (
                  <LeagueMatchNode
                    key={match.id}
                    match={match}
                    tournament={currentTournament}
                    teamNameMap={teamNameMap}
                    onResultChange={handleMatchResultChange}
                    onUpdateMatch={handleUpdateMatch}
                    onResetMatch={handleResetMatch}
                    onUpdateTeamName={handleUpdateTeamName}
                    matchResults={matchResults}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2 text-center">순위표</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>순위</TableHead>
                    <TableHead>팀</TableHead>
                    <TableHead>경기</TableHead>
                    <TableHead>승</TableHead>
                    <TableHead>무</TableHead>
                    <TableHead>패</TableHead>
                    <TableHead>승점</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(leagueStandings as Team[]).map((team, index) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-bold">{index + 1}</TableCell>
                      <TableCell>{team.name}</TableCell>
                      <TableCell>{(team as any).matchesPlayed}</TableCell>
                      <TableCell>{(team as any).wins}</TableCell>
                      <TableCell>{(team as any).draws}</TableCell>
                      <TableCell>{(team as any).losses}</TableCell>
                      <TableCell className="font-bold">{(team as any).points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------
 * 하위 컴포넌트
 * ----------------------------------------------------- */

const LeagueMatchNode = (props: MatchNodeProps) => {
  return (
    <MatchNode {...props} isLeague />
  );
};

interface MatchNodeProps {
  match: Match;
  tournament: Tournament;
  teamNameMap: Map<string, string>;
  onResultChange: (matchId: string, team: 'A' | 'B', gameIndex: number, score: string) => void;
  onUpdateMatch: (matchId: string) => void;
  onResetMatch: (matchId: string) => void;
  onUpdateTeamName: (teamId: string, newName: string) => void;
  isLeague?: boolean;
  matchResults: Record<string, { scoresA: string[], scoresB: string[] }>;
}

const MatchNode = ({
  match,
  tournament,
  teamNameMap,
  onResultChange,
  onUpdateMatch,
  onResetMatch,
  onUpdateTeamName,
  isLeague = false,
  matchResults,
}: MatchNodeProps) => {
    let winsA = 0;
    let winsB = 0;
    
    const simpleScoresA = matchResults[match.id]?.scoresA || [];
    const simpleScoresB = matchResults[match.id]?.scoresB || [];
    const detailedScoresA = match.scoresA || [];
    const detailedScoresB = match.scoresB || [];

    const hasDetailedScores = detailedScoresA.length > 0 || detailedScoresB.length > 0;
    const scoresToUseA = hasDetailedScores ? detailedScoresA : simpleScoresA.map(s => parseInt(s, 10)).filter(s => !isNaN(s));
    const scoresToUseB = hasDetailedScores ? detailedScoresB : simpleScoresB.map(s => parseInt(s, 10)).filter(s => !isNaN(s));

    for (let i = 0; i < Math.max(scoresToUseA.length, scoresToUseB.length); i++) {
        if ((scoresToUseA[i] || 0) > (scoresToUseB[i] || 0)) winsA++;
        else if ((scoresToUseB[i] || 0) > (scoresToUseA[i] || 0)) winsB++;
    }

    const requiredWins = Math.ceil((tournament.bestOf || 1) / 2);
    const isMatchOver = winsA >= requiredWins || winsB >= requiredWins;
    const finalWinnerId = isMatchOver ? (winsA > winsB ? match.teamAId : match.teamBId) : null;
    const finalWinnerIsA = finalWinnerId === match.teamAId;
    const finalWinnerIsB = finalWinnerId === match.teamBId;
  
  const cardClassName = cn(
    "relative flex w-full flex-col justify-center rounded-md border p-2 shadow-sm",
    isLeague ? "hover:bg-muted/50" : ""
  );

  return (
    <Card className={cardClassName}>
       <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1 w-full">
                <TeamNameEditor
                    teamId={match.teamAId}
                    name={match.teamAId ? teamNameMap.get(match.teamAId) ?? '미정' : '미정'}
                    onUpdate={onUpdateTeamName}
                    className={`truncate text-sm ${finalWinnerIsA ? 'font-bold text-primary' : ''} ${match.teamAId ? '' : 'text-muted-foreground'}`}
                />
                <TeamNameEditor
                    teamId={match.teamBId}
                    name={match.teamBId ? teamNameMap.get(match.teamBId) ?? '팀 없음' : (match.status === 'bye' ? '(부전승)' : '미정')}
                    onUpdate={onUpdateTeamName}
                    className={`truncate text-sm ${finalWinnerIsB ? 'font-bold text-primary' : ''} ${match.teamBId || match.status === 'bye' ? '' : 'text-muted-foreground'}`}
                />
            </div>
            { (match.status === 'completed' || isMatchOver) && (
                <div className="font-bold text-lg text-primary pl-2">{`${winsA} : ${winsB}`}</div>
            )}
      </div>

       <div className="flex flex-col gap-2 mt-2">
        {Array.from({ length: tournament.bestOf || 1 }).map((_, i) => (
          <MatchResultInput
            key={i}
            gameIndex={i}
            match={match}
            tournament={tournament}
            teamNameMap={teamNameMap}
            onResultChange={onResultChange}
            isMatchOver={isMatchOver}
            matchResults={matchResults}
          />
        ))}
      </div>
      
      <div className="flex gap-2 mt-2 justify-end">
        <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => onUpdateMatch(match.id)}>
          <Save className="mr-2 h-3 w-3" /> 저장
        </Button>
        {match.status === 'completed' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 flex-1" onClick={(e) => e.stopPropagation()}>
                <RotateCcw className="mr-2 h-3 w-3" /> 초기화
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>결과를 초기화하시겠습니까?</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>취소</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.stopPropagation(); onResetMatch(match.id); }}>초기화</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </Card>
  );
};

const EditableScore = ({ value, onChange, disabled }: { value: string; onChange: (newValue: string) => void, disabled?: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    const handleSave = () => {
        setIsEditing(false);
        onChange(currentValue);
    };
    
    if (disabled) {
        return (
             <div className="w-12 h-8 flex items-center justify-center cursor-not-allowed bg-muted/50 rounded-md">
                <span className="font-bold">{value || '-'}</span>
            </div>
        )
    }

    if (isEditing) {
        return (
            <Input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-12 h-8 text-center p-1"
                autoFocus
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className="w-12 h-8 flex items-center justify-center cursor-pointer hover:bg-secondary rounded-md"
        >
            <span className="font-bold">{value || '-'}</span>
        </div>
    );
};


const MatchResultInput = ({
  gameIndex,
  match,
  tournament,
  onResultChange,
  isMatchOver,
  matchResults,
}: {
  gameIndex: number;
  match: Match;
  tournament: Tournament;
  teamNameMap: Map<string, string>;
  onResultChange: (matchId: string, team: 'A' | 'B', gameIndex: number, score: string) => void;
  isMatchOver: boolean;
  matchResults: Record<string, { scoresA: string[], scoresB: string[] }>;
}) => {
  const sport = getSportFromTournamentName(tournament.name || '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const simpleScores = matchResults[match.id] || { scoresA: [], scoresB: [] };
  const scoreA = simpleScores.scoresA[gameIndex] ?? '';
  const scoreB = simpleScores.scoresB[gameIndex] ?? '';

  const hasDetailedScores = (match.scoresA && match.scoresA.length > gameIndex) || (match.scoresB && match.scoresB.length > gameIndex);
  
  const handleOpenDialog = () => {
    if (isMatchOver && !hasResult) {
      return;
    }
    setIsDialogOpen(true);
  }

  const hasResult = scoreA !== '' || scoreB !== '';

  return (
    <div
        className={cn(
        "mt-1 p-2 border-t flex flex-col gap-1 rounded-b-md",
        (isMatchOver && !hasResult) 
            ? "bg-muted/50 cursor-not-allowed text-muted-foreground" 
            : "hover:bg-secondary"
        )}
    >
        <div className="text-xs text-center text-muted-foreground">{gameIndex + 1}경기</div>
        <div className="flex gap-1 justify-between items-center">
            <div className="flex-1 text-sm truncate">{match.teamAId ? teamNameMap.get(match.teamAId) : '미정'}</div>
            <EditableScore 
              value={String(hasDetailedScores ? (match.scoresA?.[gameIndex] ?? '') : scoreA)}
              onChange={(newScore) => onResultChange(match.id, 'A', gameIndex, newScore)}
              disabled={hasDetailedScores}
            />
        </div>
        <div className="flex gap-1 justify-between items-center">
            <div className="flex-1 text-sm truncate">{match.teamBId ? teamNameMap.get(match.teamBId) : '미정'}</div>
            <EditableScore 
              value={String(hasDetailedScores ? (match.scoresB?.[gameIndex] ?? '') : scoreB)}
              onChange={(newScore) => onResultChange(match.id, 'B', gameIndex, newScore)}
              disabled={hasDetailedScores}
            />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 mt-1 text-xs text-muted-foreground" onClick={(e) => {e.stopPropagation(); handleOpenDialog();}}>
                <ClipboardList className="mr-2 h-3 w-3" />상세 기록
            </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle>경기 기록</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto">
                    <MatchPageContent
                        matchId={match.id}
                        sport={sport}
                        gameIndex={gameIndex}
                    />
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
};


const MatchPageContent = ({ sport }: { matchId: string, sport: string, gameIndex: number }) => {
    switch (sport) {
        case 'basketball':
            return <BasketballMatchPage />;
        case 'volleyball':
            return <VolleyballMatchPage />;
        case 'soccer':
            return <SoccerMatchPage />;
        case 'baseball':
            return <BaseballMatchPage />;
        case 'dodgeball':
            return <DodgeballMatchPage />;
        default:
            return <GenericMatchPage />;
    }
}

const TeamNameEditor = ({
  teamId,
  name,
  className,
  onUpdate,
}: {
  teamId: string | null;
  name: string;
  className: string;
  onUpdate: (teamId: string, newName: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(name);

  useEffect(() => {
    setNewName(name);
  }, [name]);

  const handleUpdate = () => {
    if (teamId && newName.trim() && newName !== name) {
      onUpdate(teamId, newName);
    }
    setIsEditing(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  if (!teamId || name === '미정' || name === '(부전승)' || name === '팀 없음') {
    return <span className={className}>{name}</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleUpdate}
          onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
          className="h-7 p-1 text-sm"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className={className}>{name}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100"
        onClick={handleClick}
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
};

function SendTournamentDialog({
  tournament,
  onUpdate,
  school,
}: {
  tournament: Tournament | null;
  onUpdate: () => void;
  school: string;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  const [targetGrade, setTargetGrade] = useState('');
  const [targetGender, setTargetGender] = useState<'all' | '남' | '여'>('all');

  const grades = useMemo(
    () => [...new Set(allStudents.map((s) => s.grade))].sort(),
    [allStudents]
  );

  useEffect(() => {
    if (isOpen && school) {
      getStudents(school).then(setAllStudents);
    }
  }, [isOpen, school]);

  useEffect(() => {
    if (tournament) {
      setTargetGrade(tournament.grade || '');
      setTargetGender(tournament.gender || 'all');
    }
  }, [tournament, isOpen]);

  const handleSend = async () => {
    if (!tournament) return;
    setIsSending(true);

    try {
      if (tournament.teamGroupId) {
        const dataToUpdate: Partial<Omit<Tournament, 'id' | 'school'>> = {
          teamGroupId: tournament.teamGroupId,
        };
        if (targetGrade) dataToUpdate.grade = targetGrade;
        if (targetGender) dataToUpdate.gender = targetGender;

        await updateTournament(school, tournament.id, dataToUpdate);
        toast({
          title: '전달 완료',
          description: '팀 편성 그룹에 속한 학생들에게 대진표가 전달되었습니다.',
        });
      } else {
        if (!targetGrade && tournament.type !== 'individual-league') {
          toast({
            variant: 'destructive',
            title: '전달 실패',
            description: '전달할 학년을 선택해주세요.',
          });
          setIsSending(false);
          return;
        }
        await updateTournament(school, tournament.id, {
          grade: targetGrade,
          gender: targetGender,
        });
        toast({
          title: '전달 완료',
          description: `${targetGrade}학년 ${
            targetGender === 'all' ? '전체' : targetGender
          } 학생들에게 대진표가 전달되었습니다.`,
        });
      }
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to send tournament', error);
      toast({ variant: 'destructive', title: '전달 실패' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button disabled={!tournament}>
          <Send className="mr-2 h-4 w-4" /> 학생들에게 전달
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>대진표 전달</DialogTitle>
          <DialogDescription>
            {tournament?.teamGroupId
              ? '이 대회는 팀 편성 그룹으로 생성되었습니다. 해당 그룹의 모든 학생에게 대진표가 전달됩니다.'
              : '이 대회는 수동으로 생성되었습니다. 대진표를 전달할 학년과 성별을 지정해주세요.'}
          </DialogDescription>
        </DialogHeader>
        {!tournament?.teamGroupId && tournament?.type !== 'individual-league' && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="grade" className="text-right">
                학년
              </Label>
              <Select value={targetGrade} onValueChange={setTargetGrade}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="학년 선택" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}학년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="gender" className="text-right">
                성별
              </Label>
              <Select
                value={targetGender}
                onValueChange={(v) => setTargetGender(v as any)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="남">남</SelectItem>
                  <SelectItem value="여">여</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            전달
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const IndividualLeagueSetup = ({ allStudents, participantIds, onParticipantToggle, onSelectAll, pointsPerWin, setPointsPerWin, membersPerTeam, setMembersPerTeam }: {
  allStudents: Student[];
  participantIds: Set<string>;
  onParticipantToggle: (studentId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  pointsPerWin: number;
  setPointsPerWin: (value: number) => void;
  membersPerTeam: number;
  setMembersPerTeam: (value: number) => void;
}) => {
    return (
        <div className="space-y-4">
            <div className='space-y-2'>
              <h4 className="font-medium">리그 설정</h4>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md'>
                <div className='space-y-1'>
                  <Label htmlFor='pointsPerWin'>승리 시 승점</Label>
                  <Input id="pointsPerWin" type="number" value={pointsPerWin} onChange={(e) => setPointsPerWin(Number(e.target.value))} placeholder="승리 시 승점" />
                </div>
                <div className='space-y-1'>
                    <Label htmlFor='membersPerTeam'>팀원 수</Label>
                    <Input id="membersPerTeam" type="number" value={membersPerTeam} onChange={(e) => setMembersPerTeam(Number(e.target.value))} placeholder="한 팀의 인원 수" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
                <h4 className="font-medium">참가자 선택</h4>
                <div className="p-2 border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-10'>
                                  <Checkbox
                                      checked={participantIds.size === allStudents.length && allStudents.length > 0}
                                      onCheckedChange={(checked) => onSelectAll(!!checked)}
                                  />
                                </TableHead>
                                <TableHead>학년</TableHead>
                                <TableHead>반</TableHead>
                                <TableHead>번호</TableHead>
                                <TableHead>이름</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allStudents.map(student => (
                                <TableRow key={student.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={participantIds.has(student.id)}
                                            onCheckedChange={(checked) => onParticipantToggle(student.id, !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell>{student.grade}</TableCell>
                                    <TableCell>{student.classNum}</TableCell>
                                    <TableCell>{student.studentNum}</TableCell>
                                    <TableCell>{student.name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

// Helper function to get all possible combinations
const getCombinations = <T,>(array: T[], size: number): T[][] => {
    if (size > array.length) return [];
    if (size === 0) return [[]];
    if (size === array.length) return [array];
    
    const result: T[][] = [];
    
    function backtrack(startIndex: number, currentCombination: T[]) {
        if (currentCombination.length === size) {
            result.push([...currentCombination]);
            return;
        }
        
        if (startIndex === array.length) return;
        
        // Include array[startIndex]
        currentCombination.push(array[startIndex]);
        backtrack(startIndex + 1, currentCombination);
        currentCombination.pop();
        
        // Exclude array[startIndex]
        backtrack(startIndex + 1, currentCombination);
    }
    
    backtrack(0, []);
    return result;
};


const IndividualLeagueInterface = ({ tournament, onUpdateTournament }: { 
    tournament: Tournament, 
    onUpdateTournament: (t: Tournament) => void,
}) => {
    const { school } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [matchResults, setMatchResults] = useState<Record<string, { scoresA: string[], scoresB: string[] }>>({});

     useEffect(() => {
        const initialResults: Record<string, { scoresA: string[], scoresB: string[] }> = {};
        tournament.matches?.forEach((match) => {
            initialResults[match.id] = {
            scoresA: match.scoresA?.map(s => String(s)) || [],
            scoresB: match.scoresB?.map(s => String(s)) || [],
            };
        });
        setMatchResults(initialResults);
    }, [tournament.matches]);


    const handleNextRound = async () => {
        if (!school || tournament.isFinished || !tournament.membersPerTeam) return;
        setIsLoading(true);

        try {
            let participantsToPlay = tournament.participants?.filter(p => p.status === 'active') || [];
            if (participantsToPlay.length < (tournament.membersPerTeam || 2)) {
                toast({ variant: 'destructive', title: '참가자 부족', description: '다음 라운드를 진행하기에 인원이 부족하여 리그를 종료합니다.' });
                await handleEndLeague();
                return;
            }
             if (participantsToPlay.length % tournament.membersPerTeam !== 0) {
              toast({ variant: 'destructive', title: '팀 구성 불가', description: `현재 참가자(${participantsToPlay.length}명)를 ${tournament.membersPerTeam}명씩 팀으로 나눌 수 없습니다.` });
              setIsLoading(false);
              return;
            }

            const pastTeamMemberIds = (tournament.teams || []).map(team => new Set(team.memberIds));
            
            let allPossibleTeams = getCombinations(participantsToPlay, tournament.membersPerTeam);
            
            allPossibleTeams.sort((teamA, teamB) => {
                const teamASet = new Set(teamA.map(p => p.id));
                const teamBSet = new Set(teamB.map(p => p.id));

                let penaltyA = 0;
                let penaltyB = 0;
                
                pastTeamMemberIds.forEach(pastSet => {
                    const setAArray = Array.from(teamASet);
                    const setBArray = Array.from(teamBSet);
                    
                    const isSameAsPastA = setAArray.length === pastSet.size && setAArray.every(memberId => pastSet.has(memberId));
                    const isSameAsPastB = setBArray.length === pastSet.size && setBArray.every(memberId => pastSet.has(memberId));

                    if (isSameAsPastA) {
                       penaltyA++;
                    }
                    if (isSameAsPastB) {
                       penaltyB++;
                    }
                });
                
                return penaltyA - penaltyB;
            });
            
            const selectedPlayers = new Set<string>();
            const teams: Team[] = [];
            
            for (const pTeam of allPossibleTeams) {
                const playerIds = pTeam.map(p => p.id);
                if (playerIds.some(id => selectedPlayers.has(id))) {
                    continue;
                }

                playerIds.forEach(id => selectedPlayers.add(id));
                teams.push({
                    id: uuidv4(),
                    name: pTeam.map(p => p.name).join(' & '),
                    memberIds: playerIds,
                    teamIndex: teams.length,
                });
            }

            const matches = generateRoundRobinMatches(teams);
            
            const updatedTournament: Tournament = {
                ...tournament,
                teams: [...(tournament.teams || []), ...teams],
                matches: [...(tournament.matches || []), ...matches.map(m => ({ ...m, round: (tournament.currentRound || 0) + 1 }))],
                currentRound: (tournament.currentRound || 0) + 1,
            };

            await updateTournament(school, tournament.id, updatedTournament);
            onUpdateTournament(updatedTournament);
            toast({ title: "다음 라운드 생성", description: `${updatedTournament.currentRound} 라운드의 경기가 생성되었습니다.` });

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '다음 라운드 생성 실패' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEndLeague = async () => {
        if (!school || tournament.isFinished) return;
        setIsLoading(true);
        try {
            const updatedTournament = { ...tournament, isFinished: true };
            await updateTournament(school, tournament.id, updatedTournament);
            onUpdateTournament(updatedTournament);
            toast({ title: "리그 종료됨" });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '리그 종료 실패' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateLeagueMatch = async (matchId: string) => {
        if (!school || !tournament.participants || !tournament.pointsPerWin) return;
        
        const match = tournament.matches.find(m => m.id === matchId);
        const results = matchResults[matchId];
        if (!match || !results) return;
        
        const scoresA = results.scoresA.map(s => parseInt(s, 10));
        const scoresB = results.scoresB.map(s => parseInt(s, 10));

        let winsA = 0;
        let winsB = 0;
        for (let i = 0; i < Math.max(scoresA.length, scoresB.length); i++) {
            if ((scoresA[i] || 0) > (scoresB[i] || 0)) winsA++;
            else if ((scoresB[i] || 0) > (scoresA[i] || 0)) winsB++;
        }

        setIsLoading(true);
        try {
            const tournamentToUpdate = JSON.parse(JSON.stringify(tournament)) as Tournament;
            const matchToUpdate = tournamentToUpdate.matches.find(m => m.id === matchId);
            if (!matchToUpdate) return;
            
            matchToUpdate.scoresA = scoresA.filter(s => !isNaN(s));
            matchToUpdate.scoresB = scoresB.filter(s => !isNaN(s));
            matchToUpdate.status = 'completed';
            
            let winnerId = null;
            if (winsA > winsB) winnerId = matchToUpdate.teamAId;
            else if (winsB > winsA) winnerId = matchToUpdate.teamBId;
            matchToUpdate.winnerId = winnerId;
            
            const winnerTeam = tournamentToUpdate.teams.find(t => t.id === winnerId);
            if (winnerTeam) {
                winnerTeam.memberIds.forEach(memberId => {
                    const participant = tournamentToUpdate.participants?.find(p => p.id === memberId);
                    if (participant) {
                        participant.totalPoints += (tournament.pointsPerWin || 3);
                    }
                });
            }

            await updateTournament(school, tournament.id, tournamentToUpdate);
            onUpdateTournament(tournamentToUpdate);
            toast({ title: "경기 결과 저장 완료" });

        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "결과 저장 실패" });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleMatchResultChange = (
        matchId: string,
        team: 'A' | 'B',
        gameIndex: number,
        score: string
    ) => {
        setMatchResults((prev) => {
        const newResults = { ...prev };
        const currentScores = newResults[matchId] || { scoresA: [], scoresB: [] };
        const newScoresA = [...currentScores.scoresA];
        const newScoresB = [...currentScores.scoresB];

        if (team === 'A') {
            newScoresA[gameIndex] = score;
        } else {
            newScoresB[gameIndex] = score;
        }
        
        newResults[matchId] = { scoresA: newScoresA, scoresB: newScoresB };
        return newResults;
        });
    };

    const sortedParticipants = useMemo(() => {
        return [...(tournament.participants || [])].sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) {
                return b.totalPoints - a.totalPoints;
            }
            return a.initialRank - b.initialRank;
        });
    }, [tournament.participants]);

    const currentRoundMatches = useMemo(() => {
        return tournament.matches.filter(m => m.round === tournament.currentRound);
    }, [tournament.matches, tournament.currentRound]);

    const teamNameMap = useMemo(() => {
        return new Map(tournament.teams.map((team) => [team.id, team.name]));
    }, [tournament.teams]);


    return (
        <Card>
            <CardHeader>
                <CardTitle>{tournament.name} 진행</CardTitle>
                <div className='flex gap-2'>
                    <Button onClick={handleNextRound} disabled={isLoading || tournament.isFinished}>다음 라운드 생성</Button>
                    <Button onClick={handleEndLeague} disabled={isLoading || tournament.isFinished} variant="destructive">리그 종료</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-2 text-center">경기 목록 (라운드 {tournament.currentRound || 0})</h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                           {currentRoundMatches.length > 0 ? currentRoundMatches.map(match => (
                                <LeagueMatchNode
                                    key={match.id}
                                    match={match}
                                    tournament={tournament}
                                    teamNameMap={teamNameMap}
                                    onResultChange={handleMatchResultChange}
                                    onUpdateMatch={handleUpdateLeagueMatch}
                                    onResetMatch={() => { /* Not implemented for league */ }}
                                    onUpdateTeamName={() => { /* Not implemented for league */ }}
                                    matchResults={matchResults}
                                />
                           )) : (
                               <div className='text-center text-muted-foreground p-4'>생성된 경기가 없습니다. '다음 라운드 생성' 버튼을 눌러주세요.</div>
                           )}
                        </div>
                    </div>
                     <div>
                        <h3 className="font-semibold text-lg mb-2 text-center">개인 순위</h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>순위</TableHead>
                                    <TableHead>이름</TableHead>
                                    <TableHead>총 승점</TableHead>
                                    <TableHead>상태</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedParticipants.map((p, index) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-bold flex items-center">
                                            {index + 1}
                                            {tournament.isFinished && index === 0 && <Crown className="w-5 h-5 text-yellow-500 ml-2"/>}
                                            {tournament.isFinished && index === 1 && <Medal className="w-5 h-5 text-gray-400 ml-2"/>}
                                            {tournament.isFinished && index === 2 && <TrophyIcon className="w-5 h-5 text-orange-400 ml-2"/>}
                                        </TableCell>
                                        <TableCell>{p.name}</TableCell>
                                        <TableCell>{p.totalPoints}</TableCell>
                                        <TableCell>{p.status === 'active' ? '진행중' : '탈락'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
