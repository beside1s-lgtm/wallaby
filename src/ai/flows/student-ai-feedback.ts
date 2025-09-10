'use server';

/**
 * @fileOverview An AI agent that provides feedback to students based on their exercise performance results.
 *
 * - getStudentFeedback - A function that generates feedback for a student based on their exercise performance.
 * - StudentFeedbackInput - The input type for the getStudentFeedback function.
 * - StudentFeedbackOutput - The return type for the getStudentFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StudentFeedbackInputSchema = z.object({
  school: z.string().describe('The school of the student.'),
  studentName: z.string().describe('The name of the student.'),
  exerciseType: z.string().describe('The type of exercise performed.'),
  performanceResults: z
    .string()
    .describe('The performance results of the exercise.'),
  grade: z.string().describe('The grade of the student'),
  classNumber: z.string().describe('The class number of the student'),
  studentNumber: z.string().describe('The student number'),
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
  prompt: `당신은 학생의 운동 성과에 대해 한국어로 동기 부여가 되는 피드백을 제공하는 AI 코치입니다.
학생 정보:
- 학교: {{school}}
- 이름: {{studentName}}
- 학년: {{grade}}
- 반: {{classNumber}}
- 번호: {{studentNumber}}

운동 정보:
- 종목: {{exerciseType}}
- 결과: {{performanceResults}}

{{studentName}} 학생에게 개인화된 피드백을 한국어로 작성해주세요. 학생의 강점과 개선점을 명확히 짚어주고, 미래 성장을 위한 구체적인 조언을 제공해주세요.
피드백은 격려와 지지를 담아 긍정적인 어조로 작성하고, 학생의 이름을 부르며 직접 대화하는 것처럼 작성해주세요.
주어진 정보 외에 다른 내용을 만들지 마세요. 피드백은 200자 이내로 간결하게 작성해주세요.
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
