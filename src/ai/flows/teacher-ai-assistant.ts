'use server';

/**
 * @fileOverview Provides AI-driven analysis of a student's strengths and weaknesses, along with suggested training methods.
 *
 * - analyzeStudentPerformance - A function that analyzes student performance and suggests training methods.
 * - AnalyzeStudentPerformanceInput - The input type for the analyzeStudentPerformance function.
 * - AnalyzeStudentPerformanceOutput - The return type for the analyzeStudentPerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeStudentPerformanceInputSchema = z.object({
  school: z.string().describe('The school of the student.'),
  studentName: z.string().describe('The name of the student to analyze.'),
  performanceData: z.string().describe('The student performance data in all sports. Represented as a JSON string.'),
});
export type AnalyzeStudentPerformanceInput = z.infer<
  typeof AnalyzeStudentPerformanceInputSchema
>;

const AnalyzeStudentPerformanceOutputSchema = z.object({
  strengths: z.string().describe('The student\'s strengths in sports.'),
  weaknesses: z.string().describe('The student\'s weaknesses in sports.'),
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
  prompt: `당신은 {{school}}의 체육 교사를 위한 AI 조수입니다. 학생의 경기력 데이터를 바탕으로 강점과 약점을 분석하고, 경기력 향상을 위한 훈련 방법을 제안하는 임무를 맡고 있습니다.

학생 이름: {{{studentName}}}
경기력 데이터: {{{performanceData}}}

경기력 데이터에는 'recordType' 필드가 포함되어 있으며, 이는 기록의 유형을 나타냅니다:
- 'time': 기록이 짧을수록 좋습니다(예: 달리기).
- 'distance': 기록이 길수록 좋습니다(예: 멀리뛰기).
- 'count': 기록이 많을수록 좋습니다(예: 윗몸 일으키기).

학생의 경기력 데이터를 분석하여 다음을 한국어로 제공하세요:
- 강점: 학생의 다양한 스포츠에서의 강점을 파악하세요.
- 약점: 학생의 다양한 스포츠에서의 약점을 파악하세요.
- 추천 훈련 방법: 약점을 보완하고 전반적인 경기력을 향상시키기 위한 구체적이고 실행 가능한 훈련 방법을 제안하세요.

제안된 훈련 방법은 구체적이고 실행 가능해야 합니다. 모든 답변은 한국어로 작성해주세요.
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
