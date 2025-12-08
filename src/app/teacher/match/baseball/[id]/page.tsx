'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, GripVertical, Save, Shuffle, Printer } from 'lucide-react';
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

type StatCategory = 'batting' | 'baserunning' | 'throwing' | 'catching';
type PlayerStats = {
  [key in StatCategory]: { attempt: number, success: number }
};
type InningStats = Record<string, PlayerStats>; // Key: playerId
type MatchStats = Record<string, InningStats>; // Key: inningNumber ('1', '2', etc.)

export default function BaseballMatchPage() {
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
  const [selectedInning, setSelectedInning] = useState('1');
  
  const [rosters, setRosters] = useState<Record<string, Student[]>>({});
  const [matchStats, setMatchStats] = useState<MatchStats>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Student | null>(null);
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
  
  const selectedTeam = useMemo(() => {
      if (!selectedTeamId) return null;
      if (selectedTeamId === teamA?.id) return teamA;
      if (selectedTeamId === teamB?.id) return teamB;
      return null;
  }, [selectedTeamId, teamA, teamB]);

  useEffect(() => {
    setMatchStats(prevStats => {
        const newStats = { ...prevStats };
        const currentInningStats = newStats[selectedInning] || {};
        let changed = false;

        currentRoster.forEach(player => {
            if (!currentInningStats[player.id]) {
                currentInningStats[player.id] = {
                    batting: { attempt: 0, success: 0 },
                    baserunning: { attempt: 0, success: 0 },
                    throwing: { attempt: 0, success: 0 },
                    catching: { attempt: 0, success: 0 },
                };
                changed = true;
            }
        });

        if (changed) {
            newStats[selectedInning] = currentInningStats;
            return newStats;
        }
        return prevStats;
    });
  }, [selectedInning, currentRoster]);

  const handleStatChange = (playerId: string, category: StatCategory, type: 'attempt' | 'success', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) && value !== '') return;

    setMatchStats(prev => {
        const newMatchStats = { ...prev };
        const newInningStats = { ...(newMatchStats[selectedInning] || {}) };
        const newPlayerStats = { ...(newInningStats[playerId] || {
            batting: { attempt: 0, success: 0 },
            baserunning: { attempt: 0, success: 0 },
            throwing: { attempt: 0, success: 0 },
            catching: { attempt: 0, success: 0 },
        }) };

        newPlayerStats[category] = {
            ...newPlayerStats[category],
            [type]: isNaN(numValue) ? 0 : numValue
        };
        
        newInningStats[playerId] = newPlayerStats;
        newMatchStats[selectedInning] = newInningStats;
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
                batting: { attempt: 0, success: 0 },
                baserunning: { attempt: 0, success: 0 },
                throwing: { attempt: 0, success: 0 },
                catching: { attempt: 0, success: 0 },
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
    const statsToTotal = printView === 'final' ? displayedStats : (matchStats[selectedInning] || {});
    
    const totals: { [key in StatCategory]: { attempt: number, success: number } } = {
      batting: { attempt: 0, success: 0 },
      baserunning: { attempt: 0, success: 0 },
      throwing: { attempt: 0, success: 0 },
      catching: { attempt: 0, success: 0 },
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
  }, [selectedInning, matchStats, currentRoster, printView, displayedStats]);


  const handleSave = async () => {
    if (!school || !tournament) {
      toast({ variant: 'destructive', title: '저장 실패', description: '학교 또는 대회 정보를 찾을 수 없습니다.' });
      return;
    }
    setIsSubmitting(true);

    const recordsToSave: Omit<MeasurementRecord, 'id'>[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const categoryToItemName: Record<StatCategory, string> = {
        batting: '타격',
        baserunning: '주루',
        throwing: '송구',
        catching: '포구',
    };

    const currentInningPlayerStats = matchStats[selectedInning];
    if (!currentInningPlayerStats) {
        toast({ title: '저장할 기록 없음', description: '현재 이닝에 입력된 기록이 없습니다.' });
        setIsSubmitting(false);
        return;
    }

    currentRoster.forEach(player => {
      const playerStats = currentInningPlayerStats[player.id];
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
        toast({ title: '기록 저장 완료', description: `${selectedInning}이닝 기록이 학생들의 개별 데이터에 반영되었습니다.`});

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

  const teamForPrint = selectedTeamId === teamA?.id ? teamA : teamB;

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin" /></div>;
  }

  if (!tournament || !match) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8"><p>경기 정보를 찾을 수 없습니다.</p></div>;
  }
  
  const statCategories: { key: StatCategory, name: string, successLabel: string, attemptLabel: string }[] = [
    { key: 'batting', name: '타격', successLabel: '성공', attemptLabel: '시도' },
    { key: 'baserunning', name: '주루', successLabel: '진루', attemptLabel: '실패' },
    { key: 'throwing', name: '송구', successLabel: '시도', attemptLabel: '실패' },
    { key: 'catching', name: '포구', successLabel: '시도', attemptLabel: '실패' },
  ];

  return (
    <>
      <style>
        {`
          @media print {
            body, html {
              width: 100%;
              height: auto;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-hidden {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
             #print-area {
                zoom: 0.61;
             }
          }
        `}
      </style>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-4 print-hidden">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">야구 경기 기록 페이지</h1>
            <p className="text-muted-foreground">기록할 팀과 이닝을 선택하고, 선수별 성적을 입력하세요. 선수 순서는 드래그하여 변경할 수 있습니다.</p>
          </div>
        </div>
        
        <Card className="mb-6 print-hidden">
          <CardHeader>
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
              <Select value={selectedInning} onValueChange={setSelectedInning}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="이닝 선택" />
                </SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 9 }, (_, i) => i + 1).map(inning => (
                        <SelectItem key={inning} value={String(inning)}>{inning}회</SelectItem>
                    ))}
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
                    {Object.keys(matchStats).map(inningNum => (
                        <SelectItem key={inningNum} value={inningNum}>{inningNum}회</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />인쇄하기</Button>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        <div id="print-area">
            <div className="print-only mb-4 hidden">
                <h2 className="text-2xl font-bold">{tournament.name}</h2>
                <h3 className="text-xl">{(teamForPrint?.name)} 팀 기록지 - {printView === 'final' ? '최종 합계' : `${printView}회`}</h3>
            </div>
            <Card>
                <CardContent className="overflow-x-auto pt-6">
                    <div className="overflow-x-auto">
                        <Table className="min-w-full">
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
                                            <TableHead className="text-center border-l w-[80px] break-keep">{cat.attemptLabel}</TableHead>
                                            <TableHead className="text-center w-[80px] break-keep">{cat.successLabel}</TableHead>
                                            <TableHead className="text-center w-[90px] break-keep">성공률</TableHead>
                                        </React.Fragment>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentRoster.map(player => {
                                    const playerStats = (matchStats[selectedInning] || {})[player.id];
                                    const displayPlayerStats = displayedStats[player.id] || {
                                        batting: { attempt: 0, success: 0 }, baserunning: { attempt: 0, success: 0 }, throwing: { attempt: 0, success: 0 }, catching: { attempt: 0, success: 0 },
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
                                            <TableCell className="font-semibold">{player.name}</TableCell>
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
                                    <TableCell colSpan={2} className="text-center whitespace-nowrap">팀 합계</TableCell>

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
      </div>
    </>
  );
}
