"use client";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  saveTournament,
  getTournaments,
  deleteTournament,
  updateTournament,
  getStudents
} from "@/lib/store";
import { Tournament, Match, Team, TeamGroup, Student } from "@/lib/types";
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
  Send
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from '@/components/ui/dialog';
import { v4 as uuidv4 } from "uuid";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";


type TournamentManagementProps = {
  onTournamentUpdate: () => void;
  allTeamGroups: TeamGroup[];
};

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
 * 브래킷 생성
 * ----------------------------------------------------- */
function generateTournamentBracket(teams: Team[]): { matches: Match[] } {
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  const numTeams = shuffledTeams.length;
  let allMatches: Match[] = [];

  if (numTeams < 2) return { matches: [] };

  const totalSlots = nextPowerOfTwo(numTeams);
  const numByes = totalSlots - numTeams;

  // 1. 1라운드 생성
  let round1Matches: Match[] = [];
  const teamsToPlay = shuffledTeams.slice(numByes);
  const byeTeams = shuffledTeams.slice(0, numByes);

  // 부전승 팀을 먼저 Match 객체로 만듭니다.
  byeTeams.forEach(team => {
      round1Matches.push({
          id: uuidv4(),
          round: 1, matchNumber: 0, // 임시 matchNumber
          teamAId: team.id, teamBId: null,
          scoreA: null, scoreB: null, winnerId: team.id, status: "bye",
          nextMatchId: null, nextMatchSlot: null,
      });
  });

  // 경기하는 팀들을 Match 객체로 만듭니다.
  for (let i = 0; i < teamsToPlay.length / 2; i++) {
    round1Matches.push({
      id: uuidv4(),
      round: 1, matchNumber: 0, // 임시 matchNumber
      teamAId: teamsToPlay[i * 2].id, teamBId: teamsToPlay[i * 2 + 1].id,
      scoreA: null, scoreB: null, winnerId: null, status: "scheduled",
      nextMatchId: null, nextMatchSlot: null,
    });
  }
  
  // 전략적으로 섞어서 대진을 공평하게 배분하고 matchNumber를 할당합니다.
  let finalRound1: Match[] = [];
  const byeMatches = round1Matches.filter(m => m.status === 'bye');
  const regularMatches = round1Matches.filter(m => m.status === 'scheduled');
  
  let byeIdx = 0;
  let regularIdx = 0;
  while(byeIdx < byeMatches.length || regularIdx < regularMatches.length) {
    if(regularIdx < regularMatches.length) finalRound1.push(regularMatches[regularIdx++]);
    if(byeIdx < byeMatches.length) finalRound1.push(byeMatches[byeIdx++]);
  }
  
  finalRound1.forEach((match, index) => { match.matchNumber = index + 1; });
  allMatches = [...finalRound1];

  // 3. 상위 라운드 생성
  let currentRoundEntrants = [...finalRound1];
  let currentRound = 1;
  while (currentRoundEntrants.length > 1) {
    const nextRoundMatches: Match[] = [];
    for (let i = 0; i < Math.floor(currentRoundEntrants.length / 2); i++) {
      const matchA = currentRoundEntrants[i * 2];
      const matchB = currentRoundEntrants[i * 2 + 1];

      const newMatch: Match = {
        id: uuidv4(),
        round: currentRound + 1,
        matchNumber: i + 1,
        teamAId: matchA.winnerId,
        teamBId: matchB.winnerId,
        scoreA: null, scoreB: null, winnerId: null,
        status: "scheduled",
        nextMatchId: null, nextMatchSlot: null,
      };
      
      // 다음 라운드에서 부전승이 발생하는 경우 처리
      if (newMatch.teamAId && !newMatch.teamBId) {
        newMatch.winnerId = newMatch.teamAId;
        newMatch.status = 'bye';
      } else if (!newMatch.teamAId && newMatch.teamBId) {
        newMatch.winnerId = newMatch.teamBId;
        newMatch.status = 'bye';
      }

      matchA.nextMatchId = newMatch.id;
      matchA.nextMatchSlot = "A";
      matchB.nextMatchId = newMatch.id;
      matchB.nextMatchSlot = "B";
      nextRoundMatches.push(newMatch);
    }
    allMatches.push(...nextRoundMatches);
    currentRoundEntrants = nextRoundMatches;
    currentRound++;
  }

  return { matches: allMatches };
}




/* -------------------------------------------------------
 * 메인 컴포넌트
 * ----------------------------------------------------- */
