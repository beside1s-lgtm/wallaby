"use client";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  saveTournament,
  getTournaments,
  deleteTournament,
  updateTournament,
} from "@/lib/store";
import { Tournament, Match, Team } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Pencil,
  Plus,
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
import { v4 as uuidv4 } from "uuid";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";


type TournamentManagementProps = {
  onTournamentUpdate: () => void;
};

/* -------------------------------------------------------
 * Utils
 * ----------------------------------------------------- */
const nextPowerOfTwo = (n: number): number => {
  if (n <= 1) return 1;
  return 1 << (n - 1).toString(2).length;
};

/* -------------------------------------------------------
 * 브래킷 생성
 * ----------------------------------------------------- */
function generateTournamentBracket(teams: Team[]): { matches: Match[] } {
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  const numTeams = shuffledTeams.length;
  const allMatches: Match[] = [];

  if (numTeams < 2) return { matches: [] };

  const totalSlots = nextPowerOfTwo(numTeams);
  const numByes = totalSlots - numTeams;
  const numRound1Matches = (numTeams - numByes) / 2;

  let round1Matches: Match[] = [];
  
  // Create matches for teams that play in round 1
  let teamsToPlay = shuffledTeams.slice(numByes);
  for (let i = 0; i < numRound1Matches; i++) {
    const match: Match = {
      id: uuidv4(),
      round: 1,
      matchNumber: i + 1,
      teamAId: teamsToPlay[i * 2].id,
      teamBId: teamsToPlay[i * 2 + 1].id,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      status: "scheduled",
      nextMatchId: null,
      nextMatchSlot: null,
    };
    round1Matches.push(match);
  }

  // Create "bye" matches for teams that get a bye
  let byeTeams = shuffledTeams.slice(0, numByes);
  const byeMatches: Match[] = byeTeams.map((team, index) => ({
    id: uuidv4(),
    round: 1,
    matchNumber: numRound1Matches + index + 1,
    teamAId: team.id,
    teamBId: null,
    scoreA: null,
    scoreB: null,
    winnerId: team.id, // A bye is an automatic win
    status: 'bye',
    nextMatchId: null,
    nextMatchSlot: null,
  }));

  allMatches.push(...round1Matches, ...byeMatches);

  let currentRound = 1;
  let matchesInCurrentRound = [...allMatches];

  while (matchesInCurrentRound.length > 1) {
    const nextRoundMatches: Match[] = [];
    const numMatchesThisRound = matchesInCurrentRound.length;

    for (let i = 0; i < numMatchesThisRound / 2; i++) {
        const matchA = matchesInCurrentRound[i];
        const matchB = matchesInCurrentRound[numMatchesThisRound - 1 - i];

        const newMatch: Match = {
            id: uuidv4(),
            round: currentRound + 1,
            matchNumber: i + 1,
            teamAId: matchA.winnerId, // Can be null if match not played
            teamBId: matchB.winnerId, // Can be null if match not played
            scoreA: null,
            scoreB: null,
            winnerId: null,
            status: "scheduled",
            nextMatchId: null,
            nextMatchSlot: null,
        };
        
        // Link previous matches to this new one
        matchA.nextMatchId = newMatch.id;
        matchA.nextMatchSlot = "A";
        matchB.nextMatchId = newMatch.id;
        matchB.nextMatchSlot = "B";

        // Check for byes in the next round
        if (newMatch.teamAId && !newMatch.teamBId) {
          newMatch.winnerId = newMatch.teamAId;
          newMatch.status = "bye";
        }
        if (!newMatch.teamAId && newMatch.teamBId) {
          newMatch.winnerId = newMatch.teamBId;
          newMatch.status = "bye";
        }

        nextRoundMatches.push(newMatch);
    }
    allMatches.push(...nextRoundMatches);
    matchesInCurrentRound = nextRoundMatches;
    currentRound++;
  }
  
  return { matches: allMatches };
}


/* -------------------------------------------------------
 * 메인 컴포넌트
 * ----------------------------------------------------- */
export default function TournamentManagement({
  onTournamentUpdate,
}: TournamentManagementProps) {
  const { school } = useAuth();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentType, setTournamentType] = useState<"tournament">(
    "tournament"
  );
  
  // State for manual team entry
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState("");

  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(
    null
  );
  const [matchResults, setMatchResults] = useState<
    Record<string, { scoreA: string; scoreB: string }>
  >({});

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
  }, [school, toast]);
  
  const teamNameMap = useMemo(() => {
    if (!currentTournament?.teams) return new Map<string, string>();
    return new Map(currentTournament.teams.map((team) => [team.id, team.name]));
  }, [currentTournament]);
  
  const handleAddTeam = () => {
    if (!newTeamName.trim()) {
        toast({ variant: 'destructive', title: '팀 이름을 입력해주세요.'});
        return;
    }
    if (teamList.some(team => team.name === newTeamName.trim())) {
        toast({ variant: 'destructive', title: '이미 존재하는 팀 이름입니다.'});
        return;
    }
    const newTeam: Team = {
        id: uuidv4(),
        name: newTeamName.trim(),
        teamIndex: teamList.length,
        memberIds: [],
    };
    setTeamList(prev => [...prev, newTeam]);
    setNewTeamName("");
    setCurrentTournament(null); // Reset bracket if teams change
  };

  const handleRemoveTeam = (teamId: string) => {
    setTeamList(prev => prev.filter(team => team.id !== teamId));
    setCurrentTournament(null); // Reset bracket if teams change
  };

  const handleCreateOrUpdateTournament = async () => {
    if (!school || !tournamentName) {
      toast({
        variant: "destructive",
        title: "정보 부족",
        description: "대회 이름을 입력해주세요.",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      if (currentTournament) {
        // 이름만 변경
        if (currentTournament.name !== tournamentName) {
          await updateTournament(school, currentTournament.id, {
            name: tournamentName,
          });
          setCurrentTournament(prev => prev ? { ...prev, name: tournamentName } : null);
          setTournaments(prev => prev.map(t => t.id === currentTournament.id ? { ...t, name: tournamentName } : t));
          toast({ title: "대회 이름 변경 완료" });
        } else {
          toast({ title: "변경 사항 없음" });
        }
      } else {
         if (teamList.length < 2) {
          toast({ variant: "destructive", title: "팀 부족", description: "대진표를 생성하려면 최소 2팀이 필요합니다." });
          setIsLoading(false);
          return;
        }
        // 새 대회 생성
        const { matches } = generateTournamentBracket(teamList);

        const tournamentData: Omit<Tournament, "id" | "createdAt"> = {
          school,
          name: tournamentName,
          type: tournamentType,
          teams: teamList,
          matches,
        };
        
        const newTournament = await saveTournament(tournamentData);
        
        setTournaments(prev => [newTournament, ...prev]);
        handleLoadTournament(newTournament.id, newTournament); // Load the newly created tournament immediately

        toast({ title: "새로운 대회 생성 완료" });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomizeBracket = async () => {
    if (!school || !currentTournament) return;
    setIsLoading(true);
    try {
      const { matches: newMatches } = generateTournamentBracket(currentTournament.teams);
      await updateTournament(school, currentTournament.id, { matches: newMatches });

      const reloadedTournament = { ...currentTournament, matches: newMatches };
      setTournaments(prev => prev.map(t => t.id === reloadedTournament.id ? reloadedTournament : t));
      handleLoadTournament(reloadedTournament.id, reloadedTournament);

      toast({ title: "대진표 재추첨 완료" });
    } catch (error) {
      console.error("Failed to randomize bracket:", error);
      toast({ variant: "destructive", title: "재추첨 실패" });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTournamentId("");
    setTournamentName("");
    setTournamentType("tournament");
    setCurrentTournament(null);
    setMatchResults({});
    setTeamList([]);
    setNewTeamName("");
  };

  const handleLoadTournament = (id: string, tournamentData?: Tournament) => {
    const tournament = tournamentData || tournaments.find((t) => t.id === id);
    if (tournament) {
      setCurrentTournament(tournament);
      setSelectedTournamentId(tournament.id);
      setTournamentName(tournament.name);
      setTournamentType(tournament.type as "tournament");
      setTeamList(tournament.teams);

      const initialResults: Record<string, { scoreA: string; scoreB: string }> = {};
      tournament.matches?.forEach((match) => {
        initialResults[match.id] = {
          scoreA: match.scoreA !== null ? match.scoreA.toString() : "",
          scoreB: match.scoreB !== null ? match.scoreB.toString() : "",
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
      toast({ title: "대회 삭제 완료" });
      setTournaments(prev => prev.filter(t => t.id !== tournamentIdToDelete));
      resetForm();
    } catch (error) {
      toast({ variant: "destructive", title: "삭제 실패" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdateTeamName = async (teamId: string, newName: string) => {
    if (!school || !currentTournament || !newName.trim()) return;

    const updatedTeams = currentTournament.teams.map(t => 
      t.id === teamId ? { ...t, name: newName.trim() } : t
    );

    setIsLoading(true);
    try {
      await updateTournament(school, currentTournament.id, { teams: updatedTeams });
      const updatedTournament = { ...currentTournament, teams: updatedTeams };
      setCurrentTournament(updatedTournament);
      setTournaments(prev => prev.map(t => t.id === updatedTournament.id ? updatedTournament : t));
      toast({ title: "팀 이름 변경 완료" });
    } catch (error) {
      console.error("Failed to update team name:", error);
      toast({ variant: "destructive", title: "이름 변경 실패" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatchResultChange = (
    matchId: string,
    team: "A" | "B",
    score: string
  ) => {
    setMatchResults((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === "A" ? "scoreA" : "scoreB"]: score,
      },
    }));
  };

  const handleUpdateMatch = async (matchId: string) => {
    if (!school || !currentTournament) return;
    const results = matchResults[matchId];
    if (!results || results.scoreA === "" || results.scoreB === "") {
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
      const tournamentToUpdate = JSON.parse(JSON.stringify(currentTournament)) as Tournament;
      let matchToUpdate = tournamentToUpdate.matches.find(m => m.id === matchId);
      
      if (matchToUpdate) {
        matchToUpdate.scoreA = scoreA;
        matchToUpdate.scoreB = scoreB;
        matchToUpdate.status = "completed";
        matchToUpdate.winnerId = scoreA > scoreB ? matchToUpdate.teamAId : matchToUpdate.teamBId;
        
        // Propagate winner to the next match
        while (matchToUpdate && matchToUpdate.nextMatchId) {
          const nextMatch = tournamentToUpdate.matches.find(m => m.id === matchToUpdate!.nextMatchId);
          if (nextMatch) {
            if (matchToUpdate.nextMatchSlot === 'A') {
              nextMatch.teamAId = matchToUpdate.winnerId;
            } else {
              nextMatch.teamBId = matchToUpdate.winnerId;
            }
             
            // Check if the next match becomes a bye
            if (nextMatch.teamAId && !nextMatch.teamBId && nextMatch.status === 'scheduled') {
                nextMatch.winnerId = nextMatch.teamAId;
                nextMatch.status = 'bye';
            } else if (!nextMatch.teamAId && nextMatch.teamBId && nextMatch.status === 'scheduled') {
                nextMatch.winnerId = nextMatch.teamBId;
                nextMatch.status = 'bye';
            } else {
              // If it's no longer a bye, ensure status is scheduled
              nextMatch.winnerId = null;
              nextMatch.status = 'scheduled';
            }
            matchToUpdate = nextMatch;
          } else {
            break;
          }
        }
      }

      await updateTournament(school, currentTournament.id, { matches: tournamentToUpdate.matches });
      setCurrentTournament(tournamentToUpdate);
      setTournaments(prev => prev.map(t => t.id === tournamentToUpdate.id ? tournamentToUpdate : t));
      toast({ title: "경기 결과 저장 완료" });
    } catch (error) {
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
      const tournamentToUpdate = JSON.parse(JSON.stringify(currentTournament)) as Tournament;

      const resetMatchRecursive = (mId: string | null): boolean => {
        if (!mId) return true;
        const matchToReset = tournamentToUpdate.matches.find(m => m.id === mId);
        if (!matchToReset || matchToReset.status !== 'completed') return true;

        if (matchToReset.nextMatchId) {
          const nextMatch = tournamentToUpdate.matches.find(m => m.id === matchToReset.nextMatchId);
          if (nextMatch) {
             if (nextMatch.status === 'completed') {
                if (!resetMatchRecursive(nextMatch.id)) return false;
             }
             if (matchToReset.nextMatchSlot === "A") nextMatch.teamAId = null;
             else nextMatch.teamBId = null;
             
             nextMatch.status = 'scheduled';
             nextMatch.winnerId = null;
          }
        }

        matchToReset.scoreA = null;
        matchToReset.scoreB = null;
        matchToReset.winnerId = null;
        matchToReset.status = 'scheduled';

        setMatchResults((prev) => ({ ...prev, [mId]: { scoreA: "", scoreB: "" }}));
        return true;
      };

      if(resetMatchRecursive(matchId)){
        await updateTournament(school, currentTournament.id, { matches: tournamentToUpdate.matches });
        setCurrentTournament(tournamentToUpdate);
        setTournaments(prev => prev.map(t => t.id === tournamentToUpdate.id ? tournamentToUpdate : t));
        toast({ title: "경기 결과 초기화 완료" });
      } else {
         toast({ variant: "destructive", title: "초기화 실패" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "초기화 실패" });
    } finally {
      setIsLoading(false);
    }
  };

  const matchesByRound = useMemo(() => {
    if (!currentTournament?.matches) return {};
    return currentTournament.matches.reduce((acc, match) => {
      const round = match.round;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      acc[round].sort((a, b) => a.matchNumber - b.matchNumber);
      return acc;
    }, {} as Record<number, Match[]>);
  }, [currentTournament]);
  
  const finalMatch = useMemo(() => {
    if (!currentTournament?.matches || currentTournament.matches.length === 0) return null;
    const maxRound = Math.max(...currentTournament.matches.map((m) => m.round));
    return currentTournament.matches.find((m) => m.round === maxRound) ?? null;
  }, [currentTournament]);
  
  const fmRound = finalMatch?.round ?? Number.POSITIVE_INFINITY;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Swords /> 대회 관리</CardTitle>
          <CardDescription>새로운 리그나 토너먼트를 생성하거나, 기존 대회를 불러와 수정하고 결과를 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold">대회 불러오기 또는 새로 만들기</h3>
             <div className="flex flex-wrap gap-2 items-center">
                <Select onValueChange={(id) => handleLoadTournament(id)} value={selectedTournamentId}>
                    <SelectTrigger className="flex-1 min-w-[200px]"><SelectValue placeholder="저장된 대회를 선택하세요..." /></SelectTrigger>
                    <SelectContent>
                        {isLoading ? <SelectItem value="loading" disabled>로딩 중...</SelectItem>
                        : tournaments.length > 0 ? tournaments.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))
                        : <SelectItem value="none" disabled>저장된 대회가 없습니다.</SelectItem>}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={resetForm}><RefreshCw className="mr-2 h-4 w-4" />새 대회</Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive" disabled={!currentTournament}><Trash2 className="mr-2 h-4 w-4" />대회 삭제</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle><AlertDialogDescription>이 작업은 되돌릴 수 없습니다. 대회 정보가 영구적으로 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          </div>
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-semibold">대회 정보 설정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                <Label htmlFor="tournament-name">대회 이름</Label>
                <Input id="tournament-name" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} placeholder="예: 2학기 5학년 피구 리그" />
              </div>
               <div className="space-y-2">
                <Label htmlFor="tournament-type">대회 종류</Label>
                <Select onValueChange={(v) => setTournamentType(v as "tournament")} value={tournamentType} disabled={!!currentTournament}>
                  <SelectTrigger id="tournament-type"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="tournament">토너먼트 (싱글 엘리미네이션)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Manual Team Entry */}
            {!currentTournament && (
                <div className="space-y-4 pt-4 border-t">
                    <Label>참가팀 추가</Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="팀 이름을 입력하세요" 
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                        />
                        <Button onClick={handleAddTeam}><Plus className="h-4 w-4 mr-2" />추가</Button>
                    </div>
                    {teamList.length > 0 && (
                        <div className="p-2 border rounded-md max-h-48 overflow-y-auto">
                            <ul className="space-y-1">
                                {teamList.map(team => (
                                    <li key={team.id} className="flex justify-between items-center text-sm p-1 bg-background rounded">
                                        <span>{team.name}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveTeam(team.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}


            <div className="flex justify-end pt-4 gap-2">
              <Button onClick={handleCreateOrUpdateTournament} disabled={isLoading}><Save className="mr-2 h-4 w-4" />{currentTournament ? "이름 변경 저장" : "대진표 생성"}</Button>
              {currentTournament && (<Button variant="outline" onClick={handleRandomizeBracket} disabled={isLoading}><Shuffle className="mr-2 h-4 w-4" />대진표 재추첨</Button>)}
            </div>
          </div>
        </CardContent>
      </Card>
      {currentTournament && Object.keys(matchesByRound).length > 0 && (
        <Card>
          <CardHeader><CardTitle>{currentTournament.name} 대진표</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-4">
            <div className="flex items-start space-x-8">
              {Object.entries(matchesByRound).map(([round, matches]) => (
                <div key={round} className="flex flex-col space-y-16 min-w-[300px]">
                  <h4 className="font-bold text-center text-lg">
                    {parseInt(round) === fmRound ? "결승"
                      : Object.keys(matchesByRound).length > 1 && parseInt(round) === fmRound - 1 ? "준결승"
                      : `${matches.length * 2}강`}
                  </h4>
                  <div className="flex flex-col justify-around h-full space-y-16">
                    {matches.map((match) => (
                      <MatchNode key={match.id} match={match} teamNameMap={teamNameMap} matchResults={matchResults}
                        onResultChange={handleMatchResultChange} onUpdateMatch={handleUpdateMatch} onResetMatch={handleResetMatch}
                        onUpdateTeamName={handleUpdateTeamName} />
                    ))}
                  </div>
                </div>
              ))}
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
const MatchNode = ({ match, teamNameMap, matchResults, onResultChange, onUpdateMatch, onResetMatch, onUpdateTeamName }: {
  match: Match; teamNameMap: Map<string, string>; matchResults: Record<string, { scoreA: string; scoreB: string }>;
  onResultChange: (matchId: string, team: "A" | "B", score: string) => void;
  onUpdateMatch: (matchId: string) => void; onResetMatch: (matchId: string) => void;
  onUpdateTeamName: (teamId: string, newName: string) => void;
}) => {
  const winnerIsA = !!match.winnerId && match.winnerId === match.teamAId;
  const winnerIsB = !!match.winnerId && match.winnerId === match.teamBId;

  return (
    <div className="relative">
      <div className="relative flex w-full flex-col justify-center rounded-md border bg-card p-2 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <TeamNameEditor teamId={match.teamAId} name={match.teamAId ? teamNameMap.get(match.teamAId) ?? "미정" : "미정"} onUpdate={onUpdateTeamName}
            className={`truncate text-sm ${winnerIsA ? "font-bold text-primary" : ""} ${match.teamAId ? "" : "text-muted-foreground"}`} />
          <Input type="number" className="h-7 w-14 text-center" placeholder="-" value={matchResults[match.id]?.scoreA ?? ""}
            onChange={(e) => onResultChange(match.id, "A", e.target.value)} disabled={match.status !== 'scheduled'} />
        </div>
        <div className="flex items-center justify-between">
          <TeamNameEditor teamId={match.teamBId} name={match.teamBId ? teamNameMap.get(match.teamBId) ?? "팀 없음" : match.status === "bye" ? "(부전승)" : "미정"} onUpdate={onUpdateTeamName}
            className={`truncate text-sm ${winnerIsB ? "font-bold text-primary" : ""} ${match.teamBId ? "" : "text-muted-foreground"}`} />
          <Input type="number" className="h-7 w-14 text-center" placeholder="-" value={matchResults[match.id]?.scoreB ?? ""}
            onChange={(e) => onResultChange(match.id, "B", e.target.value)} disabled={match.status !== 'scheduled' || !match.teamBId} />
        </div>
        
        {match.status === 'scheduled' && match.teamAId && match.teamBId && (
          <Button size="sm" className="h-7 w-full" onClick={() => onUpdateMatch(match.id)}><Save className="mr-2 h-3 w-3" /> 결과 저장</Button>
        )}
        
        {match.status === "completed" && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-full"><RotateCcw className="mr-2 h-3 w-3" /> 결과 초기화</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>결과를 초기화하시겠습니까?</AlertDialogTitle><AlertDialogDescription>이 경기의 점수와 승리 기록이 삭제됩니다. 상위 라운드에 진출했다면 해당 기록도 수정됩니다.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={() => onResetMatch(match.id)}>초기화</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

const TeamNameEditor = ({ teamId, name, className, onUpdate }: { teamId: string | null; name: string; className: string; onUpdate: (teamId: string, newName: string) => void; }) => {
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

  if (!teamId || name === "미정" || name === "(부전승)" || name === "팀 없음") {
    return <span className={className}>{name}</span>;
  }
  
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={handleUpdate} onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
          className="h-7 p-1 text-sm" autoFocus />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className={className}>{name}</span>
      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => setIsEditing(true)}>
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
};
