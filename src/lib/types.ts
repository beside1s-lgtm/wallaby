export type Student = {
  id: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
};

export type MeasurementItem = string;

export type MeasurementRecord = {
  id: string;
  studentId: string;
  item: MeasurementItem;
  value: number;
  date: string; // YYYY-MM-DD
};

export type StudentLogin = Omit<Student, 'id'>;
