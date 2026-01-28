import { Injectable, UnauthorizedException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  //

  // ! for login user
  async loginUser(payload: LoginDto) {
    const userData = await this.prisma.user.findUnique({
      where: { email: payload?.email },
    });

    if (!userData) {
      throw new UnauthorizedException('Invalid Email!!!');
    }

    const isPasswordMatch = await bcrypt.compare(
      payload?.password,
      userData?.password,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Wrong password!!!');
    }

    const tokenPayload = {
      email: payload?.email,
      userId: userData?.id,
      role: userData?.role,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '1h',
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };

    //
  }

  //
}
