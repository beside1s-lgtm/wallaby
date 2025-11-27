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
  performanceData: z.string().describe('The student PAPS performance data. Represented as a JSON string.'),
  ranks: z.record(z.string()).describe("A record of the student's rank for each PAPS measurement type."),
});
export type AnalyzeStudentPerformanceInput = z.infer<
  typeof AnalyzeStudentPerformanceInputSchema
>;

const AnalyzeStudentPerformanceOutputSchema = z.object({
  strengths: z.string().describe("The student's strengths in PAPS sports."),
  weaknesses: z.string().describe("The student's weaknesses in PAPS sports."),
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
  prompt: `당신은 {{school}}의 체육 교사를 위한 AI 조수입니다. 학생의 PAPS(학생건강체력평가) 기록만을 바탕으로 강점과 약점을 분석하고, 경기력 향상을 위한 훈련 방법을 제안하는 임무를 맡고 있습니다. 답변은 아주 간략하게 핵심만 요약해주세요.

학생 이름: {{{studentName}}}
PAPS 기록: {{{performanceData}}}
PAPS 종목별 등수: {{json ranks}}

## 분석 가이드라인
1.  **강점 및 약점 분석:**
    -   'performanceData'와 'ranks' 정보를 종합하여, 다른 학생들과 비교했을 때 상대적으로 뛰어난 종목(강점)과 부진한 종목(약점)을 찾아내세요.
    -   등수 정보를 분석의 핵심 근거로 사용하세요.
    -   만약 분석할 만한 뚜렷한 강점이 없다면, '강점' 필드에 '특별한 강점은 발견되지 않음' 이라고 솔직하게 작성하세요.

2.  **훈련 방법 제안:**
    -   분석된 '약점'을 보완하고 전반적인 체력을 향상시키기 위한 구체적이고 실행 가능한 훈련 방법을 제안하세요.

모든 답변은 한국어로, 항목당 한 문장으로 간결하게 작성해주세요.
`,
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const analyzeStudentPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeStudentPerformanceFlow',
    inputSchema: AnalyzeStudentPerformanceInputSchema,
    outputSchema: AnalyzeStudentPerformanceOutputSchema,
  },
  async input => {
    await delay(5000);
    const {output} = await analyzeStudentPerformancePrompt(input);
    return output!;
  }
);
