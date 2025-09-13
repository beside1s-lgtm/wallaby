
import type { MeasurementItem, Student } from './types';

// 초/중/고 PAPS 기준표 (교육부 기준 기반)
// 5단계 구조: 학년 -> 종목 -> 성별 -> 등급별 기준 범위
const papsStandardsByGrade: Record<
  string, // 학년 (e.g., '4', '5', '6', '7' for 중1, etc.)
  Record<
    string, // 종목명
    {
      male: { grade: number; min: number; max: number }[];
      female: { grade: number; min: number; max: number }[];
      type: 'time' | 'count' | 'distance' | 'weight';
      unit: string;
    }
  >
> = {
  // --- 초등학교 ---
  '4': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 77, max: 100 }, { grade: 2, min: 57, max: 76 }, { grade: 3, min: 40, max: 56 }, { grade: 4, min: 21, max: 39 }, { grade: 5, min: 16, max: 20 } ],
      female: [ { grade: 1, min: 77, max: 100 }, { grade: 2, min: 57, max: 76 }, { grade: 3, min: 40, max: 56 }, { grade: 4, min: 21, max: 39 }, { grade: 5, min: 16, max: 20 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: 120 }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 7, max: 21 }, { grade: 5, min: 0, max: 6 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 36, max: 59 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: -Infinity, max: 6 } ],
      type: 'count', unit: '회' 
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 17, max: Infinity }, { grade: 2, min: 13, max: 16.9 }, { grade: 3, min: 9, max: 12.9 }, { grade: 4, min: 5, max: 8.9 }, { grade: 5, min: -Infinity, max: 4.9 } ],
      female: [ { grade: 1, min: 19, max: Infinity }, { grade: 2, min: 16, max: 18.9 }, { grade: 3, min: 13, max: 15.9 }, { grade: 4, min: 9, max: 12.9 }, { grade: 5, min: -Infinity, max: 8.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 0, max: 8.4 }, { grade: 2, min: 8.5, max: 9.1 }, { grade: 3, min: 9.2, max: 9.9 }, { grade: 4, min: 10.0, max: 10.6 }, { grade: 5, min: 10.7, max: Infinity } ],
      female: [ { grade: 1, min: 0, max: 9.0 }, { grade: 2, min: 9.1, max: 9.8 }, { grade: 3, min: 9.9, max: 10.6 }, { grade: 4, min: 10.7, max: 11.3 }, { grade: 5, min: 11.4, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 155, max: 169 }, { grade: 3, min: 140, max: 154 }, { grade: 4, min: 125, max: 139 }, { grade: 5, min: 0, max: 124 } ],
      female: [ { grade: 1, min: 160, max: Infinity }, { grade: 2, min: 145, max: 159 }, { grade: 3, min: 130, max: 144 }, { grade: 4, min: 115, max: 129 }, { grade: 5, min: 0, max: 114 } ],
      type: 'distance', unit: 'cm'
    },
  },
  '5': {
    '왕복오래달리기': { 
        male: [ { grade: 1, min: 85, max: 104 }, { grade: 2, min: 63, max: 84 }, { grade: 3, min: 45, max: 62 }, { grade: 4, min: 23, max: 44 }, { grade: 5, min: 18, max: 22 } ],
        female: [ { grade: 1, min: 85, max: 104 }, { grade: 2, min: 63, max: 84 }, { grade: 3, min: 45, max: 62 }, { grade: 4, min: 23, max: 44 }, { grade: 5, min: 18, max: 22 } ],
        type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: 120 }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 10, max: 21 }, { grade: 5, min: 0, max: 9 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 36, max: 59 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: -Infinity, max: 6 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 18, max: Infinity }, { grade: 2, min: 14, max: 17.9 }, { grade: 3, min: 10, max: 13.9 }, { grade: 4, min: 6, max: 9.9 }, { grade: 5, min: -Infinity, max: 5.9 } ],
      female: [ { grade: 1, min: 20, max: Infinity }, { grade: 2, min: 17, max: 19.9 }, { grade: 3, min: 14, max: 16.9 }, { grade: 4, min: 10, max: 13.9 }, { grade: 5, min: -Infinity, max: 9.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 0, max: 8.1 }, { grade: 2, min: 8.2, max: 8.8 }, { grade: 3, min: 8.9, max: 9.6 }, { grade: 4, min: 9.7, max: 10.3 }, { grade: 5, min: 10.4, max: Infinity } ],
      female: [ { grade: 1, min: 0, max: 8.7 }, { grade: 2, min: 8.8, max: 9.5 }, { grade: 3, min: 9.6, max: 10.3 }, { grade: 4, min: 10.4, max: 11.0 }, { grade: 5, min: 11.1, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 165, max: 179 }, { grade: 3, min: 150, max: 164 }, { grade: 4, min: 135, max: 149 }, { grade: 5, min: 0, max: 134 } ],
      female: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 155, max: 169 }, { grade: 3, min: 140, max: 154 }, { grade: 4, min: 125, max: 139 }, { grade: 5, min: 0, max: 124 } ],
      type: 'distance', unit: 'cm'
    },
  },
  '6': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 93, max: 112 }, { grade: 2, min: 69, max: 92 }, { grade: 3, min: 50, max: 68 }, { grade: 4, min: 25, max: 49 }, { grade: 5, min: 20, max: 24 } ],
      female: [ { grade: 1, min: 93, max: 112 }, { grade: 2, min: 69, max: 92 }, { grade: 3, min: 50, max: 68 }, { grade: 4, min: 25, max: 49 }, { grade: 5, min: 20, max: 24 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: 120 }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 10, max: 21 }, { grade: 5, min: 0, max: 9 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 43, max: 59 }, { grade: 3, min: 23, max: 42 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: -Infinity, max: 6 } ],
      type: 'count', unit: '회' 
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 19, max: Infinity }, { grade: 2, min: 15, max: 18.9 }, { grade: 3, min: 11, max: 14.9 }, { grade: 4, min: 7, max: 10.9 }, { grade: 5, min: -Infinity, max: 6.9 } ],
      female: [ { grade: 1, min: 21, max: Infinity }, { grade: 2, min: 18, max: 20.9 }, { grade: 3, min: 15, max: 17.9 }, { grade: 4, min: 11, max: 14.9 }, { grade: 5, min: -Infinity, max: 10.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 0, max: 7.8 }, { grade: 2, min: 7.9, max: 8.5 }, { grade: 3, min: 8.6, max: 9.3 }, { grade: 4, min: 9.4, max: 10.0 }, { grade: 5, min: 10.1, max: Infinity } ],
      female: [ { grade: 1, min: 0, max: 8.4 }, { grade: 2, min: 8.5, max: 9.2 }, { grade: 3, min: 9.3, max: 10.0 }, { grade: 4, min: 10.1, max: 10.7 }, { grade: 5, min: 10.8, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 190, max: Infinity }, { grade: 2, min: 175, max: 189 }, { grade: 3, min: 160, max: 174 }, { grade: 4, min: 145, max: 159 }, { grade: 5, min: 0, max: 144 } ],
      female: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 165, max: 179 }, { grade: 3, min: 150, max: 164 }, { grade: 4, min: 135, max: 149 }, { grade: 5, min: 0, max: 134 } ],
      type: 'distance', unit: 'cm'
    },
  },
  // --- 중학교 (7,8,9) ---
  '7': { // 중1
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 35, max: 70 }, { grade: 2, min: 25, max: 34 }, { grade: 3, min: 19, max: 24 }, { grade: 4, min: 14, max: 18 }, { grade: 5, min: 10, max: 13 } ],
      female: [ { grade: 1, min: 35, max: 70 }, { grade: 2, min: 25, max: 34 }, { grade: 3, min: 19, max: 24 }, { grade: 4, min: 14, max: 18 }, { grade: 5, min: 10, max: 13 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 55, max: 89 }, { grade: 3, min: 33, max: 54 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: 5, max: 13 } ],
      female: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 55, max: 89 }, { grade: 3, min: 33, max: 54 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: 5, max: 13 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 40, max: Infinity }, { grade: 2, min: 30, max: 39 }, { grade: 3, min: 20, max: 29 }, { grade: 4, min: 10, max: 19 }, { grade: 5, min: 0, max: 9 } ],
      female: [ { grade: 1, min: 20, max: Infinity }, { grade: 2, min: 15, max: 19 }, { grade: 3, min: 10, max: 14 }, { grade: 4, min: 5, max: 9 }, { grade: 5, min: 0, max: 4 } ],
      type: 'count', unit: '회'
    },
  },
  '8': { // 중2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 40, max: 75 }, { grade: 2, min: 29, max: 39 }, { grade: 3, min: 21, max: 28 }, { grade: 4, min: 15, max: 20 }, { grade: 5, min: 10, max: 14 } ],
      female: [ { grade: 1, min: 40, max: 75 }, { grade: 2, min: 29, max: 39 }, { grade: 3, min: 21, max: 28 }, { grade: 4, min: 15, max: 20 }, { grade: 5, min: 10, max: 14 } ],
      type: 'count', unit: '회' 
    },
     '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 55, max: 89 }, { grade: 3, min: 33, max: 54 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: 5, max: 13 } ],
      female: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 55, max: 89 }, { grade: 3, min: 33, max: 54 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: 5, max: 13 } ],
      type: 'count', unit: '회' 
    },
     '팔굽혀펴기': {
      male: [ { grade: 1, min: 45, max: Infinity }, { grade: 2, min: 35, max: 44 }, { grade: 3, min: 25, max: 34 }, { grade: 4, min: 15, max: 24 }, { grade: 5, min: 0, max: 14 } ],
      female: [ { grade: 1, min: 22, max: Infinity }, { grade: 2, min: 17, max: 21 }, { grade: 3, min: 12, max: 16 }, { grade: 4, min: 7, max: 11 }, { grade: 5, min: 0, max: 6 } ],
      type: 'count', unit: '회'
    },
  },
  '9': { // 중3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 45, max: 80 }, { grade: 2, min: 33, max: 44 }, { grade: 3, min: 23, max: 32 }, { grade: 4, min: 16, max: 22 }, { grade: 5, min: 12, max: 15 } ],
      female: [ { grade: 1, min: 45, max: 80 }, { grade: 2, min: 33, max: 44 }, { grade: 3, min: 23, max: 32 }, { grade: 4, min: 16, max: 22 }, { grade: 5, min: 12, max: 15 } ],
      type: 'count', unit: '회' 
    },
     '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 55, max: 89 }, { grade: 3, min: 33, max: 54 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: 5, max: 13 } ],
      female: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 55, max: 89 }, { grade: 3, min: 33, max: 54 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: 5, max: 13 } ],
      type: 'count', unit: '회' 
    },
     '팔굽혀펴기': {
      male: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 40, max: 49 }, { grade: 3, min: 30, max: 39 }, { grade: 4, min: 20, max: 29 }, { grade: 5, min: 0, max: 19 } ],
      female: [ { grade: 1, min: 24, max: Infinity }, { grade: 2, min: 19, max: 23 }, { grade: 3, min: 14, max: 18 }, { grade: 4, min: 9, max: 13 }, { grade: 5, min: 0, max: 8 } ],
      type: 'count', unit: '회'
    },
  },
  // --- 고등학교 (10,11,12) ---
  '10': { // 고1
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 50, max: 85 }, { grade: 2, min: 37, max: 49 }, { grade: 3, min: 25, max: 36 }, { grade: 4, min: 17, max: 24 }, { grade: 5, min: 13, max: 16 } ],
      female: [ { grade: 1, min: 50, max: 85 }, { grade: 2, min: 37, max: 49 }, { grade: 3, min: 25, max: 36 }, { grade: 4, min: 17, max: 24 }, { grade: 5, min: 13, max: 16 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 60, max: 89 }, { grade: 3, min: 35, max: 59 }, { grade: 4, min: 15, max: 34 }, { grade: 5, min: 8, max: 14 } ],
      female: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 60, max: 89 }, { grade: 3, min: 35, max: 59 }, { grade: 4, min: 15, max: 34 }, { grade: 5, min: 8, max: 14 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 40, max: 49 }, { grade: 3, min: 30, max: 39 }, { grade: 4, min: 20, max: 29 }, { grade: 5, min: 0, max: 19 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 10, max: 14 }, { grade: 5, min: 0, max: 9 } ],
      type: 'count', unit: '회'
    },
  },
  '11': { // 고2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
      female: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 60, max: 89 }, { grade: 3, min: 35, max: 59 }, { grade: 4, min: 17, max: 34 }, { grade: 5, min: 10, max: 16 } ],
      female: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 60, max: 89 }, { grade: 3, min: 35, max: 59 }, { grade: 4, min: 17, max: 34 }, { grade: 5, min: 10, max: 16 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 40, max: 49 }, { grade: 3, min: 30, max: 39 }, { grade: 4, min: 20, max: 29 }, { grade: 5, min: 0, max: 19 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 10, max: 14 }, { grade: 5, min: 0, max: 9 } ],
      type: 'count', unit: '회'
    },
  },
  '12': { // 고3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
      female: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 60, max: 89 }, { grade: 3, min: 35, max: 59 }, { grade: 4, min: 17, max: 34 }, { grade: 5, min: 10, max: 16 } ],
      female: [ { grade: 1, min: 90, max: 130 }, { grade: 2, min: 60, max: 89 }, { grade: 3, min: 35, max: 59 }, { grade: 4, min: 17, max: 34 }, { grade: 5, min: 10, max: 16 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 40, max: 49 }, { grade: 3, min: 30, max: 39 }, { grade: 4, min: 20, max: 29 }, { grade: 5, min: 0, max: 19 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 10, max: 14 }, { grade: 5, min: 0, max: 9 } ],
      type: 'count', unit: '회'
    },
  },
};

