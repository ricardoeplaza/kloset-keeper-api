import { Module } from '@nestjs/common';
import { SystemSetupService } from './system-setup.service';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemCategoriesService } from './system-categories.service';
import { UsersService } from '../users/users.service';

@Module({
  controllers: [SystemController],
  providers: [SystemService, SystemSetupService, SystemCategoriesService, UsersService],
})
export class SystemModule {}
