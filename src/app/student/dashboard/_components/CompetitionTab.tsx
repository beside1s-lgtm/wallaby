'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Swords, Users, Trophy, Calendar, CheckCircle2, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tournament, Match, Team } from '@/lib/types';

interface CompetitionTabProps {
  tournament: Tournament | null;
  studentId: string;
}

export function CompetitionTab({ tournament, studentId }: CompetitionTabProps) {
  // 1. 학생이 속한 팀 찾기
  const myTeam = useMemo(() => {
    if (!tournament || !studentId) return null;
    return tournament.teams.find(t => t.memberIds.includes(studentId));
  }, [tournament, studentId]);

  // 2. 라운드별 경기 그룹화 (토너먼트용)
  const rounds = useMemo(() => {
    if (!tournament || tournament.type !== 'tournament') return [];
    const roundsMap: Record<number, Match[]> = {};
    tournament.matches.forEach(m => {
      const r = m.round || 1;
      if (!roundsMap[r]) roundsMap[r] = [];
      roundsMap[r].push(m);
    });
    return Object.entries(roundsMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, matches]) => ({ round: Number(round), matches }));
  }, [tournament]);

  // 3. 리그 순위 계산 (리그용)
  const standings = useMemo(() => {
    if (!tournament || tournament.type !== 'league') return [];
    
    const stats: Record<string, Team & { matchesPlayed: number, wins: number, losses: number, draws: number, points: number }> = {};
    tournament.teams.forEach(t => {
      stats[t.id] = { ...t, matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0 };
    });

    tournament.matches.forEach(m => {
      if (m.status !== 'completed' || !m.teamAId || !m.teamBId) return;
      
      const teamA = stats[m.teamAId];
      const teamB = stats[m.teamBId];
      if (!teamA || !teamB) return;

      teamA.matchesPlayed += 1;
      teamB.matchesPlayed += 1;

      const scoreA = m.scoresA.reduce((a, b) => a + b, 0);
      const scoreB = m.scoresB.reduce((a, b) => a + b, 0);

      if (scoreA > scoreB) {
        teamA.wins += 1;
        teamA.points += 3;
        teamB.losses += 1;
      } else if (scoreA < scoreB) {
        teamB.wins += 1;
        teamB.points += 3;
        teamA.losses += 1;
      } else {
        teamA.draws += 1;
        teamA.points += 1;
        teamB.draws += 1;
        teamB.points += 1;
      }
    });

    return Object.values(stats).sort((a, b) => b.points - a.points || b.wins - a.wins);
  }, [tournament]);

  if (!tournament) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl bg-muted/5 animate-in fade-in duration-500">
        <Swords className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-xl font-bold">현재 참가 중인 대회가 없습니다.</p>
        <p className="text-sm">대회가 생성되면 이곳에서 대진표를 확인할 수 있습니다.</p>
      </div>
    );
  }

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return '미정';
    return tournament.teams.find(t => t.id === teamId)?.name || '알 수 없는 팀';
  };

  const getMatchResult = (match: Match) => {
    if (match.status === 'scheduled') return <Badge variant="outline" className="bg-muted/50">예정</Badge>;
    if (match.status === 'bye') return <Badge variant="secondary">부전승</Badge>;
    
    const scoreA = match.scoresA.reduce((a, b) => a + b, 0);
    const scoreB = match.scoresB.reduce((a, b) => a + b, 0);
    return (
      <div className="flex items-center gap-2 font-black text-lg">
        <span className={cn(match.winnerId === match.teamAId ? "text-primary" : "text-muted-foreground")}>{scoreA}</span>
        <span className="text-muted-foreground/30 text-sm">:</span>
        <span className={cn(match.winnerId === match.teamBId ? "text-primary" : "text-muted-foreground")}>{scoreB}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8 mt-6 pb-10">
      {/* 대회 개요 카드 */}
      <Card className="border-2 border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-primary/5 flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" /> {tournament.name}
            </CardTitle>
            <div className="flex items-center gap-3 font-medium text-muted-foreground text-sm">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {tournament.date || '일정 미정'}</span>
              <Badge variant="outline" className="capitalize bg-background text-[10px]">
                {tournament.type === 'tournament' ? '토너먼트' : '리그'}
              </Badge>
            </div>
          </div>
          {myTeam && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">나의 소속 팀</p>
              <p className="text-lg font-black text-primary">{myTeam.name}</p>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="pt-6">
          {tournament.type === 'tournament' ? (
            /* 토너먼트 대진표 뷰 */
            <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
              {rounds.map((r) => (
                <div key={r.round} className="flex-1 min-w-[240px] space-y-4">
                  <div className="flex items-center justify-center py-2 bg-muted/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground border">
                    {r.round === rounds.length ? '결승전' : r.round === rounds.length - 1 ? '준결승' : `${r.round}라운드`}
                  </div>
                  <div className="space-y-4">
                    {r.matches.map((m) => (
                      <div key={m.id} className={cn(
                        "p-4 rounded-xl border-2 transition-all",
                        (m.teamAId === myTeam?.id || m.teamBId === myTeam?.id) ? "border-primary/30 bg-primary/5 shadow-md" : "bg-card shadow-sm"
                      )}>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className={cn(
                              "font-bold truncate max-w-[120px] text-sm",
                              m.teamAId === myTeam?.id ? "text-primary underline underline-offset-4" : "text-foreground/80",
                              m.winnerId === m.teamAId && "text-primary"
                            )}>
                              {getTeamName(m.teamAId)}
                            </span>
                            {m.status === 'completed' && m.winnerId === m.teamAId && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                          
                          <div className="flex items-center justify-center py-1 relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-muted"></div></div>
                            <div className="relative bg-background px-3 rounded-full border text-[10px] font-black text-muted-foreground">
                              {getMatchResult(m)}
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className={cn(
                              "font-bold truncate max-w-[120px] text-sm",
                              m.teamBId === myTeam?.id ? "text-primary underline underline-offset-4" : "text-foreground/80",
                              m.winnerId === m.teamBId && "text-primary"
                            )}>
                              {getTeamName(m.teamBId)}
                            </span>
                            {m.status === 'completed' && m.winnerId === m.teamBId && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 리그 대진표 뷰 */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ListOrdered className="h-5 w-5 text-primary" />
                  <h3 className="font-black text-lg">리그 순위 현황</h3>
                </div>
                <div className="border rounded-2xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12 text-center text-xs">순위</TableHead>
                        <TableHead className="text-xs">팀명</TableHead>
                        <TableHead className="text-center text-xs">경기</TableHead>
                        <TableHead className="text-center text-xs">승점</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.map((s, idx) => (
                        <TableRow key={s.id} className={cn(s.id === myTeam?.id && "bg-primary/5 font-bold")}>
                          <TableCell className="text-center font-black text-sm">{idx + 1}</TableCell>
                          <TableCell className="font-bold text-sm flex items-center gap-2">
                            {s.name} {s.id === myTeam?.id && <Badge className="text-[8px] h-3 px-1">MY</Badge>}
                          </TableCell>
                          <TableCell className="text-center text-sm">{s.matchesPlayed}</TableCell>
                          <TableCell className="text-center font-black text-primary text-sm">{s.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Swords className="h-5 w-5 text-primary" />
                  <h3 className="font-black text-lg">최근 경기</h3>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {tournament.matches.slice().reverse().map(m => (
                    <div key={m.id} className={cn(
                      "p-3 border rounded-xl text-xs",
                      m.status === 'completed' ? "bg-muted/20" : "border-dashed border-primary/20 bg-primary/5"
                    )}>
                      <div className="flex justify-between items-center gap-2">
                        <span className={cn("flex-1 text-right truncate", m.winnerId === m.teamAId && "font-black")}>{getTeamName(m.teamAId)}</span>
                        <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">
                            {m.status === 'completed' ? '경기 종료' : '경기 예정'}
                          </span>
                          <span className="font-black text-primary">
                            {m.status === 'completed' ? `${m.scoresA.reduce((a,b)=>a+b,0)} : ${m.scoresB.reduce((a,b)=>a+b,0)}` : 'VS'}
                          </span>
                        </div>
                        <span className={cn("flex-1 text-left truncate", m.winnerId === m.teamBId && "font-black")}>{getTeamName(m.teamBId)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 나의 팀 상세 정보 */}
      <Card className="border-2 border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b bg-card">
          <CardTitle className="flex items-center gap-2 text-primary font-black">
            <Users className="h-6 w-6" /> 나의 팀 선수단
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {myTeam ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {myTeam.memberIds.map(id => {
                  const member = tournament.teams.flatMap(t => t.members || []).find(m => m.id === id);
                  return (
                    <div key={id} className={cn(
                      "flex flex-col items-center p-4 rounded-2xl border transition-all",
                      id === studentId ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-card hover:bg-muted/30"
                    )}>
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3 text-xl font-black text-muted-foreground overflow-hidden">
                        {member?.photoUrl ? <img src={member.photoUrl} className="w-full h-full object-cover" /> : member?.name[0] || '?'}
                      </div>
                      <span className="font-black text-sm">{member?.name || '알 수 없음'}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{member?.studentNum}번</span>
                      {id === studentId && <Badge className="mt-2 text-[8px] h-3 px-1">나</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-3xl">
              <p className="font-bold">팀 정보가 아직 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
