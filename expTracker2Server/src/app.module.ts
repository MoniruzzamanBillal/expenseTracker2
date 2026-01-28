import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { UserModule } from './modules/user/user.module';
import { ProductModule } from './modules/product/product.module';
import { AiIntegrationModule } from './modules/ai-integration/ai-integration.module';
import { TransactionAiModule } from './modules/transaction-ai/transaction-ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserModule,
    AuthModule,
    ProjectModule,
    ProductModule,
    AiIntegrationModule,
    TransactionAiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
