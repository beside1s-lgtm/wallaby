'use server';
/**
 * @fileOverview Generates an AI scouting report for a student based on their athletic performance.
 *
 * - getScoutingReport - Analyzes student data and produces a brief scouting report.
 * - ScoutingReportInput - Input schema for the report generation.
 * - ScoutingReportOutput - Output schema for the report generation.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import type { MeasurementItem } from '@/lib/types';

const AbilityScoreSchema = z.object({
  item: z.string().describe('The name of the measurement item.'),
  score: z.number().describe('The ability score for the item (0-100).'),
});

const ScoutingReportInputSchema = z.object({
  studentName: z.string().describe('The name of the student being evaluated.'),
  abilityScores: z.array(AbilityScoreSchema).describe('An array of ability scores for different items.'),
  ranks: z.record(z.string()).describe("A record of the student's rank for each measurement type within their grade."),
  allItems: z.custom<MeasurementItem[]>().describe('A list of all available measurement items for context.'),
});
export type ScoutingReportInput = z.infer<typeof ScoutingReportInputSchema>;

const ScoutingReportOutputSchema = z.object({
  report: z.string().describe("A brief, insightful scouting report on the student's athletic abilities."),
});
export type ScoutingReportOutput = z.infer<typeof ScoutingReportOutputSchema>;

export async function getScoutingReport(input: ScoutingReportInput): Promise<ScoutingReportOutput> {
  return scoutingReportFlow(input);
}

const papsFactorMap: Record<string, string> = {
    '50m 달리기': '순발력',
    '제자리 멀리뛰기': '순발력',
    '윗몸 말아올리기': '근지구력',
    '팔굽혀펴기': '근지구력',
    '무릎 대고 팔굽혀펴기': '근지구력',
    '왕복오래달리기': '심폐지구력',
    '오래달리기': '심폐지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '악력': '근력',
};

const prompt = ai.definePrompt({
  name: 'scoutingReportPrompt',
  input: { schema: ScoutingReportInputSchema },
  output: { schema: ScoutingReportOutputSchema },
  model: googleAI.model('gemini-2.5-flash-lite'),
  prompt: `당신은 학생 선수의 잠재력을 분석하는 전문 스카우터입니다. 주어진 데이터를 바탕으로 {{studentName}} 학생에 대한 간결하고 통찰력 있는 스카우팅 리포트를 한국어로 작성해주세요.

### 분석 데이터:
- **학생 이름:** {{studentName}}
- **능력치 점수 (100점 만점):** {{json abilityScores}}
- **학년 내 종목별 등수:** {{json ranks}}

### 리포트 작성 가이드라인:
1.  **핵심 강점 식별:**
    -   '능력치 점수'가 가장 높은 1~2개 종목을 학생의 '핵심 강점'으로 파악하세요.
    -   PAPS 종목인 경우, 아래 체력 요소를 참고하여 강점을 구체적으로 서술하세요.
        -   순발력: 50m 달리기, 제자리 멀리뛰기
        -   근지구력: 윗몸 말아올리기, 팔굽혀펴기
        -   심폐지구력: 왕복오래달리기, 오래달리기
        -   유연성: 앉아윗몸앞으로굽히기
        -   근력: 악력
        -   (예: "50m 달리기 점수가 높은 것은 뛰어난 순발력을 의미하며, 단거리 스퍼트가 요구되는 상황에서 두각을 나타낼 수 있습니다.")
    -   기타 종목(예: 농구, 배구)인 경우, 해당 스포츠에서 그 능력이 어떤 이점으로 작용할지 서술하세요. (예: "자유투 점수가 높은 것은 높은 집중력과 안정적인 슈팅 메커니즘을 갖췄음을 보여줍니다.")

2.  **잠재적 약점 및 보완점:**
    -   '능력치 점수'가 상대적으로 낮은 1~2개 종목을 '보완점'으로 언급하세요.
    -   강점에 비해 점수가 현저히 낮은 종목을 중심으로 간략하게 언급하세요.

3.  **종합 평가:**
    -   학생의 전반적인 운동 능력을 한 문장으로 요약하여 선수 유형을 제시하세요. (예: "종합적으로 볼 때, {{studentName}} 학생은 뛰어난 순발력을 바탕으로 한 파워형 선수입니다." 또는 "심폐지구력을 강점으로 내세우는 지구력형 선수입니다.")
    -   등수 정보를 활용하여 학생의 재능을 객관적으로 어필하세요. (예: "특히 제자리 멀리뛰기는 학년 전체 50명 중 3등을 차지할 정도로 최상위권의 재능을 보입니다.")

4.  **스타일:**
    -   전문적이고 긍정적인 톤을 유지하되, 내용은 3~4문장으로 매우 간결하게 작성해주세요.
    -   "스카우팅 리포트:" 라는 제목으로 시작해주세요.
`,
});

const scoutingReportFlow = ai.defineFlow(
  {
    name: 'scoutingReportFlow',
    inputSchema: ScoutingReportInputSchema,
    outputSchema: ScoutingReportOutputSchema,
  },
  async (input) => {
    // Enrich input with PAPS factor information before calling the prompt
    const enrichedScores = input.abilityScores.map(score => {
        const factor = papsFactorMap[score.item];
        const itemInfo = input.allItems.find(i => i.name === score.item);
        const category = itemInfo?.category || (itemInfo?.isPaps ? 'PAPS' : '기타');
        return {
            ...score,
            factor: factor || '해당 없음',
            category: category,
        };
    });
    
    const enrichedInput = { ...input, abilityScores: enrichedScores };

    const { output } = await prompt(enrichedInput);
    return output!;
  }
);
