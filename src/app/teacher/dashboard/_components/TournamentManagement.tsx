"use client";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  saveTournament,
  getTournaments,
  deleteTournament,
  updateTournament,
} from "@/lib/store";
import { TeamGroup, Tournament, Match, Team } from "@/lib/types";
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

const generateTournamentBracket = (teams: Team[]): Match[] => {
    const numTeams = teams.length;
    if (numTeams < 2) return [];

    const matches: Match[] = [];
    const numRounds = Math.ceil(Math.log2(numTeams));
    const totalSlots = Math.pow(2, numRounds);
    const byes = totalSlots - numTeams;

    let currentRoundEntrants: (Team | Match)[] = [...teams];
    
    // 1라운드 처리
    let round1Matches: Match[] = [];
    const teamsInRound1 = currentRoundEntrants.slice(byes);
    const teamsWithByes = currentRoundEntrants.slice(0, byes);

    for (let i = 0; i < teamsInRound1.length; i += 2) {
        const match: Match = {
            id: uuidv4(),
            round: 1,
            matchNumber: i / 2 + 1,
            teamAId: teamsInRound1[i].id,
            teamBId: teamsInRound1[i + 1].id,
            scoreA: null,
            scoreB: null,
            winnerId: null,
            status: 'scheduled',
            nextMatchId: null,
            nextMatchSlot: null
        };
        round1Matches.push(match);
    }
    matches.push(...round1Matches);
    
    currentRoundEntrants = [...teamsWithByes, ...round1Matches];

    // 2라운드부터 결승까지 처리
    for (let round = 2; round <= numRounds; round++) {
        const nextRoundMatches: Match[] = [];
        for (let i = 0; i < currentRoundEntrants.length; i += 2) {
            const entrantA = currentRoundEntrants[i];
            const entrantB = currentRoundEntrants[i + 1];

            const match: Match = {
                id: uuidv4(),
                round: round,
                matchNumber: i / 2 + 1,
                teamAId: 'winnerId' in entrantA ? entrantA.winnerId : entrantA.id,
                teamBId: entrantB ? ('winnerId' in entrantB ? entrantB.winnerId : entrantB.id) : null,
                scoreA: null,
                scoreB: null,
                winnerId: null,
                status: 'scheduled',
                nextMatchId: null,
                nextMatchSlot: null,
            };

            if (!match.teamBId) {
                match.winnerId = match.teamAId;
                match.status = 'bye';
            }

            if ('id' in entrantA && !('winnerId' in entrantA)) {
                // 부전승 팀 객체인 경우
            } else {
                 (entrantA as Match).nextMatchId = match.id;
                 (entrantA as Match).nextMatchSlot = 'A';
            }
            if (entrantB) {
                if ('id' in entrantB && !('winnerId' in entrantB)) {
                    // 부전승 팀 객체인 경우
                } else {
                    (entrantB as Match).nextMatchId = match.id;
                    (entrantB as Match).nextMatchSlot = 'B';
                }
            }
            
            nextRoundMatches.push(match);
        }
        matches.push(...nextRoundMatches);
        currentRoundEntrants = nextRoundMatches;
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
  const [tournamentType, setTournamentType] = useState<"tournament">("tournament");
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState("");
  
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
      matches: [],
    };
    
    const teams = [...selectedTeamGroup.teams];
    // Randomize team order
    for (let i = teams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teams[i], teams[j]] = [teams[j], teams[i]];
    }

    if (tournamentType === 'tournament') {
        tournamentData.matches = generateTournamentBracket(teams);
    } 

    setIsLoading(true);
    try {
      if (currentTournament && (isRegenerate || currentTournament.name !== tournamentName)) {
        let updateData: Partial<Tournament> = { name: tournamentName };
        if (isRegenerate) {
            updateData.matches = tournamentData.matches;
        }
        await updateTournament(school, currentTournament.id, updateData);
        const updatedTournaments = await getTournaments(school);
        setTournaments(updatedTournaments);
        const reloadedTournament = updatedTournaments.find(t => t.id === currentTournament.id);
        if (reloadedTournament) handleLoadTournament(reloadedTournament.id);
        toast({ title: "대회 정보 업데이트 완료" });
      } else if (!currentTournament) {
        await saveTournament(tournamentData as Omit<Tournament, 'id' | 'createdAt'>);
        toast({ title: "새로운 대회 생성 완료" });
        onTournamentUpdate();
        resetForm();
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsLoading(false);
    }
  };

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
        setTournamentType(tournament.type as 'tournament');
        setSelectedTeamGroupId(tournament.teamGroupId);
        
        const initialResults: Record<string, { scoreA: string, scoreB: string }> = {};
        tournament.matches?.forEach(match => {
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
          let matchToUpdate = newTournamentData.matches?.find(m => m.id === matchId);
      
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
                      if (nextMatch.teamAId && !nextMatch.teamBId) {
                        nextMatch.winnerId = nextMatch.teamAId;
                        nextMatch.status = 'bye';
                      }
                  }
              }
          } else {
              throw new Error("Match not found");
          }
      
          await updateTournament(school, currentTournament.id, {
              matches: newTournamentData.matches,
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
          let tournamentToUpdate = JSON.parse(JSON.stringify(currentTournament)) as Tournament;
          
          const resetMatchRecursive = (mId: string | null): boolean => {
              if (!mId) return true;

              const matchToReset = tournamentToUpdate.matches.find(m => m.id === mId);
              if (!matchToReset) return false;
              
              if (matchToReset.status === 'scheduled') return true;

              if (matchToReset.nextMatchId) {
                  const nextMatch = tournamentToUpdate.matches.find(m => m.id === matchToReset.nextMatchId);
                  if (nextMatch && nextMatch.status === 'completed') {
                       toast({ variant: 'destructive', title: '초기화 불가', description: '다음 라운드 경기가 이미 진행되어 결과를 초기화할 수 없습니다. 다음 경기를 먼저 초기화해주세요.' });
                       return false;
                  }
                   if(nextMatch){
                      if (matchToReset.nextMatchSlot === 'A') {
                          nextMatch.teamAId = null;
                      } else {
                          nextMatch.teamBId = null;
                      }
                      nextMatch.status = 'scheduled';
                      nextMatch.winnerId = null;
                      nextMatch.scoreA = null;
                      nextMatch.scoreB = null;
                      setMatchResults(prev => ({ ...prev, [nextMatch!.id]: { scoreA: '', scoreB: '' } }));
                  }
              }

              matchToReset.scoreA = null;
              matchToReset.scoreB = null;
              matchToReset.winnerId = null;
              matchToReset.status = 'scheduled';
              setMatchResults(prev => ({ ...prev, [mId]: { scoreA: '', scoreB: '' } }));

              return true;
          }

          if (resetMatchRecursive(matchId)) {
            await updateTournament(school, currentTournament.id, {
                matches: tournamentToUpdate.matches,
            });
            setCurrentTournament(tournamentToUpdate);
            toast({ title: "경기 결과 초기화 완료" });
          }

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
        // Here we use team.id directly assuming it is a unique identifier for the team.
        const firstStudent = team.members?.[0];
        const teamName = firstStudent ? `${firstStudent.grade}-${firstStudent.classNum} ${relativeTeamIndex(team, selectedTeamGroup)}팀` : `팀 ${team.teamIndex + 1}`;
        map.set(team.id, teamName);
    });
    return map;
  }, [selectedTeamGroup]);
  
  const relativeTeamIndex = (team: Team, group: TeamGroup) => {
      if (!team.members || team.members.length === 0) return team.teamIndex + 1;
      const firstStudent = team.members[0];
      const teamsInClass = group.teams.filter(t => t.members?.[0]?.grade === firstStudent.grade && t.members?.[0]?.classNum === firstStudent.classNum);
      return teamsInClass.findIndex(t => t.id === team.id) + 1;
  };

  const finalMatch = useMemo(() => {
    if (!currentTournament?.matches || currentTournament.matches.length === 0) return null;
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
                    setTournamentType(v as 'tournament')
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
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-4 gap-2">
                <Button onClick={() => handleCreateOrUpdateTournament(!!currentTournament)} disabled={isLoading}>
                    {currentTournament ? '이름 변경 저장' : '대진표 생성'}
                </Button>
                 {currentTournament && (
                     <Button variant="outline" onClick={() => handleCreateOrUpdateTournament(true)} disabled={isLoading}>
                        대진표 재구성
                    </Button>
                 )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {currentTournament && currentTournament.type === 'tournament' && finalMatch && (
            <Card>
                <CardHeader>
                    <CardTitle>{currentTournament.name} 대진표</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto p-4 flex justify-center">
                    <div className="relative">
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

    const teamAMatch = allMatches.find(m => m.nextMatchId === match.id && m.nextMatchSlot === 'A');
    const teamBMatch = allMatches.find(m => m.nextMatchId === match.id && m.nextMatchSlot === 'B');
    
    return (
        <div className="flex items-center">
            <div className="flex flex-col justify-around space-y-2">
                {teamAMatch && (
                     <MatchNode 
                        match={teamAMatch} 
                        allMatches={allMatches} 
                        teamNameMap={teamNameMap}
                        matchResults={matchResults}
                        onResultChange={onResultChange}
                        onUpdateMatch={onUpdateMatch}
                        onResetMatch={onResetMatch}
                    />
                )}
                 {teamBMatch && (
                     <MatchNode 
                        match={teamBMatch} 
                        allMatches={allMatches} 
                        teamNameMap={teamNameMap}
                        matchResults={matchResults}
                        onResultChange={onResultChange}
                        onUpdateMatch={onUpdateMatch}
                        onResetMatch={onResetMatch}
                    />
                )}
            </div>
            
            <div className="relative flex w-44 flex-col justify-center rounded-md border bg-card p-2 shadow-sm space-y-1 ml-4">
              <div className="flex items-center justify-between">
                <span className={`truncate text-sm ${winnerIsA ? 'font-bold text-primary' : ''} ${match.teamAId ? '' : 'text-muted-foreground'}`}>
                  {match.teamAId ? (teamNameMap.get(match.teamAId) || '부전승') : '미정'}
                </span>
                <Input
                  type="number"
                  className="h-7 w-12 text-center"
                  placeholder="-"
                  value={matchResults[match.id]?.scoreA ?? ''}
                  onChange={(e) => onResultChange(match.id, 'A', e.target.value)}
                  disabled={match.status === 'completed' || match.status === 'bye'}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`truncate text-sm ${winnerIsB ? 'font-bold text-primary' : ''} ${match.teamBId ? '' : 'text-muted-foreground'}`}>
                  {match.teamBId ? (teamNameMap.get(match.teamBId) || '팀 없음') : (match.status === 'bye' ? '부전승' : '미정')}
                </span>
                <Input
                  type="number"
                  className="h-7 w-12 text-center"
                  placeholder="-"
                  value={matchResults[match.id]?.scoreB ?? ''}
                  onChange={(e) => onResultChange(match.id, 'B', e.target.value)}
                  disabled={match.status === 'completed' || !match.teamBId || match.status === 'bye'}
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
