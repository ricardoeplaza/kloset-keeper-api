import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // Strip properties that do not have any decorators in the DTO
    forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
    transform: true,            // Automatically transform payloads to be objects typed according to their DTO classes
  }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
