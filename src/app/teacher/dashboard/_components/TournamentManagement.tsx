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
  Save,
  RotateCcw,
  Shuffle,
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
    let teams = [...teamIds];
    const numTeams = teams.length;
    if (numTeams < 2) return [];

    const matches: Match[] = [];
    const numRounds = Math.ceil(Math.log2(numTeams));
    const totalSlots = Math.pow(2, numRounds);
    const byes = totalSlots - numTeams;

    let teamsInRound1 = teams.slice(byes);
    let teamsWithByes = teams.slice(0, byes);

    // Shuffle for fairness in round 1 placement
    teamsInRound1.sort(() => Math.random() - 0.5);
    teamsWithByes.sort(() => Math.random() - 0.5);

    let previousRoundMatches: Match[] = [];
    if (teamsInRound1.length > 0) {
      for (let i = 0; i < teamsInRound1.length / 2; i++) {
        const match: Match = {
          id: uuidv4(),
          round: 1,
          matchNumber: i + 1,
          teamAId: teamsInRound1[i * 2],
          teamBId: teamsInRound1[i * 2 + 1],
          scoreA: null, scoreB: null, winnerId: null, status: 'scheduled',
          nextMatchId: null,
          nextMatchSlot: null
        };
        previousRoundMatches.push(match);
      }
      matches.push(...previousRoundMatches);
    }
    
    let currentRoundEntrants = [...previousRoundMatches.map(m => m.id), ...teamsWithByes];

    for (let round = 2; round <= numRounds; round++) {
        const currentRoundMatches: Match[] = [];
        for (let i = 0; i < currentRoundEntrants.length / 2; i++) {
            const match: Match = {
                id: uuidv4(),
                round: round,
                matchNumber: i + 1,
                teamAId: null, teamBId: null,
                scoreA: null, scoreB: null, winnerId: null, status: 'scheduled',
                nextMatchId: null,
                nextMatchSlot: null,
            };

            const entrantAId = currentRoundEntrants[i * 2];
            const entrantBId = currentRoundEntrants[i * 2 + 1];

            // If entrant is a team ID (from a bye), assign it directly
            if (teams.includes(entrantAId)) {
                match.teamAId = entrantAId;
            } else { // It's a match ID, so link it
                const prevMatchA = matches.find(m => m.id === entrantAId);
                if (prevMatchA) {
                    prevMatchA.nextMatchId = match.id;
                    prevMatchA.nextMatchSlot = 'A';
                }
            }

            if (teams.includes(entrantBId)) {
                match.teamBId = entrantBId;
            } else {
                const prevMatchB = matches.find(m => m.id === entrantBId);
                if (prevMatchB) {
                    prevMatchB.nextMatchId = match.id;
                    prevMatchB.nextMatchSlot = 'B';
                }
            }
             currentRoundMatches.push(match);
        }
        matches.push(...currentRoundMatches);
        currentRoundEntrants = currentRoundMatches.map(m => m.id);
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
  >("tournament");
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
      groups: [],
      matches: [],
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
        await updateTournament(school, currentTournament.id, tournamentData);
        const updatedTournaments = await getTournaments(school);
        setTournaments(updatedTournaments);
        const reloadedTournament = updatedTournaments.find(t => t.id === currentTournament.id);
        if (reloadedTournament) handleLoadTournament(reloadedTournament.id);
        toast({ title: "대진표 재생성 완료" });
      } else if(currentTournament) {
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
                nextMatchSlot: null,
            });
        }
    }
    return matches;
  }

  const resetForm = () => {
    setSelectedTournamentId("");
    setTournamentName("");
    setTournamentType("tournament");
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
        setNumGroups(tournament.groups?.length || 2);
        
        const initialResults: Record<string, { scoreA: string, scoreB: string }> = {};
        const allMatches = [...(tournament.matches || []), ...(tournament.groups || []).flatMap(g => g.matches)];
        allMatches.forEach(match => {
            initialResults[match.id] = {
                scoreA: match.scoreA !== null ? match.scoreA.toString() : '',
                scoreB: match.scoreB !== null ? match.scoreB.toString() : '',
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

        setIsLoading(true);
        try {
            const newTournamentData = JSON.parse(JSON.stringify(currentTournament)) as Tournament;
            let allMatches = [...(newTournamentData.matches || []), ...(newTournamentData.groups || []).flatMap(g => g.matches)];
            let matchToUpdate = allMatches.find(m => m.id === matchId);
        
            if(matchToUpdate) {
                matchToUpdate.scoreA = scoreA;
                matchToUpdate.scoreB = scoreB;
                matchToUpdate.status = 'completed';
                const winnerId = scoreA > scoreB ? matchToUpdate.teamAId : (scoreB > scoreA ? matchToUpdate.teamBId : null);
                matchToUpdate.winnerId = winnerId;
    
                if (winnerId && matchToUpdate.nextMatchId) {
                    const nextMatch = newTournamentData.matches.find(m => m.id === matchToUpdate.nextMatchId);
                    if (nextMatch) {
                         if (matchToUpdate.nextMatchSlot === 'A') {
                            nextMatch.teamAId = winnerId;
                        } else if (matchToUpdate.nextMatchSlot === 'B') {
                            nextMatch.teamBId = winnerId;
                        }
                    }
                }
            } else {
                throw new Error("Match not found");
            }
        
            await updateTournament(school, currentTournament.id, {
                matches: newTournamentData.matches,
                groups: newTournamentData.groups
            });
            setCurrentTournament(newTournamentData);
            toast({ title: "경기 결과 저장 완료" });

        } catch(error) {
            console.error(error);
            toast({ variant: "destructive", title: "결과 저장 실패" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetMatch = async (matchId: string) => {
        if (!school || !currentTournament) return;
        
        setIsLoading(true);
        try {
            const newTournamentData = JSON.parse(JSON.stringify(currentTournament)) as Tournament;
            let allMatches = [...(newTournamentData.matches || []), ...(newTournamentData.groups || []).flatMap(g => g.matches)];
            let matchToReset = allMatches.find(m => m.id === matchId);

             if (!matchToReset) {
                toast({ variant: 'destructive', title: '오류', description: '리셋할 경기를 찾지 못했습니다.' });
                setIsLoading(false);
                return;
            }

            const oldWinnerId = matchToReset.winnerId;

            // Reset current match
            matchToReset.scoreA = null;
            matchToReset.scoreB = null;
            matchToReset.winnerId = null;
            matchToReset.status = 'scheduled';
            
            // Clear local input state for this match
            setMatchResults(prev => ({ ...prev, [matchId]: { scoreA: '', scoreB: '' } }));

            // If there was a winner, find the next match and remove them
            if (oldWinnerId && matchToReset.nextMatchId) {
                let nextMatch = newTournamentData.matches.find(m => m.id === matchToReset.nextMatchId);
                if (nextMatch) {
                    // Check if the next match is not already completed
                    if (nextMatch.status !== 'completed') {
                        if (nextMatch.teamAId === oldWinnerId) {
                            nextMatch.teamAId = null;
                        } else if (nextMatch.teamBId === oldWinnerId) {
                            nextMatch.teamBId = null;
                        }
                    } else {
                       toast({ variant: 'destructive', title: '초기화 불가', description: '다음 라운드 경기가 이미 진행되어 결과를 초기화할 수 없습니다. 다음 경기를 먼저 초기화해주세요.' });
                       setIsLoading(false);
                       return;
                    }
                }
            }
            
            await updateTournament(school, currentTournament.id, {
                matches: newTournamentData.matches,
                groups: newTournamentData.groups,
            });
            setCurrentTournament(newTournamentData);
            toast({ title: "경기 결과 초기화 완료" });

        } catch (error) {
            toast({ variant: "destructive", title: "초기화 실패" });
        } finally {
            setIsLoading(false);
        }
    }


  const teamNameMap = useMemo(() => {
    if (!selectedTeamGroup) return new Map();
    const map = new Map<string, string>();
    selectedTeamGroup.teams.forEach((team) => {
      const firstStudent = team.members?.[0];
      const teamName = firstStudent ? `${firstStudent.grade}-${firstStudent.classNum} ${relativeTeamIndex(team.teamIndex, selectedTeamGroup)}팀` : `팀 ${team.teamIndex + 1}`;
      map.set(String(team.teamIndex), teamName);
    });
    return map;
  }, [selectedTeamGroup]);
  
  const relativeTeamIndex = (teamIndex: number, group: TeamGroup) => {
      const team = group.teams.find(t => t.teamIndex === teamIndex);
      if (!team || !team.members || team.members.length === 0) return teamIndex + 1;
      const firstStudent = team.members[0];
      const teamsInClass = group.teams.filter(t => t.members?.[0]?.grade === firstStudent.grade && t.members?.[0]?.classNum === firstStudent.classNum);
      return teamsInClass.findIndex(t => t.teamIndex === teamIndex) + 1;
  };
  
    const finalMatch = useMemo(() => {
        if (!currentTournament || !currentTournament.matches || currentTournament.matches.length === 0) return null;
        const maxRound = Math.max(...currentTournament.matches.map(m => m.round));
        return currentTournament.matches.find(m => m.round === maxRound) || null;
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
                    <SelectItem value="tournament">
                      토너먼트 (싱글 엘리미네이션)
                    </SelectItem>
                    <SelectItem value="league-tournament" disabled>
                      조별리그 후 토너먼트 (준비 중)
                    </SelectItem>
                    <SelectItem value="round-robin" disabled>
                      풀 리그 (라운드 로빈) (준비 중)
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
      
        {currentTournament && currentTournament.type === 'tournament' && finalMatch && (
            <Card>
                <CardHeader>
                    <CardTitle>{currentTournament.name} 대진표</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto p-4">
                    <div className="flex justify-center p-4">
                       <MatchNode
                            match={finalMatch}
                            allMatches={currentTournament.matches}
                            teamNameMap={teamNameMap}
                            matchResults={matchResults}
                            onResultChange={handleMatchResultChange}
                            onUpdateMatch={handleUpdateMatch}
                            onResetMatch={handleResetMatch}
                        />
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

const MatchNode = ({ match, allMatches, teamNameMap, matchResults, onResultChange, onUpdateMatch, onResetMatch }: {
    match: Match;
    allMatches: Match[];
    teamNameMap: Map<string, string>;
    matchResults: Record<string, {scoreA: string, scoreB: string}>;
    onResultChange: (matchId: string, team: 'A' | 'B', score: string) => void;
    onUpdateMatch: (matchId: string) => void;
    onResetMatch: (matchId: string) => void;
}) => {
    const winnerIsA = match.winnerId && match.winnerId === match.teamAId;
    const winnerIsB = match.winnerId && match.winnerId === match.teamBId;

    const teamAChild = allMatches.find(m => m.nextMatchId === match.id && m.nextMatchSlot === 'A');
    const teamBChild = allMatches.find(m => m.nextMatchId === match.id && m.nextMatchSlot === 'B');

    return (
    <div className="flex items-center">
        <div className="flex flex-col justify-around gap-2">
            {teamAChild && (
            <MatchNode
                match={teamAChild}
                allMatches={allMatches}
                teamNameMap={teamNameMap}
                matchResults={matchResults}
                onResultChange={onResultChange}
                onUpdateMatch={onUpdateMatch}
                onResetMatch={onResetMatch}
            />
            )}
            {teamBChild && (
            <MatchNode
                match={teamBChild}
                allMatches={allMatches}
                teamNameMap={teamNameMap}
                matchResults={matchResults}
                onResultChange={onResultChange}
                onUpdateMatch={onUpdateMatch}
                onResetMatch={onResetMatch}
            />
            )}
        </div>

        {(teamAChild || teamBChild) && (
            <div className="h-full w-8 flex-shrink-0 relative">
                <div className="absolute left-0 top-1/2 w-full h-[1px] bg-muted-foreground"></div>
                {teamAChild && <div className="absolute left-0 top-0 w-[1px] h-1/2 bg-muted-foreground"></div>}
                {teamBChild && <div className="absolute left-0 bottom-0 w-[1px] h-1/2 bg-muted-foreground"></div>}
            </div>
        )}
      
      <div className="relative flex w-44 flex-col justify-center rounded-md border bg-card p-2 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm ${winnerIsA ? 'font-bold text-primary' : ''}`}>
            {match.teamAId ? (teamNameMap.get(match.teamAId) || '부전승') : '미정'}
          </span>
          <Input
            type="number"
            className="h-7 w-12 text-center"
            placeholder="-"
            value={matchResults[match.id]?.scoreA ?? ''}
            onChange={(e) => onResultChange(match.id, 'A', e.target.value)}
            disabled={match.status === 'completed'}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm ${winnerIsB ? 'font-bold text-primary' : ''}`}>
            {match.teamBId ? (teamNameMap.get(match.teamBId) || '미정') : '미정'}
          </span>
          <Input
            type="number"
            className="h-7 w-12 text-center"
            placeholder="-"
            value={matchResults[match.id]?.scoreB ?? ''}
            onChange={(e) => onResultChange(match.id, 'B', e.target.value)}
            disabled={match.status === 'completed' || !match.teamBId}
          />
        </div>
        {match.status === 'scheduled' && match.teamAId && match.teamBId && (
          <Button size="sm" className="h-7 w-full" onClick={() => onUpdateMatch(match.id)}>
            <Save className="mr-2 h-3 w-3" /> 저장
          </Button>
        )}
        {match.status === 'completed' && match.teamBId && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-full">
                <RotateCcw className="mr-2 h-3 w-3" /> 결과 초기화
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>결과를 초기화하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 경기의 점수와 승리 기록이 삭제됩니다. 다음 라운드에 진출했다면 해당 기록도 수정됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => onResetMatch(match.id)}>초기화</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};
