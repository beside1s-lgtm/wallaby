'use client';
import type { Student, MeasurementItem, MeasurementRecord, RecordType, StudentToAdd, School, StudentToUpdate, TeamGroup, TeamGroupInput, Tournament, Team } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { initialItems, initialStudents, initialRecords } from './initial-data';
import { db, signIn } from './firebase';
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
  limit,
  updateDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { errorEmitter } from './error-emitter';
import { FirestorePermissionError } from './errors';
import { exportToCsv as exportToCsvUtil } from './utils';

// This function now only seeds data if the schools collection is empty for that school.
export const initializeData = async (schoolName: string, password?: string) => {
  await signIn();
  const schoolDocRef = doc(db, 'schools', schoolName);
  
  try {
    await runTransaction(db, async (transaction) => {
      const schoolDoc = await transaction.get(schoolDocRef);
      if (schoolDoc.exists()) {
        // School already exists, do nothing.
        return;
      }
      
      // If school does not exist, create it along with initial data.
      const schoolData: School = {
        id: schoolName,
        name: schoolName,
        createdAt: serverTimestamp(),
      };
      if (password) {
        schoolData.password = password;
      }
      transaction.set(schoolDocRef, schoolData);

      const schoolStudents = initialStudents.map(s => ({...s, school: schoolName}));
      schoolStudents.forEach(student => {
        const studentDocRef = doc(db, 'schools', schoolName, 'students', student.id);
        transaction.set(studentDocRef, student);
      });
      
      initialItems.forEach(item => {
          const itemDocRef = doc(db, 'schools', schoolName, 'items', item.id);
          transaction.set(itemDocRef, item);
      });

      const schoolRecords = initialRecords.map(r => ({...r, school: schoolName}));
      schoolRecords.forEach(record => {
          const recordDocRef = doc(collection(db, 'schools', schoolName, 'records')); 
          transaction.set(recordDocRef, { ...record, id: recordDocRef.id });
      });
    });
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: schoolDocRef.path,
        operation: 'write', // A transaction can be a complex write operation
        requestResourceData: { name: schoolName, password, message: "Initial data setup for new school." }
      }));
    }
    // Re-throw other errors
    throw e;
  }
};

export const exportToCsv = (filename: string, rows: object[]) => {
  exportToCsvUtil(filename, rows);
}

export const getSchoolByName = async (schoolName: string): Promise<School | null> => {
  await signIn();
  const schoolRef = doc(db, 'schools', schoolName);
  try {
    const schoolSnap = await getDoc(schoolRef);
    if (schoolSnap.exists()) {
      return schoolSnap.data() as School;
    }
    return null;
  } catch (e: any) {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: schoolRef.path,
            operation: 'get'
        }));
    }
    throw e;
  }
}

export const updateSchoolPassword = async (schoolName: string, password: string): Promise<void> => {
  await signIn();
  const schoolRef = doc(db, 'schools', schoolName);
  try {
    await updateDoc(schoolRef, { password });
  } catch (e: any) {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: schoolRef.path,
            operation: 'update',
            requestResourceData: { password: '***' } // Don't leak password in error
        }));
    }
    throw e;
  }
}


// --- Student Functions ---
export const getStudents = async (school: string): Promise<Student[]> => {
    await signIn();
    const studentsRef = collection(db, 'schools', school, 'students');
    const snapshot = await getDocs(studentsRef).catch((e) => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: studentsRef.path,
                operation: 'list',
            }));
        }
        throw e;
    });
    return snapshot.docs.map(doc => doc.data() as Student);
};

export const deleteStudentAndAssociatedRecords = async (school: string, studentId: string) => {
  await signIn();
  const batch = writeBatch(db);
  const recordsRef = collection(db, 'schools', school, 'records');
  const q = query(recordsRef, where('studentId', '==', studentId));
  
  const recordsSnapshot = await getDocs(q);
  recordsSnapshot.forEach(doc => batch.delete(doc.ref));

  const studentDocRef = doc(db, 'schools', school, 'students', studentId);
  batch.delete(studentDocRef);

  await batch.commit().catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `schools/${school}`,
        operation: 'write',
        requestResourceData: { message: `Deleting student ${studentId} and their records.` }
      }));
    }
    throw e;
  });
};


