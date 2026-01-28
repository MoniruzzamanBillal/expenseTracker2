import { Module } from '@nestjs/common';

import { ProjectController } from './project.controller';

import { PrismaService } from 'src/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectService } from './project.service';

@Module({
  imports: [AuthModule],
  providers: [ProjectService, PrismaService],
  controllers: [ProjectController],
})
export class ProjectModule {}
