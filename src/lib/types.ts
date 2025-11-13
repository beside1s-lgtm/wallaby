export type Student = {
  id: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
  gender: '남' | '여';
  accessCode: string; // 5-digit unique access code
  photoUrl?: string; // 학생 사진 URL (선택 사항)
};

export type StudentToAdd = Omit<Student, 'id' | 'accessCode' | 'photoUrl'>;
export type StudentToUpdate = Omit<Student, 'id' | 'accessCode' | 'school'>;

export type RecordType = 'time' | 'count' | 'distance' | 'weight' | 'level' | 'compound';

export type MeasurementItem = {
  id: string;
  name: string;
  unit: string;
  recordType: RecordType;
  goal?: number; // Optional goal for non-PAPS items
  isPaps: boolean;
  isCompound?: boolean; // For items like BMI that require multiple inputs
  category?: string; // Optional category for custom items
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

export type Team = {
  id: string;
  name: string;
  teamIndex: number;
  memberIds: string[];
  members?: Student[]; // Optional, populated on client
  // For league stats
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  points?: number;
};

export type TeamGroup = {
  id: string;
  school: string;
  description: string;
  teams: Team[];
  itemNamesForBalancing: string[]; // 능력치 기준 종목
  createdAt: any;
  // Metadata for reloading the state
  analysisScope: 'all' | 'grade' | 'class';
  grade?: string;
  classNum?: string;
  gender?: 'all' | '남' | '여';
  divideBy?: 'teams' | 'members' | 'single';
  numTeams?: number;
  membersPerTeam?: number;
};

export type TeamGroupInput = Omit<TeamGroup, 'id' | 'createdAt' | 'teams'> & {
  teams: Omit<Team, 'id' | 'name'>[];
};


// --- Tournament Types ---
export type Match = {
  id: string;
  round?: number; // For tournaments
  matchNumber: number; // For tournaments
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: 'scheduled' | 'completed' | 'bye';
  nextMatchId: string | null;
  nextMatchSlot: 'A' | 'B' | null;
};

export type Tournament = {
  id: string;
  school: string;
  name: string;
  type: 'tournament' | 'league';
  teamGroupId?: string;
  teams: Team[]; // 직접 팀 정보를 저장
  matches: Match[];
  createdAt: any;
  meetingsPerTeam?: number;
  // For manual audience targeting
  grade?: string;
  gender?: 'all' | '남' | '여';
};