export const getStudent = async (
  loginInfo: Omit<Student, 'id' | 'gender' | 'photoUrl'> & { accessCode: string }
): Promise<Student | undefined> => {
  await signIn();
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
  const snapshot = await getDocs(q).catch(e => {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: studentsRef.path,
            operation: 'list',
            requestResourceData: { query: "student login query" }
        }));
    }
    throw e;
  });

  if (snapshot.empty) {
    return undefined;
  }
  return snapshot.docs[0].data() as Student;
};

export const addStudent = async (school: string, studentData: StudentToAdd, allStudents: Student[]) => {
    await signIn();
    const existingCodes = new Set(allStudents.map(s => s.accessCode).filter(Boolean));
    let newCode: string;
    do {
      newCode = Math.floor(10000 + Math.random() * 90000).toString();
    } while (existingCodes.has(newCode));

    const studentWithId = { ...studentData, school, id: uuidv4(), accessCode: newCode };
    const studentDocRef = doc(db, 'schools', school, 'students', studentWithId.id);
    await setDoc(studentDocRef, studentWithId).catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: studentDocRef.path,
                operation: 'create',
                requestResourceData: studentWithId
            }));
        }
        throw e;
    });
    return studentWithId;
};

export const updateStudent = async (school: string, studentId: string, studentData: StudentToUpdate) => {
  await signIn();
  const studentDocRef = doc(db, 'schools', school, 'students', studentId);
  await updateDoc(studentDocRef, studentData).catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: studentDocRef.path,
        operation: 'update',
        requestResourceData: studentData
      }));
    }
    throw e;
  });
};

export const getStudentById = async (school: string, studentId: string): Promise<Student | undefined> => {
    await signIn();
    const studentDocRef = doc(db, 'schools', school, 'students', studentId);
    const docSnap = await getDoc(studentDocRef).catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: studentDocRef.path,
                operation: 'get'
            }));
        }
        throw e;
    });
    return docSnap.exists() ? docSnap.data() as Student : undefined;
}

