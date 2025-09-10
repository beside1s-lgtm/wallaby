// 초등학교 5학년 PAPS 기준표 (예시)
export const papsStandards: Record<string, { male: number[], female: number[], type: 'time' | 'count' | 'distance' | 'weight' }> = {
  '50m 달리기': {
    male: [8.4, 9.0, 9.6, 10.2],
    female: [9.0, 9.6, 10.2, 10.8],
    type: 'time'
  },
  '제자리 멀리뛰기': {
    male: [185, 170, 155, 140],
    female: [175, 160, 145, 130],
    type: 'distance'
  },
  '윗몸 말아올리기': {
    male: [40, 32, 24, 16],
    female: [35, 27, 19, 11],
    type: 'count'
  },
  '왕복오래달리기': {
    male: [60, 45, 30, 15],
    female: [50, 35, 20, 10],
    type: 'count'
  },
  '앉아윗몸앞으로굽히기': {
    male: [15, 10, 5, 0],
    female: [18, 13, 8, 3],
    type: 'distance'
  },
  '악력': {
    male: [25, 20, 15, 10],
    female: [20, 15, 10, 5],
    type: 'weight'
  },
};

type ItemName = keyof typeof papsStandards;

export function getPapsGrade(item: string, gender: '남' | '여', value: number): number | null {
  const standard = papsStandards[item as ItemName];
  if (!standard) return null;

  const thresholds = gender === '남' ? standard.male : standard.female;
  if (!thresholds) return null;

  const type = standard.type;

  if (type === 'time') { // 낮을수록 좋음
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 4;
    return 5;
  } else { // 높을수록 좋음 (count, distance, weight)
    if (value >= thresholds[0]) return 1;
    if (value >= thresholds[1]) return 2;
    if (value >= thresholds[2]) return 3;
    if (value >= thresholds[3]) return 4;
    return 5;
  }
}
