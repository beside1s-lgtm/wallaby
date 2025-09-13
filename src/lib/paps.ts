
import type { MeasurementItem, Student } from './types';

// 초등학교 4~6학년 PAPS 기준표 (교육부 기준 기반)
// 5단계 구조: 학년 -> 종목 -> 성별 -> 등급별 기준 범위
const papsStandardsByGrade: Record<
  string, // 학년 (e.g., '4', '5', '6')
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
  '4': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 96, max: 103 }, { grade: 2, min: 69, max: 95 }, { grade: 3, min: 45, max: 68 }, { grade: 4, min: 26, max: 44 }, { grade: 5, min: 19, max: 25 } ],
      female: [ { grade: 1, min: 34, max: Infinity }, { grade: 2, min: 25, max: 33 }, { grade: 3, min: 16, max: 24 }, { grade: 4, min: 9, max: 15 }, { grade: 5, min: -Infinity, max: 8 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': { 
      male: [ { grade: 1, min: 13.0, max: Infinity }, { grade: 2, min: 8.5, max: 12.9 }, { grade: 3, min: 4.5, max: 8.4 }, { grade: 4, min: 0.5, max: 4.4 }, { grade: 5, min: -Infinity, max: 0.4 } ],
      female: [ { grade: 1, min: 15.2, max: Infinity }, { grade: 2, min: 11.5, max: 15.1 }, { grade: 3, min: 7.5, max: 11.4 }, { grade: 4, min: 3.5, max: 7.4 }, { grade: 5, min: -Infinity, max: 3.4 } ],
      type: 'distance', unit: 'cm' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 42, max: Infinity }, { grade: 2, min: 31, max: 41 }, { grade: 3, min: 18, max: 30 }, { grade: 4, min: 6, max: 17 }, { grade: 5, min: -Infinity, max: 5 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 36, max: 59 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: 0, max: 6 } ],
      type: 'count', unit: '회' 
    },
    '50m 달리기': { 
      male: [ { grade: 1, min: -Infinity, max: 8.9 }, { grade: 2, min: 9.0, max: 9.5 }, { grade: 3, min: 9.6, max: 10.1 }, { grade: 4, min: 10.2, max: 10.7 }, { grade: 5, min: 10.8, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 9.3 }, { grade: 2, min: 9.4, max: 9.9 }, { grade: 3, min: 10.0, max: 10.5 }, { grade: 4, min: 10.6, max: 11.1 }, { grade: 5, min: 11.2, max: Infinity } ],
      type: 'time', unit: '초' 
    },
    '제자리 멀리뛰기': { 
      male: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 160, max: 169 }, { grade: 3, min: 150, max: 159 }, { grade: 4, min: 135, max: 149 }, { grade: 5, min: -Infinity, max: 134 } ],
      female: [ { grade: 1, min: 165, max: Infinity }, { grade: 2, min: 155, max: 164 }, { grade: 3, min: 140, max: 154 }, { grade: 4, min: 125, max: 139 }, { grade: 5, min: -Infinity, max: 124 } ],
      type: 'distance', unit: 'cm' 
    },
  },
  '5': {
    '왕복오래달리기': { 
        male: [ { grade: 1, min: 100, max: 107 }, { grade: 2, min: 73, max: 99 }, { grade: 3, min: 50, max: 72 }, { grade: 4, min: 29, max: 49 }, { grade: 5, min: 22, max: 28 } ],
        female: [ { grade: 1, min: 38, max: Infinity }, { grade: 2, min: 29, max: 37 }, { grade: 3, min: 19, max: 28 }, { grade: 4, min: 11, max: 18 }, { grade: 5, min: -Infinity, max: 10 } ],
        type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': { 
      male: [ { grade: 1, min: 14.0, max: Infinity }, { grade: 2, min: 9.5, max: 13.9 }, { grade: 3, min: 5.0, max: 9.4 }, { grade: 4, min: 0.5, max: 4.9 }, { grade: 5, min: -Infinity, max: 0.4 } ],
      female: [ { grade: 1, min: 16.5, max: Infinity }, { grade: 2, min: 12.5, max: 16.4 }, { grade: 3, min: 8.5, max: 12.4 }, { grade: 4, min: 4.5, max: 8.4 }, { grade: 5, min: -Infinity, max: 4.4 } ],
      type: 'distance', unit: 'cm' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 46, max: Infinity }, { grade: 2, min: 35, max: 45 }, { grade: 3, min: 22, max: 34 }, { grade: 4, min: 9, max: 21 }, { grade: 5, min: -Infinity, max: 8 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 36, max: 59 }, { grade: 3, min: 23, max: 35 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: 0, max: 6 } ],
      type: 'count', unit: '회' 
    },
    '50m 달리기': { 
      male: [ { grade: 1, min: -Infinity, max: 8.4 }, { grade: 2, min: 8.5, max: 9.0 }, { grade: 3, min: 9.1, max: 9.6 }, { grade: 4, min: 9.7, max: 10.2 }, { grade: 5, min: 10.3, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 9.0 }, { grade: 2, min: 9.1, max: 9.6 }, { grade: 3, min: 9.7, max: 10.2 }, { grade: 4, min: 10.3, max: 10.8 }, { grade: 5, min: 10.9, max: Infinity } ],
      type: 'time', unit: '초' 
    },
    '제자리 멀리뛰기': { 
      male: [ { grade: 1, min: 185, max: Infinity }, { grade: 2, min: 170, max: 184 }, { grade: 3, min: 155, max: 169 }, { grade: 4, min: 140, max: 154 }, { grade: 5, min: -Infinity, max: 139 } ],
      female: [ { grade: 1, min: 175, max: Infinity }, { grade: 2, min: 160, max: 174 }, { grade: 3, min: 145, max: 159 }, { grade: 4, min: 130, max: 144 }, { grade: 5, min: -Infinity, max: 129 } ],
      type: 'distance', unit: 'cm' 
    },
  },
  '6': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 104, max: 112 }, { grade: 2, min: 78, max: 103 }, { grade: 3, min: 54, max: 77 }, { grade: 4, min: 32, max: 53 }, { grade: 5, min: 22, max: 31 } ],
      female: [ { grade: 1, min: 42, max: Infinity }, { grade: 2, min: 32, max: 41 }, { grade: 3, min: 22, max: 31 }, { grade: 4, min: 13, max: 21 }, { grade: 5, min: -Infinity, max: 12 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': { 
      male: [ { grade: 1, min: 15.0, max: Infinity }, { grade: 2, min: 10.0, max: 14.9 }, { grade: 3, min: 5.5, max: 9.9 }, { grade: 4, min: 1.0, max: 5.4 }, { grade: 5, min: -Infinity, max: 0.9 } ],
      female: [ { grade: 1, min: 17.8, max: Infinity }, { grade: 2, min: 14.0, max: 17.7 }, { grade: 3, min: 10.0, max: 13.9 }, { grade: 4, min: 6.0, max: 9.9 }, { grade: 5, min: -Infinity, max: 5.9 } ],
      type: 'distance', unit: 'cm' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 49, max: Infinity }, { grade: 2, min: 38, max: 48 }, { grade: 3, min: 25, max: 37 }, { grade: 4, min: 12, max: 24 }, { grade: 5, min: -Infinity, max: 11 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 43, max: 59 }, { grade: 3, min: 23, max: 42 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: 0, max: 6 } ],
      type: 'count', unit: '회' 
    },
    '50m 달리기': { 
      male: [ { grade: 1, min: -Infinity, max: 8.1 }, { grade: 2, min: 8.2, max: 8.7 }, { grade: 3, min: 8.8, max: 9.3 }, { grade: 4, min: 9.4, max: 9.9 }, { grade: 5, min: 10.0, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 8.7 }, { grade: 2, min: 8.8, max: 9.3 }, { grade: 3, min: 9.4, max: 9.9 }, { grade: 4, min: 10.0, max: 10.5 }, { grade: 5, min: 10.6, max: Infinity } ],
      type: 'time', unit: '초' 
    },
    '제자리 멀리뛰기': { 
      male: [ { grade: 1, min: 195, max: Infinity }, { grade: 2, min: 180, max: 194 }, { grade: 3, min: 165, max: 179 }, { grade: 4, min: 145, max: 164 }, { grade: 5, min: -Infinity, max: 144 } ],
      female: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 165, max: 179 }, { grade: 3, min: 150, max: 164 }, { grade: 4, min: 135, max: 149 }, { grade: 5, min: -Infinity, max: 134 } ],
      type: 'distance', unit: 'cm' 
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
// 기존에 있던 종목 중 새로운 기준표에 없는 종목 추가
papsStandards['오래달리기'] = { type: 'time', unit: '초' };
papsStandards['윗몸 일으키기'] = { type: 'count', unit: '회' };
papsStandards['팔굽혀펴기'] = { type: 'count', unit: '회' };
papsStandards['악력'] = { type: 'weight', unit: 'kg' };


