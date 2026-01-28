import { Body, Controller, Post } from '@nestjs/common';
import { AiIntegrationService } from './ai-integration.service';

@Controller('ai-integration')
export class AiIntegrationController {
  constructor(private readonly aiIntegrationService: AiIntegrationService) {}

  //

  @Post('chat')
  async chat(@Body() payload: { prompt: string }) {
    return {
      reply: await this.aiIntegrationService.chat(payload?.prompt),
    };
  }

  //
}