export const assignMissingAccessCodes = async (school: string): Promise<void> => {
  await signIn();
  const students = await getStudents(school);
  const studentsWithoutCode = students.filter(s => !s.accessCode);

  if (studentsWithoutCode.length === 0) {
    return;
  }
  
  const existingCodes = new Set(students.map(s => s.accessCode).filter(Boolean));
  const batch = writeBatch(db);

  studentsWithoutCode.forEach(student => {
    let newCode: string;
    do {
      newCode = Math.floor(10000 + Math.random() * 90000).toString();
    } while (existingCodes.has(newCode));
    
    existingCodes.add(newCode);
    const studentDocRef = doc(db, 'schools', school, 'students', student.id);
    batch.update(studentDocRef, { accessCode: newCode });
  });

  await batch.commit().catch(e => {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${school}/students`,
            operation: 'write',
            requestResourceData: { message: "Batch updating access codes." }
        }));
    }
    throw e;
  });
};

export const promoteStudents = async (school: string, allStudents: Student[], promotionData: any[]): Promise<number> => {
  await signIn();
  const batch = writeBatch(db);
  const studentMapByName = new Map(allStudents.map(s => [`${s.school}-${s.grade}-${s.classNum}-${s.studentNum}-${s.name}`, s]));
  
  let updatedCount = 0;

  for (const promo of promotionData) {
    const studentKey = `${promo.school}-${promo.grade}-${promo.classNum}-${promo.studentNum}-${promo.name}`;
    const student = studentMapByName.get(studentKey);
    
    if (student && promo.newGrade && promo.newClassNum && promo.newStudentNum) {
      const studentDocRef = doc(db, 'schools', school, 'students', student.id);
      batch.update(studentDocRef, {
        grade: promo.newGrade,
        classNum: promo.newClassNum,
        studentNum: promo.newStudentNum,
      });
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    await batch.commit().catch(e => {
      if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `schools/${school}/students`,
          operation: 'write',
          requestResourceData: { message: "Batch promoting students." }
        }));
      }
      throw e;
    });
  }

  return updatedCount;
};


// Measurement Items
export const getItems = async (school: string): Promise<MeasurementItem[]> => {
    await signIn();
    const itemsRef = collection(db, 'schools', school, 'items');
    const snapshot = await getDocs(itemsRef).catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: itemsRef.path,
                operation: 'list'
            }));
        }
        throw e;
    });
    if(snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => doc.data() as MeasurementItem);
};

export const setItems = async (school: string, items: MeasurementItem[]) => {
    await signIn();
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
    await batch.commit().catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: itemsRef.path,
                operation: 'write',
                requestResourceData: { message: "Batch setting items." }
            }));
        }
        throw e;
    });
}


export const addItem = async (school: string, item: Omit<MeasurementItem, 'id' | 'category'> & {category?: string}) => {
  await signIn();
  const itemsRef = collection(db, 'schools', school, 'items');
  const q = query(itemsRef, where("name", "==", item.name), limit(1));
  const existing = await getDocs(q);

  if (existing.empty) {
    const newItemRef = doc(itemsRef);
    const newItem = { ...item, id: newItemRef.id };
    await setDoc(newItemRef, newItem).catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: newItemRef.path,
                operation: 'create',
                requestResourceData: newItem
            }));
        }
        throw e;
    });
    return newItem;
  }
  return existing.docs[0].data() as MeasurementItem;
};

export const deleteItemAndAssociatedRecords = async (school: string, itemToDelete: MeasurementItem) => {
  await signIn();
  const batch = writeBatch(db);
  const recordsRef = collection(db, 'schools', school, 'records');
  const q = query(recordsRef, where('item', '==', itemToDelete.name));
  const recordsSnapshot = await getDocs(q);

  recordsSnapshot.forEach(doc => batch.delete(doc.ref));

  const itemDocRef = doc(db, 'schools', school, 'items', itemToDelete.id);
  batch.delete(itemDocRef);

  await batch.commit().catch(e => {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${school}`,
            operation: 'write',
            requestResourceData: { message: `Deleting item ${itemToDelete.name} and its records.` }
        }));
    }
    throw e;
  });
};


// Records
export const getRecords = async (school: string): Promise<MeasurementRecord[]> => {
    await signIn();
    const recordsRef = collection(db, 'schools', school, 'records');
    const snapshot = await getDocs(recordsRef).catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: recordsRef.path,
                operation: 'list'
            }));
        }
        throw e;
    });
    if(snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => doc.data() as MeasurementRecord);
}

export const setRecords = async (school: string, records: MeasurementRecord[]) => {
     await signIn();
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
    await batch.commit().catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: recordsRef.path,
                operation: 'write',
                requestResourceData: { message: 'Batch setting records.' }
            }));
        }
        throw e;
    });
}


export const addOrUpdateRecord = async (record: Partial<MeasurementRecord> & Pick<MeasurementRecord, 'school' | 'studentId' | 'item' | 'value' | 'date'>): Promise<MeasurementRecord> => {
  await signIn();
  const recordsRef = collection(db, 'schools', record.school, 'records');
  let finalRecord: MeasurementRecord;

  try {
    await runTransaction(db, async (transaction) => {
      const q = query(
        recordsRef,
        where('studentId', '==', record.studentId),
        where('item', '==', record.item),
        where('date', '==', record.date),
        limit(1)
      );
      
      const querySnapshot = await transaction.get(q);
      
      if (!querySnapshot.empty) {
        const docToUpdateRef = querySnapshot.docs[0].ref;
        transaction.update(docToUpdateRef, { value: record.value });
        finalRecord = { ...querySnapshot.docs[0].data(), value: record.value } as MeasurementRecord;
      } else {
        const newRecordRef = record.id ? doc(recordsRef, record.id) : doc(recordsRef);
        finalRecord = { ...record, id: newRecordRef.id } as MeasurementRecord;
        transaction.set(newRecordRef, finalRecord);
      }
    });
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: recordsRef.path,
        operation: 'write',
        requestResourceData: { record }
      }));
    }
    throw e;
  }
  // @ts-ignore
  return finalRecord;
};

