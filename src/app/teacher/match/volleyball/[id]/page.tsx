'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, GripVertical, Save, Shuffle, Printer } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTournaments, getStudents, addOrUpdateRecords } from '@/lib/store';
import { Tournament, Student, Team, MeasurementRecord } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type StatCategory = 'spike' | 'receive' | 'toss' | 'serve';
type PlayerStats = {
  [key in StatCategory]: { attempt: number, success: number }
};
type SetStats = Record<string, PlayerStats>; // Key: playerId
type MatchStats = Record<string, SetStats>; // Key: setNumber ('1', '2', etc.)

export default function VolleyballMatchPage() {
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
  const [teamAMembers, setTeamAMembers] = useState<Student[]>([]);
  const [teamBMembers, setTeamBMembers] = useState<Student[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSet, setSelectedSet] = useState('1');
  
  const [rosters, setRosters] = useState<Record<string, Student[]>>({}); // Key: teamId
  const [matchStats, setMatchStats] = useState<MatchStats>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Student | null>(null);

  const [printView, setPrintView] = useState('final'); // 'final', '1', '2', etc.


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
                currentSetStats[player.id] = {
                    spike: { attempt: 0, success: 0 },
                    receive: { attempt: 0, success: 0 },
                    toss: { attempt: 0, success: 0 },
                    serve: { attempt: 0, success: 0 },
                };
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


  const handleStatChange = (playerId: string, category: StatCategory, type: 'attempt' | 'success', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) && value !== '') return;

    setMatchStats(prev => {
        const newMatchStats = { ...prev };
        const newSetStats = { ...(newMatchStats[selectedSet] || {}) };
        const newPlayerStats = { ...(newSetStats[playerId] || {
            spike: { attempt: 0, success: 0 },
            receive: { attempt: 0, success: 0 },
            toss: { attempt: 0, success: 0 },
            serve: { attempt: 0, success: 0 },
        }) };

        newPlayerStats[category] = {
            ...newPlayerStats[category],
            [type]: isNaN(numValue) ? 0 : numValue
        };
        
        newSetStats[playerId] = newPlayerStats;
        newMatchStats[selectedSet] = newSetStats;
        return newMatchStats;
    });
  };
  
  const calculateSuccessRate = (attempt: number, success: number) => {
    if (attempt === 0) return '0.0%';
    return `${((success / attempt) * 100).toFixed(1)}%`;
  }

  const displayedStats = useMemo(() => {
    if (printView === 'final') {
        const finalStats: Record<string, PlayerStats> = {};
        currentRoster.forEach(player => {
            finalStats[player.id] = {
                spike: { attempt: 0, success: 0 },
                receive: { attempt: 0, success: 0 },
                toss: { attempt: 0, success: 0 },
                serve: { attempt: 0, success: 0 },
            };
        });

        Object.values(matchStats).forEach(setStats => {
            currentRoster.forEach(player => {
                const playerSetStats = setStats[player.id];
                if (playerSetStats) {
                    (Object.keys(finalStats[player.id]) as StatCategory[]).forEach(cat => {
                        finalStats[player.id][cat].attempt += playerSetStats[cat].attempt;
                        finalStats[player.id][cat].success += playerSetStats[cat].success;
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
    
    const totals: { [key in StatCategory]: { attempt: number, success: number } } = {
      spike: { attempt: 0, success: 0 },
      receive: { attempt: 0, success: 0 },
      toss: { attempt: 0, success: 0 },
      serve: { attempt: 0, success: 0 },
    };
    currentRoster.forEach(player => {
      const playerStats = statsToTotal[player.id];
      if (playerStats) {
        (Object.keys(totals) as StatCategory[]).forEach(cat => {
          totals[cat].attempt += playerStats[cat].attempt;
          totals[cat].success += playerStats[cat].success;
        });
      }
    });
    return totals;
  }, [selectedSet, matchStats, currentRoster, printView, displayedStats]);


  const handleSave = async () => {
    if (!school || !tournament) {
      toast({ variant: 'destructive', title: '저장 실패', description: '학교 또는 대회 정보를 찾을 수 없습니다.' });
      return;
    }
    setIsSubmitting(true);

    const recordsToSave: Omit<MeasurementRecord, 'id'>[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const categoryToItemName: Record<StatCategory, string> = {
        spike: '스파이크',
        receive: '리시브',
        toss: '토스',
        serve: '서브',
    };

    const currentSetPlayerStats = matchStats[selectedSet];
    if (!currentSetPlayerStats) {
        toast({ title: '저장할 기록 없음', description: '현재 세트에 입력된 기록이 없습니다.' });
        setIsSubmitting(false);
        return;
    }

    currentRoster.forEach(player => {
      const playerStats = currentSetPlayerStats[player.id];
      if (playerStats) {
        (Object.keys(playerStats) as StatCategory[]).forEach(cat => {
            const { attempt, success } = playerStats[cat];
            if (attempt > 0) {
              const successRate = (success / attempt) * 100;
              const score = Math.round(successRate / 10); // 10점 만점으로 환산

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
             await addOrUpdateRecords(school, currentRoster, recordsToSave.map(r => ({...r, ...currentRoster.find(s=>s.id === r.studentId)})));
        }
        toast({ title: '기록 저장 완료', description: `${selectedSet}세트 기록이 학생들의 개별 데이터에 반영되었습니다.`});

    } catch (error) {
        console.error("Failed to save records", error);
        toast({ variant: 'destructive', title: '기록 저장 실패' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, student: Student) => {
    setDraggedItem(student);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetItem: Student) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null);
      return;
    }

    const rosterToUpdate = rosters[selectedTeamId] || [];
    const currentIndex = rosterToUpdate.findIndex(item => item.id === draggedItem.id);
    const targetIndex = rosterToUpdate.findIndex(item => item.id === targetItem.id);
    
    let newRoster = [...rosterToUpdate];
    newRoster.splice(currentIndex, 1);
    newRoster.splice(targetIndex, 0, draggedItem);
    
    setRosters(prev => ({...prev, [selectedTeamId]: newRoster }));
    setDraggedItem(null);
  };
  
  const randomizeRoster = () => {
    setRosters(prev => {
        const rosterToUpdate = prev[selectedTeamId] || [];
        return {
            ...prev,
            [selectedTeamId]: [...rosterToUpdate].sort(() => Math.random() - 0.5)
        }
    });
  };

  const handlePrint = () => {
    window.print();
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin" /></div>;
  }

  if (!tournament || !match) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8"><p>경기 정보를 찾을 수 없습니다.</p></div>;
  }
  
  const statCategories: { key: StatCategory, name: string }[] = [
    { key: 'spike', name: '스파이크' },
    { key: 'receive', name: '리시브' },
    { key: 'toss', name: '토스' },
    { key: 'serve', name: '서브' },
  ];

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl" id="print-area">
      <div className="flex items-center gap-4 mb-6 print-hidden">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">배구 경기 기록 페이지</h1>
      </div>

      <Card>
        <CardHeader className="print-hidden">
            <CardTitle>경기 정보 및 기록</CardTitle>
            <CardDescription>기록할 팀과 세트를 선택하고, 선수별 성적을 입력하세요. 선수 순서는 드래그하여 변경할 수 있습니다.</CardDescription>
            <div className="flex flex-wrap items-center gap-4 pt-4">
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
                        <SelectValue placeholder="세트 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1세트</SelectItem>
                        <SelectItem value="2">2세트</SelectItem>
                        <SelectItem value="3">3세트</SelectItem>
                        <SelectItem value="4">4세트</SelectItem>
                        <SelectItem value="5">5세트</SelectItem>
                    </SelectContent>
                </Select>
                 <Button variant="outline" onClick={randomizeRoster}><Shuffle className="w-4 h-4 mr-2" />순서 섞기</Button>
                <div className="flex items-center gap-2 sm:ml-auto">
                    <Select value={printView} onValueChange={setPrintView}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="인쇄 보기 선택" />
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
        </CardHeader>
        <CardContent>
            <div className="print-only mb-4 hidden">
                <h2 className="text-2xl font-bold">{teamA?.name} vs {teamB?.name}</h2>
                <h3 className="text-xl">{rosters[selectedTeamId]?.[0]?.name} 팀 기록지 - {printView === 'final' ? '최종 합계' : `${printView}세트`}</h3>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px] print-hidden"></TableHead>
                            <TableHead className="w-[120px] whitespace-nowrap">선수</TableHead>
                            {statCategories.map(cat => (
                                <TableHead key={cat.key} colSpan={3} className="text-center border-l">{cat.name}</TableHead>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableHead className="print-hidden"></TableHead>
                            <TableHead className="w-[120px] whitespace-nowrap"></TableHead>
                            {statCategories.map(cat => (
                                <React.Fragment key={`${cat.key}-sub`}>
                                    <TableHead className="text-center border-l w-[60px]">시도</TableHead>
                                    <TableHead className="text-center w-[60px]">성공</TableHead>
                                    <TableHead className="text-center w-[70px]">성공률</TableHead>
                                </React.Fragment>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentRoster.map(player => {
                            const playerStats = (matchStats[selectedSet] || {})[player.id];
                            const displayPlayerStats = displayedStats[player.id] || {
                                spike: { attempt: 0, success: 0 }, receive: { attempt: 0, success: 0 }, toss: { attempt: 0, success: 0 }, serve: { attempt: 0, success: 0 },
                            };
                            
                            if (!playerStats) return null;

                            return (
                                <TableRow 
                                    key={player.id} 
                                    draggable 
                                    onDragStart={(e) => handleDragStart(e, player)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, player)}
                                    className={draggedItem?.id === player.id ? 'opacity-50' : 'cursor-move'}
                                >
                                    <TableCell className="text-center print-hidden"><GripVertical className="h-5 w-5 text-muted-foreground" /></TableCell>
                                    <TableCell className="font-semibold w-[120px] whitespace-nowrap">{player.name}</TableCell>
                                    {statCategories.map(cat => (
                                        <React.Fragment key={`${player.id}-${cat.key}`}>
                                            <TableCell className="border-l">
                                                <Input type="number" min="0" className="h-8 text-center print-hidden" value={playerStats[cat.key].attempt || ''} onChange={e => handleStatChange(player.id, cat.key, 'attempt', e.target.value)} />
                                                <span className="print-only hidden">{displayPlayerStats[cat.key].attempt}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" min="0" className="h-8 text-center print-hidden" value={playerStats[cat.key].success || ''} onChange={e => handleStatChange(player.id, cat.key, 'success', e.target.value)} />
                                                 <span className="print-only hidden">{displayPlayerStats[cat.key].success}</span>
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                                {calculateSuccessRate(displayPlayerStats[cat.key].attempt, displayPlayerStats[cat.key].success)}
                                            </TableCell>
                                        </React.Fragment>
                                    ))}
                                </TableRow>
                            )
                        })}
                        <TableRow className="bg-muted hover:bg-muted font-bold">
                            <TableCell colSpan={2} className="text-center print-hidden-cell whitespace-nowrap">팀 합계</TableCell>
                            <TableCell colSpan={1} className="text-center hidden print-table-cell whitespace-nowrap">팀 합계</TableCell>

                            {statCategories.map(cat => (
                                <React.Fragment key={`total-${cat.key}`}>
                                    <TableCell className="text-center border-l">{tableTotals[cat.key].attempt}</TableCell>
                                    <TableCell className="text-center">{tableTotals[cat.key].success}</TableCell>
                                    <TableCell className="text-center">
                                        {calculateSuccessRate(tableTotals[cat.key].attempt, tableTotals[cat.key].success)}
                                    </TableCell>
                                </React.Fragment>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
             <div className="flex justify-end mt-6 print-hidden">
                <Button onClick={handleSave} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    기록 저장
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
