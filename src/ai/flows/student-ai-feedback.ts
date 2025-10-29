'use server';

/**
 * @fileOverview An AI agent that provides feedback to students based on their exercise performance results.
 *
 * - getStudentFeedback - A function that generates feedback for a student based on their exercise performance.
 * - StudentFeedbackInput - The input type for the getStudentFeedback function.
 * - StudentFeedbackOutput - The return type for the getStudentFeedback function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'zod';

const StudentFeedbackInputSchema = z.object({
  school: z.string().describe('The school of the student.'),
  studentName: z.string().describe('The name of the student.'),
  exerciseType: z.string().describe('The type of exercise performed.'),
  performanceResults: z
    .string()
    .describe('The performance results of the exercise.'),
  grade: z.string().describe('The grade of the student'),
  classNumber: z.string().describe('The class number of the student'),
  studentNumber: z.string().describe('The student number of the student'),
  gender: z.enum(['남', '여']).describe('The gender of the student'),
  ranks: z.record(z.string()).describe('A record of the student\'s rank for each measurement type.'),
});
export type StudentFeedbackInput = z.infer<typeof StudentFeedbackInputSchema>;

const StudentFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The AI-generated feedback for the student.'),
});
export type StudentFeedbackOutput = z.infer<typeof StudentFeedbackOutputSchema>;

export async function getStudentFeedback(input: StudentFeedbackInput): Promise<StudentFeedbackOutput> {
  return studentFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'studentFeedbackPrompt',
  input: {schema: StudentFeedbackInputSchema},
  output: {schema: StudentFeedbackOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `당신은 학생의 운동 성과에 대해 한국어로 동기 부여가 되는 피드백을 제공하는 AI 코치입니다.

학생 정보:
- 학교: {{school}}
- 이름: {{studentName}}
- 학년: {{grade}}
- 반: {{classNumber}}
- 번호: {{studentNumber}}
- 성별: {{gender}}

운동 정보:
- 종목: {{exerciseType}}
- 결과: {{performanceResults}}
- 종목별 등수: {{json ranks}}

주어진 학생의 기록과 등수 정보를 아래의 학생건강체력평가(PAPS) 기준표와 비교하여 학생의 현재 수준을 평가하고, 개인화된 피드백을 한국어로 작성해주세요.

## 학생건강체력평가(PAPS) 기준표 (초등학교)
| 종목 | 성별 | 1등급 | 2등급 | 3등급 | 4등급 | 5등급 |
|---|---|---|---|---|---|---|
| 50m 달리기 (초) | 남 | <= 8.3 | <= 8.9 | <= 9.5 | <= 10.1 | > 10.1 |
| | 여 | <= 8.8 | <= 9.4 | <= 10.0 | <= 10.6 | > 10.6 |
| 윗몸 일으키기 (회/분) | 남 | >= 45 | >= 38 | >= 30 | >= 23 | < 23 |
| | 여 | >= 38 | >= 31 | >= 24 | >= 17 | < 17 |
| 제자리 멀리뛰기 (cm) | 남 | >= 200 | >= 180 | >= 160 | >= 140 | < 140 |
| | 여 | >= 180 | >= 160 | >= 140 | >= 120 | < 120 |
| 오래달리기 (초) | 남 | <= 200 | <= 220 | <= 240 | <= 260 | > 260 |
| | 여 | <= 230 | <= 250 | <= 270 | <= 290 | > 290 |
* 참고: 달리기와 오래달리기는 수치가 낮을수록 등급이 높고, 나머지는 높을수록 등급이 높습니다.

피드백 작성 가이드라인:
1.  PAPS 기준표를 바탕으로 학생의 기록이 몇 등급에 해당하는지 분석해주세요.
2.  학생의 강점과 개선점을 등급과 함께 명확히 짚어주세요. 등수 정보를 활용하여 현재 위치를 알려주세요. (예: "50m 달리기는 1등급으로, 전체 학생 중 3등을 차지할 만큼 아주 빨라!")
3.  미래 성장을 위한 구체적인 조언을 제공해주세요.
4.  피드백은 격려와 지지를 담아 긍정적인 어조로 작성하고, 학생의 이름을 부르며 직접 대화하는 것처럼 작성해주세요.
5.  주어진 정보 외에 다른 내용을 만들지 마세요. 피드백은 200자 이내로 간결하게 작성해주세요.
`,
});

const studentFeedbackFlow = ai.defineFlow(
  {
    name: 'studentFeedbackFlow',
    inputSchema: StudentFeedbackInputSchema,
    outputSchema: StudentFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