export const deleteRecord = async (school: string, recordId: string) => {
  await signIn();
  const recordDocRef = doc(db, 'schools', school, 'records', recordId);
  await deleteDoc(recordDocRef).catch(e => {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: recordDocRef.path,
            operation: 'delete'
        }));
    }
    throw e;
  });
};

export const deleteRecordsByDateAndItem = async (school: string, date: string, item: string): Promise<number> => {
    await signIn();
    const recordsRef = collection(db, 'schools', school, 'records');
    const q = query(recordsRef, where('date', '==', date), where('item', '==', item));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return 0;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit().catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: recordsRef.path,
                operation: 'write',
                requestResourceData: { message: `Deleting records for item ${item} on date ${date}.` }
            }));
        }
        throw e;
    });
    return snapshot.size;
};

export const addOrUpdateRecords = async (school: string, recordsToProcess: (Omit<MeasurementRecord, 'id'> & { student: Student })[]): Promise<MeasurementRecord[]> => {
  await signIn();
  if (recordsToProcess.length === 0) {
    return [];
  }

  const recordsRef = collection(db, 'schools', school, 'records');
  const updatedRecords: MeasurementRecord[] = [];
  
  const firstRecord = recordsToProcess[0];
  const recordDate = firstRecord.date;
  const recordItem = firstRecord.item;
  const studentIds = recordsToProcess.map(r => r.studentId);
  const studentIdChunks: string[][] = [];

  for (let i = 0; i < studentIds.length; i += 30) {
    studentIdChunks.push(studentIds.slice(i, i + 30));
  }

  const queryPromises = studentIdChunks.map(chunk => 
    getDocs(query(
      recordsRef,
      where('studentId', 'in', chunk),
      where('item', '==', recordItem),
      where('date', '==', recordDate)
    ))
  );

  const querySnapshots = await Promise.all(queryPromises);
  const existingRecordsMap = new Map<string, MeasurementRecord>();
  querySnapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      const data = doc.data() as MeasurementRecord;
      existingRecordsMap.set(data.studentId, { ...data, id: doc.id });
    });
  });

  const batch = writeBatch(db);
  const recordsToSave = [];

  for (const record of recordsToProcess) {
    const existingRecord = existingRecordsMap.get(record.studentId);

    if (existingRecord) {
      const docRef = doc(recordsRef, existingRecord.id);
      batch.update(docRef, { value: record.value });
      recordsToSave.push({ ...existingRecord, value: record.value });
    } else {
      const newRecordRef = doc(recordsRef);
      const newRecord = { 
          id: newRecordRef.id,
          studentId: record.studentId,
          school: record.school,
          item: record.item,
          value: record.value,
          date: record.date
       };
      batch.set(newRecordRef, newRecord);
      recordsToSave.push(newRecord);
    }
  }

  if (recordsToSave.length > 0) {
    await batch.commit().catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `schools/${school}/records`,
                operation: 'write',
                requestResourceData: { message: `Batch add/update ${recordsToSave.length} records.` }
            }));
        }
        throw e;
    });
  }

  return recordsToSave;
};


