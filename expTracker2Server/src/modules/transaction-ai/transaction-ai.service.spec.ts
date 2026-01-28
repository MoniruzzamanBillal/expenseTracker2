import { Test, TestingModule } from '@nestjs/testing';
import { TransactionAiService } from './transaction-ai.service';

describe('TransactionAiService', () => {
  let service: TransactionAiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionAiService],
    }).compile();

    service = module.get<TransactionAiService>(TransactionAiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
