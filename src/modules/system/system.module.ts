import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SystemCategoriesService } from './system-categories.service';
import { SystemSetupService } from './system-setup.service';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemRepository } from './repositories/system.repository';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [SystemController],
  providers: [SystemService, SystemSetupService, SystemCategoriesService, SystemRepository],
})
export class SystemModule { }

