import { Injectable } from '@nestjs/common';
import { AiClientService } from 'src/AiClient.service';

// model: "deepseek/deepseek-r1-0528:free",

@Injectable()
export class AiIntegrationService {
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

  //
}
