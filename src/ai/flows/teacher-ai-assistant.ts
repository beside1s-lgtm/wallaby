'use server';

/**
 * @fileOverview Provides AI-driven analysis of a student's strengths and weaknesses, along with suggested training methods.
 *
 * - analyzeStudentPerformance - A function that analyzes student performance and suggests training methods.
 * - AnalyzeStudentPerformanceInput - The input type for the analyzeStudentPerformance function.
 * - AnalyzeStudentPerformanceOutput - The return type for the analyzeStudentPerformance function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'zod';

const AnalyzeStudentPerformanceInputSchema = z.object({
  school: z.string().describe('The school of the student.'),
  studentName: z.string().describe('The name of the student to analyze.'),
  performanceData: z.string().describe('The student performance data in all sports. Represented as a JSON string.'),
  ranks: z.record(z.string()).describe("A record of the student's rank for each measurement type."),
});
export type AnalyzeStudentPerformanceInput = z.infer<
  typeof AnalyzeStudentPerformanceInputSchema
>;

const AnalyzeStudentPerformanceOutputSchema = z.object({
  strengths: z.string().describe("The student's strengths in sports."),
  weaknesses: z.string().describe("The student's weaknesses in sports."),
  suggestedTrainingMethods: z
    .string()
    .describe('Suggested training methods to improve the student\'s performance.'),
});
export type AnalyzeStudentPerformanceOutput = z.infer<
  typeof AnalyzeStudentPerformanceOutputSchema
>;

export async function analyzeStudentPerformance(
  input: AnalyzeStudentPerformanceInput
): Promise<AnalyzeStudentPerformanceOutput> {
  return analyzeStudentPerformanceFlow(input);
}

const analyzeStudentPerformancePrompt = ai.definePrompt({
  name: 'analyzeStudentPerformancePrompt',
  input: {schema: AnalyzeStudentPerformanceInputSchema},
  output: {schema: AnalyzeStudentPerformanceOutputSchema},
  model: googleAI.model('gemini-2.5-flash-lite'),
  prompt: `당신은 {{school}}의 체육 교사를 위한 AI 조수입니다. 학생의 경기력 데이터를 바탕으로 강점과 약점을 분석하고, 경기력 향상을 위한 훈련 방법을 제안하는 임무를 맡고 있습니다. 답변은 아주 간략하게 핵심만 요약해주세요.

학생 이름: {{{studentName}}}
경기력 데이터: {{{performanceData}}}
종목별 등수: {{json ranks}}

## 분석 가이드라인
1.  **경기력 데이터 해석:**
    -   'recordType' 필드는 기록의 유형을 나타냅니다.
        -   'time': 기록이 짧을수록 좋습니다 (예: 달리기).
        -   'distance', 'count', 'weight': 기록이 클수록 좋습니다 (예: 멀리뛰기, 윗몸 일으키기).
        -   'level': 1(상), 2(중), 3(하) 등급으로 평가하며, 1이 가장 좋습니다.
    -   'isPaps' 필드는 해당 종목이 PAPS(학생건강체력평가)에 속하는지 여부를 나타냅니다. 'true'이면 체력 종목, 'false'이면 기능 종목입니다.

2.  **강점 및 약점 분석:**
    -   분석 결과를 **"PAPS 종목 (체력)"**과 **"기타 종목 (기능)"** 두 부분으로 명확히 나누어 작성해주세요.
    -   **PAPS 종목(체력) 분석:** 등수 정보를 적극 활용하여 강점(예: 50m 달리기 1등)과 약점(예: 윗몸 일으키기 15등)을 구체적으로 지적하세요.
    -   **기타 종목(기능) 분석:**
        -   **매우 중요:** 'recordType'이 'level'인 종목(예: 음악 줄넘기, 수영)은 **절대로 등수 정보를 사용하지 마세요.**
        -   'level' 종목은 오직 'value' 값으로만 강점/약점을 판단합니다.
            -   'value'가 1(상)이면 강점입니다. 이 경우, "[종목명] 수업에 잘 참여하여 높은 수준의 목표를 달성함" 과 같이 표현해주세요.
            -   'value'가 2(중)이면 보통입니다. 이 경우, 강점 또는 약점 항목에 포함시키지 말고, "[종목명] 수업에 참여하여 보통 수준의 목표를 달성함" 과 같이 별도로 서술할 수 있습니다. 하지만 주로 강점과 약점에 집중하세요.
            -   'value'가 3(하)이면 약점입니다. 이 경우, "[종목명] 수업의 목표에 도달하지 못함" 과 같이 표현해주세요.
        -   그 외의 기능 종목은 등수 정보를 활용하여 강점과 약점을 분석하세요.

3.  **훈련 방법 제안:**
    -   분석된 약점을 보완하고 전반적인 경기력을 향상시키기 위한 구체적이고 실행 가능한 훈련 방법을 제안하세요.

모든 답변은 한국어로, 항목당 한 문장으로 간결하게 작성해주세요.
`,
});

const analyzeStudentPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeStudentPerformanceFlow',
    inputSchema: AnalyzeStudentPerformanceInputSchema,
    outputSchema: AnalyzeStudentPerformanceOutputSchema,
  },
  async input => {
    const {output} = await analyzeStudentPerformancePrompt(input);
    return output!;
  }
);
