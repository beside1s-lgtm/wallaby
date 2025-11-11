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

const generateTournamentBracket = (teamIds: string[]): Match[] => {
    const numTeams = teamIds.length;
    if (numTeams < 2) return [];

    const rounds = Math.ceil(Math.log2(numTeams));
    const totalSlots = Math.pow(2, rounds);
    const byes = totalSlots - numTeams;

    const matches: Match[] = [];
    let previousRoundMatches: Match[] = [];

    // 1. Initialize first round
    const firstRoundTeamIds = [...teamIds].sort(() => Math.random() - 0.5);
    const round1MatchesCount = (numTeams - byes) / 2;
    const round1Matches: Match[] = [];

    // Teams that play in the first round
    const playingTeams = firstRoundTeamIds.splice(0, round1MatchesCount * 2);
    
    // Teams that get a bye
    const byeTeams = firstRoundTeamIds;
    
    for (let i = 0; i < round1MatchesCount; i++) {
        const match: Match = {
            id: uuidv4(),
            round: 1,
            matchNumber: i + 1,
            teamAId: playingTeams[i*2],
            teamBId: playingTeams[i*2 + 1],
            scoreA: null, scoreB: null, winnerId: null, status: 'scheduled',
            nextMatchId: null,
        };
        round1Matches.push(match);
    }
    matches.push(...round1Matches);
    previousRoundMatches = round1Matches;

    // 2. Build subsequent rounds
    for (let round = 2; round <= rounds; round++) {
        const currentRoundMatches: Match[] = [];
        const teamsForThisRound: (string | Match)[] = [];

        // Add winners of the previous round
        teamsForThisRound.push(...previousRoundMatches);
        
        // Add bye teams in the second round
        if (round === 2) {
            teamsForThisRound.push(...byeTeams);
        }
        
        // Shuffle to randomize pairings of winners and bye teams
        teamsForThisRound.sort(() => Math.random() - 0.5);

        for (let i = 0; i < teamsForThisRound.length; i += 2) {
            const teamA = teamsForThisRound[i];
            const teamB = teamsForThisRound[i + 1];

            const match: Match = {
                id: uuidv4(),
                round: round,
                matchNumber: (i/2) + 1,
                teamAId: typeof teamA === 'string' ? teamA : null,
                teamBId: typeof teamB === 'string' ? teamB : null,
                scoreA: null, scoreB: null, winnerId: null, status: 'scheduled',
                nextMatchId: null,
            };
            
            if (typeof teamA !== 'string') { // It's a match from previous round
                const prevMatchA = matches.find(m => m.id === teamA.id);
                if(prevMatchA) prevMatchA.nextMatchId = match.id;
            }
            if (typeof teamB !== 'string' && teamB !== undefined) {
                const prevMatchB = matches.find(m => m.id === teamB.id);
                if(prevMatchB) prevMatchB.nextMatchId = match.id;
            }
            
            currentRoundMatches.push(match);
        }
        matches.push(...currentRoundMatches);
        previousRoundMatches = currentRoundMatches;
    }

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
        const teamIds = teams.map(t => String(t.teamIndex));
        tournamentData.matches = generateTournamentBracket(teamIds);
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

  const handleUpdateMatch = async (matchId: string) => {
      if (!school || !currentTournament) return;

      const results = matchResults[matchId];
      if (results.scoreA === '' || results.scoreB === '') {
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
      let matchToUpdate: Match | undefined = newTournamentData.matches.find(m => m.id === matchId) || newTournamentData.groups.flatMap(g => g.matches).find(m => m.id === matchId);
      
      if (!matchToUpdate) return;

      matchToUpdate.scoreA = scoreA;
      matchToUpdate.scoreB = scoreB;
      matchToUpdate.status = 'completed';
      const winnerId = scoreA > scoreB ? matchToUpdate.teamAId : (scoreB > scoreA ? matchToUpdate.teamBId : null);
      matchToUpdate.winnerId = winnerId;

      // Update next match if this match has a winner
      if (winnerId && matchToUpdate.nextMatchId) {
          const nextMatch = newTournamentData.matches.find(m => m.id === matchToUpdate.nextMatchId);
          if (nextMatch) {
              const previousMatchForA = newTournamentData.matches.find(m => m.nextMatchId === nextMatch.id && m.id !== matchId);
              if(previousMatchForA && (previousMatchForA.id === nextMatch.teamAId || previousMatchForA.id === nextMatch.teamBId)) {
                 // The other team is already set, this one must be the second
                 if (nextMatch.teamAId === null) nextMatch.teamAId = winnerId;
                 else nextMatch.teamBId = winnerId;
              } else {
                 if (nextMatch.teamAId === null) nextMatch.teamAId = winnerId;
                 else nextMatch.teamBId = winnerId;
              }
          }
      }

      setIsLoading(true);
      try {
          await updateTournament(school, currentTournament.id, {
              matches: newTournamentData.matches,
              groups: newTournamentData.groups
          });
          setCurrentTournament(newTournamentData); // Update local state to re-render
          toast({ title: "경기 결과 저장 완료" });
      } catch (error) {
          toast({ variant: "destructive", title: "결과 저장 실패" });
      } finally {
          setIsLoading(false);
      }
  };


  const teamNameMap = useMemo(() => {
    if (!selectedTeamGroup) return new Map();
    const map = new Map<string, string>();
    selectedTeamGroup.teams.forEach((team) => {
      const firstStudent = team.members?.[0];
      const teamName = firstStudent ? `${firstStudent.grade}-${firstStudent.classNum}반 ${team.teamIndex + 1}팀` : `팀 ${team.teamIndex + 1}`;
      map.set(String(team.teamIndex), teamName);
    });
    return map;
  }, [selectedTeamGroup]);

  const tournamentRounds = useMemo(() => {
    if (!currentTournament || currentTournament.type !== 'tournament' || !currentTournament.matches) return [];
    
    const rounds: Match[][] = [];
    currentTournament.matches.forEach(match => {
        if (!rounds[match.round - 1]) {
            rounds[match.round - 1] = [];
        }
        rounds[match.round - 1].push(match);
    });
    return rounds;
  }, [currentTournament]);


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
      
      {currentTournament && currentTournament.type === 'tournament' && tournamentRounds.length > 0 && (
         <Card>
            <CardHeader>
                <CardTitle>{currentTournament.name} 대진표</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-4">
                <div className="flex justify-center items-start min-w-max space-x-8">
                    {tournamentRounds.map((round, roundIndex) => (
                        <div key={roundIndex} className="flex flex-col justify-around h-full space-y-8">
                            <h4 className="text-center font-bold">
                              {roundIndex + 1 === tournamentRounds.length ? "결승" :
                               roundIndex + 2 === tournamentRounds.length ? "준결승" :
                               `${round.length}강`}
                            </h4>
                            {round.map(match => (
                                <MatchNode
                                    key={match.id}
                                    match={match}
                                    teamNameMap={teamNameMap}
                                    matchResults={matchResults}
                                    onResultChange={handleMatchResultChange}
                                    onUpdateMatch={handleUpdateMatch}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      )}

      {currentTournament && (currentTournament.type === 'league-tournament' || currentTournament.type === 'round-robin') && (
        <Card>
            <CardHeader>
                <CardTitle>{currentTournament.name} 리그 결과</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {currentTournament.groups.map(group => (
                    <div key={group.name} className="p-4 border rounded-lg">
                        <h4 className="font-bold text-lg mb-4">
                          {group.name}
                        </h4>
                        <div className="space-y-2">
                            {group.matches.map(match => (
                                <div key={match.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="flex-1 text-right font-semibold">{teamNameMap.get(match.teamAId!)}</span>
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
                                    <span className="flex-1 text-left font-semibold">{teamNameMap.get(match.teamBId!)}</span>
                                    <Button size="sm" variant="outline" onClick={() => handleUpdateMatch(match.id)}>
                                      <Save className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
      )}

    </div>
  );
}


const MatchNode = ({ match, teamNameMap, matchResults, onResultChange, onUpdateMatch }: {
    match: Match;
    teamNameMap: Map<string, string>;
    matchResults: Record<string, {scoreA: string, scoreB: string}>;
    onResultChange: (matchId: string, team: 'A' | 'B', score: string) => void;
    onUpdateMatch: (matchId: string) => void;
}) => {
    const winnerIsA = match.winnerId && match.winnerId === match.teamAId && match.status === 'completed';
    const winnerIsB = match.winnerId && match.winnerId === match.teamBId && match.status === 'completed';
    
    const isBye = !match.teamBId && match.status === 'completed';

    return (
        <div className="flex flex-col items-center p-2 border bg-background rounded-lg shadow-md w-64 min-h-[100px]">
            <div className="flex items-center justify-between w-full">
                <span className={`w-20 text-right text-sm truncate ${winnerIsA ? 'font-bold text-primary' : ''}`}>
                    {teamNameMap.get(match.teamAId!) || '미정'}
                </span>
                <Input 
                    type="number" 
                    className="w-12 h-7 text-center mx-1" 
                    placeholder="-"
                    value={isBye ? '승' : matchResults[match.id]?.scoreA || ''}
                    onChange={(e) => onResultChange(match.id, 'A', e.target.value)}
                    disabled={match.status === 'completed'}
                />
            </div>
            <div className="text-xs my-1">vs</div>
            <div className="flex items-center justify-between w-full">
                <span className={`w-20 text-right text-sm truncate ${winnerIsB ? 'font-bold text-primary' : ''}`}>
                    {teamNameMap.get(match.teamBId!) || (match.teamAId ? '부전승' : '미정')}
                </span>
                <Input 
                    type="number" 
                    className="w-12 h-7 text-center mx-1" 
                    placeholder="-"
                    value={isBye ? '' : matchResults[match.id]?.scoreB || ''}
                    onChange={(e) => onResultChange(match.id, 'B', e.target.value)}
                    disabled={match.status === 'completed' || isBye}
                />
            </div>
             {match.status === 'scheduled' && !isBye && (
                <Button size="sm" className="w-full mt-2 h-7" onClick={() => onUpdateMatch(match.id)} disabled={!match.teamAId || !match.teamBId}>
                    <Save className="mr-2 h-3 w-3"/> 저장
                </Button>
             )}
        </div>
    );
};
