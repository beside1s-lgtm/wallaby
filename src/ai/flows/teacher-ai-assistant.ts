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
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `당신은 {{school}}의 체육 교사를 위한 AI 조수입니다. 학생의 경기력 데이터를 바탕으로 강점과 약점을 분석하고, 경기력 향상을 위한 훈련 방법을 제안하는 임무를 맡고 있습니다. 답변은 아주 간략하게 핵심만 요약해주세요.

학생 이름: {{{studentName}}}
경기력 데이터: {{{performanceData}}}
종목별 등수: {{json ranks}}

경기력 데이터에는 'recordType' 필드가 포함되어 있으며, 이는 기록의 유형을 나타냅니다:
- 'time': 기록이 짧을수록 좋습니다(예: 달리기).
- 'distance': 기록이 길수록 좋습니다(예: 멀리뛰기).
- 'count': 기록이 많을수록 좋습니다(예: 윗몸 일으키기).

학생의 경기력 데이터와 등수 정보를 분석하여 다음을 한국어로 제공하세요:
- 강점: 학생의 다양한 스포츠에서의 강점을 파악하세요. 등수 정보를 참고하여 학생의 뛰어난 점을 강조하세요. (예: 50m 달리기 1등)
- 약점: 학생의 다양한 스포츠에서의 약점을 파악하세요. 등수 정보를 참고하여 상대적으로 개선이 필요한 부분을 지적하세요. (예: 윗몸 일으키기 15등)
- 추천 훈련 방법: 약점을 보완하고 전반적인 경기력을 향상시키기 위한 구체적이고 실행 가능한 훈련 방법을 제안하세요.

제안된 훈련 방법은 구체적이고 실행 가능해야 합니다. 모든 답변은 한국어로, 항목당 한 문장으로 간결하게 작성해주세요.
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
