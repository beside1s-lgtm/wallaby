'use client';
import type { Student, MeasurementItem, MeasurementRecord, RecordType } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { initialItems, initialStudents, initialRecords } from './initial-data';
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
  runTransaction,
  collectionGroup,
  limit
} from 'firebase/firestore';


// This function now only seeds data if the schools collection is empty for that school.
export const initializeData = async (school: string) => {
  const schoolDocRef = doc(db, 'schools', school);
  const snapshot = await getDoc(schoolDocRef);
  
  if (!snapshot.exists()) {
    const batch = writeBatch(db);
    batch.set(schoolDocRef, { name: school, createdAt: new Date() });

    const schoolStudents = initialStudents.filter(s => s.school === school);
    schoolStudents.forEach(student => {
      const studentDocRef = doc(db, 'schools', school, 'students', student.id);
      batch.set(studentDocRef, student);
    });
    
    initialItems.forEach(item => {
        const itemDocRef = doc(db, 'schools', school, 'items', item.id);
        batch.set(itemDocRef, item);
    });

    const schoolRecords = initialRecords.filter(r => r.school === school);
    schoolRecords.forEach(record => {
        const recordDocRef = doc(collection(db, 'schools', school, 'records')); 
        batch.set(recordDocRef, { ...record, id: recordDocRef.id });
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

export const setStudents = async (school: string, students: Student[]) => {
    const batch = writeBatch(db);
    const studentsRef = collection(db, 'schools', school, 'students');
    const currentStudentsSnapshot = await getDocs(studentsRef);
    currentStudentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    students.forEach(student => {
        const studentDocRef = doc(db, 'schools', school, 'students', student.id);
        batch.set(studentDocRef, student);
    });
    await batch.commit();
}


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
    where('name', '==', loginInfo.name),
    where('accessCode', '==', loginInfo.accessCode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return undefined;
  }
  return snapshot.docs[0].data() as Student;
};

export const addStudent = async (student: Omit<Student, 'id'>) => {
    const studentWithId = { ...student, id: uuidv4() };
    const studentDocRef = doc(db, 'schools', student.school, 'students', studentWithId.id);
    await setDoc(studentDocRef, studentWithId);
    return studentWithId;
};

export const getStudentById = async (school: string, studentId: string): Promise<Student | undefined> => {
    const studentDocRef = doc(db, 'schools', school, 'students', studentId);
    const docSnap = await getDoc(studentDocRef);
    return docSnap.exists() ? docSnap.data() as Student : undefined;
}

// Measurement Items
export const getItems = async (school: string): Promise<MeasurementItem[]> => {
    const itemsRef = collection(db, 'schools', school, 'items');
    const snapshot = await getDocs(itemsRef);
    if(snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => doc.data() as MeasurementItem);
};

export const setItems = async (school: string, items: MeasurementItem[]) => {
    const batch = writeBatch(db);
    const itemsRef = collection(db, 'schools', school, 'items');
    const currentItemsSnapshot = await getDocs(itemsRef);
    currentItemsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    items.forEach(item => {
        const itemDocRef = doc(db, 'schools', school, 'items', item.id);
        batch.set(itemDocRef, item);
    });
    await batch.commit();
}


export const addItem = async (school: string, item: Omit<MeasurementItem, 'id'>) => {
  const itemsRef = collection(db, 'schools', school, 'items');
  const q = query(itemsRef, where("name", "==", item.name), limit(1));
  const existing = await getDocs(q);

  if (existing.empty) {
    const newItemRef = doc(itemsRef);
    const newItem = { ...item, id: newItemRef.id };
    await setDoc(newItemRef, newItem);
    return newItem;
  }
  return existing.docs[0].data() as MeasurementItem;
};

export const deleteItem = async (school: string, itemId: string) => {
  await deleteDoc(doc(db, 'schools', school, 'items', itemId));
};

// Records
export const getRecords = async (school: string): Promise<MeasurementRecord[]> => {
    const recordsRef = collection(db, 'schools', school, 'records');
    const snapshot = await getDocs(recordsRef);
    if(snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => doc.data() as MeasurementRecord);
}

export const setRecords = async (school: string, records: MeasurementRecord[]) => {
     const batch = writeBatch(db);
    const recordsRef = collection(db, 'schools', school, 'records');
    const currentRecordsSnapshot = await getDocs(recordsRef);
    currentRecordsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    records.forEach(record => {
        const recordDocRef = doc(db, 'schools', school, 'records', record.id);
        batch.set(recordDocRef, record);
    });
    await batch.commit();
}


export const addOrUpdateRecord = async (record: Omit<MeasurementRecord, 'id'>) => {
  const recordDate = record.date || format(new Date(), 'yyyy-MM-dd');
  const recordsRef = collection(db, 'schools', record.school, 'records');
  const q = query(recordsRef, 
      where("studentId", "==", record.studentId), 
      where("item", "==", record.item), 
      where("date", "==", recordDate)
  );

  await runTransaction(db, async (transaction) => {
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      // If duplicates exist, update the last one and delete the others.
      const docs = snapshot.docs;
      const docToKeep = docs[docs.length - 1];
      transaction.update(docToKeep.ref, { value: record.value });
      
      // Delete other duplicates
      for (let i = 0; i < docs.length - 1; i++) {
        transaction.delete(docs[i].ref);
      }
    } else {
      const newRecordRef = doc(recordsRef);
      const newRecord = { ...record, id: newRecordRef.id, date: recordDate };
      transaction.set(newRecordRef, newRecord);
    }
  });
};

export const deleteRecord = async (school: string, recordId: string) => {
  const recordDocRef = doc(db, 'schools', school, 'records', recordId);
  await deleteDoc(recordDocRef);
};

export const addOrUpdateRecords = async (school: string, allStudents: Student[], newRecords: any[]) => {
  const batch = writeBatch(db);
  const studentMap = new Map(allStudents.map(s => [`${s.school}-${s.grade}-${s.classNum}-${s.studentNum}-${s.name}`, s]));
  const currentItems = await getItems(school);
  const itemMap = new Map(currentItems.map(i => [i.name, i]));
  
  // Pre-fetch all existing records for performance
  const allExistingRecords = await getRecords(school);
  const existingRecordsMap = new Map<string, MeasurementRecord>();
  allExistingRecords.forEach(rec => {
    const key = `${rec.studentId}-${rec.item}-${rec.date}`;
    existingRecordsMap.set(key, rec);
  });

  const newItemsToAdd: Omit<MeasurementItem, 'id'>[] = [];
  // Find new items to create
  for (const record of newRecords) {
    if (record.item && !itemMap.has(record.item) && !newItemsToAdd.some(i => i.name === record.item)) {
       newItemsToAdd.push({
            name: record.item,
            unit: record.unit || '점',
            recordType: record.recordType || 'distance',
            isPaps: false
        });
    }
  }

  // Add new items to DB and update the local map
  if (newItemsToAdd.length > 0) {
    const itemPromises = newItemsToAdd.map(item => addItem(school, item));
    const addedItems = await Promise.all(itemPromises);
    addedItems.forEach(item => itemMap.set(item.name, item));
  }
  
  for (const record of newRecords) {
    const studentKey = `${record.school}-${record.grade}-${record.classNum}-${record.studentNum}-${record.name}`;
    const student = studentMap.get(studentKey);
    
    if (!student || !record.item || record.value === undefined) continue;

    const recordDate = record.date || format(new Date(), 'yyyy-MM-dd');
    const recordValue = parseFloat(record.value);
    if(isNaN(recordValue)) continue;

    const recordKey = `${student.id}-${record.item}-${recordDate}`;
    const existingRecord = existingRecordsMap.get(recordKey);

    const recordsCollectionRef = collection(db, 'schools', school, 'records');

    if (existingRecord) {
      if (existingRecord.value !== recordValue) {
        const docRef = doc(recordsCollectionRef, existingRecord.id);
        batch.update(docRef, { value: recordValue });
      }
    } else {
      const newRecordRef = doc(recordsCollectionRef);
      const recordToAdd = {
        id: newRecordRef.id,
        studentId: student.id,
        school: school,
        item: record.item,
        value: recordValue,
        date: recordDate,
      };
      batch.set(newRecordRef, recordToAdd);
    }
  }

  await batch.commit();
};

export const getRecordsByStudent = async (school: string, studentId: string): Promise<MeasurementRecord[]> => {
  const recordsRef = collection(db, 'schools', school, 'records');
  const q = query(recordsRef, where("studentId", "==", studentId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as MeasurementRecord);
};


// Ranks
type RankInfo = { studentId: string; value: number; rank: number };

export const calculateRanks = (
    school: string, 
    allItems: MeasurementItem[], 
    allRecords: MeasurementRecord[],
    allStudents: Student[],
    grade?: string
): Record<string, RankInfo[]> => {
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

export const cleanUpDuplicateRecords = async (school: string): Promise<void> => {
  const recordsRef = collection(db, 'schools', school, 'records');
  const snapshot = await getDocs(recordsRef);
  const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeasurementRecord));

  const recordsByCompoundKey = new Map<string, MeasurementRecord[]>();

  records.forEach(record => {
    const key = `${record.studentId}-${record.item}-${record.date}`;
    if (!recordsByCompoundKey.has(key)) {
      recordsByCompoundKey.set(key, []);
    }
    recordsByCompoundKey.get(key)!.push(record);
  });

  const batch = writeBatch(db);
  let duplicatesFound = false;

  for (const [key, recordGroup] of recordsByCompoundKey.entries()) {
    if (recordGroup.length > 1) {
      duplicatesFound = true;
      // Sort by ID to find the "latest" one. Assuming UUIDs/auto-IDs are roughly chronological.
      recordGroup.sort((a, b) => b.id.localeCompare(a.id));
      const recordToKeep = recordGroup[0];

      // Mark others for deletion
      for (let i = 1; i < recordGroup.length; i++) {
        const docToDeleteRef = doc(db, 'schools', school, 'records', recordGroup[i].id);
        batch.delete(docToDeleteRef);
      }
    }
  }

  if (duplicatesFound) {
    console.log(`[${school}] Cleaning up duplicate records...`);
    await batch.commit();
    console.log(`[${school}] Cleanup complete.`);
  }
};
