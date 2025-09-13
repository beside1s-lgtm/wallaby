
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
      male: [ { grade: 1, min: 48, max: Infinity }, { grade: 2, min: 36, max: 47 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 12, max: 22 }, { grade: 5, min: -Infinity, max: 11 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 36, max: 59 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: -Infinity, max: 6 } ],
      type: 'count', unit: '회' 
    },
  },
  '5': {
    '왕복오래달리기': { 
        male: [ { grade: 1, min: 85, max: 104 }, { grade: 2, min: 63, max: 84 }, { grade: 3, min: 45, max: 62 }, { grade: 4, min: 23, max: 44 }, { grade: 5, min: 18, max: 22 } ],
        female: [ { grade: 1, min: 85, max: 104 }, { grade: 2, min: 63, max: 84 }, { grade: 3, min: 45, max: 62 }, { grade: 4, min: 23, max: 44 }, { grade: 5, min: 18, max: 22 } ],
        type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 39, max: 49 }, { grade: 3, min: 26, max: 38 }, { grade: 4, min: 14, max: 25 }, { grade: 5, min: -Infinity, max: 13 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 36, max: 59 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: -Infinity, max: 6 } ],
      type: 'count', unit: '회' 
    },
  },
  '6': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 93, max: 112 }, { grade: 2, min: 69, max: 92 }, { grade: 3, min: 50, max: 68 }, { grade: 4, min: 25, max: 49 }, { grade: 5, min: 20, max: 24 } ],
      female: [ { grade: 1, min: 93, max: 112 }, { grade: 2, min: 69, max: 92 }, { grade: 3, min: 50, max: 68 }, { grade: 4, min: 25, max: 49 }, { grade: 5, min: 20, max: 24 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 52, max: Infinity }, { grade: 2, min: 41, max: 51 }, { grade: 3, min: 29, max: 40 }, { grade: 4, min: 16, max: 28 }, { grade: 5, min: -Infinity, max: 15 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 43, max: 59 }, { grade: 3, min: 23, max: 42 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: -Infinity, max: 6 } ],
      type: 'count', unit: '회' 
    },
  },
  // --- 중학교 (7,8,9) ---
  '7': { // 중1
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 35, max: 70 }, { grade: 2, min: 25, max: 34 }, { grade: 3, min: 19, max: 24 }, { grade: 4, min: 14, max: 18 }, { grade: 5, min: 10, max: 13 } ],
      female: [ { grade: 1, min: 35, max: 70 }, { grade: 2, min: 25, max: 34 }, { grade: 3, min: 19, max: 24 }, { grade: 4, min: 14, max: 18 }, { grade: 5, min: 10, max: 13 } ],
      type: 'count', unit: '회' 
    },
  },
  '8': { // 중2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 40, max: 75 }, { grade: 2, min: 29, max: 39 }, { grade: 3, min: 21, max: 28 }, { grade: 4, min: 15, max: 20 }, { grade: 5, min: 10, max: 14 } ],
      female: [ { grade: 1, min: 40, max: 75 }, { grade: 2, min: 29, max: 39 }, { grade: 3, min: 21, max: 28 }, { grade: 4, min: 15, max: 20 }, { grade: 5, min: 10, max: 14 } ],
      type: 'count', unit: '회' 
    },
  },
  '9': { // 중3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 45, max: 80 }, { grade: 2, min: 33, max: 44 }, { grade: 3, min: 23, max: 32 }, { grade: 4, min: 16, max: 22 }, { grade: 5, min: 12, max: 15 } ],
      female: [ { grade: 1, min: 45, max: 80 }, { grade: 2, min: 33, max: 44 }, { grade: 3, min: 23, max: 32 }, { grade: 4, min: 16, max: 22 }, { grade: 5, min: 12, max: 15 } ],
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
  },
  '11': { // 고2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
      female: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
      type: 'count', unit: '회' 
    },
  },
  '12': { // 고3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
      female: [ { grade: 1, min: 55, max: 90 }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: 14, max: 17 } ],
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
    // 기록(value)이 min과 max 사이에 있는지 확인 (양 끝값 포함)
    if (value >= range.min && value <= range.max) {
      return range.grade;
    }
  }

  // 범위에 속하지 않을 경우, Infinity를 사용하는 극단값 처리
  // time 타입 (낮을수록 좋음)
  if (standard.type === 'time') {
    const minThreshold = thresholds.reduce((prev, curr) => (prev.min < curr.min ? prev : curr));
    if (value < minThreshold.min) return minThreshold.grade; // 가장 낮은 기준보다 좋으면 최고 등급
    
    const maxThreshold = thresholds.reduce((prev, curr) => (prev.max > curr.max ? prev : curr));
    if (value > maxThreshold.max) return maxThreshold.grade; // 가장 높은 기준보다 나쁘면 최저 등급
  } 
  // count/distance/weight 타입 (높을수록 좋음)
  else {
    const maxThreshold = thresholds.reduce((prev, curr) => (prev.max > curr.max ? prev : curr));
    if (value > maxThreshold.max) return maxThreshold.grade; // 가장 높은 기준보다 좋으면 최고 등급

    const minThreshold = thresholds.reduce((prev, curr) => (prev.min < curr.min ? prev : curr));
    if (value < minThreshold.min) return minThreshold.grade; // 가장 낮은 기준보다 나쁘면 최저 등급
  }

  return 5; // 등급을 찾지 못하면 5등급으로 처리
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
