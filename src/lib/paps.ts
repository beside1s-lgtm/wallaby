
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
      male: [ { grade: 1, min: 96, max: Infinity }, { grade: 2, min: 69, max: 95 }, { grade: 3, min: 45, max: 68 }, { grade: 4, min: 26, max: 44 }, { grade: 5, min: 1, max: 25 } ],
      female: [ { grade: 1, min: 77, max: Infinity }, { grade: 2, min: 57, max: 76 }, { grade: 3, min: 40, max: 56 }, { grade: 4, min: 21, max: 39 }, { grade: 5, min: 1, max: 20 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: Infinity }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 7, max: 21 }, { grade: 5, min: 0, max: 6 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 29, max: 59 }, { grade: 3, min: 18, max: 28 }, { grade: 4, min: 6, max: 17 }, { grade: 5, min: 0, max: 5 } ],
      type: 'count', unit: '회' 
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 8.0, max: Infinity }, { grade: 2, min: 5.0, max: 7.9 }, { grade: 3, min: 1.0, max: 4.9 }, { grade: 4, min: -4.0, max: 0.9 }, { grade: 5, min: -Infinity, max: -4.1 } ],
      female: [ { grade: 1, min: 14.0, max: Infinity }, { grade: 2, min: 10.0, max: 13.9 }, { grade: 3, min: 5.0, max: 9.9 }, { grade: 4, min: 2.0, max: 4.9 }, { grade: 5, min: -Infinity, max: 1.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 1, max: 8.8 }, { grade: 2, min: 8.9, max: 9.7 }, { grade: 3, min: 9.8, max: 10.5 }, { grade: 4, min: 10.6, max: 13.2 }, { grade: 5, min: 13.3, max: Infinity } ],
      female: [ { grade: 1, min: 1, max: 9.4 }, { grade: 2, min: 9.5, max: 10.4 }, { grade: 3, min: 10.5, max: 11.0 }, { grade: 4, min: 11.1, max: 13.3 }, { grade: 5, min: 13.4, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 149, max: 169 }, { grade: 3, min: 130, max: 148 }, { grade: 4, min: 100, max: 129 }, { grade: 5, min: 10, max: 99 } ],
      female: [ { grade: 1, min: 161, max: Infinity }, { grade: 2, min: 135, max: 160 }, { grade: 3, min: 119, max: 134 }, { grade: 4, min: 97, max: 118 }, { grade: 5, min: 10, max: 96 } ],
      type: 'distance', unit: 'cm'
    },
    '악력': {
      male: [ { grade: 1, min: 31.0, max: Infinity }, { grade: 2, min: 18.5, max: 30.9 }, { grade: 3, min: 15.0, max: 18.4 }, { grade: 4, min: 11.5, max: 14.9 }, { grade: 5, min: 0, max: 11.4 } ],
      female: [ { grade: 1, min: 29.0, max: Infinity }, { grade: 2, min: 18.0, max: 28.9 }, { grade: 3, min: 13.5, max: 17.9 }, { grade: 4, min: 10.5, max: 13.4 }, { grade: 5, min: 0, max: 10.4 } ],
      type: 'weight', unit: 'kg'
    },
  },
  '5': {
    '왕복오래달리기': { 
        male: [ { grade: 1, min: 100, max: Infinity }, { grade: 2, min: 73, max: 99 }, { grade: 3, min: 50, max: 72 }, { grade: 4, min: 29, max: 49 }, { grade: 5, min: 1, max: 28 } ],
        female: [ { grade: 1, min: 85, max: Infinity }, { grade: 2, min: 63, max: 84 }, { grade: 3, min: 45, max: 62 }, { grade: 4, min: 23, max: 44 }, { grade: 5, min: 1, max: 22 } ],
        type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: Infinity }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 10, max: 21 }, { grade: 5, min: 0, max: 9 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 29, max: 59 }, { grade: 3, min: 18, max: 28 }, { grade: 4, min: 6, max: 17 }, { grade: 5, min: 0, max: 5 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 8, max: Infinity }, { grade: 2, min: 5.0, max: 7.9 }, { grade: 3, min: 1.0, max: 4.9 }, { grade: 4, min: -4.0, max: 0.9 }, { grade: 5, min: -Infinity, max: -4.1 } ],
      female: [ { grade: 1, min: 14, max: Infinity }, { grade: 2, min: 10, max: 13.9 }, { grade: 3, min: 5.0, max: 9.9 }, { grade: 4, min: 2, max: 4.9 }, { grade: 5, min: -Infinity, max: 1.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 1, max: 8.5 }, { grade: 2, min: 8.6, max: 9.4 }, { grade: 3, min: 9.5, max: 10.2 }, { grade: 4, min: 10.3, max: 11.0 }, { grade: 5, min: 11.1, max: Infinity } ],
      female: [ { grade: 1, min: 1, max: 8.9 }, { grade: 2, min: 9.0, max: 9.9 }, { grade: 3, min: 10.0, max: 10.7 }, { grade: 4, min: 10.8, max: 11.5 }, { grade: 5, min: 11.6, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 180, max: Infinity }, { grade: 2, min: 159, max: 179 }, { grade: 3, min: 141, max: 158 }, { grade: 4, min: 111, max: 140 }, { grade: 5, min: 10, max: 110 } ],
      female: [ { grade: 1, min: 170, max: Infinity }, { grade: 2, min: 139, max: 169 }, { grade: 3, min: 123, max: 138 }, { grade: 4, min: 100, max: 122 }, { grade: 5, min: 10, max: 99 } ],
      type: 'distance', unit: 'cm'
    },
    '악력': {
      male: [ { grade: 1, min: 31.0, max: Infinity }, { grade: 2, min: 23.0, max: 30.9 }, { grade: 3, min: 17.0, max: 22.9 }, { grade: 4, min: 12.5, max: 16.9 }, { grade: 5, min: 0, max: 12.4 } ],
      female: [ { grade: 1, min: 29.0, max: Infinity }, { grade: 2, min: 19.0, max: 28.9 }, { grade: 3, min: 15.5, max: 18.9 }, { grade: 4, min: 12.0, max: 15.4 }, { grade: 5, min: 0, max: 11.9 } ],
      type: 'weight', unit: 'kg'
    },
  },
  '6': {
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 104, max: Infinity }, { grade: 2, min: 78, max: 103 }, { grade: 3, min: 54, max: 77 }, { grade: 4, min: 32, max: 53 }, { grade: 5, min: 1, max: 31 } ],
      female: [ { grade: 1, min: 93, max: Infinity }, { grade: 2, min: 69, max: 84 }, { grade: 3, min: 50, max: 68 }, { grade: 4, min: 25, max: 49 }, { grade: 5, min: 1, max: 24 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 80, max: Infinity }, { grade: 2, min: 40, max: 79 }, { grade: 3, min: 22, max: 39 }, { grade: 4, min: 10, max: 21 }, { grade: 5, min: 0, max: 9 } ],
      female: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 43, max: 59 }, { grade: 3, min: 23, max: 42 }, { grade: 4, min: 7, max: 22 }, { grade: 5, min: 0, max: 6 } ],
      type: 'count', unit: '회' 
    },
     '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 8, max: Infinity }, { grade: 2, min: 5, max: 7.9 }, { grade: 3, min: 1, max: 4.9 }, { grade: 4, min: -4.0, max: 0.9 }, { grade: 5, min: -Infinity, max: -4.1 } ],
      female: [ { grade: 1, min: 14, max: Infinity }, { grade: 2, min: 10, max: 13.9 }, { grade: 3, min: 5, max: 9.9 }, { grade: 4, min: 2, max: 4.9 }, { grade: 5, min: -Infinity, max: 1.9 } ],
      type: 'distance', unit: 'cm'
    },
    '50m 달리기': {
      male: [ { grade: 1, min: 1, max: 8.1 }, { grade: 2, min: 8.2, max: 9.0 }, { grade: 3, min: 9.1, max: 9.8 }, { grade: 4, min: 9.9, max: 10.6 }, { grade: 5, min: 10.7, max: Infinity } ],
      female: [ { grade: 1, min: 1, max: 8.9 }, { grade: 2, min: 9.0, max: 9.8 }, { grade: 3, min: 9.9, max: 10.7 }, { grade: 4, min: 10.8, max: 11.5 }, { grade: 5, min: 11.6, max: Infinity } ],
      type: 'time', unit: '초'
    },
    '제자리 멀리뛰기': {
      male: [ { grade: 1, min: 200, max: Infinity }, { grade: 2, min: 167, max: 199 }, { grade: 3, min: 148, max: 166 }, { grade: 4, min: 122, max: 147 }, { grade: 5, min: 10, max: 121 } ],
      female: [ { grade: 1, min: 175, max: Infinity }, { grade: 2, min: 144, max: 174 }, { grade: 3, min: 127, max: 143 }, { grade: 4, min: 100, max: 126 }, { grade: 5, min: 10, max: 99 } ],
      type: 'distance', unit: 'cm'
    },
    '악력': {
      male: [ { grade: 1, min: 35.0, max: Infinity }, { grade: 2, min: 26.5, max: 34.9 }, { grade: 3, min: 19.0, max: 26.4 }, { grade: 4, min: 15.0, max: 18.9 }, { grade: 5, min: 0, max: 14.9 } ],
      female: [ { grade: 1, min: 33.0, max: Infinity }, { grade: 2, min: 22.0, max: 32.9 }, { grade: 3, min: 19.0, max: 21.9 }, { grade: 4, min: 14.0, max: 18.9 }, { grade: 5, min: 0, max: 13.9 } ],
      type: 'weight', unit: 'kg'
    },
  },
  // --- 중학교 (7,8,9) ---
  '7': { // 중1
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 64, max: Infinity }, { grade: 2, min: 50, max: 63 }, { grade: 3, min: 36, max: 49 }, { grade: 4, min: 20, max: 35 }, { grade: 5, min: -Infinity, max: 19 } ],
      female: [ { grade: 1, min: 35, max: Infinity }, { grade: 2, min: 25, max: 34 }, { grade: 3, min: 19, max: 24 }, { grade: 4, min: 14, max: 18 }, { grade: 5, min: -Infinity, max: 13 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 55, max: Infinity }, { grade: 2, min: 44, max: 54 }, { grade: 3, min: 33, max: 43 }, { grade: 4, min: 14, max: 32 }, { grade: 5, min: -Infinity, max: 13 } ],
      female: [ { grade: 1, min: 46, max: Infinity }, { grade: 2, min: 36, max: 45 }, { grade: 3, min: 25, max: 35 }, { grade: 4, min: 10, max: 24 }, { grade: 5, min: -Infinity, max: 9 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 18.0, max: Infinity }, { grade: 2, min: 13.9, max: 17.9 }, { grade: 3, min: 9.1, max: 13.8 }, { grade: 4, min: 3.5, max: 9.0 }, { grade: 5, min: -Infinity, max: 3.4 } ],
      female: [ { grade: 1, min: 20.0, max: Infinity }, { grade: 2, min: 16.9, max: 19.9 }, { grade: 3, min: 13.0, max: 16.8 }, { grade: 4, min: 8.8, max: 12.9 }, { grade: 5, min: -Infinity, max: 8.7 } ],
      type: 'distance', unit: 'cm'
    },
    '팔굽혀펴기': { 
      male: [ { grade: 1, min: 35, max: Infinity }, { grade: 2, min: 27, max: 34 }, { grade: 3, min: 19, max: 26 }, { grade: 4, min: 6, max: 18 }, { grade: 5, min: -Infinity, max: 5 } ],
      female: [ { grade: 1, min: 20, max: Infinity }, { grade: 2, min: 15, max: 19 }, { grade: 3, min: 10, max: 14 }, { grade: 4, min: 3, max: 9 }, { grade: 5, min: -Infinity, max: 2 } ],
      type: 'count', unit: '회'
    },
    '악력': {
        male: [ { grade: 1, min: 42.0, max: Infinity }, { grade: 2, min: 30.0, max: 41.9 }, { grade: 3, min: 22.5, max: 29.9 }, { grade: 4, min: 16.5, max: 22.4 }, { grade: 5, min: 0, max: 16.4 } ],
        female: [ { grade: 1, min: 36.0, max: Infinity }, { grade: 2, min: 23.0, max: 35.9 }, { grade: 3, min: 19.0, max: 22.9 }, { grade: 4, min: 14.0, max: 18.9 }, { grade: 5, min: 0, max: 13.9 } ],
        type: 'weight', unit: 'kg'
    },
  },
  '8': { // 중2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 66, max: Infinity }, { grade: 2, min: 52, max: 65 }, { grade: 3, min: 38, max: 51 }, { grade: 4, min: 22, max: 37 }, { grade: 5, min: -Infinity, max: 21 } ],
      female: [ { grade: 1, min: 40, max: Infinity }, { grade: 2, min: 29, max: 39 }, { grade: 3, min: 21, max: 28 }, { grade: 4, min: 15, max: 20 }, { grade: 5, min: -Infinity, max: 14 } ],
      type: 'count', unit: '회' 
    },
     '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 57, max: Infinity }, { grade: 2, min: 46, max: 56 }, { grade: 3, min: 35, max: 45 }, { grade: 4, min: 16, max: 34 }, { grade: 5, min: -Infinity, max: 15 } ],
      female: [ { grade: 1, min: 48, max: Infinity }, { grade: 2, min: 38, max: 47 }, { grade: 3, min: 27, max: 37 }, { grade: 4, min: 12, max: 26 }, { grade: 5, min: -Infinity, max: 11 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 18.0, max: Infinity }, { grade: 2, min: 13.9, max: 17.9 }, { grade: 3, min: 9.1, max: 13.8 }, { grade: 4, min: 3.5, max: 9.0 }, { grade: 5, min: -Infinity, max: 3.4 } ],
      female: [ { grade: 1, min: 20.0, max: Infinity }, { grade: 2, min: 16.9, max: 19.9 }, { grade: 3, min: 13.0, max: 16.8 }, { grade: 4, min: 8.8, max: 12.9 }, { grade: 5, min: -Infinity, max: 8.7 } ],
      type: 'distance', unit: 'cm'
    },
     '팔굽혀펴기': {
      male: [ { grade: 1, min: 40, max: Infinity }, { grade: 2, min: 31, max: 39 }, { grade: 3, min: 22, max: 30 }, { grade: 4, min: 8, max: 21 }, { grade: 5, min: -Infinity, max: 7 } ],
      female: [ { grade: 1, min: 22, max: Infinity }, { grade: 2, min: 17, max: 21 }, { grade: 3, min: 12, max: 16 }, { grade: 4, min: 4, max: 11 }, { grade: 5, min: -Infinity, max: 3 } ],
      type: 'count', unit: '회'
    },
    '악력': {
        male: [ { grade: 1, min: 44.5, max: Infinity }, { grade: 2, min: 37.0, max: 44.4 }, { grade: 3, min: 28.5, max: 36.9 }, { grade: 4, min: 22.0, max: 28.4 }, { grade: 5, min: 0, max: 21.9 } ],
        female: [ { grade: 1, min: 36.0, max: Infinity }, { grade: 2, min: 25.5, max: 35.9 }, { grade: 3, min: 19.5, max: 25.4 }, { grade: 4, min: 14.0, max: 19.4 }, { grade: 5, min: 0, max: 13.9 } ],
        type: 'weight', unit: 'kg'
    },
  },
  '9': { // 중3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 68, max: Infinity }, { grade: 2, min: 54, max: 67 }, { grade: 3, min: 40, max: 53 }, { grade: 4, min: 24, max: 39 }, { grade: 5, min: -Infinity, max: 23 } ],
      female: [ { grade: 1, min: 45, max: Infinity }, { grade: 2, min: 33, max: 44 }, { grade: 3, min: 23, max: 32 }, { grade: 4, min: 16, max: 22 }, { grade: 5, min: -Infinity, max: 15 } ],
      type: 'count', unit: '회' 
    },
     '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 59, max: Infinity }, { grade: 2, min: 48, max: 58 }, { grade: 3, min: 37, max: 47 }, { grade: 4, min: 18, max: 36 }, { grade: 5, min: -Infinity, max: 17 } ],
      female: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 40, max: 49 }, { grade: 3, min: 29, max: 39 }, { grade: 4, min: 14, max: 28 }, { grade: 5, min: -Infinity, max: 13 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 18.8, max: Infinity }, { grade: 2, min: 14.8, max: 18.7 }, { grade: 3, min: 10.1, max: 14.7 }, { grade: 4, min: 4.8, max: 10.0 }, { grade: 5, min: -Infinity, max: 4.7 } ],
      female: [ { grade: 1, min: 20.9, max: Infinity }, { grade: 2, min: 17.8, max: 20.8 }, { grade: 3, min: 13.9, max: 17.7 }, { grade: 4, min: 9.6, max: 13.8 }, { grade: 5, min: -Infinity, max: 9.5 } ],
      type: 'distance', unit: 'cm'
    },
     '팔굽혀펴기': {
      male: [ { grade: 1, min: 45, max: Infinity }, { grade: 2, min: 35, max: 44 }, { grade: 3, min: 25, max: 34 }, { grade: 4, min: 10, max: 24 }, { grade: 5, min: -Infinity, max: 9 } ],
      female: [ { grade: 1, min: 24, max: Infinity }, { grade: 2, min: 19, max: 23 }, { grade: 3, min: 14, max: 18 }, { grade: 4, min: 5, max: 13 }, { grade: 5, min: -Infinity, max: 4 } ],
      type: 'count', unit: '회'
    },
    '악력': {
        male: [ { grade: 1, min: 48.5, max: Infinity }, { grade: 2, min: 40.5, max: 48.4 }, { grade: 3, min: 33.0, max: 40.4 }, { grade: 4, min: 25.0, max: 32.9 }, { grade: 5, min: 0, max: 24.9 } ],
        female: [ { grade: 1, min: 36.0, max: Infinity }, { grade: 2, min: 27.5, max: 35.9 }, { grade: 3, min: 19.5, max: 27.4 }, { grade: 4, min: 16.0, max: 19.4 }, { grade: 5, min: 0, max: 15.9 } ],
        type: 'weight', unit: 'kg'
    },
  },
  // --- 고등학교 (10,11,12) ---
  '10': { // 고1
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 70, max: Infinity }, { grade: 2, min: 56, max: 69 }, { grade: 3, min: 42, max: 55 }, { grade: 4, min: 26, max: 41 }, { grade: 5, min: -Infinity, max: 25 } ],
      female: [ { grade: 1, min: 50, max: Infinity }, { grade: 2, min: 37, max: 49 }, { grade: 3, min: 25, max: 36 }, { grade: 4, min: 17, max: 24 }, { grade: 5, min: -Infinity, max: 16 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 60, max: Infinity }, { grade: 2, min: 49, max: 59 }, { grade: 3, min: 38, max: 48 }, { grade: 4, min: 19, max: 37 }, { grade: 5, min: -Infinity, max: 18 } ],
      female: [ { grade: 1, min: 51, max: Infinity }, { grade: 2, min: 41, max: 50 }, { grade: 3, min: 30, max: 40 }, { grade: 4, min: 15, max: 29 }, { grade: 5, min: -Infinity, max: 14 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 19.3, max: Infinity }, { grade: 2, min: 15.3, max: 19.2 }, { grade: 3, min: 10.6, max: 15.2 }, { grade: 4, min: 5.4, max: 10.5 }, { grade: 5, min: -Infinity, max: 5.3 } ],
      female: [ { grade: 1, min: 21.3, max: Infinity }, { grade: 2, min: 18.2, max: 21.2 }, { grade: 3, min: 14.5, max: 18.1 }, { grade: 4, min: 10.3, max: 14.4 }, { grade: 5, min: -Infinity, max: 10.2 } ],
      type: 'distance', unit: 'cm'
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 46, max: Infinity }, { grade: 2, min: 36, max: 45 }, { grade: 3, min: 26, max: 35 }, { grade: 4, min: 11, max: 25 }, { grade: 5, min: -Infinity, max: 10 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 6, max: 14 }, { grade: 5, min: -Infinity, max: 5 } ],
      type: 'count', unit: '회'
    },
    '악력': {
        male: [ { grade: 1, min: 61.0, max: Infinity }, { grade: 2, min: 42.5, max: 60.9 }, { grade: 3, min: 35.5, max: 42.4 }, { grade: 4, min: 29.0, max: 35.4 }, { grade: 5, min: 0, max: 28.9 } ],
        female: [ { grade: 1, min: 36.0, max: Infinity }, { grade: 2, min: 29.0, max: 35.9 }, { grade: 3, min: 23.0, max: 28.9 }, { grade: 4, min: 16.5, max: 22.9 }, { grade: 5, min: 0, max: 16.4 } ],
        type: 'weight', unit: 'kg'
    },
  },
  '11': { // 고2
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 72, max: Infinity }, { grade: 2, min: 58, max: 71 }, { grade: 3, min: 44, max: 57 }, { grade: 4, min: 28, max: 43 }, { grade: 5, min: -Infinity, max: 27 } ],
      female: [ { grade: 1, min: 55, max: Infinity }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: -Infinity, max: 17 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 61, max: Infinity }, { grade: 2, min: 50, max: 60 }, { grade: 3, min: 39, max: 49 }, { grade: 4, min: 20, max: 38 }, { grade: 5, min: -Infinity, max: 19 } ],
      female: [ { grade: 1, min: 52, max: Infinity }, { grade: 2, min: 42, max: 51 }, { grade: 3, min: 31, max: 41 }, { grade: 4, min: 16, max: 30 }, { grade: 5, min: -Infinity, max: 15 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 19.8, max: Infinity }, { grade: 2, min: 15.8, max: 19.7 }, { grade: 3, min: 11.0, max: 15.7 }, { grade: 4, min: 5.8, max: 10.9 }, { grade: 5, min: -Infinity, max: 5.7 } ],
      female: [ { grade: 1, min: 21.6, max: Infinity }, { grade: 2, min: 18.5, max: 21.5 }, { grade: 3, min: 14.8, max: 18.4 }, { grade: 4, min: 10.6, max: 14.7 }, { grade: 5, min: -Infinity, max: 10.5 } ],
      type: 'distance', unit: 'cm'
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 47, max: Infinity }, { grade: 2, min: 37, max: 46 }, { grade: 3, min: 27, max: 36 }, { grade: 4, min: 12, max: 26 }, { grade: 5, min: -Infinity, max: 11 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 6, max: 14 }, { grade: 5, min: -Infinity, max: 5 } ],
      type: 'count', unit: '회'
    },
    '악력': {
        male: [ { grade: 1, min: 61.0, max: Infinity }, { grade: 2, min: 46.0, max: 60.9 }, { grade: 3, min: 39.0, max: 45.9 }, { grade: 4, min: 31.0, max: 38.9 }, { grade: 5, min: 0, max: 30.9 } ],
        female: [ { grade: 1, min: 37.5, max: Infinity }, { grade: 2, min: 29.5, max: 37.4 }, { grade: 3, min: 25.0, max: 29.4 }, { grade: 4, min: 18.0, max: 24.9 }, { grade: 5, min: 0, max: 17.9 } ],
        type: 'weight', unit: 'kg'
    },
  },
  '12': { // 고3
    '왕복오래달리기': { 
      male: [ { grade: 1, min: 74, max: Infinity }, { grade: 2, min: 60, max: 73 }, { grade: 3, min: 46, max: 59 }, { grade: 4, min: 30, max: 45 }, { grade: 5, min: -Infinity, max: 29 } ],
      female: [ { grade: 1, min: 55, max: Infinity }, { grade: 2, min: 41, max: 54 }, { grade: 3, min: 27, max: 40 }, { grade: 4, min: 18, max: 26 }, { grade: 5, min: -Infinity, max: 17 } ],
      type: 'count', unit: '회' 
    },
    '윗몸 말아올리기': { 
      male: [ { grade: 1, min: 61, max: Infinity }, { grade: 2, min: 50, max: 60 }, { grade: 3, min: 39, max: 49 }, { grade: 4, min: 20, max: 38 }, { grade: 5, min: -Infinity, max: 19 } ],
      female: [ { grade: 1, min: 52, max: Infinity }, { grade: 2, min: 42, max: 51 }, { grade: 3, min: 31, max: 41 }, { grade: 4, min: 16, max: 30 }, { grade: 5, min: -Infinity, max: 15 } ],
      type: 'count', unit: '회' 
    },
    '앉아윗몸앞으로굽히기': {
      male: [ { grade: 1, min: 20.0, max: Infinity }, { grade: 2, min: 16.0, max: 19.9 }, { grade: 3, min: 11.3, max: 15.9 }, { grade: 4, min: 6.1, max: 11.2 }, { grade: 5, min: -Infinity, max: 6.0 } ],
      female: [ { grade: 1, min: 21.8, max: Infinity }, { grade: 2, min: 18.7, max: 21.7 }, { grade: 3, min: 15.0, max: 18.6 }, { grade: 4, min: 10.8, max: 14.9 }, { grade: 5, min: -Infinity, max: 10.7 } ],
      type: 'distance', unit: 'cm'
    },
    '팔굽혀펴기': {
      male: [ { grade: 1, min: 47, max: Infinity }, { grade: 2, min: 37, max: 46 }, { grade: 3, min: 27, max: 36 }, { grade: 4, min: 12, max: 26 }, { grade: 5, min: -Infinity, max: 11 } ],
      female: [ { grade: 1, min: 25, max: Infinity }, { grade: 2, min: 20, max: 24 }, { grade: 3, min: 15, max: 19 }, { grade: 4, min: 6, max: 14 }, { grade: 5, min: -Infinity, max: 5 } ],
      type: 'count', unit: '회'
    },
    '악력': {
        male: [ { grade: 1, min: 63.5, max: Infinity }, { grade: 2, min: 46.0, max: 63.4 }, { grade: 3, min: 39.0, max: 45.9 }, { grade: 4, min: 31.0, max: 38.9 }, { grade: 5, min: 0, max: 30.9 } ],
        female: [ { grade: 1, min: 37.5, max: Infinity }, { grade: 2, min: 29.5, max: 37.4 }, { grade: 3, min: 25.0, max: 29.4 }, { grade: 4, min: 18.0, max: 24.9 }, { grade: 5, min: 0, max: 17.9 } ],
        type: 'weight', unit: 'kg'
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


export function getPapsGrade(item: string, student: Student, value: number): number | null {
  const gradeKey = student.grade;
  let gradeStandard = papsStandardsByGrade[gradeKey];
  
  if (!gradeStandard) {
    const gradeNum = parseInt(gradeKey);
    if (gradeNum >= 1 && gradeNum <= 3) {
      // 초 1~3학년 -> 4학년 기준 적용
      gradeStandard = papsStandardsByGrade['4'];
    } else {
      // 그 외 학년은 기준표에 없으므로 null 처리
      return null; 
    }
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
    if (standard.type === 'time') { // 시간이면 낮을수록 좋음
        if (value <= range.max && value >= range.min) {
            return range.grade;
        }
    } else { // 나머지는 높을수록 좋음
        if (value >= range.min && value <= range.max) {
            return range.grade;
        }
    }
  }
  
  // 등급 범위를 벗어난 경우 (1등급 초과 or 5등급 미만)
  const isTimeType = standard.type === 'time';
  const sortedThresholds = [...thresholds].sort((a,b) => isTimeType ? b.min - a.min : a.min - b.min); // 1등급 기준이 가장 앞으로 오도록 정렬
  
  if (isTimeType) { // 시간이면 낮을수록 좋음
    if (value < sortedThresholds[0].max) return 1; // 1등급 기준(max)보다 작으면 1등급
    if (value > sortedThresholds[4].min) return 5; // 5등급 기준(min)보다 크면 5등급
  } else { // 시간이 아니면 높을수록 좋음
    if (value > sortedThresholds[0].min) return 1; // 1등급 기준(min)보다 크면 1등급
    if (value < sortedThresholds[4].max) return 5; // 5등급 기준(max)보다 작으면 5등급
  }
  
  return 5; // 어떤 범위에도 속하지 않으면 기본적으로 5등급
}


export function getCustomItemGrade(item: MeasurementItem, value: number): number | null {
  if (item.isPaps || item.recordType === 'time') {
    return null;
  }
  
  if (item.recordType === 'level') {
    if(value === 1) return 1;
    if(value === 2) return 2;
    if(value === 3) return 3;
    if(value === 4) return 4;
    if(value === 5) return 5;
    return null;
  }
  
  if (!item.goal) return null;


  const percentage = (value / item.goal) * 100;

  if (percentage >= 100) return 1;
  if (percentage >= 75) return 2;
  if (percentage >= 50) return 3;
  if (percentage >= 25) return 4;
  return 5;
}

/**
 * PAPS 등급과 실제 기록을 바탕으로 0-100 사이의 성취도를 계산합니다.
 * @param grade 등급
 * @param value 실제 기록
 * @param item 종목명
 * @param student 학생 정보
 * @returns 0-100 사이의 성취도 점수
 */
export function normalizePapsRecord(grade: number, value: number, item: string, student: Student): number {
    const gradeKey = student.grade;
    let gradeStandard = papsStandardsByGrade[gradeKey];
    if (!gradeStandard) {
        const gradeNum = parseInt(gradeKey);
        if (gradeNum >= 1 && gradeNum <= 3) gradeStandard = papsStandardsByGrade['4'];
        else return (5 - grade) * 25; // 기준표 없으면 기존 방식
    }
    
    const standard = gradeStandard[item === '무릎 대고 팔굽혀펴기' ? '팔굽혀펴기' : item];
    if (!standard) return (5 - grade) * 25;

    const thresholds = (student.gender === '남' ? standard.male : standard.female).sort((a,b) => a.grade - b.grade);
    if (thresholds.length < 5) return (5 - grade) * 25;

    const isTimeType = standard.type === 'time';
    const baseScore = (5 - grade) * 20; // 1등급=80, 2등급=60, ..., 5등급=0
    let bonusScore = 0;

    const currentGradeInfo = thresholds[grade - 1];
    const nextGradeInfo = grade > 1 ? thresholds[grade - 2] : null;

    let min = currentGradeInfo.min;
    let max = currentGradeInfo.max;

    if (isTimeType) {
        min = currentGradeInfo.max; // 시간은 값이 작을수록 좋으므로 min/max 반전
        max = currentGradeInfo.min;
        if(nextGradeInfo) max = nextGradeInfo.max;
    } else {
        if(nextGradeInfo) max = nextGradeInfo.min;
    }
    
    // 1등급 초과 or 5등급 미만 기록에 대한 min/max 재설정
    if (grade === 1 && !isFinite(max)) max = min * 1.5; // 1등급 상한선을 1등급 기준치의 150%로 임의 설정
    if (grade === 5 && !isFinite(min)) min = 0;

    const range = max - min;
    
    if (range > 0) {
        let progress = isTimeType ? (max - value) / range : (value - min) / range;
        progress = Math.max(0, Math.min(1, progress)); // 0~1 사이로 제한
        bonusScore = progress * 20; // 등급 내에서 최대 20점의 보너스 점수
    } else if (value === min) {
        bonusScore = 0;
    } else if (isTimeType ? value < max : value > min) { // 1등급이면서 기준치를 넘었을 때
        bonusScore = 20;
    }
    
    const totalScore = Math.min(100, baseScore + bonusScore);
    return parseFloat(totalScore.toFixed(2));
}

/**
 * 기타 종목의 기록을 0-100 사이의 성취도로 변환합니다.
 */
export function normalizeCustomRecord(item: MeasurementItem, value: number): number {
    if (item.recordType === 'level') {
        if (value === 1) return 100; // 상
        if (value === 2) return 75;  // 중
        if (value === 3) return 50;  // 하
        return 0;
    }
    
    if (!item.goal || item.goal === 0 || item.recordType === 'time') {
        return 0;
    }
    // 목표치를 초과해도 100%로 제한
    const achievement = Math.min(100, (value / item.goal) * 100);
    return parseFloat(achievement.toFixed(2));
}
