'use client';
import type { Student, MeasurementItem, MeasurementRecord, StudentLogin } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const initialStudents: Student[] = [
  { id: '1', grade: '1', classNum: '1', studentNum: '1', name: '김민준' },
  { id: '2', grade: '1', classNum: '1', studentNum: '2', name: '이서연' },
  { id: '3', grade: '1', classNum: '2', studentNum: '1', name: '박하은' },
  { id: '4', grade: '2', classNum: '1', studentNum: '1', name: '최지우' },
];

const initialItems: MeasurementItem[] = ['50m 달리기', '윗몸 일으키기', '오래달리기', '제자리 멀리뛰기'];

const initialRecords: MeasurementRecord[] = [
  { id: uuidv4(), studentId: '1', item: '50m 달리기', value: 8.5, date: '2024-05-01' },
  { id: uuidv4(), studentId: '1', item: '50m 달리기', value: 8.3, date: '2024-05-15' },
  { id: uuidv4(), studentId: '1', item: '윗몸 일으키기', value: 45, date: '2024-05-01' },
  { id: uuidv4(), studentId: '2', item: '50m 달리기', value: 9.1, date: '2024-05-01' },
  { id: uuidv4(), studentId: '2', item: '윗몸 일으키기', value: 38, date: '2024-05-01' },
  { id: uuidv4(), studentId: '3', item: '50m 달리기', value: 8.9, date: '2024-05-02' },
  { id: uuidv4(), studentId: '4', item: '제자리 멀리뛰기', value: 210, date: '2024-05-10' },
];

const getLocalStorage = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : fallback;
};

const setLocalStorage = <T>(key: string, value: T) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

export const initializeData = () => {
  getLocalStorage('students', initialStudents);
  getLocalStorage('measurementItems', initialItems);
  getLocalStorage('records', initialRecords);
};

// Students
export const getStudents = (): Student[] => getLocalStorage('students', []);
export const setStudents = (students: Student[]) => setLocalStorage('students', students);
export const addStudent = (student: Omit<Student, 'id'>) => {
  const students = getStudents();
  const newStudent = { ...student, id: uuidv4() };
  setStudents([...students, newStudent]);
  return newStudent;
};
export const getStudent = (loginInfo: StudentLogin): Student | undefined => {
  const students = getStudents();
  return students.find(s => s.grade === loginInfo.grade && s.classNum === loginInfo.classNum && s.studentNum === loginInfo.studentNum && s.name === loginInfo.name);
};
export const deleteStudents = (ids: string[]) => {
  const students = getStudents();
  setStudents(students.filter(s => !ids.includes(s.id)));
};

// Measurement Items
export const getItems = (): MeasurementItem[] => getLocalStorage('measurementItems', []);
export const setItems = (items: MeasurementItem[]) => setLocalStorage('measurementItems', items);
export const addItem = (item: MeasurementItem) => {
  const items = getItems();
  if (!items.includes(item)) {
    setItems([...items, item]);
  }
};
export const deleteItem = (item: MeasurementItem) => {
  const items = getItems();
  setItems(items.filter(i => i !== item));
};

// Records
export const getRecords = (): MeasurementRecord[] => getLocalStorage('records', []);
export const setRecords = (records: MeasurementRecord[]) => setLocalStorage('records', records);
export const addOrUpdateRecord = (record: Omit<MeasurementRecord, 'id' | 'date'> & { date?: string }) => {
  const records = getRecords();
  const today = record.date || format(new Date(), 'yyyy-MM-dd');
  const existingRecordIndex = records.findIndex(r => r.studentId === record.studentId && r.item === record.item && r.date === today);

  if (existingRecordIndex > -1) {
    records[existingRecordIndex].value = record.value;
    setRecords(records);
    return records[existingRecordIndex];
  } else {
    const newRecord = { ...record, id: uuidv4(), date: today };
    setRecords([...records, newRecord]);
    return newRecord;
  }
};
export const getRecordsByStudent = (studentId: string): MeasurementRecord[] => {
  const records = getRecords();
  return records.filter(r => r.studentId === studentId);
};
