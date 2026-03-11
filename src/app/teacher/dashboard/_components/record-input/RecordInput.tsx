
'use client';
import { useMemo } from 'react';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BatchInput } from './BatchInput';
import { IndividualInput } from './IndividualInput';

interface RecordInputProps {
    allStudents: Student[];
    allItems: MeasurementItem[];
    allRecords: MeasurementRecord[];
    onRecordUpdate: (records: MeasurementRecord[] | string, action: 'update' | 'delete') => void;
    allTeamGroups: TeamGroup[];
    sportsClubs: SportsClub[];
}

export default function RecordInput({ allStudents, allItems, allRecords, onRecordUpdate, allTeamGroups, sportsClubs }: RecordInputProps) {
  const activeItems = useMemo(() => allItems.filter(item => !item.isArchived && !item.isDeactivated), [allItems]);

  return (
    <Tabs defaultValue="batch">
      <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="batch">학급/팀별 기록</TabsTrigger>
          <TabsTrigger value="individual">개별 기록</TabsTrigger>
      </TabsList>
      <TabsContent value="batch">
        <BatchInput allStudents={allStudents} activeItems={activeItems} allRecords={allRecords} onRecordUpdate={onRecordUpdate} allTeamGroups={allTeamGroups} sportsClubs={sportsClubs} />
      </TabsContent>
      <TabsContent value="individual">
        <IndividualInput allStudents={allStudents} activeItems={activeItems} onRecordUpdate={onRecordUpdate} />
      </TabsContent>
    </Tabs>
  );
}
