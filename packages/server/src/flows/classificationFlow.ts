import { ai } from '../genkit.js';
import * as z from 'zod';
import { gpt4oMini } from 'genkitx-openai';

export const ClassificationFlow = ai.defineFlow(
    {
        name: "ClassificationFlow",
        inputSchema: z.object({
            userInput: z.string()
        })
    },
    async (input: { userInput: string }) => {

        try 
        {
            const prompt = ai.prompt("classification");
            const rendered_prompt = await prompt.render({
                userInput: input.userInput,
            })

            const answer = await ai.generate({
                ...rendered_prompt,
                model: gpt4oMini,
            });

            return answer;
        }
        catch (error) {
            return 'Error generating classification.'; 
        }
    }
)