"use client";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  saveTournament,
  getTournaments,
  deleteTournament,
  updateTournament,
} from "@/lib/store";
import { TeamGroup, Tournament, Match, TournamentGroup } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Trash2,
  RefreshCw,
  Swords,
  Users,
  Send,
  Plus,
  Shuffle,
  Save,
} from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';

type TournamentManagementProps = {
  teamGroups: TeamGroup[];
  onTournamentUpdate: () => void;
};

type EnrichedMatch = Match & { teamAName?: string; teamBName?: string };
type EnrichedTournamentGroup = Omit<TournamentGroup, 'matches'> & { matches: EnrichedMatch[] };

const generateTournamentBracket = (teamIds: string[]): Match[] => {
  let teams = [...teamIds];
  const numTeams = teams.length;
  if (numTeams < 2) return [];

  const rounds = Math.ceil(Math.log2(numTeams));
  const totalSlots = Math.pow(2, rounds);
  const byes = totalSlots - numTeams;

  // Add byes and shuffle for first round placement
  for (let i = 0; i < byes; i++) {
    teams.push('bye');
  }
  teams.sort(() => Math.random() - 0.5);

  let matches: Match[] = [];
  let previousRoundMatches: Match[] = [];

  // Generate matches from round 1 up to the final
  for (let round = 1; round <= rounds; round++) {
    const currentRoundMatches: Match[] = [];
    const numMatchesInRound = Math.pow(2, rounds - round);

    for (let i = 0; i < numMatchesInRound; i++) {
      const match: Match = {
        id: uuidv4(),
        round,
        matchNumber: i + 1,
        teamAId: null,
        teamBId: null,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        status: 'scheduled',
        nextMatchId: null,
        nextMatchSlot: null,
      };
      currentRoundMatches.push(match);
    }

    if (round > 1) {
      for (let i = 0; i < previousRoundMatches.length; i++) {
        const prevMatch = previousRoundMatches[i];
        const nextMatchIndex = Math.floor(i / 2);
        const nextSlot = (i % 2 === 0) ? 'A' : 'B';
        prevMatch.nextMatchId = currentRoundMatches[nextMatchIndex].id;
        prevMatch.nextMatchSlot = nextSlot;
      }
    }
    
    matches = [...matches, ...currentRoundMatches];
    previousRoundMatches = currentRoundMatches;
  }

  // Populate first round
  const firstRoundMatches = matches.filter(m => m.round === 1);
  for (let i = 0; i < teams.length; i += 2) {
    const teamA = teams[i];
    const teamB = teams[i + 1];
    const matchIndex = Math.floor(i / 2);
    const match = firstRoundMatches[matchIndex];

    if (teamA === 'bye') {
      match.teamAId = null;
      match.teamBId = teamB;
      match.winnerId = teamB;
      match.status = 'completed';
    } else if (teamB === 'bye') {
      match.teamAId = teamA;
      match.teamBId = null;
      match.winnerId = teamA;
      match.status = 'completed';
    } else {
      match.teamAId = teamA;
      match.teamBId = teamB;
    }
  }
  
  // Auto-advance winners from bye rounds
  const advanceByeWinners = () => {
    let changed = true;
    while(changed) {
      changed = false;
      matches.filter(m => m.status === 'completed' && m.winnerId && m.nextMatchId).forEach(m => {
          const nextMatch = matches.find(nm => nm.id === m.nextMatchId);
          if (nextMatch) {
              if (m.nextMatchSlot === 'A' && nextMatch.teamAId === null) {
                  nextMatch.teamAId = m.winnerId;
                  changed = true;
              } else if (m.nextMatchSlot === 'B' && nextMatch.teamBId === null) {
                  nextMatch.teamBId = m.winnerId;
                  changed = true;
              }
          }
      });
    }
  }
  advanceByeWinners();
  
  return matches;
};

