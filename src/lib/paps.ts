export const papsStandards = {
  '50m 달리기': {
    남: [8.3, 8.9, 9.5, 10.1],
    여: [8.8, 9.4, 10.0, 10.6],
    type: 'time'
  },
  '윗몸 일으키기': {
    남: [45, 38, 30, 23],
    여: [38, 31, 24, 17],
    type: 'count'
  },
  '제자리 멀리뛰기': {
    남: [200, 180, 160, 140],
    여: [180, 160, 140, 120],
    type: 'distance'
  },
  '오래달리기': {
    남: [200, 220, 240, 260],
    여: [230, 250, 270, 290],
    type: 'time'
  }
};

type ItemName = keyof typeof papsStandards;

export function getPapsGrade(item: string, gender: '남' | '여', value: number): number | null {
  const standard = papsStandards[item as ItemName];
  if (!standard) return null;

  const thresholds = standard[gender];
  if (!thresholds) return null; // thresholds가 없을 경우를 대비한 안전 장치

  const type = standard.type;

  if (type === 'time') { // 낮을수록 좋음
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 4;
    return 5;
  } else { // 높을수록 좋음
    if (value >= thresholds[0]) return 1;
    if (value >= thresholds[1]) return 2;
    if (value >= thresholds[2]) return 3;
    if (value >= thresholds[3]) return 4;
    return 5;
  }
}
