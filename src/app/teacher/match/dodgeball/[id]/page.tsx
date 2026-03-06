
'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GripVertical, Save, Shuffle, Printer, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect, useMemo } from 'react';
import { getTournaments, getStudents, addOrUpdateRecords } from '@/lib/store';
import { Tournament, Student, Team, MeasurementRecord } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type StatCategory = 'attack' | 'pass' | 'catch' | 'dodge';
type PlayerStats = {
  [key in StatCategory]: number;
};
type SetStats = Record<string, PlayerStats>; // Key: playerId
type MatchStats = Record<string, SetStats>; // Key: setNumber ('1', '2', etc.)

export default function DodgeballMatchPage() {
  const params = useParams();
  const router = useRouter();
  const { school } = useAuth();
  const { toast } = useToast();
  const matchId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<any | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSet, setSelectedSet] = useState('1');
  
  const [rosters, setRosters] = useState<Record<string, Student[]>>({});
  const [matchStats, setMatchStats] = useState<MatchStats>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printView, setPrintView] = useState('final');

  useEffect(() => {
    async function fetchData() {
      if (!school || !matchId) return;
      setIsLoading(true);
      try {
        const tournaments = await getTournaments(school);
        let foundMatch: any = null;
        const parentTournament = tournaments.find(t => {
            const m = t.matches.find(m => m.id === matchId);
            if (m) {
                foundMatch = m;
                return true;
            }
            return false;
        });

        if (parentTournament && foundMatch) {
            setTournament(parentTournament);
            setMatch(foundMatch);

            const teamAData = parentTournament.teams.find(t => t.id === foundMatch.teamAId);
            const teamBData = parentTournament.teams.find(t => t.id === foundMatch.teamBId);
            setTeamA(teamAData || null);
            setTeamB(teamBData || null);

            if (teamAData) {
                setSelectedTeamId(teamAData.id);
            }
            
            const allStudents = await getStudents(school);
            const studentMap = new Map(allStudents.map(s => [s.id, s]));
            
            const newRosters: Record<string, Student[]> = {};
            if (teamAData?.memberIds) {
                const members = teamAData.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s);
                newRosters[teamAData.id] = members;
            }
            if (teamBData?.memberIds) {
                const members = teamBData.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s);
                 newRosters[teamBData.id] = members;
            }
            setRosters(newRosters);
        }
      } catch (error) {
        console.error("Failed to fetch match data", error);
        toast({ variant: 'destructive', title: '데이터 로딩 실패' });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [school, matchId, toast]);
  
  const currentRoster = useMemo(() => rosters[selectedTeamId] || [], [rosters, selectedTeamId]);

  useEffect(() => {
    setMatchStats(prevStats => {
        const newStats = { ...prevStats };
        const currentSetStats = newStats[selectedSet] || {};
        let changed = false;

        currentRoster.forEach(player => {
            if (!currentSetStats[player.id]) {
                currentSetStats[player.id] = { attack: 0, pass: 0, catch: 0, dodge: 0 };
                changed = true;
            }
        });

        if (changed) {
            newStats[selectedSet] = currentSetStats;
            return newStats;
        }
        return prevStats;
    });
  }, [selectedSet, currentRoster]);

  const handleStatChange = (playerId: string, category: StatCategory, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) && value !== '') return;

    setMatchStats(prev => {
        const newMatchStats = { ...prev };
        const newSetStats = { ...(newMatchStats[selectedSet] || {}) };
        const newPlayerStats = { ...(newSetStats[playerId] || { attack: 0, pass: 0, catch: 0, dodge: 0 }) };

        newPlayerStats[category] = isNaN(numValue) ? 0 : numValue;
        
        newSetStats[playerId] = newPlayerStats;
        newMatchStats[selectedSet] = newSetStats;
        return newMatchStats;
    });
  };

  const displayedStats = useMemo(() => {
    if (printView === 'final') {
        const finalStats: Record<string, PlayerStats> = {};
        currentRoster.forEach(player => {
            finalStats[player.id] = { attack: 0, pass: 0, catch: 0, dodge: 0 };
        });

        Object.values(matchStats).forEach(setStats => {
            currentRoster.forEach(player => {
                const playerSetStats = setStats[player.id];
                if (playerSetStats) {
                    (Object.keys(finalStats[player.id]) as StatCategory[]).forEach(cat => {
                        finalStats[player.id][cat] += playerSetStats[cat];
                    });
                }
            });
        });
        return finalStats;
    }
    return matchStats[printView] || {};
  }, [printView, matchStats, currentRoster]);

  const tableTotals = useMemo(() => {
    const statsToTotal = printView === 'final' ? displayedStats : (matchStats[selectedSet] || {});
    
    const totals: PlayerStats = { attack: 0, pass: 0, catch: 0, dodge: 0 };
    currentRoster.forEach(player => {
      const playerStats = statsToTotal[player.id];
      if (playerStats) {
        (Object.keys(totals) as StatCategory[]).forEach(cat => {
          totals[cat] += playerStats[cat];
        });
      }
    });
    return totals;
  }, [selectedSet, matchStats, currentRoster, printView, displayedStats]);

  const handleSave = async () => {
    if (!school || !tournament) {
      toast({ variant: 'destructive', title: '저장 실패' });
      return;
    }
    setIsSubmitting(true);

    const recordsToSave: any[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const categoryToItemName: Record<StatCategory, string> = {
        attack: '공격성공',
        pass: '패스성공',
        catch: '포구',
        dodge: '회피성공',
    };
    const categoryToScoreMultiplier: Record<StatCategory, number> = {
        attack: 2, pass: 1, catch: 2, dodge: 1,
    };

    const currentSetPlayerStats = matchStats[selectedSet];
    if (!currentSetPlayerStats) {
        toast({ title: '저장할 기록 없음' });
        setIsSubmitting(false);
        return;
    }

    currentRoster.forEach(player => {
      const playerStats = currentSetPlayerStats[player.id];
      if (playerStats) {
        (Object.keys(playerStats) as StatCategory[]).forEach(cat => {
            const count = playerStats[cat];
            if (count > 0) {
              const score = count * categoryToScoreMultiplier[cat];
              recordsToSave.push({
                  studentId: player.id,
                  school: school,
                  item: categoryToItemName[cat],
                  value: score,
                  date: recordDate,
              });
            }
        });
      }
    });
    
    try {
        if(recordsToSave.length > 0) {
             await addOrUpdateRecords(school, currentRoster, recordsToSave);
        }
        toast({ title: '저장 완료', description: `${selectedSet}세트 기록이 반영되었습니다.`});
    } catch (error) {
        toast({ variant: 'destructive', title: '저장 실패' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleGoBack = () => {
    router.push('/teacher/dashboard?tab=competition');
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }

  if (!tournament || !match) {
    return <div className="container mx-auto p-8"><Button variant="outline" onClick={handleGoBack} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> 뒤로 가기</Button><p>경기 정보를 찾을 수 없습니다.</p></div>;
  }
  
  const statCategories: { key: StatCategory, name: string }[] = [
    { key: 'attack', name: '공격 성공' },
    { key: 'pass', name: '패스 성공' },
    { key: 'catch', name: '포구' },
    { key: 'dodge', name: '회피 성공' },
  ];

  return (
    <>
      <style jsx global>{`
        @media print {
          body, html { width: 100%; height: auto; margin: 0 !important; padding: 0 !important; }
          .print-hidden { display: none !important; }
          .print-only { display: block !important; }
          #print-area { zoom: 0.8; }
        }
      `}</style>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-4 print-hidden">
          <Button variant="ghost" onClick={handleGoBack} size="icon"><ArrowLeft /></Button>
          <div>
            <h1 className="text-3xl font-bold">피구 경기 기록지</h1>
            <p className="text-muted-foreground">{tournament.name} - {match.matchNumber}번 경기</p>
          </div>
        </div>
        
        <Card className="mb-6 print-hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="팀 선택" />
                </SelectTrigger>
                <SelectContent>
                  {teamA && <SelectItem value={teamA.id}>{teamA.name}</SelectItem>}
                  {teamB && <SelectItem value={teamB.id}>{teamB.name}</SelectItem>}
                </SelectContent>
              </Select>
              <Select value={selectedSet} onValueChange={setSelectedSet}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="세트" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1세트</SelectItem>
                  <SelectItem value="2">2세트</SelectItem>
                  <SelectItem value="3">3세트</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 sm:ml-auto">
                <Select value={printView} onValueChange={setPrintView}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="final">최종 합계</SelectItem>
                    {Object.keys(matchStats).map(setNum => (
                        <SelectItem key={setNum} value={setNum}>{setNum}세트</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />인쇄하기</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div id="print-area">
            <div className="print-only mb-4 hidden">
                <h2 className="text-2xl font-bold">{tournament.name}</h2>
                <h3 className="text-xl">팀 기록지 - {printView === 'final' ? '최종 합계' : `${printView}세트`}</h3>
            </div>
            <Card>
                <CardContent className="overflow-x-auto pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px] whitespace-nowrap">선수명</TableHead>
                                {statCategories.map(cat => (
                                    <TableHead key={cat.key} className="text-center border-l">{cat.name}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentRoster.map(player => {
                                const playerStats = (matchStats[selectedSet] || {})[player.id];
                                const displayPlayerStats = displayedStats[player.id] || { attack: 0, pass: 0, catch: 0, dodge: 0 };
                                
                                if (!playerStats) return null;

                                return (
                                    <TableRow key={player.id} className="hover:bg-muted/50">
                                        <TableCell className="font-semibold">{player.name}</TableCell>
                                        {statCategories.map(cat => (
                                            <TableCell key={`${player.id}-${cat.key}`} className="border-l">
                                                <Input type="number" min="0" className="h-8 text-center print-hidden" value={playerStats[cat.key] || ''} onChange={e => handleStatChange(player.id, cat.key, e.target.value)} />
                                                <span className="print-only hidden">{displayPlayerStats[cat.key]}</span>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                )
                            })}
                            <TableRow className="bg-muted hover:bg-muted font-bold">
                                <TableCell className="text-center whitespace-nowrap">팀 합계</TableCell>
                                {statCategories.map(cat => (
                                    <TableCell key={`total-${cat.key}`} className="text-center border-l">{tableTotals[cat.key]}</TableCell>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                    <div className="flex justify-end mt-6 print-hidden">
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            기록 저장
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
