'use client';
import type { Student, MeasurementItem, MeasurementRecord, RecordType } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { initialItems, initialStudents, initialRecords } from './initial-data';
import { papsStandards } from './paps';
import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  runTransaction
} from 'firebase/firestore';


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

// This function now only seeds data if the collections are empty.
export const initializeData = async (school: string) => {
  const studentsRef = collection(db, 'schools', school, 'students');
  const snapshot = await getDocs(query(studentsRef));
  if (snapshot.empty) {
    const batch = writeBatch(db);
    const schoolStudents = initialStudents.filter(s => s.school === school);
    schoolStudents.forEach(student => {
      const studentDocRef = doc(db, 'schools', school, 'students', student.id);
      batch.set(studentDocRef, student);
    });
    
    const itemsRef = collection(db, 'schools', school, 'items');
    initialItems.forEach(item => {
        const itemDocRef = doc(db, 'schools', school, 'items', item.id);
        batch.set(itemDocRef, item);
    });

    const recordsRef = collection(db, 'schools', school, 'records');
    const schoolRecords = initialRecords.filter(r => r.school === school);
    schoolRecords.forEach(record => {
        const recordDocRef = doc(recordsRef); // Firestore will auto-generate ID
        batch.set(recordDocRef, record);
    });

    await batch.commit();
  }
};

// --- Student Functions ---
export const getStudents = async (school: string): Promise<Student[]> => {
    const studentsRef = collection(db, 'schools', school, 'students');
    const snapshot = await getDocs(studentsRef);
    return snapshot.docs.map(doc => doc.data() as Student);
};

export const getStudent = async (
  loginInfo: Omit<Student, 'id' | 'gender'>
): Promise<Student | undefined> => {
  const studentsRef = collection(db, 'schools', loginInfo.school, 'students');
  const q = query(
    studentsRef,
    where('school', '==', loginInfo.school),
    where('grade', '==', loginInfo.grade),
    where('classNum', '==', loginInfo.classNum),
    where('studentNum', '==', loginInfo.studentNum),
    where('name', '==', loginInfo.name)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return undefined;
  }
  return snapshot.docs[0].data() as Student;
};


// --- Legacy localStorage functions (will be migrated) ---

export const getStudentsBySchool = (school: string): Student[] => {
    return getLocalStorage(getKey(school, 'students'), []);
}
export const setStudents = (school: string, students: Student[]) => setLocalStorage(getKey(school, 'students'), students);
export const addStudent = (student: Omit<Student, 'id'>) => {
  const students = getStudentsBySchool(student.school);
  const newStudent = { ...student, id: uuidv4() };
  setStudents(student.school, [...students, newStudent]);
  return newStudent;
};

export const getStudentById = (school: string, studentId: string): Student | undefined => {
    const students = getStudentsBySchool(school);
    return students.find(s => s.id === studentId);
}
export const deleteStudents = (school: string, ids: string[]) => {
  const students = getStudentsBySchool(school);
  setStudents(school, students.filter(s => !ids.includes(s.id)));
};
const getKey = (school: string, key: string) => `${school}_${key}`;
// Measurement Items
export const getItems = (school: string): MeasurementItem[] => {
    const key = getKey(school, 'measurementItems');
    let items = getLocalStorage<MeasurementItem[]>(key, initialItems);

    // Data migration logic for old items without isPaps
    if (items.length > 0 && typeof items[0].isPaps === 'undefined') {
        const migratedItems = items.map((item) => ({
            ...item,
            isPaps: !!papsStandards[item.name as keyof typeof papsStandards],
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

export const addOrUpdateRecords = (school: string, newRecords: (Omit<MeasurementRecord, 'id'> & { studentId: string })[]) => {
  const allRecords = getRecords(school);
  
  newRecords.forEach(record => {
      const recordDate = record.date || format(new Date(), 'yyyy-MM-dd');
      const existingRecordIndex = allRecords.findIndex(r => 
          r.studentId === record.studentId && 
          r.item === record.item && 
          r.date === recordDate
      );

      if (existingRecordIndex > -1) {
          allRecords[existingRecordIndex].value = record.value;
      } else {
          allRecords.push({ ...record, id: uuidv4(), date: recordDate });
      }
  });

  setRecords(school, allRecords);
};

export const getRecordsByStudent = (school: string, studentId: string): MeasurementRecord[] => {
  const records = getRecords(school);
  return records.filter(r => r.studentId === studentId);
};


// Ranks
type RankInfo = { studentId: string; value: number; rank: number };

export const calculateRanks = (school: string, grade?: string): Record<string, RankInfo[]> => {
  const allItems = getItems(school);
  const allRecords = getRecords(school);
  const allStudents = getStudentsBySchool(school);
  const allRanks: Record<string, RankInfo[]> = {};

  const gradeStudents = grade ? allStudents.filter(s => s.grade === grade) : allStudents;
  const gradeStudentIds = new Set(gradeStudents.map(s => s.id));

  allItems.forEach(item => {
    const latestRecords: Record<string, MeasurementRecord> = {};
    const itemRecords = allRecords.filter(r => r.item === item.name && gradeStudentIds.has(r.studentId));

    itemRecords.forEach(record => {
      if (!latestRecords[record.studentId] || new Date(record.date) > new Date(latestRecords[record.studentId].date)) {
        latestRecords[record.studentId] = record;
      }
    });

    const studentValues = Object.values(latestRecords);

    if (item.recordType === 'time') {
      studentValues.sort((a, b) => a.value - b.value); // Lower is better
    } else {
      studentValues.sort((a, b) => b.value - a.value); // Higher is better
    }

    const ranks: RankInfo[] = [];
    let rank = 1;
    for (let i = 0; i < studentValues.length; i++) {
      if (i > 0 && studentValues[i].value !== studentValues[i - 1].value) {
        rank = i + 1;
      }
      ranks.push({
        studentId: studentValues[i].studentId,
        value: studentValues[i].value,
        rank: rank
      });
    }
    allRanks[item.name] = ranks;
  });

  return allRanks;
};
