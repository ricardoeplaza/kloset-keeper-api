import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Public } from 'src/infra/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guards';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(AdminGuard)
  @Post()
  async create(@Body() createUserDto: CreateUserDto, @Req() req: Request) {
    if (!req['user'].isAdmin) {
      throw new ForbiddenException('Only admins can create users');
    }
    return this.usersService.create(createUserDto);
  }

  @UseGuards(AdminGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findByEmail(id);
  }

  @Patch()
  updateme(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateme(updateUserDto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
