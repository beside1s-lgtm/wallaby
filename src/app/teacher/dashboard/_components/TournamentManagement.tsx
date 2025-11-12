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

const generateTournamentBracket = (teams: Team[]): { matches: Match[], teams: Team[] } => {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const numTeams = shuffledTeams.length;

    if (numTeams < 2) {
        return { matches: [], teams: shuffledTeams };
    }

    const matches: Match[] = [];
    const numRounds = Math.ceil(Math.log2(numTeams));
    const totalSlots = Math.pow(2, numRounds);
    const numByes = totalSlots - numTeams;

    let previousRoundMatches: Match[] = [];

    // --- 1라운드 생성 ---
    const round1Matches: Match[] = [];
    let teamIndex = 0;
    
    // 부전승 처리
    for (let i = 0; i < numByes; i++) {
        const team = shuffledTeams[teamIndex++];
        if (!team) continue;
        const byeMatch: Match = {
            id: uuidv4(),
            round: 1,
            matchNumber: round1Matches.length + 1,
            teamAId: team.id,
            teamBId: null,
            scoreA: null,
            scoreB: null,
            winnerId: team.id, // 부전승이므로 바로 승자 처리
            status: 'bye',
            nextMatchId: null,
            nextMatchSlot: null,
        };
        round1Matches.push(byeMatch);
    }

    // 1라운드 경기 처리
    const teamsInFirstRound = numTeams - numByes;
    for (let i = 0; i < teamsInFirstRound / 2; i++) {
        const teamA = shuffledTeams[teamIndex++];
        const teamB = shuffledTeams[teamIndex++];
        if (!teamA || !teamB) continue;
        
        const match: Match = {
            id: uuidv4(),
            round: 1,
            matchNumber: round1Matches.length + 1,
            teamAId: teamA.id,
            teamBId: teamB.id,
            scoreA: null,
            scoreB: null,
            winnerId: null,
            status: 'scheduled',
            nextMatchId: null,
            nextMatchSlot: null,
        };
        round1Matches.push(match);
    }
    
    matches.push(...round1Matches);
    previousRoundMatches = round1Matches;

    // --- 2라운드부터 결승까지 생성 ---
    for (let round = 2; round <= numRounds; round++) {
        const currentRoundMatches: Match[] = [];
        const entrants = [...previousRoundMatches].sort((a,b) => a.matchNumber - b.matchNumber);

        for (let i = 0; i < entrants.length; i += 2) {
            const entrantA = entrants[i];
            const entrantB = entrants[i + 1];

            const match: Match = {
                id: uuidv4(),
                round: round,
                matchNumber: currentRoundMatches.length + 1,
                teamAId: entrantA.winnerId, // 1라운드 승자 또는 부전승자
                teamBId: entrantB ? entrantB.winnerId : null,
                scoreA: null,
                scoreB: null,
                winnerId: null,
                status: 'scheduled',
                nextMatchId: null,
                nextMatchSlot: null,
            };

            // 다음 라운드 진출자가 한명밖에 없으면 부전승
            if (match.teamAId && !match.teamBId) {
                match.status = 'bye';
                match.winnerId = match.teamAId;
            }

            // 이전 경기들에 다음 경기 ID 연결
            const prevMatchA = matches.find(m => m.id === entrantA.id);
            if (prevMatchA) prevMatchA.nextMatchId = match.id;
            if (prevMatchA) prevMatchA.nextMatchSlot = 'A';

            if (entrantB) {
                const prevMatchB = matches.find(m => m.id === entrantB.id);
                if (prevMatchB) prevMatchB.nextMatchId = match.id;
                if (prevMatchB) prevMatchB.nextMatchSlot = 'B';
            }
            
            currentRoundMatches.push(match);
        }
        matches.push(...currentRoundMatches);
        previousRoundMatches = currentRoundMatches;
    }

    return { matches, teams: shuffledTeams };
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
        const { matches, teams } = generateTournamentBracket(selectedTeamGroup.teams);
        const tournamentData: Omit<Tournament, 'id' | 'createdAt'> = {
          school,
          name: tournamentName,
          type: tournamentType,
          teamGroupId: selectedTeamGroup.id,
          teams: teams,
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
        const { matches: newMatches, teams: newShuffledTeams } = generateTournamentBracket(selectedTeamGroup.teams);

        await updateTournament(school, currentTournament.id, { teams: newShuffledTeams, matches: newMatches });
        
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
              
              if (matchToReset.status === 'scheduled') return true;

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
               if (matchToReset.status === 'bye') {
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
        if (fullTeam && teamGroup) { // Check if fullTeam and teamGroup exist
            const firstStudent = fullTeam.members?.[0];
            const teamName = firstStudent ? `${firstStudent.grade}-${firstStudent.classNum} ${relativeTeamIndex(fullTeam, teamGroup)}팀` : `팀 ${fullTeam.teamIndex + 1}`;
            map.set(team.id, teamName);
        } else {
             map.set(team.id, `팀 ${team.teamIndex + 1}`);
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
                <CardContent className="overflow-x-auto p-4 flex">
                    <div className="flex-1 min-w-max">
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
        <div className="flex justify-center items-center">
             <div className="flex flex-col justify-around space-y-4">
                {prevMatchA && <Bracket match={prevMatchA} allMatches={allMatches} teamNameMap={teamNameMap} matchResults={matchResults} onResultChange={onResultChange} onUpdateMatch={onUpdateMatch} onResetMatch={onResetMatch} />}
                {prevMatchB && <Bracket match={prevMatchB} allMatches={allMatches} teamNameMap={teamNameMap} matchResults={matchResults} onResultChange={onResultChange} onUpdateMatch={onUpdateMatch} onResetMatch={onResetMatch} />}
            </div>
            
            {(prevMatchA || prevMatchB) && <div className="w-8 h-full border-r border-gray-300"></div>}
            
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
