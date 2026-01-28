import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiClientService {
  public client: OpenAI;

  constructor() {
    console.log(process.env.OPENROUTER_API_KEY);

    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
}
