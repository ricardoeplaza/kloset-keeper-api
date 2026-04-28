import { Module } from '@nestjs/common';
import { SystemCategoriesService } from './system-categories.service';
import { SystemSetupService } from './system-setup.service';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';

@Module({
  controllers: [SystemController],
  providers: [SystemService, SystemSetupService, SystemCategoriesService, AuthService, UsersService],
})
export class SystemModule { }
