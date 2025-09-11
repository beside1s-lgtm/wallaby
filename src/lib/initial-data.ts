import type { Student, MeasurementItem, MeasurementRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

export const initialStudents: Student[] = [
  { id: '1', school: '테스트초등학교', grade: '1', classNum: '1', studentNum: '1', name: '김민준', gender: '남' },
  { id: '2', school: '테스트초등학교', grade: '1', classNum: '1', studentNum: '2', name: '이서연', gender: '여' },
  { id: '3', school: '테스트초등학교', grade: '1', classNum: '2', studentNum: '1', name: '박하은', gender: '여' },
  { id: '4', school: '샘플중학교', grade: '2', classNum: '1', studentNum: '1', name: '최지우', gender: '남' },
];

export const initialItems: MeasurementItem[] = [
    { id: '1', name: '50m 달리기', unit: '초', recordType: 'time', isPaps: true },
    { id: '2', name: '윗몸 일으키기', unit: '회', recordType: 'count', isPaps: true },
    { id: '3', name: '오래달리기', unit: '초', recordType: 'time', isPaps: true },
    { id: '4', name: '제자리 멀리뛰기', unit: 'cm', recordType: 'distance', isPaps: true },
];

export const initialRecords: MeasurementRecord[] = [
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.5, date: '2024-05-01' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.3, date: '2024-05-15' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '윗몸 일으키기', value: 45, date: '2024-05-01' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '윗몸 일으키기', value: 50, date: '2024-05-15' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '제자리 멀리뛰기', value: 195, date: '2024-05-01' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '제자리 멀리뛰기', value: 205, date: '2024-05-15' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '50m 달리기', value: 9.1, date: '2024-05-01' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '50m 달리기', value: 8.9, date: '2024-05-15' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '윗몸 일으키기', value: 38, date: '2024-05-01' },
  { id: uuidv4(), studentId: '3', school: '테스트초등학교', item: '50m 달리기', value: 8.9, date: '2024-05-02' },
  { id: uuidv4(), studentId: '4', school: '샘플중학교', item: '제자리 멀리뛰기', value: 210, date: '2024-05-10'},
];
