'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GripVertical, Save, Shuffle, Printer } from 'lucide-react';
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

type StatCategory = 'shot' | 'assist' | 'rebound' | 'steal';
type PlayerStats = {
  [key in StatCategory]: number;
};
type QuarterStats = Record<string, PlayerStats>; // Key: playerId
type MatchStats = Record<string, QuarterStats>; // Key: quarterNumber ('1', '2', etc.)

export default function BasketballMatchPage() {
  const params = useParams();
  const { school } = useAuth();
  const { toast } = useToast();
  const matchId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<any | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState('1');
  
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
  const selectedTeam = useMemo(() => {
      if (!selectedTeamId) return null;
      if (selectedTeamId === teamA?.id) return teamA;
      if (selectedTeamId === teamB?.id) return teamB;
      return null;
  }, [selectedTeamId, teamA, teamB]);

  useEffect(() => {
    setMatchStats(prevStats => {
        const newStats = { ...prevStats };
        const currentQuarterStats = newStats[selectedQuarter] || {};
        let changed = false;

        currentRoster.forEach(player => {
            if (!currentQuarterStats[player.id]) {
                currentQuarterStats[player.id] = { shot: 0, assist: 0, rebound: 0, steal: 0 };
                changed = true;
            }
        });

        if (changed) {
            newStats[selectedQuarter] = currentQuarterStats;
            return newStats;
        }
        return prevStats;
    });
  }, [selectedQuarter, currentRoster]);

  const handleStatChange = (playerId: string, category: StatCategory, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) && value !== '') return;

    setMatchStats(prev => {
        const newMatchStats = { ...prev };
        const newQuarterStats = { ...(newMatchStats[selectedQuarter] || {}) };
        const newPlayerStats = { ...(newQuarterStats[playerId] || { shot: 0, assist: 0, rebound: 0, steal: 0 }) };

        newPlayerStats[category] = isNaN(numValue) ? 0 : numValue;
        
        newQuarterStats[playerId] = newPlayerStats;
        newMatchStats[selectedQuarter] = newQuarterStats;
        return newMatchStats;
    });
  };

  const displayedStats = useMemo(() => {
    if (printView === 'final') {
        const finalStats: Record<string, PlayerStats> = {};
        currentRoster.forEach(player => {
            finalStats[player.id] = { shot: 0, assist: 0, rebound: 0, steal: 0 };
        });

        Object.values(matchStats).forEach(quarterStats => {
            currentRoster.forEach(player => {
                const playerQuarterStats = quarterStats[player.id];
                if (playerQuarterStats) {
                    (Object.keys(finalStats[player.id]) as StatCategory[]).forEach(cat => {
                        finalStats[player.id][cat] += playerQuarterStats[cat];
                    });
                }
            });
        });
        return finalStats;
    }
    return matchStats[printView] || {};
  }, [printView, matchStats, currentRoster]);

  const tableTotals = useMemo(() => {
    const statsToTotal = printView === 'final' ? displayedStats : (matchStats[selectedQuarter] || {});
    
    const totals: PlayerStats = { shot: 0, assist: 0, rebound: 0, steal: 0 };
    currentRoster.forEach(player => {
      const playerStats = statsToTotal[player.id];
      if (playerStats) {
        (Object.keys(totals) as StatCategory[]).forEach(cat => {
          totals[cat] += playerStats[cat];
        });
      }
    });
    return totals;
  }, [selectedQuarter, matchStats, currentRoster, printView, displayedStats]);

  const handleSave = async () => {
    if (!school || !tournament) {
      toast({ variant: 'destructive', title: '저장 실패', description: '학교 또는 대회 정보를 찾을 수 없습니다.' });
      return;
    }
    setIsSubmitting(true);

    const recordsToSave: Omit<MeasurementRecord, 'id'>[] = [];
    const recordDate = tournament.date ? format(new Date(tournament.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const categoryToItemName: Record<StatCategory, string> = {
        shot: '슛',
        assist: '어시스트',
        rebound: '리바운드',
        steal: '스틸',
    };
    const categoryToScoreMultiplier: Record<StatCategory, number> = {
        shot: 2, // 슛 1개당 2점
        assist: 1,
        rebound: 1,
        steal: 1,
    }

    const currentQuarterPlayerStats = matchStats[selectedQuarter];
    if (!currentQuarterPlayerStats) {
        toast({ title: '저장할 기록 없음', description: '현재 쿼터에 입력된 기록이 없습니다.' });
        setIsSubmitting(false);
        return;
    }

    currentRoster.forEach(player => {
      const playerStats = currentQuarterPlayerStats[player.id];
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
        toast({ title: '기록 저장 완료', description: `${selectedQuarter}쿼터 기록이 학생들의 개별 데이터에 반영되었습니다.`});

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
    return <div className="flex justify-center items-center h-full"><Loader2 className="w-12 h-12 animate-spin" /></div>;
  }

  if (!tournament || !match) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8"><p>경기 정보를 찾을 수 없습니다.</p></div>;
  }
  
  const statCategories: { key: StatCategory, name: string }[] = [
    { key: 'shot', name: '슛(득점)' },
    { key: 'assist', name: '어시스트' },
    { key: 'rebound', name: '리바운드' },
    { key: 'steal', name: '스틸' },
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
              zoom: 0.8;
            }
          }
        `}
      </style>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-4 print-hidden">
          <div>
            <h1 className="text-3xl font-bold">농구 경기 기록 페이지</h1>
            <p className="text-muted-foreground">기록할 팀과 쿼터를 선택하고, 선수별 성적을 입력하세요.</p>
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
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="쿼터 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1쿼터</SelectItem>
                  <SelectItem value="2">2쿼터</SelectItem>
                  <SelectItem value="3">3쿼터</SelectItem>
                  <SelectItem value="4">4쿼터</SelectItem>
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
                    {Object.keys(matchStats).map(qNum => (
                        <SelectItem key={qNum} value={qNum}>{qNum}쿼터</SelectItem>
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
                <h3 className="text-xl">{(teamForPrint?.name)} 팀 기록지 - {printView === 'final' ? '최종 합계' : `${printView}쿼터`}</h3>
            </div>
            <Card>
                <CardContent className="overflow-x-auto pt-6">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px] print-hidden"></TableHead>
                                    <TableHead className="w-[120px] whitespace-nowrap">선수</TableHead>
                                    {statCategories.map(cat => (
                                        <TableHead key={cat.key} className="text-center border-l">{cat.name}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentRoster.map(player => {
                                    const playerStats = (matchStats[selectedQuarter] || {})[player.id];
                                    const displayPlayerStats = displayedStats[player.id] || { shot: 0, assist: 0, rebound: 0, steal: 0 };
                                    
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
                                                <TableCell key={`${player.id}-${cat.key}`} className="border-l">
                                                    <Input type="number" min="0" className="h-8 text-center print-hidden" value={playerStats[cat.key] || ''} onChange={e => handleStatChange(player.id, cat.key, e.target.value)} />
                                                    <span className="print-only hidden">{displayPlayerStats[cat.key]}</span>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )
                                })}
                                <TableRow className="bg-muted hover:bg-muted font-bold">
                                    <TableCell colSpan={2} className="text-center whitespace-nowrap">팀 합계</TableCell>

                                    {statCategories.map(cat => (
                                        <TableCell key={`total-${cat.key}`} className="text-center border-l">{tableTotals[cat.key]}</TableCell>
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
