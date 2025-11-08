import type { Student, MeasurementItem, MeasurementRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

export const initialStudents: Student[] = [
  { id: '1', school: '테스트초등학교', grade: '4', classNum: '1', studentNum: '1', name: '김민준', gender: '남', accessCode: '12345' },
  { id: '2', school: '테스트초등학교', grade: '4', classNum: '1', studentNum: '2', name: '이서연', gender: '여', accessCode: '23456' },
  { id: '3', school: '테스트초등학교', grade: '5', classNum: '2', studentNum: '1', name: '박하은', gender: '여', accessCode: '34567' },
  { id: '4', school: '테스트초등학교', grade: '6', classNum: '1', studentNum: '1', name: '최지우', gender: '남', accessCode: '45678' },
];

export const initialItems: MeasurementItem[] = [
    { id: '1', name: '50m 달리기', unit: '초', recordType: 'time', isPaps: true, category: 'PAPS' },
    { id: '2', name: '윗몸 말아올리기', unit: '회', recordType: 'count', isPaps: true, category: 'PAPS' },
    { id: '3', name: '왕복오래달리기', unit: '회', recordType: 'count', isPaps: true, category: 'PAPS' },
    { id: '4', name: '제자리 멀리뛰기', unit: 'cm', recordType: 'distance', isPaps: true, category: 'PAPS' },
    { id: '5', name: '앉아윗몸앞으로굽히기', unit: 'cm', recordType: 'distance', isPaps: true, category: 'PAPS' },
    { id: 'bmi', name: '체질량지수(BMI)', unit: 'kg/m²', recordType: 'count', isPaps: true, isCompound: true, category: 'PAPS' },
    { id: '6', name: '자유투', unit: '성공', recordType: 'count', isPaps: false, goal: 10, category: '농구' },
];

export const initialRecords: MeasurementRecord[] = [
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.8, date: '2024-05-01' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.5, date: '2024-05-15' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '윗몸 말아올리기', value: 25, date: '2024-05-01' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '윗몸 말아올리기', value: 30, date: '2024-05-15' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '50m 달리기', value: 9.2, date: '2024-05-01' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '제자리 멀리뛰기', value: 160, date: '2024-05-15' },
  { id: uuidv4(), studentId: '3', school: '테스트초등학교', item: '왕복오래달리기', value: 30, date: '2024-05-02' },
  { id: uuidv4(), studentId: '4', school: '테스트초등학교', item: '제자리 멀리뛰기', value: 200, date: '2024-05-10'},
];