export const getRecordsByStudent = async (school: string, studentId: string): Promise<MeasurementRecord[]> => {
  await signIn();
  const recordsRef = collection(db, 'schools', school, 'records');
  const q = query(recordsRef, where("studentId", "==", studentId));
  const snapshot = await getDocs(q).catch(e => {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: recordsRef.path,
            operation: 'list',
            requestResourceData: { query: `records for student ${studentId}` }
        }));
    }
    throw e;
  });
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
    } else if (item.recordType === 'level') {
        studentValues.sort((a, b) => a.value - b.value); // Lower is better (1=상, 2=중, 3=하)
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

export const cleanUpDuplicateRecords = async (school: string): Promise<number> => {
  await signIn();
  const recordsRef = collection(db, 'schools', school, 'records');
  const snapshot = await getDocs(recordsRef);
  const records = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MeasurementRecord));

  const recordsByCompoundKey = new Map<string, MeasurementRecord[]>();

  records.forEach(record => {
    const key = `${record.studentId}-${record.item}-${record.date}`;
    if (!recordsByCompoundKey.has(key)) {
      recordsByCompoundKey.set(key, []);
    }
    recordsByCompoundKey.get(key)!.push(record);
  });

  const batch = writeBatch(db);
  let duplicatesFound = 0;

  for (const [key, recordGroup] of recordsByCompoundKey.entries()) {
    if (recordGroup.length > 1) {
      duplicatesFound += recordGroup.length - 1;
      // Keep the one with the latest ID (or any other logic, here latest ID means latest write)
      recordGroup.sort((a, b) => b.id.localeCompare(a.id));
      for (let i = 1; i < recordGroup.length; i++) {
        const docToDeleteRef = doc(db, 'schools', school, 'records', recordGroup[i].id);
        batch.delete(docToDeleteRef);
      }
    }
  }

  if (duplicatesFound > 0) {
    await batch.commit().catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: recordsRef.path,
                operation: 'write',
                requestResourceData: { message: "Cleaning up duplicate records." }
            }));
        }
        throw e;
    });
  }
  return duplicatesFound;
};

// --- Team Groups ---
export const saveTeamGroup = async (teamGroupData: TeamGroupInput): Promise<void> => {
    await signIn();
    const teamGroupsRef = collection(db, 'schools', teamGroupData.school, 'teamGroups');
    
    // Add unique ID to each team before saving
    const teamsWithIds: Omit<Team, 'name'>[] = teamGroupData.teams.map(team => ({
        ...team,
        id: uuidv4(), // Assign a unique ID to each team
    }));

    const newTeamGroupRef = doc(teamGroupsRef);
    const dataToSave = {
        ...teamGroupData,
        teams: teamsWithIds,
        id: newTeamGroupRef.id,
        createdAt: serverTimestamp(),
    };

    await setDoc(newTeamGroupRef, dataToSave).catch(e => {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: newTeamGroupRef.path,
                operation: 'create',
                requestResourceData: dataToSave
            }));
        }
        throw e;
    });
};

export const getTeamGroups = async (school: string): Promise<TeamGroup[]> => {
  await signIn();
  const teamGroupsRef = collection(db, 'schools', school, 'teamGroups');
  const q = query(teamGroupsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q).catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: teamGroupsRef.path,
        operation: 'list'
      }));
    }
    throw e;
  });
  return snapshot.docs.map(doc => doc.data() as TeamGroup);
};

export const deleteTeamGroup = async (school: string, teamGroupId: string): Promise<void> => {
  await signIn();
  const teamGroupDocRef = doc(db, 'schools', school, 'teamGroups', teamGroupId);
  await deleteDoc(teamGroupDocRef).catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: teamGroupDocRef.path,
        operation: 'delete'
      }));
    }
    throw e;
  });
};


export const getLatestTeamGroupForStudent = async (school: string, studentId: string): Promise<TeamGroup | null> => {
  await signIn();
  try {
    const teamGroupsRef = collection(db, 'schools', school, 'teamGroups');
    const q = query(teamGroupsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    for (const doc of snapshot.docs) {
      const group = doc.data() as TeamGroup;
      for (const team of group.teams) {
        if (team.memberIds && team.memberIds.includes(studentId)) {
          return group;
        }
      }
    }
    return null;
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `schools/${school}/teamGroups`,
        operation: 'list',
        requestResourceData: { query: `latest team group for student ${studentId}` }
      }));
    }
    throw e; // Re-throw other errors
  }
};

