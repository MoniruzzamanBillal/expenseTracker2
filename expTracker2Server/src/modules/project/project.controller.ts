import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { createProjectDto } from './dto/createProject.dto';
import { ProjectService } from './project.service';

@Controller('project')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  // ! for creating new project
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Post('')
  async addProject(@Body() payload: createProjectDto) {
    const result = await this.projectService.addProject(payload);

    return {
      success: true,
      status: HttpStatus.CREATED,
      message: 'project created successfully!!!',
      data: result,
    };
  }

  //   ! for getting all projects
  @Get('')
  async getAllProject() {
    const result = await this.projectService.getAllProject();

    return {
      success: true,
      status: HttpStatus.OK,
      message: 'all project retrived successfully!!!',
      data: result,
    };
  }

  //   ! for getting single project
  @Get(':id')
  async getSingleProject(@Param('id') id: string) {
    const result = await this.projectService.getSingleProject(id);

    return {
      success: true,
      status: HttpStatus.OK,
      message: 'project retrived successfully!!!',
      data: result,
    };
  }

  //
}
