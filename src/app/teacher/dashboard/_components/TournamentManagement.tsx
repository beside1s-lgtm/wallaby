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

  const handleCreateOrUpdateTournament = async () => {
    if (!school || !tournamentName || !tournamentType || !selectedTeamGroup) {
      toast({ variant: "destructive", title: "정보 부족", description: "대회 이름, 종류, 참가팀을 모두 선택해주세요."});
      return;
    }

    let tournamentData: Omit<Tournament, 'id' | 'createdAt'> = {
      school,
      name: tournamentName,
      type: tournamentType,
      teamGroupId: selectedTeamGroup.id,
      groups: [],
      matches: [],
    };
    
    const teams = [...selectedTeamGroup.teams];
    teams.sort(() => Math.random() - 0.5); 

    if (tournamentType === 'tournament') {
        tournamentData.matches = generateTournamentBracket(teams.map(t => String(t.teamIndex)));
    } else if (tournamentType === 'round-robin') {
        tournamentData.groups = [{
            name: '전체 리그',
            teamIds: teams.map(t => String(t.teamIndex)),
            matches: generateRoundRobin(teams.map(t => String(t.teamIndex)))
        }];
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
    }

    setIsLoading(true);
    try {
      if (currentTournament) {
        await updateTournament(school, currentTournament.id, tournamentData);
        toast({ title: "대회 정보 업데이트 완료" });
      } else {
        await saveTournament(tournamentData);
        toast({ title: "새로운 대회 생성 완료" });
      }
      onTournamentUpdate();
      resetForm();
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
                round: 0,
                matchNumber: matches.length + 1,
                teamAId: teamIds[i],
                teamBId: teamIds[j],
                scoreA: null,
                scoreB: null,
                winnerId: null,
                status: 'scheduled',
            });
        }
    }
    return matches;
  }

  const generateTournamentBracket = (teamIds: string[]): Match[] => {
    let teams = [...teamIds];
    const matches: Match[] = [];
    const numTeams = teams.length;
    if (numTeams < 2) return [];

    const rounds = Math.ceil(Math.log2(numTeams));
    const totalSlots = Math.pow(2, rounds);
    const byes = totalSlots - numTeams;

    for (let i = 0; i < byes; i++) {
        teams.push('bye');
    }
    teams.sort(() => Math.random() - 0.5); 

    let currentRoundTeams = teams;
    let matchCounter = 1;
    for (let round = 1; round <= rounds; round++) {
        const nextRoundTeams: (string | null)[] = [];
        let matchNumberInRound = 1;
        for (let i = 0; i < currentRoundTeams.length; i += 2) {
            const teamA = currentRoundTeams[i];
            const teamB = currentRoundTeams[i+1];
            if (teamA === 'bye') {
                nextRoundTeams.push(teamB);
            } else if (teamB === 'bye') {
                nextRoundTeams.push(teamA);
            } else {
                matches.push({
                    id: uuidv4(),
                    round,
                    matchNumber: matchCounter++,
                    teamAId: teamA,
                    teamBId: teamB,
                    scoreA: null,
                    scoreB: null,
                    winnerId: null,
                    status: 'scheduled',
                });
                nextRoundTeams.push(null); 
                matchNumberInRound++;
            }
        }
        currentRoundTeams = nextRoundTeams as string[];
    }
    return matches;
  };


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
        setMatchResults({}); // Reset results when loading a new tournament
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

  const enrichedTournament = useMemo(() => {
    if (!currentTournament || !selectedTeamGroup) return null;

    const teamNameMap = new Map<string, string>();
    selectedTeamGroup.teams.forEach((team, index) => {
      const firstStudent = team.members?.[0];
      const teamName = firstStudent ? `${firstStudent.grade}-${firstStudent.classNum}반 ${team.teamIndex + 1}팀` : `${team.teamIndex + 1}팀`;
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
        })),
        matches: enrichMatches(currentTournament.matches),
    };
  }, [currentTournament, selectedTeamGroup]);

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
                <Button onClick={handleCreateOrUpdateTournament} disabled={isLoading}>
                    <Plus className="mr-2 h-4 w-4" />
                    {currentTournament ? '대진표 다시 생성/업데이트' : '대진표 생성'}
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {enrichedTournament && (
        <Card>
            <CardHeader>
                <CardTitle>{enrichedTournament.name} 대진표</CardTitle>
                <CardDescription>
                    {enrichedTournament.type === 'league-tournament' && '조별 리그 결과'}
                    {enrichedTournament.type === 'round-robin' && '리그 경기 결과'}
                    {enrichedTournament.type === 'tournament' && '토너먼트 경기 결과'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {enrichedTournament.groups.map(group => (
                    <div key={group.name} className="p-4 border rounded-lg">
                        <h4 className="font-bold text-lg mb-2">{group.name}</h4>
                        <div className="space-y-2">
                            {group.matches.map(match => (
                                <div key={match.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="flex-1 text-right">{match.teamAName}</span>
                                    <Input type="number" className="w-16" placeholder="점수" />
                                    <span>vs</span>
                                    <Input type="number" className="w-16" placeholder="점수" />
                                    <span className="flex-1 text-left">{match.teamBName}</span>
                                    <Button size="sm" variant="outline"><Save className="h-4 w-4" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                 {enrichedTournament.matches.length > 0 && (
                    <div className="p-4 border rounded-lg">
                        <h4 className="font-bold text-lg mb-2">토너먼트</h4>
                         <div className="space-y-2">
                             {enrichedTournament.matches.map(match => (
                                <div key={match.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="text-sm text-muted-foreground w-12">R{match.round} M{match.matchNumber}</span>
                                    <span className="flex-1 text-right">{match.teamAName}</span>
                                    <Input type="number" className="w-16" placeholder="점수" />
                                    <span>vs</span>
                                    <Input type="number" className="w-16" placeholder="점수" />
                                    <span className="flex-1 text-left">{match.teamBName}</span>
                                    <Button size="sm" variant="outline"><Save className="h-4 w-4" /></Button>
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