export function getPapsGrade(item: string, student: Student, value: number): number | null {
  const gradeStandard = papsStandardsByGrade[student.grade];
  if (!gradeStandard) return null; // 해당 학년 기준 없음

  const standard = gradeStandard[item];
  if (!standard) return null; // 해당 종목 기준 없음

  const thresholds = student.gender === '남' ? standard.male : standard.female;
  if (!thresholds) return null;

  for (const range of thresholds) {
    if (value >= range.min && value <= range.max) {
      return range.grade;
    }
  }

  // Handle unbounded ranges for time-based records (lower is better) or count/distance (higher is better)
  if (standard.type === 'time') {
      const highestGradeRange = thresholds.find(r => r.max === Infinity);
      if (highestGradeRange && value >= highestGradeRange.min) {
          return highestGradeRange.grade;
      }
      const lowestGradeRange = thresholds.find(r => r.min === -Infinity);
      if (lowestGradeRange && value <= lowestGradeRange.max) {
          return lowestGradeRange.grade;
      }
  } else { // count, distance, weight
      const highestGradeRange = thresholds.find(r => r.max === Infinity);
      if (highestGradeRange && value >= highestGradeRange.min) {
          return highestGradeRange.grade;
      }
      const lowestGradeRange = thresholds.find(r => r.min === -Infinity);
      if (lowestGradeRange && value <= lowestGradeRange.max) {
          return lowestGradeRange.grade;
      }
  }


  return 5; // 등급을 찾지 못하면 5등급
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

    
