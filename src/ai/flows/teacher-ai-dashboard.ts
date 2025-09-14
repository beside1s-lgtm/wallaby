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

const GradeDistributionSchema = z.record(z.string(), z.number().describe('The percentage of students for each grade (1-5).'));

const PapsAnalysisSchema = z.object({
  averageGrade: z.number().describe('The average PAPS grade for the group.'),
  lowPerformingPercentage: z.number().describe('The percentage of students in grades 4 and 5.'),
  gradeDistribution: GradeDistributionSchema.describe('The distribution of PAPS grades as percentages.'),
});

const ProgressAnalysisSchema = z.record(
    z.string(),
    z.number().describe('The average percentage point change in achievement for the item.')
).describe('Analysis of improvement in subjects with two or more records.');

const TeacherDashboardBriefingInputSchema = z.object({
  school: z.string().describe('The school for which the briefing is generated.'),
  totalStudentCount: z.number().describe('The total number of students with records.'),
  classInfo: z.object({ grade: z.string(), classNum: z.string() }).optional().describe('The class being analyzed, if applicable.'),
  paps: z.object({
      class: PapsAnalysisSchema.optional().describe('PAPS analysis for the specific class.'),
      grade: PapsAnalysisSchema.optional().describe('PAPS analysis for the entire grade level.'),
      overall: PapsAnalysisSchema.optional().describe('PAPS analysis for all students.'),
      byGradeLevel: z.record(z.string(), PapsAnalysisSchema).optional(),
      byItem: z.record(z.string(), z.object({ averageGrade: z.number() })).optional(),
  }).describe('A detailed analysis of PAPS performance.'),
  progress: ProgressAnalysisSchema.optional(),
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
  prompt: `당신은 {{school}}의 체육 선생님을 위한 AI 조수입니다. 학생들의 PAPS(학생건강체력평가) 데이터를 분석하여 종합 브리핑과 수업 조언을 한국어로 제공해주세요.

## 분석 데이터:
{{#if classInfo}}
### {{classInfo.grade}}학년 {{classInfo.classNum}}반 학급 브리핑
- 학급 평균 등급: {{paps.class.averageGrade}}등급 (학년 전체 평균: {{paps.grade.averageGrade}}등급)
- 학급 4, 5등급 학생 비율: {{paps.class.lowPerformingPercentage}}% (학년 전체: {{paps.grade.lowPerformingPercentage}}%)
- 학급 등급 분포: {{json paps.class.gradeDistribution}}
- 학년 전체 등급 분포: {{json paps.grade.gradeDistribution}}
{{else}}
### 전체 학생 브리핑
- 기록이 있는 총 학생 수: {{totalStudentCount}}명
- 전체 학생 PAPS 분석:
    - 평균 등급: {{paps.overall.averageGrade}}등급
    - 4, 5등급 학생 비율: {{paps.overall.lowPerformingPercentage}}%
    - 전체 등급 분포: {{json paps.overall.gradeDistribution}}
- 학년별 PAPS 분석:
    {{#each paps.byGradeLevel}}
    - {{@key}}학년:
        - 평균 등급: {{this.averageGrade}}등급
        - 4, 5등급 학생 비율: {{this.lowPerformingPercentage}}%
        - 등급 분포: {{json this.gradeDistribution}}
    {{/each}}
{{/if}}

{{#if paps.byItem}}
- 종목별 평균 등급 분석 (분석 대상 그룹 기준):
    {{#each paps.byItem}}
    - {{@key}}: {{this.averageGrade}}등급
    {{/each}}
{{/if}}
{{#if progress}}
- 주요 성장 종목 분석 (2회 이상 측정된 종목 대상, 평균 성취도 변화량):
    {{#each progress}}
    - {{@key}}: {{this}}%p 향상
    {{/each}}
{{/if}}

## 평가 기준:
- **전반적 수준:**
    - **우수한 편:** 전체 평균 등급 2.5 이하
    - **부족한 편:** 전체 4~5등급 학생 비율 10% 이상
    - **보통:** 그 외의 경우
- **종목별 수준 (평균 3등급 기준):**
    - **우수:** 평균 2.5등급 이하
    - **미흡:** 평균 3.5등급 이상
    - **보통:** 2.5등급 ~ 3.5등급 사이

## 결과 생성 가이드라인:
1.  **브리핑:**
    - **(학급 브리핑의 경우)** 먼저, 학급의 평균 등급과 4-5등급 비율을 **학년 전체와 비교하여** '우수한 편', '부족한 편', '보통' 중 하나로 전반적인 수준을 평가해주세요. (예: "우리 학급은 O학년 전체 평균(2.8등급)보다 높은 2.4등급으로 우수한 수준입니다.")
    - **(전체 브리핑의 경우)** 먼저, 전체 학생의 평균 등급과 4~5등급 비율을 바탕으로 '평가 기준'에 따라 '우수한 편', '부족한 편', '보통' 중 하나로 전반적인 수준을 평가해주세요. 그 다음, 학년별 분석 데이터를 참고하여 어떤 학년이 특히 우수하거나 부족한지 구체적으로 언급해주세요.
    {{#if paps.byItem}}
    - **종목별 분석:** 종목별 평균 등급을 바탕으로 '우수' 종목과 '미흡' 종목을 각각 선별하여 언급해주세요. (예: "특히, 50m 달리기는 평균 2.1등급으로 매우 우수하지만, 윗몸 말아올리기는 평균 3.8등급으로 보완이 필요합니다.")
    {{/if}}
    {{#if progress}}
    - **성장 분석:** 주요 성장 종목 분석 데이터를 바탕으로 어떤 종목에서 학생들이 가장 큰 성장을 보였는지 긍정적으로 언급해주세요.
    {{/if}}
    - 등급 분포 데이터를 인용하여 분석을 뒷받침하세요. (예: "전체적으로 1, 2등급 학생이 50%를 차지하여 우수한 편입니다.", "특히 5학년은 4, 5등급 학생 비율이 15%로 나타나 주의가 필요합니다.")
2.  **조언:**
    - '부족한 편'으로 평가된 학년/학급이나 '미흡'으로 평가된 종목에 대해 구체적인 체력 증진 프로그램을 제안해주세요. (예: '윗몸 말아올리기'가 미흡할 경우, 코어 근력 강화를 위한 플랭크, 레그레이즈 등 보강 운동 추천)
    - '보통'인 경우, 현재 수준을 유지하며 특정 등급대(예: 3등급) 학생들을 상위 등급으로 끌어올릴 수 있는 격려 및 지도 방안을 제안해주세요.
    - '우수한 편'인 경우, 학생들의 성과를 칭찬하고 현재의 높은 체력 수준을 유지하거나 심화할 수 있는 도전적인 활동(예: 새로운 스포츠 기술 배우기, 교내 리그)을 제안해주세요.

결과는 반드시 한국어로 작성하고, 각 항목을 1-2문장의 간결하고 명확한 문장으로 요약해주세요.
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
