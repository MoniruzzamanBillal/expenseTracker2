import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { createProjectDto } from './dto/createProject.dto';
import { updateProjectDto } from './dto/updateProject.dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  // ! for adding new project
  async addProject(payload: createProjectDto) {
    const result = await this.prisma.project.create({ data: payload });

    return result;
  }

  // ! for getting all project
  async getAllProject() {
    const result = await this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return result;
  }

  // ! for getting single project
  async getSingleProject(id: string) {
    const result = await this.prisma.project.findUnique({ where: { id } });

    if (!result) {
      throw new NotFoundException("This project don't exist!!!");
    }

    return result;
  }

  // ! for updating project
  async updateProject(id: string, payload: updateProjectDto) {
    const projectData = await this.prisma.project.findUnique({ where: { id } });

    if (!projectData) {
      throw new NotFoundException('Project not found!!!');
    }

    const result = await this.prisma.project.update({
      where: { id },
      data: { ...payload },
    });

    return result;
  }

  //
}
