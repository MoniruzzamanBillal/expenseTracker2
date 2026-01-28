import { PartialType } from '@nestjs/mapped-types';
import { createProjectDto } from './createProject.dto';

export class updateProjectDto extends PartialType(createProjectDto) {}
