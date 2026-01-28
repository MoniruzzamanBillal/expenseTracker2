import { Body, Controller, Get, HttpStatus, Param, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create.user.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  //  ! for creating new user
  @Post('')
  async createNewUser(@Body() payload: CreateUserDto) {
    const result = await this.userService.createUser(payload);

    return {
      success: true,
      status: HttpStatus.CREATED,
      message: 'user created successfully!!!',
      data: result,
    };
  }

  // ! for getting all users
  @Get('')
  async getAllUser() {
    const result = await this.userService.getAllUser();

    return {
      success: true,
      status: HttpStatus.OK,
      message: 'all users retrived successfully!!!',
      data: result,
    };
  }

  // ! for getting single user data
  @Get(':id')
  async getSingleUser(@Param('id') id: string) {
    const result = await this.userService.getSingleData(id);

    return {
      success: true,
      status: HttpStatus.OK,
      message: 'user retrived successfully!!!',
      data: result,
    };
  }

  //
}
