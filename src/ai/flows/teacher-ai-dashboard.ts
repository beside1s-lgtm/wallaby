'use server';

/**
 * @fileOverview This file defines a Genkit flow for providing AI-powered
 * insights and advice to teachers based on the average measurement results
 * of their students.
 *
 * - getTeacherDashboardBriefing - A function that generates a briefing for the teacher's dashboard.
 * - TeacherDashboardBriefingInput - The input type for the getTeacherDashboardBriefing function.
 * - TeacherDashboardBriefingOutput - The return type for the getTeacherDashboardBriefing function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TeacherDashboardBriefingInputSchema = z.object({
  school: z.string().describe('The school for which the briefing is generated.'),
  performanceInsights: z
    .record(z.object({
        type: z.enum(['grade', 'percentage']),
        value: z.number()
    }))
    .describe(
      'A record of performance insights. Keys are measurement types. Values indicate average grade for PAPS items or average achievement percentage for non-PAPS items.'
    ),
   totalStudentCount: z.number().describe('The total number of students with records.'),
   studentRankings: z.record(z.object({
       rank: z.number(),
       total: z.number()
   })).describe('An object containing the rank of the student for each measurement type.')
});
export type TeacherDashboardBriefingInput = z.infer<
  typeof TeacherDashboardBriefingInputSchema
>;

const TeacherDashboardBriefingOutputSchema = z.object({
  briefing: z.string().describe('A summary of the average student performance.'),
  advice: z
    .string()
    .describe(
      'Specific advice for the teacher on how to improve student performance based on the averages.'
    ),
});
export type TeacherDashboardBriefingOutput = z.infer<
  typeof TeacherDashboardBriefingOutputSchema
>;

export async function getTeacherDashboardBriefing(
  input: TeacherDashboardBriefingInput
): Promise<TeacherDashboardBriefingOutput> {
  return teacherDashboardBriefingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'teacherDashboardBriefingPrompt',
  input: {schema: TeacherDashboardBriefingInputSchema},
  output: {schema: TeacherDashboardBriefingOutputSchema},
  prompt: `당신은 {{school}}의 체육 선생님을 위한 AI 조수입니다. 학생들의 평균 데이터를 분석하여 종합 브리핑과 수업 조언을 한국어로 제공해주세요.

분석 데이터:
- 전체 학생 평균 성취도: {{json performanceInsights}} (PAPS 종목은 평균 등급, 그 외는 평균 목표 달성률(%) 입니다. 등급은 1등급이 가장 높습니다.)
- 기록이 있는 총 학생 수: {{totalStudentCount}}
{{#if studentRankings}}- 조회 학생의 종목별 등수: {{json studentRankings}}{{/if}}

결과 형식:
- 브리핑: 전체 학생들의 평균적인 강점과 약점을 요약합니다. {{#if studentRankings}}조회된 학생의 등수 정보를 포함하여 현재 위치를 알려주세요.{{/if}}
- 조언: 분석 결과를 바탕으로 학생들의 성과를 향상시킬 수 있는 구체적이고 실행 가능한 수업 전략이나 활동을 제안합니다.

결과는 반드시 한국어로 작성해주세요. 결과를 각 1-2문장으로 요약하여 간결하게 작성해주세요.
`,
});

const teacherDashboardBriefingFlow = ai.defineFlow(
  {
    name: 'teacherDashboardBriefingFlow',
    inputSchema: TeacherDashboardBriefingInputSchema,
    outputSchema: TeacherDashboardBriefingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
return output!;
  }
);