// --- Tournament Functions ---
export const saveTournament = async (tournament: Omit<Tournament, 'id' | 'createdAt'>): Promise<Tournament> => {
  await signIn();
  const tournamentsRef = collection(db, 'schools', tournament.school, 'tournaments');
  const newDocRef = doc(tournamentsRef);
  const dataToSave: any = {
    ...tournament,
    id: newDocRef.id,
    createdAt: serverTimestamp(),
  };

  // Ensure optional fields are not saved as undefined
  if (tournament.teamGroupId === undefined) delete dataToSave.teamGroupId;
  if (tournament.grade === undefined) delete dataToSave.grade;
  if (tournament.gender === undefined) delete dataToSave.gender;


  await setDoc(newDocRef, dataToSave).catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: newDocRef.path,
        operation: 'create',
        requestResourceData: dataToSave
      }));
    }
    throw e;
  });
  
  // Firestore server timestamp is not available on the client immediately.
  // We return the client-side version with a placeholder date, which is sufficient for immediate UI updates.
  const savedData = (await getDoc(newDocRef)).data();
  return savedData as Tournament;
};

export const getTournaments = async (school: string): Promise<Tournament[]> => {
  await signIn();
  const tournamentsRef = collection(db, 'schools', school, 'tournaments');
  const q = query(tournamentsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q).catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: tournamentsRef.path,
        operation: 'list'
      }));
    }
    throw e;
  });
  return snapshot.docs.map(doc => doc.data() as Tournament);
};

export const getLatestTournamentForStudent = async (school: string, studentId: string, allStudents: Student[], allTeamGroups: TeamGroup[]): Promise<Tournament | null> => {
  await signIn();
  const student = allStudents.find(s => s.id === studentId);
  if (!student) return null;

  try {
    const tournamentsRef = collection(db, 'schools', school, 'tournaments');
    const allTournaments = (await getDocs(tournamentsRef)).docs.map(d => d.data() as Tournament);
    allTournaments.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    // 1. Find tournament based on team group ID
    const studentTeamGroup = allTeamGroups.find(group =>
      group.teams.some(team => team.memberIds.includes(studentId))
    );
    
    if (studentTeamGroup) {
        const groupTournament = allTournaments.find(t => t.teamGroupId === studentTeamGroup.id);
        if (groupTournament) return groupTournament;
    }

    // 2. If no group-based tournament, find based on grade and gender
    const manualTournaments = allTournaments.filter(t => t.grade === student.grade);
    const matchingTournament = manualTournaments.find(t => t.gender === 'all' || t.gender === student.gender);
    if(matchingTournament) return matchingTournament;
    
    return null;
  } catch(e: any) {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `schools/${school}/tournaments`,
        operation: 'list',
        requestResourceData: { query: `latest manual tournament for student ${studentId}` }
      }));
    }
    throw e;
  }
};


export const updateTournament = async (school: string, tournamentId: string, data: Partial<Omit<Tournament, 'id' | 'school'>>): Promise<void> => {
  await signIn();
  const tournamentRef = doc(db, 'schools', school, 'tournaments', tournamentId);
  
  const dataToUpdate: {[key: string]: any} = { ...data };
  // Ensure optional fields are not set to undefined
  if (data.teamGroupId === undefined) delete dataToUpdate.teamGroupId;
  if (data.grade === undefined) delete dataToUpdate.grade;
  if (data.gender === undefined) delete dataToUpdate.gender;

  await updateDoc(tournamentRef, dataToUpdate).catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: tournamentRef.path,
        operation: 'update',
        requestResourceData: dataToUpdate
      }));
    }
    throw e;
  });
};

export const deleteTournament = async (school: string, tournamentId: string): Promise<void> => {
  await signIn();
  const tournamentRef = doc(db, 'schools', school, 'tournaments', tournamentId);
  await deleteDoc(tournamentRef).catch(e => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: tournamentRef.path,
        operation: 'delete'
      }));
    }
    throw e;
  });
};
