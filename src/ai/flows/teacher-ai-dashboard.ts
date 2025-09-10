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
  averageMeasurements: z
    .record(z.number())
    .describe(
      'A record of average measurement results for all students, where keys are the measurement types and values are the average scores.'
    ),
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
  prompt: `You are an AI assistant providing insights and advice to a physical education teacher for {{school}} based on the average measurement results of their students.

  Analyze the following average measurement data and provide a briefing summarizing the overall student performance. Also provide specific advice to the teacher on how to improve student performance based on these averages.

  Average Measurements: {{{averageMeasurements}}}

  Briefing:
  Advice: `,
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