export default function TournamentManagement({
  onTournamentUpdate,
  allTeamGroups
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
  
  const [teamSource, setTeamSource] = useState<'manual' | 'group'>('manual');
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState('');

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
          const updatedTournament = { ...currentTournament, name: tournamentName };
          setCurrentTournament(updatedTournament);
          setTournaments(prev => prev.map(t => t.id === currentTournament.id ? updatedTournament : t));
          toast({ title: "대회 이름 변경 완료" });
        } else {
          toast({ title: "변경 사항 없음" });
        }
      } else {
         const teamsForBracket = teamSource === 'group' 
            ? allTeamGroups.find(g => g.id === selectedTeamGroupId)?.teams.map((t, index) => ({...t, id: uuidv4(), name: `팀 ${t.teamIndex + 1}`})) || []
            : teamList;

         if (teamsForBracket.length < 2) {
          toast({ variant: "destructive", title: "팀 부족", description: "대진표를 생성하려면 최소 2팀이 필요합니다." });
          setIsLoading(false);
          return;
        }
        
        const { matches } = generateTournamentBracket(teamsForBracket);

        let tournamentData: Omit<Tournament, "id" | "createdAt"> = {
          school,
          name: tournamentName,
          type: tournamentType,
          teams: teamsForBracket,
          matches,
        };
        
        if (teamSource === 'group' && selectedTeamGroupId) {
          tournamentData = {...tournamentData, teamGroupId: selectedTeamGroupId};
        }
        
        const newTournament = await saveTournament(tournamentData);
        setTournaments(prev => [newTournament, ...prev]);
        handleLoadTournament(newTournament.id, newTournament);

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
    setTeamSource('manual');
    setSelectedTeamGroupId('');
  };

  const handleLoadTournament = (id: string, tournamentData?: Tournament) => {
    const tournament = tournamentData || tournaments.find((t) => t.id === id);
    if (tournament) {
      setCurrentTournament(tournament);
      setSelectedTournamentId(tournament.id);
      setTournamentName(tournament.name);
      setTournamentType(tournament.type as "tournament");
      setTeamList(tournament.teams);
      setTeamSource(tournament.teamGroupId ? 'group' : 'manual');
      setSelectedTeamGroupId(tournament.teamGroupId || '');


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
      setTournaments(prev => prev.filter(t => t.id !== tournamentIdToDelete));
      resetForm();
      toast({ title: "대회 삭제 완료" });
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
             
            if (nextMatch.teamAId && nextMatch.teamBId){
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
        if (!matchToReset || (matchToReset.status !== 'completed' && matchToReset.status !== 'bye')) return true;

        if (matchToReset.nextMatchId) {
          const nextMatch = tournamentToUpdate.matches.find(m => m.id === matchToReset.nextMatchId);
          if (nextMatch) {
             if (nextMatch.status !== 'scheduled') {
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
        if(matchToReset.teamBId !== null) { // Don't change bye status on original byes
            matchToReset.winnerId = null;
            matchToReset.status = 'scheduled';
        } else {
            matchToReset.winnerId = matchToReset.teamAId;
            matchToReset.status = 'bye';
        }


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
            
            {!currentTournament && (
                <div className="space-y-4 pt-4 border-t">
                    <Label>참가팀 설정</Label>
                    <Select value={teamSource} onValueChange={v => setTeamSource(v as 'manual' | 'group')} disabled={!!currentTournament}>
                        <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="manual">팀 이름 직접 추가</SelectItem>
                            <SelectItem value="group">저장된 팀 편성 그룹에서 가져오기</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    {teamSource === 'manual' ? (
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input placeholder="팀 이름을 입력하세요" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()} />
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
                    ) : (
                        <Select value={selectedTeamGroupId} onValueChange={setSelectedTeamGroupId} disabled={!!currentTournament}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="팀 편성 그룹 선택" /></SelectTrigger>
                            <SelectContent>
                               {allTeamGroups.length > 0 ? allTeamGroups.map(group => (
                                   <SelectItem key={group.id} value={group.id}>{group.description}</SelectItem>
                               )) : <SelectItem value="none" disabled>저장된 팀 편성 그룹이 없습니다.</SelectItem>}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}


            <div className="flex justify-end pt-4 gap-2 flex-wrap">
              <Button onClick={handleCreateOrUpdateTournament} disabled={isLoading}><Save className="mr-2 h-4 w-4" />{currentTournament ? "이름 변경 저장" : "대진표 생성"}</Button>
              {currentTournament && (<Button variant="outline" onClick={handleRandomizeBracket} disabled={isLoading}><Shuffle className="mr-2 h-4 w-4" />대진표 재추첨</Button>)}
              <SendTournamentDialog tournament={currentTournament} onUpdate={onTournamentUpdate} school={school || ''} />
            </div>
          </div>
        </CardContent>
      </Card>
      {currentTournament && Object.keys(matchesByRound).length > 0 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{currentTournament.name} 대진표</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-4">
            <div className="flex justify-center">
              <div className="flex items-start space-x-8">
                {Object.entries(matchesByRound).map(([round, matches]) => (
                  <div key={round} className="flex flex-col space-y-4 min-w-[180px]">
                    <h4 className="font-bold text-center text-lg">
                      {parseInt(round) === fmRound ? "결승"
                        : Object.keys(matchesByRound).length > 1 && parseInt(round) === fmRound - 1 ? "준결승"
                        : `${currentTournament.teams.length > Math.pow(2, parseInt(round)) ? Math.pow(2, parseInt(round)) : Math.ceil(currentTournament.teams.length / (Math.pow(2, parseInt(round)-1)))}강`}
                    </h4>
                    <div className="flex flex-col justify-around h-full space-y-4">
                      {matches.map((match) => (
                        <MatchNode key={match.id} match={match} teamNameMap={teamNameMap} matchResults={matchResults}
                          onResultChange={handleMatchResultChange} onUpdateMatch={handleUpdateMatch} onResetMatch={handleResetMatch}
                          onUpdateTeamName={handleUpdateTeamName} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
            onChange={(e) => onResultChange(match.id, "A", e.target.value)} disabled={match.status !== 'scheduled' || !match.teamAId} />
        </div>
        <div className="flex items-center justify-between">
          <TeamNameEditor teamId={match.teamBId} name={match.teamBId ? teamNameMap.get(match.teamBId) ?? "팀 없음" : match.status === "bye" ? "(부전승)" : "미정"} onUpdate={onUpdateTeamName}
            className={`truncate text-sm ${winnerIsB ? "font-bold text-primary" : ""} ${match.teamBId || match.status === 'bye' ? "" : "text-muted-foreground"}`} />
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


function SendTournamentDialog({ tournament, onUpdate, school }: { tournament: Tournament | null, onUpdate: () => void, school: string }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [allStudents, setAllStudents] = useState<Student[]>([]);

    const [targetGrade, setTargetGrade] = useState('');
    const [targetGender, setTargetGender] = useState<'all' | '남' | '여'>('all');

    const grades = useMemo(() => [...new Set(allStudents.map(s => s.grade))].sort(), [allStudents]);

    useEffect(() => {
        if(isOpen && school) {
            getStudents(school).then(setAllStudents);
        }
    }, [isOpen, school]);
    
    useEffect(() => {
        if(tournament) {
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
                    teamGroupId: tournament.teamGroupId
                };
                if (targetGrade) dataToUpdate.grade = targetGrade;
                if (targetGender) dataToUpdate.gender = targetGender;

                await updateTournament(school, tournament.id, dataToUpdate);
                toast({ title: "전달 완료", description: "팀 편성 그룹에 속한 학생들에게 대진표가 전달되었습니다." });
            } else {
                if (!targetGrade) {
                    toast({ variant: 'destructive', title: "전달 실패", description: "전달할 학년을 선택해주세요."});
                    setIsSending(false);
                    return;
                }
                await updateTournament(school, tournament.id, { grade: targetGrade, gender: targetGender });
                toast({ title: "전달 완료", description: `${targetGrade}학년 ${targetGender === 'all' ? '전체' : targetGender} 학생들에게 대진표가 전달되었습니다.` });
            }
            onUpdate();
            setIsOpen(false);
        } catch (error) {
            console.error("Failed to send tournament", error);
            toast({ variant: 'destructive', title: "전달 실패" });
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
                            ? "이 대회는 팀 편성 그룹으로 생성되었습니다. 해당 그룹의 모든 학생에게 대진표가 전달됩니다."
                            : "이 대회는 수동으로 생성되었습니다. 대진표를 전달할 학년과 성별을 지정해주세요."}
                    </DialogDescription>
                </DialogHeader>
                {!tournament?.teamGroupId && (
                     <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="grade" className="text-right">학년</Label>
                            <Select value={targetGrade} onValueChange={setTargetGrade}>
                                <SelectTrigger className="col-span-3"><SelectValue placeholder="학년 선택" /></SelectTrigger>
                                <SelectContent>
                                    {grades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="gender" className="text-right">성별</Label>
                             <Select value={targetGender} onValueChange={(v) => setTargetGender(v as any)}>
                                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
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
                    <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
                    <Button onClick={handleSend} disabled={isSending}>
                        {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        전달
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
