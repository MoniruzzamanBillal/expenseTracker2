import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma.service';
import { CreateUserDto } from './dto/create.user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  //  ! for creating a new user
  async createUser(payload: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(payload?.password, 10);

    const result = await this.prisma.user.create({
      data: { ...payload, password: hashedPassword },
    });
    return result;
  }

  // ! for getting new user
  async getAllUser() {
    const result = await this.prisma.user.findMany();
    return result;
  }

  // ! for getting single user data
  async getSingleData(id: string) {
    const result = await this.prisma.user.findUnique({ where: { id } });

    if (!result) {
      throw new NotFoundException("User don't exist!!!");
    }

    return result;
  }

  //
}
