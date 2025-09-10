export type Student = {
  id: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
};

export type MeasurementItem = string;

export type RecordType = 'time' | 'count' | 'distance';

export type MeasurementRecord = {
  id: string;
  studentId: string;
  school: string;
  item: MeasurementItem;
  value: number;
  date: string; // YYYY-MM-DD
  recordType: RecordType;
};

export type StudentLogin = Omit<Student, 'id'>;
