import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  // The model property is now set within each prompt definition
  // model: 'googleai/gemini-3.0-flash-latest', 
});