export default function TournamentManagement({
  teamGroups,
  onTournamentUpdate,
}: TournamentManagementProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentType, setTournamentType] = useState<
    "round-robin" | "tournament" | "league-tournament"
  >("league-tournament");
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState("");
  const [numGroups, setNumGroups] = useState(2);

  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(
    null
  );
  
  const [matchResults, setMatchResults] = useState<Record<string, {scoreA: string, scoreB: string}>>({});

  useEffect(() => {
    async function loadTournaments() {
      if (!school) return;
      setIsLoading(true);
      try {
        const data = await getTournaments(school);
        setTournaments(data);
      } catch (error) {
        toast({ variant: "destructive", title: "대회 목록 로딩 실패" });
      } finally {
        setIsLoading(false);
      }
    }
    loadTournaments();
  }, [school, onTournamentUpdate, toast]);
  
  const selectedTeamGroup = useMemo(() => {
    return teamGroups.find(tg => tg.id === selectedTeamGroupId);
  }, [selectedTeamGroupId, teamGroups]);

  const handleCreateOrUpdateTournament = async (isRegenerate = false) => {
    if (!school || !tournamentName || !tournamentType || !selectedTeamGroup) {
      toast({ variant: "destructive", title: "정보 부족", description: "대회 이름, 종류, 참가팀을 모두 선택해주세요."});
      return;
    }

    let tournamentData: Partial<Tournament> = {
      school,
      name: tournamentName,
      type: tournamentType,
      teamGroupId: selectedTeamGroup.id,
    };
    
    const teams = [...selectedTeamGroup.teams];
     if (isRegenerate) {
        teams.sort(() => Math.random() - 0.5); 
    }

    if (tournamentType === 'tournament') {
        tournamentData.matches = generateTournamentBracket(teams.map(t => String(t.teamIndex)));
        tournamentData.groups = [];
    } else if (tournamentType === 'round-robin') {
        tournamentData.groups = [{
            name: '전체 리그',
            teamIds: teams.map(t => String(t.teamIndex)),
            matches: generateRoundRobin(teams.map(t => String(t.teamIndex)))
        }];
        tournamentData.matches = [];
    } else if (tournamentType === 'league-tournament') {
        const groups: TournamentGroup[] = Array.from({ length: numGroups }, (_, i) => ({
            name: `${String.fromCharCode(65 + i)}조`,
            teamIds: [],
            matches: [],
        }));
        
        teams.forEach((team, index) => {
            groups[index % numGroups].teamIds.push(String(team.teamIndex));
        });

        groups.forEach(group => {
            group.matches = generateRoundRobin(group.teamIds);
        });
        tournamentData.groups = groups;
        tournamentData.matches = []; // 토너먼트 단계는 나중에 생성
    }

    setIsLoading(true);
    try {
      if (currentTournament && isRegenerate) {
        // Regenerating means updating the structure
        await updateTournament(school, currentTournament.id, tournamentData);
        const updatedTournaments = await getTournaments(school);
        setTournaments(updatedTournaments);
        const reloadedTournament = updatedTournaments.find(t => t.id === currentTournament.id);
        if (reloadedTournament) handleLoadTournament(reloadedTournament.id);
        toast({ title: "대진표 재생성 완료" });
      } else if(currentTournament) {
        // Just updating name etc.
        await updateTournament(school, currentTournament.id, { name: tournamentName });
         toast({ title: "대회 정보 업데이트 완료" });
      } else {
        await saveTournament(tournamentData as Omit<Tournament, 'id' | 'createdAt'>);
        toast({ title: "새로운 대회 생성 완료" });
      }
      onTournamentUpdate();
      if (!isRegenerate) {
          resetForm();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateRoundRobin = (teamIds: string[]): Match[] => {
    const matches: Match[] = [];
    if (teamIds.length < 2) return matches;
    
    for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
            matches.push({
                id: uuidv4(),
                round: 0, // 리그는 라운드 0
                matchNumber: matches.length + 1,
                teamAId: teamIds[i],
                teamBId: teamIds[j],
                scoreA: null,
                scoreB: null,
                winnerId: null,
                status: 'scheduled',
                nextMatchId: null,
                nextMatchSlot: null
            });
        }
    }
    return matches;
  }

  const resetForm = () => {
    setSelectedTournamentId("");
    setTournamentName("");
    setTournamentType("league-tournament");
    setSelectedTeamGroupId("");
    setCurrentTournament(null);
    setMatchResults({});
  };
  
  const handleLoadTournament = (id: string) => {
    const tournament = tournaments.find(t => t.id === id);
    if(tournament) {
        setCurrentTournament(tournament);
        setSelectedTournamentId(tournament.id);
        setTournamentName(tournament.name);
        setTournamentType(tournament.type);
        setSelectedTeamGroupId(tournament.teamGroupId);
        setNumGroups(tournament.groups.length || 2);
        
        const initialResults: Record<string, { scoreA: string, scoreB: string }> = {};
        const allMatches = [...tournament.matches, ...tournament.groups.flatMap(g => g.matches)];
        allMatches.forEach(match => {
            initialResults[match.id] = {
                scoreA: match.scoreA?.toString() || '',
                scoreB: match.scoreB?.toString() || '',
            };
        });
        setMatchResults(initialResults);
    }
  }

  const handleDelete = async () => {
    if (!school || !currentTournament) return;
    setIsLoading(true);
    try {
        await deleteTournament(school, currentTournament.id);
        toast({ title: "대회 삭제 완료" });
        onTournamentUpdate();
        resetForm();
    } catch(error) {
        toast({ variant: "destructive", title: "삭제 실패" });
    } finally {
        setIsLoading(false);
    }
  }
  
  const handleMatchResultChange = (matchId: string, team: 'A' | 'B', score: string) => {
    setMatchResults(prev => ({
        ...prev,
        [matchId]: {
            ...prev[matchId],
            [team === 'A' ? 'scoreA' : 'scoreB']: score,
        }
    }));
  };

  const handleUpdateMatch = async (matchId: string, isGroupMatch: boolean, groupName?: string) => {
      if (!school || !currentTournament) return;

      const results = matchResults[matchId];
      if (!results || results.scoreA === '' || results.scoreB === '') {
          toast({ variant: "destructive", title: "점수 입력 오류", description: "두 팀의 점수를 모두 입력해주세요." });
          return;
      }

      const scoreA = parseInt(results.scoreA, 10);
      const scoreB = parseInt(results.scoreB, 10);
      if (isNaN(scoreA) || isNaN(scoreB)) {
          toast({ variant: "destructive", title: "점수 입력 오류", description: "유효한 숫자를 입력해주세요." });
          return;
      }
      
      const newTournamentData = JSON.parse(JSON.stringify(currentTournament)) as Tournament;
      let matchToUpdate: Match | undefined;

      if(isGroupMatch && groupName) {
          const group = newTournamentData.groups.find(g => g.name === groupName);
          if (group) matchToUpdate = group.matches.find(m => m.id === matchId);
      } else {
          matchToUpdate = newTournamentData.matches.find(m => m.id === matchId);
      }
      
      if (!matchToUpdate) return;

      matchToUpdate.scoreA = scoreA;
      matchToUpdate.scoreB = scoreB;
      matchToUpdate.status = 'completed';
      if (scoreA > scoreB) matchToUpdate.winnerId = matchToUpdate.teamAId;
      else if (scoreB > scoreA) matchToUpdate.winnerId = matchToUpdate.teamBId;
      else matchToUpdate.winnerId = null; 

      if (currentTournament.type === 'tournament' && matchToUpdate.winnerId && matchToUpdate.nextMatchId) {
          const nextMatch = newTournamentData.matches.find(m => m.id === matchToUpdate!.nextMatchId);
          if(nextMatch && matchToUpdate.nextMatchSlot) {
              if (matchToUpdate.nextMatchSlot === 'A') {
                  nextMatch.teamAId = matchToUpdate.winnerId;
              } else {
                  nextMatch.teamBId = matchToUpdate.winnerId;
              }
          }
      }

      setIsLoading(true);
      try {
          await updateTournament(school, currentTournament.id, newTournamentData);
          setCurrentTournament(newTournamentData); // Update local state to re-render
          toast({ title: "경기 결과 저장 완료" });
      } catch (error) {
          toast({ variant: "destructive", title: "결과 저장 실패" });
      } finally {
          setIsLoading(false);
      }
  };


  const enrichedTournament = useMemo(() => {
    if (!currentTournament || !selectedTeamGroup) return null;

    const teamNameMap = new Map<string, string>();
    selectedTeamGroup.teams.forEach((team, index) => {
      const firstStudent = team.members?.[0];
      const teamName = firstStudent ? `${firstStudent.grade}-${firstStudent.classNum}반 ${team.teamIndex + 1}팀` : `팀 ${team.teamIndex + 1}`;
      teamNameMap.set(String(team.teamIndex), teamName);
    });
    
    const enrichMatches = (matches: Match[]): EnrichedMatch[] => {
        return matches.map(match => ({
            ...match,
            teamAName: match.teamAId ? teamNameMap.get(match.teamAId) || '부전승' : '미정',
            teamBName: match.teamBId ? teamNameMap.get(match.teamBId) || '부전승' : '미정',
        }));
    }
    
    return {
        ...currentTournament,
        groups: currentTournament.groups.map(group => ({
            ...group,
            matches: enrichMatches(group.matches),
        })).sort((a,b) => a.name.localeCompare(b.name)),
        matches: enrichMatches(currentTournament.matches),
    };
  }, [currentTournament, selectedTeamGroup]);

 const tournamentRounds = useMemo(() => {
    if (!enrichedTournament || enrichedTournament.type !== 'tournament' || enrichedTournament.matches.length === 0) return [];
    
    const rounds: Record<number, EnrichedMatch[]> = {};
    enrichedTournament.matches.forEach(match => {
        if (!rounds[match.round]) {
            rounds[match.round] = [];
        }
        rounds[match.round].push(match);
    });

    return Object.entries(rounds)
      .sort(([roundA], [roundB]) => Number(roundA) - Number(roundB)) 
      .map(([, matches]) => matches.sort((a, b) => a.matchNumber - b.matchNumber));

  }, [enrichedTournament]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Swords /> 대회 관리</CardTitle>
          <CardDescription>
            새로운 리그나 토너먼트를 생성하거나, 기존 대회를 불러와 수정하고 결과를 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold">대회 불러오기 또는 새로 만들기</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <Select onValueChange={handleLoadTournament} value={selectedTournamentId}>
                <SelectTrigger className="flex-1 min-w-[200px]">
                  <SelectValue placeholder="저장된 대회를 선택하세요..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>로딩 중...</SelectItem>
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
                          <Trash2 className="mr-2 h-4 w-4"/>
                          대회 삭제
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                              이 작업은 되돌릴 수 없습니다. 대회 정보가 영구적으로 삭제됩니다.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
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
                <Label htmlFor="team-group">참가팀 그룹</Label>
                <Select
                  onValueChange={setSelectedTeamGroupId}
                  value={selectedTeamGroupId}
                  disabled={!!currentTournament}
                >
                  <SelectTrigger id="team-group">
                    <SelectValue placeholder="팀 편성 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamGroups.map((tg) => (
                      <SelectItem key={tg.id} value={tg.id}>
                        {tg.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tournament-type">대회 종류</Label>
                <Select
                  onValueChange={(v) =>
                    setTournamentType(v as any)
                  }
                  value={tournamentType}
                   disabled={!!currentTournament}
                >
                  <SelectTrigger id="tournament-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="league-tournament">
                      조별리그 후 토너먼트
                    </SelectItem>
                    <SelectItem value="round-robin">풀 리그 (라운드 로빈)</SelectItem>
                    <SelectItem value="tournament">
                      바로 토너먼트 (싱글 엘리미네이션)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tournamentType === 'league-tournament' && (
                <div className="space-y-2">
                    <Label htmlFor="num-groups">조 개수</Label>
                    <Input
                        id="num-groups"
                        type="number"
                        value={numGroups}
                        onChange={e => setNumGroups(Math.max(2, parseInt(e.target.value) || 2))}
                        min="2"
                        disabled={!!currentTournament}
                    />
                </div>
              )}
            </div>
            <div className="flex justify-end pt-4">
                <Button onClick={() => handleCreateOrUpdateTournament(!!currentTournament)} disabled={isLoading}>
                    <Shuffle className="mr-2 h-4 w-4" />
                    {currentTournament ? '대진표 다시 생성/업데이트' : '대진표 생성'}
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {enrichedTournament && (
        <Card>
            <CardHeader>
                <CardTitle>{enrichedTournament.name} 대진표 및 결과</CardTitle>
                 <CardDescription>
                    {enrichedTournament.type === 'league-tournament' && '조별 리그 결과'}
                    {enrichedTournament.type === 'round-robin' && '리그 경기 결과'}
                    {enrichedTournament.type === 'tournament' && '토너먼트 경기 결과'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {enrichedTournament.groups.map(group => (
                    <div key={group.name} className="p-4 border rounded-lg">
                        <h4 className="font-bold text-lg mb-4">
                          {group.name} 리그
                        </h4>
                        <div className="space-y-2">
                            {group.matches.map(match => (
                                <div key={match.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="flex-1 text-right font-semibold">{match.teamAName}</span>
                                    <Input 
                                      type="number" 
                                      className="w-16 text-center" 
                                      placeholder="점수" 
                                      value={matchResults[match.id]?.scoreA || ''}
                                      onChange={(e) => handleMatchResultChange(match.id, 'A', e.target.value)}
                                    />
                                    <span>vs</span>
                                    <Input 
                                      type="number" 
                                      className="w-16 text-center" 
                                      placeholder="점수" 
                                      value={matchResults[match.id]?.scoreB || ''}
                                      onChange={(e) => handleMatchResultChange(match.id, 'B', e.target.value)}
                                    />
                                    <span className="flex-1 text-left font-semibold">{match.teamBName}</span>
                                    <Button size="sm" variant="outline" onClick={() => handleUpdateMatch(match.id, true, group.name)}>
                                      <Save className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {enrichedTournament.type === 'tournament' && tournamentRounds.length > 0 && (
                    <div className="p-4 border rounded-lg overflow-x-auto">
                        <div className="flex flex-col items-center min-w-max">
                            {tournamentRounds.slice().reverse().map((round, roundIndex, allRounds) => (
                                <div key={roundIndex} className={`flex justify-around w-full ${roundIndex > 0 ? 'mt-4' : ''}`}>
                                    {round.map((match) => (
                                        <div key={match.id} className="relative flex flex-col items-center">
                                            {/* incoming lines */}
                                            {match.round < allRounds.length && (
                                                <>
                                                    <div className="absolute bottom-full left-1/2 w-px h-4 bg-gray-400"></div>
                                                    <div className="absolute" style={{bottom: 'calc(100% + 1rem - 1px)', left: '-50%', width: '100%', height:'1px', background: 'transparent' }}>
                                                         <div className="absolute top-0 left-0 w-1/2 h-full border-r border-gray-400"></div>
                                                         <div className="absolute top-0 right-0 w-1/2 h-full border-l border-gray-400"></div>
                                                    </div>
                                                </>
                                            )}
                                            
                                            <div className="p-2 bg-muted rounded-lg w-48 space-y-1 z-10">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className={`font-medium ${match.winnerId === match.teamAId ? 'text-primary' : ''}`}>{match.teamAName}</span>
                                                    <Input 
                                                        type="number" 
                                                        className="w-12 h-7 text-center" 
                                                        placeholder="-" 
                                                        value={matchResults[match.id]?.scoreA ?? ''}
                                                        onChange={(e) => handleMatchResultChange(match.id, 'A', e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className={`font-medium ${match.winnerId === match.teamBId ? 'text-primary' : ''}`}>{match.teamBName}</span>
                                                    <Input 
                                                        type="number" 
                                                        className="w-12 h-7 text-center" 
                                                        placeholder="-" 
                                                        value={matchResults[match.id]?.scoreB ?? ''}
                                                        onChange={(e) => handleMatchResultChange(match.id, 'B', e.target.value)}
                                                    />
                                                </div>
                                                <Button size="sm" className="w-full mt-1" onClick={() => handleUpdateMatch(match.id, false)} disabled={match.status === 'bye' || (!match.teamAId || !match.teamBId)}>
                                                    <Save className="mr-2 h-4 w-4" /> 저장
                                                </Button>
                                            </div>
                                             {/* Outgoing line */}
                                             {match.nextMatchId && (
                                                <div className="absolute top-full left-1/2 w-px h-4 bg-gray-400"></div>
                                             )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {enrichedTournament.groups.length === 0 && enrichedTournament.matches.length === 0 && (
                     <p className="text-center text-muted-foreground py-8">생성된 경기가 없습니다. 대진표를 생성해주세요.</p>
                )}
            </CardContent>
        </Card>
      )}

    </div>
  );
}