// 모든 PAPS 종목 정보를 하나의 객체로 통합 (기존 코드 호환용)
export const papsStandards: Record<string, { type: 'time' | 'count' | 'distance' | 'weight', unit: string }> = {};
Object.values(papsStandardsByGrade).forEach(gradeData => {
    Object.entries(gradeData).forEach(([itemName, itemData]) => {
        if (!papsStandards[itemName]) {
            papsStandards[itemName] = { type: itemData.type, unit: itemData.unit };
        }
    });
});
// 기준표에 있는 종목들 추가
papsStandards['앉아윗몸앞으로굽히기'] = { type: 'distance', unit: 'cm' };
papsStandards['50m 달리기'] = { type: 'time', unit: '초' };
papsStandards['제자리 멀리뛰기'] = { type: 'distance', unit: 'cm' };
papsStandards['팔굽혀펴기'] = { type: 'count', unit: '회' };
papsStandards['악력'] = { type: 'weight', unit: 'kg' };

// 기존에 있던 종목 중 새로운 기준표에 없는 종목 추가 (레거시 호환)
papsStandards['오래달리기'] = { type: 'time', unit: '초' };
papsStandards['윗몸 일으키기'] = { type: 'count', unit: '회' };


export function getPapsGrade(item: string, student: Student, value: number): number | null {
  const gradeKey = student.grade;
  const gradeStandard = papsStandardsByGrade[gradeKey];
  if (!gradeStandard) return null; // 해당 학년 기준 없음

  const standard = gradeStandard[item];
  if (!standard) return null; // 해당 종목 기준 없음

  const thresholds = student.gender === '남' ? standard.male : standard.female;
  if (!thresholds || thresholds.length === 0) return null;

  for (const range of thresholds) {
    if (standard.type === 'time') {
      // 시간 기록: 낮을수록 좋음 (min과 max 사이, max 값은 포함하지 않음)
      if (value >= range.min && value < range.max) {
        return range.grade;
      }
    } else {
      // 횟수/거리 기록: 높을수록 좋음 (min과 max 사이, 양 끝값 포함)
      if (value >= range.min && value <= range.max) {
        return range.grade;
      }
    }
  }

  // 범위에 속하지 않을 경우, Infinity를 사용하는 극단값 처리
  // time 타입 (낮을수록 좋음)
  if (standard.type === 'time') {
    // 가장 낮은 기준(1등급)보다 기록이 좋으면 1등급
    const bestGrade = thresholds.reduce((prev, curr) => (prev.min < curr.min ? prev : curr));
    if (value < bestGrade.min) return bestGrade.grade;
    
    // 가장 높은 기준(5등급)보다 기록이 나쁘면 5등급
    const worstGrade = thresholds.reduce((prev, curr) => (prev.max > curr.max ? prev : curr));
    if (value >= worstGrade.max) return worstGrade.grade;
  } 
  // count/distance/weight 타입 (높을수록 좋음)
  else {
    // 가장 높은 기준(1등급)보다 기록이 좋으면 1등급
    const bestGrade = thresholds.reduce((prev, curr) => (prev.max > curr.max ? prev : curr));
     if (value > bestGrade.max) return bestGrade.grade;

    // 가장 낮은 기준(5등급)보다 기록이 나쁘면 5등급
    const worstGrade = thresholds.reduce((prev, curr) => (prev.min < curr.min ? prev : curr));
    if (value < worstGrade.min) return worstGrade.grade;
  }

  return 5; // 모든 경우에 해당하지 않으면 5등급으로 처리
}


export function getCustomItemGrade(item: MeasurementItem, value: number): number | null {
  if (item.isPaps || !item.goal || item.recordType === 'time') {
    return null;
  }

  const percentage = (value / item.goal) * 100;

  if (percentage >= 80) return 1;
  if (percentage >= 60) return 2;
  if (percentage >= 40) return 3;
  if (percentage >= 20) return 4;
  return 5;
}
