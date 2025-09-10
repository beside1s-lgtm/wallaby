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
  prompt: `You are an AI assistant for a physical education teacher. Your task is to analyze a student's strengths and weaknesses based on their performance data, and suggest training methods to improve their performance.

Student Name: {{{studentName}}}
Performance Data: {{{performanceData}}}

Analyze the student's performance data and provide the following:
- Strengths: Identify the student's strengths in various sports.
- Weaknesses: Identify the student's weaknesses in various sports.
- Suggested Training Methods: Suggest training methods to improve the student's overall performance, focusing on addressing their weaknesses.

Make sure the suggested training methods are concrete and actionable.
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
