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

const generateTournamentBracket = (teamIds: string[]): { matches: Match[], finalTeamIds: string[] } => {
    const shuffledTeamIds = [...teamIds].sort(() => Math.random() - 0.5);
    let matches: Match[] = [];
    const numTeams = shuffledTeamIds.length;

    if (numTeams < 2) {
        return { matches: [], finalTeamIds: shuffledTeamIds };
    }

    const numRounds = Math.ceil(Math.log2(numTeams));
    const totalSlots = Math.pow(2, numRounds);
    const numByes = totalSlots - numTeams;

    let nextRoundEntrants: (string | Match)[] = [];

    const byeTeams = shuffledTeamIds.slice(0, numByes);
    const teamsInRound1 = shuffledTeamIds.slice(numByes);

    nextRoundEntrants.push(...byeTeams);
    
    let matchNumberR1 = 1;
    for (let i = 0; i < teamsInRound1.length; i += 2) {
        const teamAId = teamsInRound1[i];
        const teamBId = teamsInRound1[i + 1];

        if (teamAId && teamBId) {
            const match: Match = {
                id: uuidv4(),
                round: 1,
                matchNumber: matchNumberR1++,
                teamAId: teamAId,
                teamBId: teamBId,
                scoreA: null,
                scoreB: null,
                winnerId: null,
                status: 'scheduled',
                nextMatchId: null,
                nextMatchSlot: null,
            };
            matches.push(match);
            nextRoundEntrants.push(match);
        }
    }
    
    let currentRoundEntrants = nextRoundEntrants;
    for (let round = 2; round <= numRounds; round++) {
        const nextRoundMatches: Match[] = [];
        let matchNumber = 1;

        for (let i = 0; i < currentRoundEntrants.length; i += 2) {
            const entrantA = currentRoundEntrants[i];
            const entrantB = currentRoundEntrants[i + 1];

            const getTeamId = (entrant: string | Match | undefined): string | null => {
                if (!entrant) return null;
                if (typeof entrant === 'object' && entrant !== null && 'winnerId' in entrant) {
                    return entrant.winnerId;
                }
                return entrant as string;
            };

            const teamAId = getTeamId(entrantA);
            const teamBId = getTeamId(entrantB);

            const newMatch: Match = {
                id: uuidv4(),
                round: round,
                matchNumber: matchNumber++,
                teamAId: teamAId,
                teamBId: teamBId,
                scoreA: null,
                scoreB: null,
                winnerId: null,
                status: 'scheduled',
                nextMatchId: null,
                nextMatchSlot: null,
            };
            
            const linkPreviousMatch = (entrant: string | Match | undefined, slot: 'A' | 'B') => {
                if (entrant && typeof entrant === 'object' && 'id' in entrant) {
                    const prevMatch = matches.find(m => m.id === entrant.id);
                    if (prevMatch) {
                        prevMatch.nextMatchId = newMatch.id;
                        prevMatch.nextMatchSlot = slot;
                    }
                }
            };
            
            linkPreviousMatch(entrantA, 'A');
            linkPreviousMatch(entrantB, 'B');
            
            if (newMatch.teamAId && !newMatch.teamBId) {
                 newMatch.status = 'bye';
                 newMatch.winnerId = newMatch.teamAId;
            }
            
            matches.push(newMatch);
            nextRoundMatches.push(newMatch);
        }
        currentRoundEntrants = nextRoundMatches;
    }

    return { matches, finalTeamIds: shuffledTeamIds };
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

  const handleCreateOrUpdateTournament = async () => {
    if (!school || !tournamentName || !tournamentType || !selectedTeamGroup) {
      toast({ variant: "destructive", title: "정보 부족", description: "대회 이름, 종류, 참가팀을 모두 선택해주세요."});
      return;
    }

    setIsLoading(true);
    try {
      if (currentTournament) { // Update existing tournament (name only)
        if (currentTournament.name !== tournamentName) {
            await updateTournament(school, currentTournament.id, { name: tournamentName });
            toast({ title: "대회 이름 변경 완료" });
            onTournamentUpdate();
        } else {
            toast({ title: "변경 사항 없음", description: "대회 이름이 동일합니다."});
        }
      } else { // Create new tournament
        const teamIds = selectedTeamGroup.teams.map(t => t.id);
        const { matches, finalTeamIds } = generateTournamentBracket(teamIds);
        
        const teamsData = finalTeamIds.map(id => selectedTeamGroup.teams.find(t => t.id === id)).filter((t): t is Team => !!t);

        const tournamentData: Omit<Tournament, 'id' | 'createdAt'> = {
          school,
          name: tournamentName,
          type: tournamentType,
          teamGroupId: selectedTeamGroup.id,
          teams: teamsData,
          matches,
        };
        const newTournamentId = await saveTournament(tournamentData);

        const allTournaments = await getTournaments(school);
        const newTournament = allTournaments.find(t => t.id === newTournamentId);

        if (newTournament) {
            handleLoadTournament(newTournament.id);
            setCurrentTournament(newTournament);
        }

        toast({ title: "새로운 대회 생성 완료" });
        onTournamentUpdate();
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomizeTeams = async () => {
    if (!school || !currentTournament || !selectedTeamGroup) {
        toast({ variant: "destructive", title: "팀 재배정 불가", description: "먼저 대회를 불러와주세요."});
        return;
    }

    setIsLoading(true);
    try {
        const teamIds = selectedTeamGroup.teams.map(t => t.id);
        const { matches: newMatches, finalTeamIds } = generateTournamentBracket(teamIds);
        const newTeamsData = finalTeamIds.map(id => selectedTeamGroup.teams.find(t => t.id === id)).filter((t): t is Team => !!t);

        await updateTournament(school, currentTournament.id, { teams: newTeamsData, matches: newMatches });
        
        const reloadedTournaments = await getTournaments(school);
        setTournaments(reloadedTournaments);
        const reloadedTournament = reloadedTournaments.find(t => t.id === currentTournament.id);
        if (reloadedTournament) {
          handleLoadTournament(reloadedTournament.id);
          setCurrentTournament(reloadedTournament);
        }
        
        toast({ title: "팀 재배정 완료", description: "팀이 무작위로 다시 배정되었습니다." });

    } catch (error) {
        console.error("Failed to randomize teams:", error);
        toast({ variant: "destructive", title: "팀 재배정 실패" });
    } finally {
        setIsLoading(false);
    }
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
                      if (nextMatch.teamAId && !nextMatch.teamBId && nextMatch.status === 'scheduled') {
                        nextMatch.status = 'bye';
                        nextMatch.winnerId = nextMatch.teamAId;
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
              
              if (matchToReset.status === 'scheduled' || matchToReset.status === 'bye') return true;

              if (matchToReset.nextMatchId) {
                  const nextMatch = tournamentToUpdate.matches.find(m => m.id === matchToReset.nextMatchId);
                  if (nextMatch && (nextMatch.status === 'completed')) {
                       if(!resetMatchRecursive(nextMatch.id)) return false;
                  }
                  if(nextMatch){
                      if (matchToReset.nextMatchSlot === 'A') {
                          nextMatch.teamAId = null;
                      } else {
                          nextMatch.teamBId = null;
                      }
                  }
              }

              matchToReset.scoreA = null;
              matchToReset.scoreB = null;
              matchToReset.winnerId = null;
              matchToReset.status = (matchToReset.teamAId && !matchToReset.teamBId) ? 'bye' : 'scheduled';
               if (matchToReset.status === 'bye' && matchToReset.teamAId) {
                  matchToReset.winnerId = matchToReset.teamAId;
               }
              setMatchResults(prev => ({ ...prev, [mId]: { scoreA: '', scoreB: '' } }));

              return true;
          }

          if (resetMatchRecursive(matchId)) {
            await updateTournament(school, currentTournament.id, {
                matches: tournamentToUpdate.matches,
            });
            setCurrentTournament(tournamentToUpdate);
            toast({ title: "경기 결과 초기화 완료" });
          } else {
             toast({ variant: 'destructive', title: '초기화 불가', description: '상위 라운드 경기가 이미 진행되어 초기화할 수 없습니다. 상위 경기를 먼저 초기화해주세요.' });
          }

      } catch (error) {
          toast({ variant: "destructive", title: "초기화 실패" });
      } finally {
          setIsLoading(false);
      }
  }


  const teamNameMap = useMemo(() => {
    if (!currentTournament?.teams) return new Map();
    const map = new Map<string, string>();
    const teamGroup = teamGroups.find(tg => tg.id === currentTournament.teamGroupId);
    currentTournament.teams.forEach((team) => {
        const fullTeam = teamGroup?.teams.find(t => t.id === team.id);
        if (fullTeam && teamGroup && fullTeam.members) {
            const firstStudent = fullTeam.members[0];
            const teamName = firstStudent ? `${firstStudent.grade}-${firstStudent.classNum} ${relativeTeamIndex(fullTeam, teamGroup)}팀` : `팀 ${fullTeam.teamIndex + 1}`;
            map.set(team.id, teamName);
        } else if (fullTeam) {
             map.set(team.id, `팀 ${fullTeam.teamIndex + 1}`);
        }
    });
    return map;
  }, [currentTournament, teamGroups]);
  
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
                <Button onClick={() => handleCreateOrUpdateTournament()} disabled={isLoading}>
                    <Save className="mr-2 h-4 w-4" />
                    {currentTournament ? '이름 변경 저장' : '대진표 생성'}
                </Button>
                 {currentTournament && (
                     <Button variant="outline" onClick={handleRandomizeTeams} disabled={isLoading}>
                        <Shuffle className="mr-2 h-4 w-4" />
                        팀 랜덤 배정 (제비뽑기)
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
            <CardContent className="overflow-x-auto p-4">
                <div className="flex min-w-max">
                    <Bracket match={finalMatch} allMatches={currentTournament.matches} teamNameMap={teamNameMap} matchResults={matchResults} onResultChange={handleMatchResultChange} onUpdateMatch={handleUpdateMatch} onResetMatch={handleResetMatch} />
                </div>
            </CardContent>
        </Card>
    )}
    </div>
  );
}

const Bracket = ({ match, allMatches, teamNameMap, matchResults, onResultChange, onUpdateMatch, onResetMatch }: {
    match: Match;
    allMatches: Match[];
    teamNameMap: Map<string, string>;
    matchResults: Record<string, {scoreA: string, scoreB: string}>;
    onResultChange: (matchId: string, team: 'A' | 'B', score: string) => void;
    onUpdateMatch: (matchId: string) => void;
    onResetMatch: (matchId: string) => void;
}) => {
    const prevMatchA = allMatches.find(m => m.nextMatchId === match.id && m.nextMatchSlot === 'A');
    const prevMatchB = allMatches.find(m => m.nextMatchId === match.id && m.nextMatchSlot === 'B');
    
    return (
        <div className="flex items-center">
             <div className="flex flex-col justify-around">
                {prevMatchA && <Bracket match={prevMatchA} allMatches={allMatches} teamNameMap={teamNameMap} matchResults={matchResults} onResultChange={onResultChange} onUpdateMatch={onUpdateMatch} onResetMatch={onResetMatch} />}
                {!prevMatchA && match.teamAId && <div className="w-44 p-2 m-2"><span className="text-sm">{teamNameMap.get(match.teamAId) || '부전승'}</span></div>}
                
                {prevMatchB && <Bracket match={prevMatchB} allMatches={allMatches} teamNameMap={teamNameMap} matchResults={matchResults} onResultChange={onResultChange} onUpdateMatch={onUpdateMatch} onResetMatch={onResetMatch} />}
                {!prevMatchB && match.teamBId && <div className="w-44 p-2 m-2"><span className="text-sm">{teamNameMap.get(match.teamBId) || '부전승'}</span></div>}
             </div>
             
            {(prevMatchA || prevMatchB) && (
             <div className="flex flex-col items-center self-stretch">
                <div className={`w-4 h-1/2 border-r ${prevMatchA ? 'border-b' : ''} border-gray-400`}></div>
                <div className={`w-4 h-1/2 border-r ${prevMatchB ? 'border-t' : ''} border-gray-400`}></div>
             </div>
            )}
            
            <MatchNode match={match} teamNameMap={teamNameMap} matchResults={matchResults} onResultChange={onResultChange} onUpdateMatch={onUpdateMatch} onResetMatch={onResetMatch} />
        </div>
    );
};

const MatchNode = ({ match, teamNameMap, matchResults, onResultChange, onUpdateMatch, onResetMatch }: {
    match: Match;
    teamNameMap: Map<string, string>;
    matchResults: Record<string, {scoreA: string, scoreB: string}>;
    onResultChange: (matchId: string, team: 'A' | 'B', score: string) => void;
    onUpdateMatch: (matchId: string) => void;
    onResetMatch: (matchId: string) => void;
}) => {
    const winnerIsA = match.winnerId && match.winnerId === match.teamAId;
    const winnerIsB = match.winnerId && match.winnerId === match.teamBId;
    
    return (
            <div className="relative flex w-44 flex-col justify-center rounded-md border bg-card p-2 shadow-sm space-y-1 mx-2">
              <div className="flex items-center justify-between">
                <span className={`truncate text-sm ${winnerIsA ? 'font-bold text-primary' : ''} ${match.teamAId ? '' : 'text-muted-foreground'}`}>
                  {match.teamAId ? (teamNameMap.get(match.teamAId) || '미정') : '미정'}
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
                  {match.teamBId ? (teamNameMap.get(match.teamBId) || '팀 없음') : (match.status === 'bye' ? '(부전승)' : '미정')}
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
                        이 경기의 점수와 승리 기록이 삭제됩니다. 상위 라운드에 진출했다면 해당 기록도 수정됩니다.
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
    );
};
