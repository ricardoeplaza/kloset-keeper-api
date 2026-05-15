import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Public } from 'src/infra/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guards';
import { SystemService } from './system.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) { }

  @Public()
  @Get('config')
  async getConfig() {
    return this.systemService.getBootstrapConfig();
  }

  @Public()
  @Post('setup')
  async initialize(@Body() dto: CreateUserDto) {
    return this.systemService.runInitialSetup(dto);
  }

  @Post('setup/categories')
  @UseGuards(AdminGuard)
  async initializeCategories() {
    return await this.systemService.syncCategories();
  }
}
