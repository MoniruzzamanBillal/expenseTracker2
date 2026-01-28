import { Injectable } from '@nestjs/common';
import { AiClientService } from 'src/AiClient.service';

// model: "deepseek/deepseek-r1-0528:free",

@Injectable()
export class TransactionAiService {
  constructor(private openaiService: AiClientService) {}

  //

  // ! for chating
  async chat(prompt: string) {
    try {
      const response = await this.openaiService.client.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          {
            role: 'system',
            content:
              'Format responses using Markdown with headings, lists, and code blocks',
          },
          { role: 'user', content: prompt },
        ],
      });

      return response.choices[0].message?.content;
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  // ! for managing money
  async moneyManagement(prompt: string) {
    try {
      const response = await this.openaiService.client.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          {
            role: 'system',
            content: `
You are an AI that extracts money transactions from text.

Rules:
- A single text may contain MULTIPLE income and expense entries
- Return an ARRAY of objects
- Each object must represent ONE transaction
- Return ONLY valid JSON
- No explanation, no markdown, no extra text

JSON format:
[
  {
    "type": "income | expense",
    "amount": number,
    "title": string,
    "description": string
  }
]

Text:
"${prompt}"
`,
          },
          {
            role: 'user',
            content: `
Text:
"${prompt}"
`,
          },
        ],
      });

      console.log('response = ', response.choices[0].message);

      return response.choices[0].message?.content;
    } catch (error) {
      console.log('error = ', error);
      throw new Error(error);
    }
  }

  //
}
