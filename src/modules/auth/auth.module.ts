import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextInterceptor } from 'src/infra/interceptors/context.interceptor';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: 'SING_PASSWORD',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    AuthService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ContextInterceptor,
    }
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule { }