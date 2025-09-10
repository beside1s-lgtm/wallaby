'use client';
import type { Student, MeasurementItem, MeasurementRecord, StudentLogin, RecordType } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const initialStudents: Student[] = [
  { id: '1', school: '테스트초등학교', grade: '1', classNum: '1', studentNum: '1', name: '김민준' },
  { id: '2', school: '테스트초등학교', grade: '1', classNum: '1', studentNum: '2', name: '이서연' },
  { id: '3', school: '테스트초등학교', grade: '1', classNum: '2', studentNum: '1', name: '박하은' },
  { id: '4', school: '샘플중학교', grade: '2', classNum: '1', studentNum: '1', name: '최지우' },
];

const initialItems: MeasurementItem[] = [
    { id: '1', name: '50m 달리기', unit: '초', recordType: 'time' },
    { id: '2', name: '윗몸 일으키기', unit: '회', recordType: 'count' },
    { id: '3', name: '오래달리기', unit: '초', recordType: 'time' },
    { id: '4', name: '제자리 멀리뛰기', unit: 'cm', recordType: 'distance' },
];

const initialRecords: MeasurementRecord[] = [
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.5, date: '2024-05-01' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '50m 달리기', value: 8.3, date: '2024-05-15' },
  { id: uuidv4(), studentId: '1', school: '테스트초등학교', item: '윗몸 일으키기', value: 45, date: '2024-05-01' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '50m 달리기', value: 9.1, date: '2024-05-01' },
  { id: uuidv4(), studentId: '2', school: '테스트초등학교', item: '윗몸 일으키기', value: 38, date: '2024-05-01' },
  { id: uuidv4(), studentId: '3', school: '테스트초등학교', item: '50m 달리기', value: 8.9, date: '2024-05-02' },
  { id: uuidv4(), studentId: '4', school: '샘플중학교', item: '제자리 멀리뛰기', value: 210, date: '2024-05-10'},
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
    const schoolStudents = initialStudents.filter(s => s.school === school);
    if(schoolStudents.length > 0) {
        setLocalStorage(studentsKey, schoolStudents);
    }
  }
  
  const itemsKey = getKey(school, 'measurementItems');
  if (!localStorage.getItem(itemsKey)) {
    setLocalStorage(itemsKey, initialItems);
  }
  
  const recordsKey = getKey(school, 'records');
  if (!localStorage.getItem(recordsKey)) {
    const schoolRecords = initialRecords.filter(r => r.school === school);
     if(schoolRecords.length > 0) {
        setLocalStorage(recordsKey, schoolRecords);
    }
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
  initializeData(loginInfo.school);
  const students = getStudents(loginInfo.school);
  
  return students.find(s => 
    s.school === loginInfo.school &&
    s.grade === loginInfo.grade && 
    s.classNum === loginInfo.classNum && 
    s.studentNum === loginInfo.studentNum && 
    s.name === loginInfo.name
  );
};
export const deleteStudents = (school: string, ids: string[]) => {
  const students = getStudents(school);
  setStudents(school, students.filter(s => !ids.includes(s.id)));
};

// Measurement Items
export const getItems = (school: string): MeasurementItem[] => getLocalStorage(getKey(school, 'measurementItems'), []);
export const setItems = (school: string, items: MeasurementItem[]) => setLocalStorage(getKey(school, 'measurementItems'), items);
export const addItem = (school: string, item: Omit<MeasurementItem, 'id'>) => {
  const items = getItems(school);
  const newItem = { ...item, id: uuidv4() };
  if (!items.find(i => i.name === item.name)) {
    setItems(school, [...items, newItem]);
  }
};
export const deleteItem = (school: string, itemId: string) => {
  const items = getItems(school);
  const itemToDelete = items.find(i => i.id === itemId);
  if (!itemToDelete) return;
  
  const currentRecords = getRecords(school);
  setRecords(school, currentRecords.filter(r => r.item !== itemToDelete.name));
  setItems(school, items.filter(i => i.id !== itemId));
};

// Records
export const getRecords = (school: string): MeasurementRecord[] => getLocalStorage(getKey(school, 'records'), []);
export const setRecords = (school: string, records: MeasurementRecord[]) => setLocalStorage(getKey(school, 'records'), records);
export const addOrUpdateRecord = (record: Omit<MeasurementRecord, 'id' | 'date'> & { date?: string }) => {
  const records = getRecords(record.school);
  const today = record.date || format(new Date(), 'yyyy-MM-dd');
  const existingRecordIndex = records.findIndex(r => r.studentId === record.studentId && r.item === record.item && r.date === today);

  if (existingRecordIndex > -1) {
    records[existingRecordIndex].value = record.value;
    setRecords(record.school, records);
    return records[existingRecordIndex];
  } else {
    const newRecord: Omit<MeasurementRecord, 'id'> & { id: string } = { ...record, id: uuidv4(), date: today };
    setRecords(record.school, [...records, newRecord]);
    return newRecord;
  }
};
export const getRecordsByStudent = (school: string, studentId: string): MeasurementRecord[] => {
  const records = getRecords(school);
  return records.filter(r => r.studentId === studentId);
};
