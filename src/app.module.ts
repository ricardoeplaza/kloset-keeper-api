import { Logger, Module } from '@nestjs/common';
import z from 'zod';

import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { DrizzleModule } from 'src/db/drizzle.module';

import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/guards/auth.guard';
import { ImagesModule } from './modules/images/images.module';
import { ItemsModule } from './modules/items/items.module';
import { LocationsModule } from './modules/locations/locations.module';
import { UsersModule } from './modules/users/users.module';
import { SystemModule } from './modules/system/system.module';
import { HttpExceptionFilter } from './infra/filters/http-exception.filter';
import { HealthController } from './infra/health/health.controller';

const logger = new Logger('AppModule');

const envSchema = z.object({
  DB_HOST: z.string().default('localhost'),
  DB_NAME: z.string().default('app_database'),
  DB_PASSWORD: z.string().default('secure_password'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('app_user'),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),

  IA_TASKS_ENABLED: z.coerce.boolean().default(true),
  IA_WORKER_BASE_URL: z.url().default('http://localhost:8000'),

  IMAGE_MAX_WIDTH: z.coerce.number().default(1920),
  IMAGE_THUMB_WIDTH: z.coerce.number().default(300),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  UPLOAD_DIRECTORY_LEVELS: z.coerce.number().int().default(2),
  UPLOAD_LOCATION: z.string().default('./media'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, validate: (config) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) {
          logger.error('Invalid environment variables:', z.treeifyError(parsed.error));
          throw new Error('Config validation failed');
        }
        return parsed.data;
      }
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
    }),
    TerminusModule,
    DrizzleModule,
    AuthModule,
    ImagesModule,
    ItemsModule,
    LocationsModule,
    UsersModule,
    SystemModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule { }
