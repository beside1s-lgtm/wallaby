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
  prompt: `You are an AI assistant providing feedback to a student named {{studentName}} in grade {{grade}}, class {{classNumber}}, and number {{studentNumber}} based on their exercise performance.

  Exercise Type: {{exerciseType}}
  Performance Results: {{performanceResults}}

  Provide personalized feedback to the student, highlighting their strengths and areas for improvement. Offer specific suggestions for how they can improve their performance in the future. Be encouraging and supportive in your feedback.
  Address the student directly, using their name.
  Do not make up information about the student, only use the information provided to you.
  The feedback should be no more than 200 words.
  Ensure the feedback is in Korean.
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
