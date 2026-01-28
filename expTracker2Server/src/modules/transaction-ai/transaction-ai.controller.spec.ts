import { Test, TestingModule } from '@nestjs/testing';
import { TransactionAiController } from './transaction-ai.controller';

describe('TransactionAiController', () => {
  let controller: TransactionAiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionAiController],
    }).compile();

    controller = module.get<TransactionAiController>(TransactionAiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
