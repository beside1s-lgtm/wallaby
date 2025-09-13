
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
      male: [ { grade: 1, min: 77, max: Infinity }, { grade: 2, min: 57, max: 76 }, { grade: 3, min: 40, max: 56 }, { grade: 4, min: 21, max: 39 }, { grade: 5, min: -Infinity, max: 20 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 43, max: 59 }, { grade: 3, min: 29, max: 42 }, { grade: 4, min: 16, max: 28 }, { grade: 5, min: -Infinity, max: 15 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 48, max: Infinity }, { grade: 2, min: 36, max: 47 }, { grade: 3, min: 22, max: 35 }, { grade: 4, min: 10, max: 21 }, { grade: 5, min: -Infinity, max: 9 } ],
      female: [ { grade: 1, min: 43, max: Infinity }, { grade: 2, min: 32, max: 42 }, { grade: 3, min: 20, max: 31 }, { grade: 4, min: 7, max: 19 }, { grade: 5, min: -Infinity, max: 6 } ],
      type: 'count', unit: '회' 
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 17, max: Infinity }, { grade: 2, min: 13, max: 16.9 }, { grade: 3, min: 9, max: 12.9 }, { grade: 4, min: 5, max: 8.9 }, { grade: 5, min: -Infinity, max: 4.9 } ],
      female: [ { grade: 1, min: 19, max: Infinity }, { grade: 2, min: 16, max: 18.9 }, { grade: 3, min: 13, max: 15.9 }, { grade: 4, min: 9, max: 12.9 }, { grade: 5, min: -Infinity, max: 8.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: -Infinity, max: 8.4 }, { grade: 2, min: 8.5, max: 9.1 }, { grade: 3, min: 9.2, max: 9.9 }, { grade: 4, min: 10.0, max: 10.6 }, { grade: 5, min: 10.7, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 9.0 }, { grade: 2, min: 9.1, max: 9.8 }, { grade: 3, min: 9.9, max: 10.6 }, { grade: 4, min: 10.7, max: 11.3 }, { grade: 5, min: 11.4, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 155, max: 169 }, { grade: 3, min: 140, max: 154 }, { grade: 4, min: 125, max: 139 }, { grade: 5, min: -Infinity, max: 124 } ],
      female: [ { grade: 1, min: 160, max: Infinity }, { grade: 2, min: 145, max: 159 }, { grade: 3, min: 130, max: 144 }, { grade: 4, min: 115, max: 129 }, { grade: 5, min: -Infinity, max: 114 } ],
      type: 'distance', unit: 'cm'
    },
  },
  '5': {
    '왕복오래달리기': { 
        male: [ { grade: 1, min: 85, max: Infinity }, { grade: 2, min: 63, max: 84 }, { grade: 3, min: 45, max: 62 }, { grade: 4, min: 23, max: 44 }, { grade: 5, min: -Infinity, max: 22 } ],
        female: [ { grade: 1, min: 63, max: Infinity }, { grade: 2, min: 45, max: 62 }, { grade: 3, min: 30, max: 44 }, { grade: 4, min: 18, max: 29 }, { grade: 5, min: -Infinity, max: 17 } ],
        type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 53, max: Infinity }, { grade: 2, min: 41, max: 52 }, { grade: 3, min: 26, max: 40 }, { grade: 4, min: 13, max: 25 }, { grade: 5, min: -Infinity, max: 12 } ],
      female: [ { grade: 1, min: 47, max: Infinity }, { grade: 2, min: 36, max: 46 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 9, max: 22 }, { grade: 5, min: -Infinity, max: 8 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 18, max: Infinity }, { grade: 2, min: 14, max: 17.9 }, { grade: 3, min: 10, max: 13.9 }, { grade: 4, min: 6, max: 9.9 }, { grade: 5, min: -Infinity, max: 5.9 } ],
      female: [ { grade: 1, min: 20, max: Infinity }, { grade: 2, min: 17, max: 19.9 }, { grade: 3, min: 14, max: 16.9 }, { grade: 4, min: 10, max: 13.9 }, { grade: 5, min: -Infinity, max: 9.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: -Infinity, max: 8.1 }, { grade: 2, min: 8.2, max: 8.8 }, { grade: 3, min: 8.9, max: 9.6 }, { grade: 4, min: 9.7, max: 10.3 }, { grade: 5, min: 10.4, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 8.7 }, { grade: 2, min: 8.8, max: 9.5 }, { grade: 3, min: 9.6, max: 10.3 }, { grade: 4, min: 10.4, max: 11.0 }, { grade: 5, min: 11.1, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 165, max: 179 }, { grade: 3, min: 150, max: 164 }, { grade: 4, min: 135, max: 149 }, { grade: 5, min: -Infinity, max: 134 } ],
      female: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 155, max: 169 }, { grade: 3, min: 140, max: 154 }, { grade: 4, min: 125, max: 139 }, { grade: 5, min: -Infinity, max: 124 } ],
      type: 'distance', unit: 'cm'
    },
  },
  '6': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 93, max: Infinity }, { grade: 2, min: 69, max: 92 }, { grade: 3, min: 50, max: 68 }, { grade: 4, min: 25, max: 49 }, { grade: 5, min: -Infinity, max: 24 } ],
      female: [ { grade: 1, min: 70, max: Infinity }, { grade: 2, min: 51, max: 69 }, { grade: 3, min: 36, max: 50 }, { grade: 4, min: 20, max: 35 }, { grade: 5, min: -Infinity, max: 19 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: Infinity }, { grade: 2, min: 48, max: 79 }, { grade: 3, min: 28, max: 47 }, { grade: 4, min: 16, max: 27 }, { grade: 5, min: -Infinity, max: 15 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 43, max: 59 }, { grade: 3, min: 27, max: 42 }, { grade: 4, min: 12, max: 26 }, { grade: 5, min: -Infinity, max: 11 } ],
      type: 'count', unit: '회' 
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 19, max: Infinity }, { grade: 2, min: 15, max: 18.9 }, { grade: 3, min: 11, max: 14.9 }, { grade: 4, min: 7, max: 10.9 }, { grade: 5, min: -Infinity, max: 6.9 } ],
      female: [ { grade: 1, min: 21, max: Infinity }, { grade: 2, min: 18, max: 20.9 }, { grade: 3, min: 15, max: 17.9 }, { grade: 4, min: 11, max: 14.9 }, { grade: 5, min: -Infinity, max: 10.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: -Infinity, max: 7.8 }, { grade: 2, min: 7.9, max: 8.5 }, { grade: 3, min: 8.6, max: 9.3 }, { grade: 4, min: 9.4, max: 10.0 }, { grade: 5, min: 10.1, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 8.4 }, { grade: 2, min: 8.5, max: 9.2 }, { grade: 3, min: 9.3, max: 10.0 }, { grade: 4, min: 10.1, max: 10.7 }, { grade: 5, min: 10.8, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 190, max: Infinity }, { grade: 2, min: 175, max: 189 }, { grade: 3, min: 160, max: 174 }, { grade: 4, min: 145, max: 159 }, { grade: 5, min: -Infinity, max: 144 } ],
      female: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 165, max: 179 }, { grade: 3, min: 150, max: 164 }, { grade: 4, min: 135, max: 149 }, { grade: 5, min: -Infinity, max: 134 } ],
      type: 'distance', unit: 'cm'
    },
  },
  // --- 중학교 (7,8,9) ---
  '7': { // 중1
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 35, max: Infinity }, { grade: 2, min: 25, max: 34 }, { grade: 3, min: 19, max: 24 }, { grade: 4, min: 14, max: 18 }, { grade: 5, min: -Infinity, max: 13 } ],
      female: [ { grade: 1, min: 24, max: Infinity }, { grade: 2, min: 18, max: 23 }, { grade: 3, min: 14, max: 17 }, { grade: 4, min: 10, max: 13 }, { grade: 5, min: -Infinity, max: 9 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 55, max: Infinity }, { grade: 2, min: 44, max: 54 }, { grade: 3, min: 33, max: 43 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: -Infinity, max: 13 } ],
      female: [ { grade: 1, min: 46, max: Infinity }, { grade: 2, min: 36, max: 45 }, { grade: 3, min: 25, max: 35 }, { grade: 4, min: 10, max: 24 }, { grade: 5, min: -Infinity, max: 9 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': { 
      male: [ { grade: 1, min: 35, max: Infinity }, { grade: 2, min: 27, max: 34 }, { grade: 3, min: 19, max: 26 }, { grade: 4, min: 6, max: 18 }, { grade: 5, min: -Infinity, max: 5 } ],
      female: [ { grade: 1, min: 20, max: Infinity }, { grade: 2, min: 15, max: 19 }, { grade: 3, min: 10, max: 14 }, { grade: 4, min: 3, max: 9 }, { grade: 5, min: -Infinity, max: 2 } ],
      type: 'count', unit: '회'
    },
  },
  '8': { // 중2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 40, max: Infinity }, { grade: 2, min: 29, max: 39 }, { grade: 3, min: 21, max: 28 }, { grade: 4, min: 15, max: 20 }, { grade: 5, min: -Infinity, max: 14 } ],
      female: [ { grade: 1, min: 26, max: Infinity }, { grade: 2, min: 20, max: 25 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 11, max: 14 }, { grade: 5, min: -Infinity, max: 10 } ],
      type: 'count', unit: '회' 
    },
     '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 57, max: Infinity }, { grade: 2, min: 46, max: 56 }, { grade: 3, min: 35, max: 45 }, { grade: 4, min: 16, max: 34 }, { grade: 5, min: -Infinity, max: 15 } ],
      female: [ { grade: 1, min: 48, max: Infinity }, { grade: 2, min: 38, max: 47 }, { grade: 3, min: 27, max: 37 }, { grade: 4, min: 12, max: 26 }, { grade: 5, min: -Infinity, max: 11 } ],
      type: 'count', unit: '회' 
    },
     '팔굽혀펴기': {
      male: [ { grade: 1, min: 40, max: Infinity }, { grade: 2, min: 31, max: 39 }, { grade: 3, min: 22, max: 30 }, { grade: 4, min: 8, max: 21 }, { grade: 5, min: -Infinity, max: 7 } ],
      female: [ { grade: 1, min: 22, max: Infinity }, { grade: 2, min: 17, max: 21 }, { grade: 3, min: 12, max: 16 }, { grade: 4, min: 4, max: 11 }, { grade: 5, min: -Infinity, max: 3 } ],
      type: 'count', unit: '회'
    },
  },
  '9': { // 중3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 45, max: Infinity }, { grade: 2, min: 33, max: 44 }, { grade: 3, min: 23, max: 32 }, { grade: 4, min: 16, max: 22 }, { grade: 5, min: -Infinity, max: 15 } ],
      female: [ { grade: 1, min: 28, max: Infinity }, { grade: 2, min: 22, max: 27 }, { grade: 3, min: 16, max: 21 }, { grade: 4, min: 12, max: 15 }, { grade: 5, min: -Infinity, max: 11 } ],
      type: 'count', unit: '회' 
    },
     '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 59, max: Infinity }, { grade: 2, min: 48, max: 58 }, { grade: 3, min: 37, max: 47 }, { grade: 4, min: 18, max: 36 }, { grade: 5, min: -Infinity, max: 17 } ],
      female: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 40, max: 49 }, { grade: 3, min: 29, max: 39 }, { grade: 4, min: 14, max: 28 }, { grade: 5, min: -Infinity, max: 13 } ],
      type: 'count', unit: '회' 
    },
     '팔굽혀펴기': {
      male: [ { grade: 1, min: 45, max: Infinity }, { grade: 2, min: 35, max: 44 }, { grade: 3, min: 25, max: 34 }, { grade: 4, min: 10, max: 24 }, { grade: 5, min: -Infinity, max: 9 } ],
      female: [ { grade: 1, min: 24, max: Infinity }, { grade: 2, min: 19, max: 23 }, { grade: 3, min: 14, max: 18 }, { grade: 4, min: 5, max: 13 }, { grade: 5, min: -Infinity, max: 4 } ],
      type: 'count', unit: '회'
    },
  },
  // --- 고등학교 (10,11,12) ---
  '10': { // 고1
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 37, max: 49 }, { grade: 3, min: 25, max: 36 }, { grade: 4, min: 17, max: 24 }, { grade: 5, min: -Infinity, max: 16 } ],
      female: [ { grade: 1, min: 30, max: Infinity }, { grade: 2, min: 24, max: 29 }, { grade: 3, min: 18, max: 23 }, { grade: 4, min: 13, max: 17 }, { grade: 5, min: -Infinity, max: 12 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 49, max: 59 }, { grade: 3, min: 38, max: 48 }, { grade: 4, min: 19, max: 37 }, { grade: 5, min: -Infinity, max: 18 } ],
      female: [ { grade: 1, min: 51, max: Infinity }, { grade: 2, min: 41, max: 50 }, { grade: 3, min: 30, max: 40 }, { grade: 4, min: 15, max: 29 }, { grade: 5, min: -Infinity, max: 14 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 46, max: Infinity }, { grade: 2, min: 36, max: 45 }, { grade: 3, min: 26, max: 35 }, { grade: 4, min: 11, max: 25 }, { grade: 5, min: -Infinity, max: 10 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 6, max: 14 }, { grade: 5, min: -Infinity, max: 5 } ],
      type: 'count', unit: '회'
    },
  },
  '11': { // 고2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 55, max: Infinity }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: -Infinity, max: 17 } ],
      female: [ { grade: 1, min: 32, max: Infinity }, { grade: 2, min: 26, max: 31 }, { grade: 3, min: 20, max: 25 }, { grade: 4, min: 14, max: 19 }, { grade: 5, min: -Infinity, max: 13 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 61, max: Infinity }, { grade: 2, min: 50, max: 60 }, { grade: 3, min: 39, max: 49 }, { grade: 4, min: 20, max: 38 }, { grade: 5, min: -Infinity, max: 19 } ],
      female: [ { grade: 1, min: 52, max: Infinity }, { grade: 2, min: 42, max: 51 }, { grade: 3, min: 31, max: 41 }, { grade: 4, min: 16, max: 30 }, { grade: 5, min: -Infinity, max: 15 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 47, max: Infinity }, { grade: 2, min: 37, max: 46 }, { grade: 3, min: 27, max: 36 }, { grade: 4, min: 12, max: 26 }, { grade: 5, min: -Infinity, max: 11 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 6, max: 14 }, { grade: 5, min: -Infinity, max: 5 } ],
      type: 'count', unit: '회'
    },
  },
  '12': { // 고3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 55, max: Infinity }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: -Infinity, max: 17 } ],
      female: [ { grade: 1, min: 32, max: Infinity }, { grade: 2, min: 26, max: 31 }, { grade: 3, min: 20, max: 25 }, { grade: 4, min: 14, max: 19 }, { grade: 5, min: -Infinity, max: 13 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 61, max: Infinity }, { grade: 2, min: 50, max: 60 }, { grade: 3, min: 39, max: 49 }, { grade: 4, min: 20, max: 38 }, { grade: 5, min: -Infinity, max: 19 } ],
      female: [ { grade: 1, min: 52, max: Infinity }, { grade: 2, min: 42, max: 51 }, { grade: 3, min: 31, max: 41 }, { grade: 4, min: 16, max: 30 }, { grade: 5, min: -Infinity, max: 15 } ],
      type: 'count', unit: '회' 
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 47, max: Infinity }, { grade: 2, min: 37, max: 46 }, { grade: 3, min: 27, max: 36 }, { grade: 4, min: 12, max: 26 }, { grade: 5, min: -Infinity, max: 11 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 6, max: 14 }, { grade: 5, min: -Infinity, max: 5 } ],
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
  if (!gradeStandard) {
    // Fallback for grades not in the detailed map like 1,2,3
    if (parseInt(gradeKey) < 4) {
        return getPapsGrade(item, {...student, grade: '4'}, value);
    }
     if (parseInt(gradeKey) > 12) {
        return getPapsGrade(item, {...student, grade: '12'}, value);
    }
    return null;
  }

  let standard = gradeStandard[item];
  // '무릎 대고 팔굽혀펴기'를 '팔굽혀펴기' 기준으로 처리
  if (item === '무릎 대고 팔굽혀펴기' && !standard) {
    standard = gradeStandard['팔굽혀펴기'];
  }

  if (!standard) return null; // 해당 종목 기준 없음

  const thresholds = student.gender === '남' ? standard.male : standard.female;
  if (!thresholds || thresholds.length === 0) return null;

  for (const range of thresholds) {
    const isTimeRecord = standard.type === 'time';
    
    // For time records, lower is better. The range is [min, max].
    if (isTimeRecord) {
      if (value >= range.min && value <= range.max) {
        return range.grade;
      }
    } 
    // For other records, higher is better. The range is [min, max].
    else {
      if (value >= range.min && value <= range.max) {
        return range.grade;
      }
    }
  }

  // Handle values outside of defined ranges (for 1st and 5th grades with Infinity)
  if (standard.type === 'time') {
      const bestGrade = thresholds.find(t => t.grade === 1);
      if (bestGrade && value <= bestGrade.max) return 1;
      
      const worstGrade = thresholds.find(t => t.grade === 5);
      if (worstGrade && value >= worstGrade.min) return 5;

  } else {
      const bestGrade = thresholds.find(t => t.grade === 1);
      if (bestGrade && value >= bestGrade.min) return 1;

      const worstGrade = thresholds.find(t => t.grade === 5);
      if (worstGrade && value <= worstGrade.max) return 5;
  }

  return 5; // Default to 5th grade if no range matches
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

