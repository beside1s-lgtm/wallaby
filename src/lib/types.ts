export type Student = {
  id: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
  gender: '남' | '여';
  accessCode: string; // 5-digit unique access code
};

export type StudentToAdd = Omit<Student, 'id' | 'accessCode'>;
export type StudentToUpdate = Omit<Student, 'id' | 'accessCode' | 'school'>;

export type RecordType = 'time' | 'count' | 'distance' | 'weight' | 'level';

export type MeasurementItem = {
  id: string;
  name: string;
  unit: string;
  recordType: RecordType;
  goal?: number; // Optional goal for non-PAPS items
  isPaps: boolean;
};

export type MeasurementRecord = {
  id: string;
  studentId: string;
  school: string;
  item: string; // The name of the measurement item
  value: number;
  date: string; // YYYY-MM-DD
};

export type StudentLogin = Omit<Student, 'id' | 'gender'>;

export type School = {
  id: string;
  name: string;
  password?: string;
  createdAt: any; // Can be a Date or a server timestamp
};
