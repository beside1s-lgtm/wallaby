
import type { MeasurementItem, Student } from './types';

// 초등학교 4~6학년 PAPS 기준표 (2024년 교육부 기준 기반)
// 5단계 구조: 학년 -> 종목 -> 성별 -> 등급별 기준
const papsStandardsByGrade: Record<
  string, // 학년 (e.g., '4', '5', '6')
  Record<
    string, // 종목명
    {
      male: [number, number, number, number, number]; // 1~5등급 '이상' 또는 '이하' 기준값
      female: [number, number, number, number, number]; // 1~5등급 '이상' 또는 '이하' 기준값
      type: 'time' | 'count' | 'distance' | 'weight';
      unit: string;
    }
  >
> = {
  '4': {
    '왕복오래달리기': { male: [45, 34, 23, 13, 12], female: [34, 25, 16, 9, 8], type: 'count', unit: '회' },
    '앉아윗몸앞으로굽히기': { male: [13.0, 8.5, 4.5, 0.5, 0.4], female: [15.2, 11.5, 7.5, 3.5, 3.4], type: 'distance', unit: 'cm' },
    '윗몸 말아올리기': { male: [31, 24, 16, 8, 7], female: [26, 20, 14, 8, 7], type: 'count', unit: '회' },
    '50m 달리기': { male: [8.9, 9.5, 10.1, 10.7, 10.8], female: [9.3, 9.9, 10.5, 11.1, 11.2], type: 'time', unit: '초' },
    '제자리 멀리뛰기': { male: [170, 160, 150, 135, 134], female: [165, 155, 140, 125, 124], type: 'distance', unit: 'cm' },
  },
  '5': {
    '왕복오래달리기': { male: [53, 41, 28, 16, 15], female: [38, 29, 19, 11, 10], type: 'count', unit: '회' },
    '앉아윗몸앞으로굽히기': { male: [14.0, 9.5, 5.0, 0.5, 0.4], female: [16.5, 12.5, 8.5, 4.5, 4.4], type: 'distance', unit: 'cm' },
    '윗몸 말아올리기': { male: [35, 27, 19, 11, 10], female: [31, 25, 18, 11, 10], type: 'count', unit: '회' },
    '50m 달리기': { male: [8.4, 9.0, 9.6, 10.2, 10.3], female: [9.0, 9.6, 10.2, 10.8, 10.9], type: 'time', unit: '초' },
    '제자리 멀리뛰기': { male: [185, 170, 155, 140, 139], female: [175, 160, 145, 130, 129], type: 'distance', unit: 'cm' },
  },
  '6': {
    '왕복오래달리기': { male: [60, 47, 34, 20, 19], female: [42, 32, 22, 13, 12], type: 'count', unit: '회' },
    '앉아윗몸앞으로굽히기': { male: [15.0, 10.0, 5.5, 1.0, 0.9], female: [17.8, 14.0, 10.0, 6.0, 5.9], type: 'distance', unit: 'cm' },
    '윗몸 말아올리기': { male: [40, 31, 22, 13, 12], female: [34, 27, 19, 12, 11], type: 'count', unit: '회' },
    '50m 달리기': { male: [8.1, 8.7, 9.3, 9.9, 10.0], female: [8.7, 9.3, 9.9, 10.5, 10.6], type: 'time', unit: '초' },
    '제자리 멀리뛰기': { male: [195, 180, 165, 145, 144], female: [180, 165, 150, 135, 134], type: 'distance', unit: 'cm' },
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

  // thresholds 배열: [1등급컷, 2등급컷, 3등급컷, 4등급컷, 5등급컷]
  // 5등급컷은 4등급 미만인 경우를 처리하기 위한 값
  if (type === 'time') { // 낮을수록 좋음
    if (value < thresholds[0]) return 1;
    if (value < thresholds[1]) return 2;
    if (value < thresholds[2]) return 3;
    if (value < thresholds[3]) return 4;
    return 5;
  } else { // 높을수록 좋음 (count, distance, weight)
    if (value >= thresholds[0]) return 1;
    if (value >= thresholds[1]) return 2;
    if (value >= thresholds[2]) return 3;
    if (value >= thresholds[3]) return 4;
    return 5;
  }
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
