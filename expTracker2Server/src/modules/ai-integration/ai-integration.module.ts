import { Module } from '@nestjs/common';
import { AiClientService } from 'src/AiClient.service';
import { AiIntegrationController } from './ai-integration.controller';
import { AiIntegrationService } from './ai-integration.service';

@Module({
  controllers: [AiIntegrationController],
  providers: [AiIntegrationService, AiClientService],
})
export class AiIntegrationModule {}
