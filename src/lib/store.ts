'use client';
import type { Student, MeasurementItem, MeasurementRecord, StudentLogin, RecordType } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { initialItems, initialStudents, initialRecords } from './initial-data';

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
export const getStudentById = (school: string, studentId: string): Student | undefined => {
    const students = getStudents(school);
    return students.find(s => s.id === studentId);
}
export const deleteStudents = (school: string, ids: string[]) => {
  const students = getStudents(school);
  setStudents(school, students.filter(s => !ids.includes(s.id)));
};

// Measurement Items
export const getItems = (school: string): MeasurementItem[] => {
    initializeData(school);
    const key = getKey(school, 'measurementItems');
    const items = getLocalStorage(key, []);

    // Data migration logic for old string-based items
    if (items.length > 0 && typeof items[0] === 'string') {
        const migratedItems: MeasurementItem[] = initialItems.map((item) => ({
             id: uuidv4(),
             name: item.name,
             unit: item.unit,
             recordType: item.recordType,
        }));
        setLocalStorage(key, migratedItems);
        return migratedItems;
    }
    return items;
};

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
export const getRecords = (school: string): MeasurementRecord[] => {
    initializeData(school);
    return getLocalStorage(getKey(school, 'records'), []);
}
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
