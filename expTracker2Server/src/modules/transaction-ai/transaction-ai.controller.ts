import { Body, Controller, Post } from '@nestjs/common';
import { TransactionAiService } from './transaction-ai.service';

@Controller('transaction-ai')
export class TransactionAiController {
  constructor(private transactionService: TransactionAiService) {}

  //

  @Post('chat')
  async chat(@Body() payload: { prompt: string }) {
    return {
      reply: await this.transactionService.chat(payload?.prompt),
    };
  }

  // ! for money management
  @Post('manage-money')
  async moneyManagement(@Body() payload: { prompt: string }) {
    return {
      reply: await this.transactionService.moneyManagement(payload?.prompt),
    };
  }

  //
}
