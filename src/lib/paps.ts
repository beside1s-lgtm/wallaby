
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
      male: [ { grade: 1, min: 45, max: Infinity }, { grade: 2, min: 34, max: 45 }, { grade: 3, min: 23, max: 34 }, { grade: 4, min: 13, max: 23 }, { grade: 5, min: -Infinity, max: 13 } ],
      female: [ { grade: 1, min: 34, max: Infinity }, { grade: 2, min: 25, max: 34 }, { grade: 3, min: 16, max: 25 }, { grade: 4, min: 9, max: 16 }, { grade: 5, min: -Infinity, max: 9 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': { 
      male: [ { grade: 1, min: 13.0, max: Infinity }, { grade: 2, min: 8.5, max: 13.0 }, { grade: 3, min: 4.5, max: 8.5 }, { grade: 4, min: 0.5, max: 4.5 }, { grade: 5, min: -Infinity, max: 0.5 } ],
      female: [ { grade: 1, min: 15.2, max: Infinity }, { grade: 2, min: 11.5, max: 15.2 }, { grade: 3, min: 7.5, max: 11.5 }, { grade: 4, min: 3.5, max: 7.5 }, { grade: 5, min: -Infinity, max: 3.5 } ],
      type: 'distance', unit: 'cm' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 31, max: Infinity }, { grade: 2, min: 24, max: 31 }, { grade: 3, min: 16, max: 24 }, { grade: 4, min: 8, max: 16 }, { grade: 5, min: -Infinity, max: 8 } ],
      female: [ { grade: 1, min: 26, max: Infinity }, { grade: 2, min: 20, max: 26 }, { grade: 3, min: 14, max: 20 }, { grade: 4, min: 8, max: 14 }, { grade: 5, min: -Infinity, max: 8 } ],
      type: 'count', unit: '회' 
    },
    '50m 달리기': { 
      male: [ { grade: 1, min: -Infinity, max: 8.9 }, { grade: 2, min: 8.9, max: 9.5 }, { grade: 3, min: 9.5, max: 10.1 }, { grade: 4, min: 10.1, max: 10.7 }, { grade: 5, min: 10.7, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 9.3 }, { grade: 2, min: 9.3, max: 9.9 }, { grade: 3, min: 9.9, max: 10.5 }, { grade: 4, min: 10.5, max: 11.1 }, { grade: 5, min: 11.1, max: Infinity } ],
      type: 'time', unit: '초' 
    },
    '제자리 멀리뛰기': { 
      male: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 160, max: 170 }, { grade: 3, min: 150, max: 160 }, { grade: 4, min: 135, max: 150 }, { grade: 5, min: -Infinity, max: 135 } ],
      female: [ { grade: 1, min: 165, max: Infinity }, { grade: 2, min: 155, max: 165 }, { grade: 3, min: 140, max: 155 }, { grade: 4, min: 125, max: 140 }, { grade: 5, min: -Infinity, max: 125 } ],
      type: 'distance', unit: 'cm' 
    },
  },
  '5': {
    '왕복오래달리기': { 
        male: [ { grade: 1, min: 53, max: Infinity }, { grade: 2, min: 41, max: 53 }, { grade: 3, min: 28, max: 41 }, { grade: 4, min: 16, max: 28 }, { grade: 5, min: -Infinity, max: 16 } ],
        female: [ { grade: 1, min: 38, max: Infinity }, { grade: 2, min: 29, max: 38 }, { grade: 3, min: 19, max: 29 }, { grade: 4, min: 11, max: 19 }, { grade: 5, min: -Infinity, max: 11 } ],
        type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': { 
      male: [ { grade: 1, min: 14.0, max: Infinity }, { grade: 2, min: 9.5, max: 14.0 }, { grade: 3, min: 5.0, max: 9.5 }, { grade: 4, min: 0.5, max: 5.0 }, { grade: 5, min: -Infinity, max: 0.5 } ],
      female: [ { grade: 1, min: 16.5, max: Infinity }, { grade: 2, min: 12.5, max: 16.5 }, { grade: 3, min: 8.5, max: 12.5 }, { grade: 4, min: 4.5, max: 8.5 }, { grade: 5, min: -Infinity, max: 4.5 } ],
      type: 'distance', unit: 'cm' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 35, max: Infinity }, { grade: 2, min: 27, max: 35 }, { grade: 3, min: 19, max: 27 }, { grade: 4, min: 11, max: 19 }, { grade: 5, min: -Infinity, max: 11 } ],
      female: [ { grade: 1, min: 31, max: Infinity }, { grade: 2, min: 25, max: 31 }, { grade: 3, min: 18, max: 25 }, { grade: 4, min: 11, max: 18 }, { grade: 5, min: -Infinity, max: 11 } ],
      type: 'count', unit: '회' 
    },
    '50m 달리기': { 
      male: [ { grade: 1, min: -Infinity, max: 8.4 }, { grade: 2, min: 8.4, max: 9.0 }, { grade: 3, min: 9.0, max: 9.6 }, { grade: 4, min: 9.6, max: 10.2 }, { grade: 5, min: 10.2, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 9.0 }, { grade: 2, min: 9.0, max: 9.6 }, { grade: 3, min: 9.6, max: 10.2 }, { grade: 4, min: 10.2, max: 10.8 }, { grade: 5, min: 10.8, max: Infinity } ],
      type: 'time', unit: '초' 
    },
    '제자리 멀리뛰기': { 
      male: [ { grade: 1, min: 185, max: Infinity }, { grade: 2, min: 170, max: 185 }, { grade: 3, min: 155, max: 170 }, { grade: 4, min: 140, max: 155 }, { grade: 5, min: -Infinity, max: 140 } ],
      female: [ { grade: 1, min: 175, max: Infinity }, { grade: 2, min: 160, max: 175 }, { grade: 3, min: 145, max: 160 }, { grade: 4, min: 130, max: 145 }, { grade: 5, min: -Infinity, max: 130 } ],
      type: 'distance', unit: 'cm' 
    },
  },
  '6': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 47, max: 60 }, { grade: 3, min: 34, max: 47 }, { grade: 4, min: 20, max: 34 }, { grade: 5, min: -Infinity, max: 20 } ],
      female: [ { grade: 1, min: 42, max: Infinity }, { grade: 2, min: 32, max: 42 }, { grade: 3, min: 22, max: 32 }, { grade: 4, min: 13, max: 22 }, { grade: 5, min: -Infinity, max: 13 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': { 
      male: [ { grade: 1, min: 15.0, max: Infinity }, { grade: 2, min: 10.0, max: 15.0 }, { grade: 3, min: 5.5, max: 10.0 }, { grade: 4, min: 1.0, max: 5.5 }, { grade: 5, min: -Infinity, max: 1.0 } ],
      female: [ { grade: 1, min: 17.8, max: Infinity }, { grade: 2, min: 14.0, max: 17.8 }, { grade: 3, min: 10.0, max: 14.0 }, { grade: 4, min: 6.0, max: 10.0 }, { grade: 5, min: -Infinity, max: 6.0 } ],
      type: 'distance', unit: 'cm' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 40, max: Infinity }, { grade: 2, min: 31, max: 40 }, { grade: 3, min: 22, max: 31 }, { grade: 4, min: 13, max: 22 }, { grade: 5, min: -Infinity, max: 13 } ],
      female: [ { grade: 1, min: 34, max: Infinity }, { grade: 2, min: 27, max: 34 }, { grade: 3, min: 19, max: 27 }, { grade: 4, min: 12, max: 19 }, { grade: 5, min: -Infinity, max: 12 } ],
      type: 'count', unit: '회' 
    },
    '50m 달리기': { 
      male: [ { grade: 1, min: -Infinity, max: 8.1 }, { grade: 2, min: 8.1, max: 8.7 }, { grade: 3, min: 8.7, max: 9.3 }, { grade: 4, min: 9.3, max: 9.9 }, { grade: 5, min: 9.9, max: Infinity } ],
      female: [ { grade: 1, min: -Infinity, max: 8.7 }, { grade: 2, min: 8.7, max: 9.3 }, { grade: 3, min: 9.3, max: 9.9 }, { grade: 4, min: 9.9, max: 10.5 }, { grade: 5, min: 10.5, max: Infinity } ],
      type: 'time', unit: '초' 
    },
    '제자리 멀리뛰기': { 
      male: [ { grade: 1, min: 195, max: Infinity }, { grade: 2, min: 180, max: 195 }, { grade: 3, min: 165, max: 180 }, { grade: 4, min: 145, max: 165 }, { grade: 5, min: -Infinity, max: 145 } ],
      female: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 165, max: 180 }, { grade: 3, min: 150, max: 165 }, { grade: 4, min: 135, max: 150 }, { grade: 5, min: -Infinity, max: 135 } ],
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

  const type = standard.type;

  for (const range of thresholds) {
    if (type === 'time') { // 낮을수록 좋음 (min 이상, max 미만)
      if (value >= range.min && value < range.max) {
        return range.grade;
      }
    } else { // 높을수록 좋음 (min 이상, max 미만)
      if (value >= range.min && value < range.max) {
        return range.grade;
      }
    }
  }

  // 예외 처리: 만약 루프를 다 돌아도 등급이 없으면 5등급으로 처리 (특히 Infinity 값 처리)
  if (type === 'time') {
    // 가장 높은 시간값(가장 나쁜 기록)을 가진 등급
    const worstGrade = thresholds.find(t => t.max === Infinity);
    if(worstGrade && value >= worstGrade.min) return worstGrade.grade;
  } else {
    // 가장 높은 값(가장 좋은 기록)을 가진 등급
    const bestGrade = thresholds.find(t => t.max === Infinity);
    if(bestGrade && value >= bestGrade.min) return bestGrade.grade;

    // 가장 낮은 값(가장 나쁜 기록)을 가진 등급
    const worstGrade = thresholds.find(t => t.min === -Infinity);
    if(worstGrade && value < worstGrade.max) return worstGrade.grade;
  }

  return 5; // 최종적으로 등급을 찾지 못하면 5등급
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

    