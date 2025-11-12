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
import { v4 as uuidv4 } from "uuid";

type TournamentManagementProps = {
  teamGroups: TeamGroup[];
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
 * 브래킷 생성 (랜덤 섞기 + 부전승 처리)
 * ----------------------------------------------------- */
function generateTournamentBracket(teamIds: string[]): { matches: Match[] } {
  const shuffledTeamIds = [...teamIds].sort(() => Math.random() - 0.5);
  const numTeams = shuffledTeamIds.length;
  const matches: Match[] = [];

  if (numTeams < 2) return { matches: [] };

  const totalSlots = nextPowerOfTwo(numTeams);
  const numByes = totalSlots - numTeams;

  const byeTeams = numByes > 0 ? shuffledTeamIds.slice(0, numByes) : [];
  const teamsToPlay =
    numByes > 0 ? shuffledTeamIds.slice(numByes) : shuffledTeamIds;

  // Round 1
  const round1Matches: Match[] = [];
  for (let i = 0; i < teamsToPlay.length; i += 2) {
    const teamA = teamsToPlay[i];
    const teamB = teamsToPlay[i + 1];

    const match: Match = {
      id: uuidv4(),
      round: 1,
      matchNumber: round1Matches.length + 1,
      teamAId: teamA,
      teamBId: teamB ?? null,
      scoreA: null,
      scoreB: null,
      winnerId: !teamB ? teamA : null,
      status: !teamB ? "bye" : "scheduled",
      nextMatchId: null,
      nextMatchSlot: null,
    };
    round1Matches.push(match);
  }
  matches.push(...round1Matches);

  // 이후 라운드
  let currentEntrants: (string | Match)[] = [...byeTeams, ...round1Matches];
  let currentRound = 1;

  while (currentEntrants.length > 1) {
    const nextRound = currentRound + 1;
    const nextRoundMatches: Match[] = [];
    let matchNumber = 1;

    for (let i = 0; i < currentEntrants.length; i += 2) {
      const entrantA = currentEntrants[i];
      const entrantB = currentEntrants[i + 1];

      const teamAId =
        typeof entrantA === "string"
          ? entrantA
          : (entrantA as Match)?.winnerId ?? null;

      const teamBId = entrantB
        ? typeof entrantB === "string"
          ? entrantB
          : (entrantB as Match)?.winnerId ?? null
        : null;

      const newMatch: Match = {
        id: uuidv4(),
        round: nextRound,
        matchNumber: matchNumber++,
        teamAId,
        teamBId,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        status: "scheduled",
        nextMatchId: null,
        nextMatchSlot: null,
      };

      if (newMatch.teamAId && !newMatch.teamBId) {
        newMatch.winnerId = newMatch.teamAId;
        newMatch.status = "bye";
      }

      if (typeof entrantA === "object" && entrantA !== null) {
        const prevMatchA = matches.find((m) => m.id === (entrantA as Match).id);
        if (prevMatchA) {
          prevMatchA.nextMatchId = newMatch.id;
          prevMatchA.nextMatchSlot = "A";
        }
      }
      if (entrantB && typeof entrantB === "object" && entrantB !== null) {
        const prevMatchB = matches.find((m) => m.id === (entrantB as Match).id);
        if (prevMatchB) {
          prevMatchB.nextMatchId = newMatch.id;
          prevMatchB.nextMatchSlot = "B";
        }
      }

      nextRoundMatches.push(newMatch);
    }

    matches.push(...nextRoundMatches);
    currentEntrants = nextRoundMatches;
    currentRound = nextRound;
  }

  return { matches };
}

/* -------------------------------------------------------
 * 메인 컴포넌트
 * ----------------------------------------------------- */
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
  const [tournamentType, setTournamentType] = useState<"tournament">(
    "tournament"
  );
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState("");
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
  }, [school, onTournamentUpdate, toast]);

  const selectedTeamGroup = useMemo(() => {
    return teamGroups.find((tg) => tg.id === selectedTeamGroupId);
  }, [selectedTeamGroupId, teamGroups]);

  /** ⚠️ relativeTeamIndex는 teamNameMap에서 사용되므로, 먼저 선언합니다. */
  const relativeTeamIndex = (team: Team, group: TeamGroup) => {
    if (!team.members || team.members.length === 0) return team.teamIndex + 1;
    const firstStudent = team.members[0];
    const teamsInClass = group.teams.filter(
      (t) =>
        t.members?.[0]?.grade === firstStudent.grade &&
        t.members?.[0]?.classNum === firstStudent.classNum
    );
    return teamsInClass.findIndex((t) => t.id === team.id) + 1;
  };

  const teamNameMap = useMemo(() => {
    if (!currentTournament?.teams) return new Map<string, string>();
    const map = new Map<string, string>();
    const teamGroup = teamGroups.find(
      (tg) => tg.id === currentTournament.teamGroupId
    );

    currentTournament.teams.forEach((team) => {
      const fullTeam = teamGroup?.teams.find((t) => t.id === team.id);
      if (fullTeam && teamGroup && fullTeam.members) {
        const firstStudent = fullTeam.members[0];
        if (firstStudent) {
          const teamName = `${firstStudent.grade}-${firstStudent.classNum} ${relativeTeamIndex(
            fullTeam,
            teamGroup
          )}팀`;
          map.set(team.id, teamName);
        } else {
          map.set(team.id, `팀 ${fullTeam.teamIndex + 1}`);
        }
      } else if (fullTeam) {
        map.set(team.id, `팀 ${fullTeam.teamIndex + 1}`);
      }
    });
    return map;
  }, [currentTournament, teamGroups]);

  const handleCreateOrUpdateTournament = async () => {
    if (!school || !tournamentName || !tournamentType || !selectedTeamGroup) {
      toast({
        variant: "destructive",
        title: "정보 부족",
        description: "대회 이름, 종류, 참가팀을 모두 선택해주세요.",
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
          toast({ title: "대회 이름 변경 완료" });
          onTournamentUpdate();
        } else {
          toast({
            title: "변경 사항 없음",
            description: "대회 이름이 동일합니다.",
          });
        }
      } else {
        // 새 대회 생성
        const teamIds = selectedTeamGroup.teams.map((t) => t.id);
        const { matches } = generateTournamentBracket(teamIds);
        const teamsData = teamIds
          .map((id) => selectedTeamGroup.teams.find((t) => t.id === id))
          .filter((t): t is Team => !!t);

        const tournamentData: Omit<Tournament, "id" | "createdAt"> = {
          school,
          name: tournamentName,
          type: tournamentType,
          teamGroupId: selectedTeamGroup.id,
          teams: teamsData,
          matches,
        };
        const newTournamentId = await saveTournament(tournamentData);
        const allTournaments = await getTournaments(school);
        const newTournament = allTournaments.find((t) => t.id === newTournamentId);
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
      toast({
        variant: "destructive",
        title: "팀 재배정 불가",
        description: "먼저 대회를 불러와주세요.",
      });
      return;
    }
    setIsLoading(true);
    try {
      const teamIds = selectedTeamGroup.teams.map((t) => t.id);
      const { matches: newMatches } = generateTournamentBracket(teamIds);
      await updateTournament(school, currentTournament.id, { matches: newMatches });

      const reloadedTournaments = await getTournaments(school);
      setTournaments(reloadedTournaments);
      const reloadedTournament = reloadedTournaments.find(
        (t) => t.id === currentTournament.id
      );
      if (reloadedTournament) {
        handleLoadTournament(reloadedTournament.id);
        setCurrentTournament(reloadedTournament);
      }
      toast({
        title: "팀 재배정 완료",
        description: "팀이 무작위로 다시 배정되었습니다.",
      });
    } catch (error) {
      console.error("Failed to randomize teams:", error);
      toast({ variant: "destructive", title: "팀 재배정 실패" });
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
    const tournament = tournaments.find((t) => t.id === id);
    if (tournament) {
      setCurrentTournament(tournament);
      setSelectedTournamentId(tournament.id);
      setTournamentName(tournament.name);
      setTournamentType(tournament.type as "tournament");
      setSelectedTeamGroupId(tournament.teamGroupId);

      const initialResults: Record<string, { scoreA: string; scoreB: string }> =
        {};
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
    setIsLoading(true);
    try {
      await deleteTournament(school, currentTournament.id);
      toast({ title: "대회 삭제 완료" });
      onTournamentUpdate();
      resetForm();
    } catch (error) {
      toast({ variant: "destructive", title: "삭제 실패" });
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
      toast({
        variant: "destructive",
        title: "점수 입력 오류",
        description: "두 팀의 점수를 모두 입력해주세요.",
      });
      return;
    }
    const scoreA = parseInt(results.scoreA, 10);
    const scoreB = parseInt(results.scoreB, 10);
    if (isNaN(scoreA) || isNaN(scoreB)) {
      toast({
        variant: "destructive",
        title: "점수 입력 오류",
        description: "유효한 숫자를 입력해주세요.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const newTournamentData = JSON.parse(
        JSON.stringify(currentTournament)
      ) as Tournament;

      const matchToUpdate = newTournamentData.matches?.find(
        (m) => m.id === matchId
      );
      if (matchToUpdate) {
        matchToUpdate.scoreA = scoreA;
        matchToUpdate.scoreB = scoreB;
        matchToUpdate.status = "completed";

        const winnerId =
          scoreA > scoreB
            ? matchToUpdate.teamAId
            : scoreB > scoreA
            ? matchToUpdate.teamBId
            : null; // 무승부는 winnerId 없음
        matchToUpdate.winnerId = winnerId;

        if (winnerId && matchToUpdate.nextMatchId) {
          const nextMatch = newTournamentData.matches.find(
            (m) => m.id === matchToUpdate.nextMatchId
          );
          if (nextMatch) {
            if (matchToUpdate.nextMatchSlot === "A") {
              nextMatch.teamAId = winnerId;
            } else if (matchToUpdate.nextMatchSlot === "B") {
              nextMatch.teamBId = winnerId;
            }
            // 상위 라운드에서 홀수 진출자 처리
            if (nextMatch.teamAId && !nextMatch.teamBId && nextMatch.status === "scheduled") {
              nextMatch.status = "bye";
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
      const tournamentToUpdate = JSON.parse(
        JSON.stringify(currentTournament)
      ) as Tournament;

      const resetMatchRecursive = (mId: string | null): boolean => {
        if (!mId) return true;
        const matchToReset = tournamentToUpdate.matches.find(
          (m) => m.id === mId
        );
        if (!matchToReset) return false;

        // 이미 예정/부전 상태면 더 할 일 없음
        if (matchToReset.status === "scheduled" || matchToReset.status === "bye")
          return true;

        // 상위 라운드가 완료돼 있으면 먼저 초기화
        if (matchToReset.nextMatchId) {
          const nextMatch = tournamentToUpdate.matches.find(
            (m) => m.id === matchToReset.nextMatchId
          );
          if (nextMatch && nextMatch.status === "completed") {
            if (!resetMatchRecursive(nextMatch.id)) return false;
          }
          if (nextMatch) {
            if (matchToReset.nextMatchSlot === "A") {
              nextMatch.teamAId = null;
            } else {
              nextMatch.teamBId = null;
            }
            // 상위 라운드 상태도 재평가 (둘 다 없으면 scheduled 유지)
            if (nextMatch.teamAId && !nextMatch.teamBId) {
              nextMatch.status = "bye";
              nextMatch.winnerId = nextMatch.teamAId;
            } else {
              nextMatch.status = "scheduled";
              nextMatch.winnerId = null;
            }
          }
        }

        matchToReset.scoreA = null;
        matchToReset.scoreB = null;
        matchToReset.winnerId = null;
        matchToReset.status =
          matchToReset.teamAId && !matchToReset.teamBId ? "bye" : "scheduled";
        if (matchToReset.status === "bye" && matchToReset.teamAId) {
          matchToReset.winnerId = matchToReset.teamAId;
        }

        setMatchResults((prev) => ({
          ...prev,
          [mId]: { scoreA: "", scoreB: "" },
        }));

        return true;
      };

      if (resetMatchRecursive(matchId)) {
        await updateTournament(school, currentTournament.id, {
          matches: tournamentToUpdate.matches,
        });
        setCurrentTournament(tournamentToUpdate);
        toast({ title: "경기 결과 초기화 완료" });
      } else {
        toast({
          variant: "destructive",
          title: "초기화 불가",
          description:
            "상위 라운드 경기가 이미 진행되어 초기화할 수 없습니다. 상위 경기를 먼저 초기화해주세요.",
        });
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
      if (!acc[round]) {
        acc[round] = [];
      }
      acc[round].push(match);
      acc[round].sort((a, b) => a.matchNumber - b.matchNumber);
      return acc;
    }, {} as Record<number, Match[]>);
  }, [currentTournament]);

  const finalMatch = useMemo(() => {
    if (!currentTournament?.matches || currentTournament.matches.length === 0)
      return null;
    const maxRound = Math.max(...currentTournament.matches.map((m) => m.round));
    return (
      currentTournament.matches.find((m) => m.round === maxRound) ?? null
    );
  }, [currentTournament]);

  const fmRound = finalMatch?.round ?? Number.POSITIVE_INFINITY;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords /> 대회 관리
          </CardTitle>
          <CardDescription>
            새로운 리그나 토너먼트를 생성하거나, 기존 대회를 불러와 수정하고 결과를
            관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 불러오기/새로 만들기 */}
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold">대회 불러오기 또는 새로 만들기</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <Select onValueChange={handleLoadTournament} value={selectedTournamentId}>
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
                <RefreshCw className="mr-2 h-4 w-4" />
                새 대회
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

          {/* 대회 정보 설정 */}
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
                  onValueChange={(v) => setTournamentType(v as "tournament")}
                  value={tournamentType}
                  disabled={!!currentTournament}
                >
                  <SelectTrigger id="tournament-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tournament">토너먼트 (싱글 엘리미네이션)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-2">
              <Button onClick={() => handleCreateOrUpdateTournament()} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {currentTournament ? "이름 변경 저장" : "대진표 생성"}
              </Button>
              {currentTournament && (
                <Button
                  variant="outline"
                  onClick={handleRandomizeTeams}
                  disabled={isLoading}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  팀 랜덤 배정 (제비뽑기)
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 대진표 */}
      {currentTournament &&
        currentTournament.type === "tournament" &&
        Object.keys(matchesByRound).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{currentTournament.name} 대진표</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-4">
              <div className="flex items-start space-x-8">
                {Object.entries(matchesByRound).map(([round, matches]) => (
                  <div key={round} className="flex flex-col space-y-16 min-w-[280px]">
                    <h4 className="font-bold text-center text-lg">
                      {parseInt(round) === fmRound
                        ? "결승"
                        : Object.keys(matchesByRound).length > 1 &&
                          parseInt(round) === fmRound - 1
                        ? "준결승"
                        : `${matches.length * 2}강`}
                    </h4>
                    <div className="flex flex-col justify-around h-full space-y-16">
                      {matches.map((match) => (
                        <MatchNode
                          key={match.id}
                          match={match}
                          teamNameMap={teamNameMap}
                          matchResults={matchResults}
                          onResultChange={handleMatchResultChange}
                          onUpdateMatch={handleUpdateMatch}
                          onResetMatch={handleResetMatch}
                        />
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
const MatchNode = ({
  match,
  teamNameMap,
  matchResults,
  onResultChange,
  onUpdateMatch,
  onResetMatch,
}: {
  match: Match;
  teamNameMap: Map<string, string>;
  matchResults: Record<string, { scoreA: string; scoreB: string }>;
  onResultChange: (matchId: string, team: "A" | "B", score: string) => void;
  onUpdateMatch: (matchId: string) => void;
  onResetMatch: (matchId: string) => void;
}) => {
  const winnerIsA = !!match.winnerId && match.winnerId === match.teamAId;
  const winnerIsB = !!match.winnerId && match.winnerId === match.teamBId;

  return (
    <div className="relative">
      <div className="relative flex w-64 flex-col justify-center rounded-md border bg-card p-2 shadow-sm space-y-1">
        {/* Team A */}
        <div className="flex items-center justify-between">
          <span
            className={`truncate text-sm ${
              winnerIsA ? "font-bold text-primary" : ""
            } ${match.teamAId ? "" : "text-muted-foreground"}`}
          >
            {match.teamAId ? teamNameMap.get(match.teamAId) ?? "미정" : "미정"}
          </span>
          <Input
            type="number"
            className="h-7 w-14 text-center"
            placeholder="-"
            value={matchResults[match.id]?.scoreA ?? ""}
            onChange={(e) => onResultChange(match.id, "A", e.target.value)}
            disabled={match.status === "completed" || match.status === "bye"}
          />
        </div>

        {/* Team B */}
        <div className="flex items-center justify-between">
          <span
            className={`truncate text-sm ${
              winnerIsB ? "font-bold text-primary" : ""
            } ${match.teamBId ? "" : "text-muted-foreground"}`}
          >
            {match.teamBId
              ? teamNameMap.get(match.teamBId) ?? "팀 없음"
              : match.status === "bye"
              ? "(부전승)"
              : "미정"}
          </span>
          <Input
            type="number"
            className="h-7 w-14 text-center"
            placeholder="-"
            value={matchResults[match.id]?.scoreB ?? ""}
            onChange={(e) => onResultChange(match.id, "B", e.target.value)}
            disabled={
              match.status === "completed" || !match.teamBId || match.status === "bye"
            }
          />
        </div>

        {/* Actions */}
        {match.status === "scheduled" && match.teamAId && match.teamBId && (
          <Button
            size="sm"
            className="h-7 w-full"
            onClick={() => onUpdateMatch(match.id)}
          >
            <Save className="mr-2 h-3 w-3" /> 결과 저장
          </Button>
        )}

        {match.status === "completed" && match.teamBId && (
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
                  이 경기의 점수와 승리 기록이 삭제됩니다. 상위 라운드에 진출했다면
                  해당 기록도 수정됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => onResetMatch(match.id)}>
                  초기화
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};
