import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from 'src/db/drizzle.module';
import { ItemsModule } from 'src/modules/items/items.module';
import { LocationsModule } from 'src/modules/locations/locations.module';
import z from 'zod';

// Define the schema for your environment variables
const envSchema = z.object({
  // Database Configuration
  DB_HOST: z.string().default('localhost'),
  DB_NAME: z.string().default('app_database'),
  DB_PASSWORD: z.string().default('secure_password'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('app_user'),
  
  // AI Service Integration
  IA_TASKS_ENABLED: z.coerce.boolean().default(true),
  IA_WORKER_BASE_URL: z.url().default('http://localhost:8000'),
  
  // Image Processing (Clothing Manager API)
  IMAGE_MAX_WIDTH: z.coerce.number().default(1920),
  IMAGE_THUMB_WIDTH: z.coerce.number().default(300),
  THUMB_WIDTH: z.coerce.number().default(300),
  
  // Storage & Redis
  REDIS_HOST: z.string().default('localhost:6379'),
  UPLOAD_DIRECTORY_LEVELS: z.coerce.number().int().default(2),
  UPLOAD_LOCATION: z.string().default('./media')
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, validate: (config) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) {
          console.error('Invalid environment variables:', z.treeifyError(parsed.error));
          throw new Error('Config validation failed');
        }
        return parsed.data;
      }
    }),
    BullModule.forRoot({ connection: { host: '192.168.14.230', port: 6379, }, }),
    DrizzleModule,
    ItemsModule,
    LocationsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
