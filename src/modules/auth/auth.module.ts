import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextInterceptor } from 'src/infra/interceptors/context.interceptor';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
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