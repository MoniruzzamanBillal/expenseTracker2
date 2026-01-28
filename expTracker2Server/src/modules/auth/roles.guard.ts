import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Request } from 'express';
import { UserRole } from 'src/generated/prisma/enums';
import { ROLES_KEY } from './decorators/roles.decorator';

export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

declare module 'express' {
  interface Request {
    user?: UserPayload;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role as UserRole)) {
      throw new UnauthorizedException('You have no access to this route');
    }

    return true;
  }
}
