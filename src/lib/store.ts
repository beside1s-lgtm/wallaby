'use client';
import type { Student, MeasurementItem, MeasurementRecord, StudentLogin, RecordType } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const getItemRecordType = (item: string): RecordType => {
    if (item.includes('달리기')) return 'time';
    if (item.includes('멀리뛰기')) return 'distance';
    if (item.includes('일으키기') || item.includes('턱걸이')) return 'count';
    return 'count'; // Default to count
};


const initialStudents: Student[] = [
  { id: '1', school: '테스트초등학교', grade: '1', classNum: '1', studentNum: '1', name: '김민준' },
  { id: '2', school: '테스트초등학교', grade: '1', classNum: '1', studentNum: '2', name: '이서연' },
  { id: '3', school: '테스트초등학교', grade: '1', classNum: '2', studentNum: '1', name: '박하은' },
  { id: '4', school: '샘플중학교', grade: '2', classNum: '1', studentNum: '1', name: '최지우' },
];

const initialItems: MeasurementItem[] = ['50m 달리기', '윗몸 일으키기', '오래달리기', '제자리 멀리뛰기'];

const initialRecords: MeasurementRecord[] = [
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.5, date: '2024-05-01', recordType: 'time' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.3, date: '2024-05-15', recordType: 'time' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '윗몸 일으키기', value: 45, date: '2024-05-01', recordType: 'count' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '50m 달리기', value: 9.1, date: '2024-05-01', recordType: 'time' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '윗몸 일으키기', value: 38, date: '2024-05-01', recordType: 'count' },
  { id: uuidv4(), studentId: '3', school: '테스트초등학교', item: '50m 달리기', value: 8.9, date: '2024-05-02', recordType: 'time' },
  { id: uuidv4(), studentId: '4', school: '샘플중학교', item: '제자리 멀리뛰기', value: 210, date: '2024-05-10', recordType: 'distance' },
];

const getKey = (school: string, key: string) => `${school}_${key}`;

const getLocalStorage = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const stored = localStorage.getItem(key);
  try {
    return stored ? JSON.parse(stored) : fallback;
  } catch (e) {
    console.error(`Failed to parse JSON for key ${key}:`, e);
    return fallback;
  }
};

const setLocalStorage = <T>(key: string, value: T) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

export const initializeData = (school: string) => {
  const studentsKey = getKey(school, 'students');
  if (!localStorage.getItem(studentsKey)) {
    setLocalStorage(studentsKey, initialStudents.filter(s => s.school === school));
  }
  
  const itemsKey = getKey(school, 'measurementItems');
  if (!localStorage.getItem(itemsKey)) {
    setLocalStorage(itemsKey, initialItems);
  }
  
  const recordsKey = getKey(school, 'records');
  if (!localStorage.getItem(recordsKey)) {
    setLocalStorage(recordsKey, initialRecords.filter(r => r.school === school));
  }
};

// Students
export const getStudents = (school: string): Student[] => getLocalStorage(getKey(school, 'students'), []);
export const getStudentsBySchool = (school: string): Student[] => {
    initializeData(school);
    return getStudents(school);
}
export const setStudents = (school: string, students: Student[]) => setLocalStorage(getKey(school, 'students'), students);
export const addStudent = (student: Omit<Student, 'id'>) => {
  initializeData(student.school);
  const students = getStudents(student.school);
  const newStudent = { ...student, id: uuidv4() };
  setStudents(student.school, [...students, newStudent]);
  return newStudent;
};
export const getStudent = (loginInfo: StudentLogin): Student | undefined => {
  const allSchools = Object.keys(localStorage)
    .filter(k => k.endsWith('_students'))
    .map(k => k.replace('_students', ''));
  
  const targetSchool = allSchools.find(s => s.includes(loginInfo.school));

  if (!targetSchool) return undefined;
  
  initializeData(targetSchool);
  const students = getStudents(targetSchool);
  return students.find(s => s.grade === loginInfo.grade && s.classNum === loginInfo.classNum && s.studentNum === loginInfo.studentNum && s.name === loginInfo.name);
};
export const deleteStudents = (school: string, ids: string[]) => {
  const students = getStudents(school);
  setStudents(school, students.filter(s => !ids.includes(s.id)));
};

// Measurement Items
export const getItems = (school: string): MeasurementItem[] => getLocalStorage(getKey(school, 'measurementItems'), []);
export const setItems = (school: string, items: MeasurementItem[]) => setLocalStorage(getKey(school, 'measurementItems'), items);
export const addItem = (school: string, item: MeasurementItem) => {
  const items = getItems(school);
  if (!items.includes(item)) {
    setItems(school, [...items, item]);
  }
};
export const deleteItem = (school: string, item: MeasurementItem) => {
  const items = getItems(school);
  const currentRecords = getRecords(school);
  setRecords(school, currentRecords.filter(r => r.item !== item));
  setItems(school, items.filter(i => i !== item));
};

// Records
export const getRecords = (school: string): MeasurementRecord[] => getLocalStorage(getKey(school, 'records'), []);
export const setRecords = (school: string, records: MeasurementRecord[]) => setLocalStorage(getKey(school, 'records'), records);
export const addOrUpdateRecord = (record: Omit<MeasurementRecord, 'id' | 'date' | 'recordType'> & { date?: string }) => {
  const records = getRecords(record.school);
  const today = record.date || format(new Date(), 'yyyy-MM-dd');
  const recordType = getItemRecordType(record.item);
  const existingRecordIndex = records.findIndex(r => r.studentId === record.studentId && r.item === record.item && r.date === today);

  if (existingRecordIndex > -1) {
    records[existingRecordIndex].value = record.value;
    records[existingRecordIndex].recordType = recordType;
    setRecords(record.school, records);
    return records[existingRecordIndex];
  } else {
    const newRecord: MeasurementRecord = { ...record, id: uuidv4(), date: today, recordType };
    setRecords(record.school, [...records, newRecord]);
    return newRecord;
  }
};
export const getRecordsByStudent = (school: string, studentId: string): MeasurementRecord[] => {
  const records = getRecords(school);
  return records.filter(r => r.studentId === studentId);
};
