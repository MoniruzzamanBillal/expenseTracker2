import { Module } from '@nestjs/common';
import { AiClientService } from 'src/AiClient.service';
import { AuthModule } from '../auth/auth.module';
import { TransactionAiController } from './transaction-ai.controller';
import { TransactionAiService } from './transaction-ai.service';

@Module({
  imports: [AuthModule],
  providers: [TransactionAiService, AiClientService],
  controllers: [TransactionAiController],
})
export class TransactionAiModule {}
