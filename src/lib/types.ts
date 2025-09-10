export type Student = {
  id: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
};

export type RecordType = 'time' | 'count' | 'distance';

export type MeasurementItem = {
  id: string;
  name: string;
  unit: string;
  recordType: RecordType;
};

export type MeasurementRecord = {
  id: string;
  studentId: string;
  school: string;
  item: string; // The name of the measurement item
  value: number;
  date: string; // YYYY-MM-DD
};

export type StudentLogin = Omit<Student, 'id'>;
