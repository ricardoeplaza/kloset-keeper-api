import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from 'src/db/drizzle.module';
import { LocationsModule } from 'src/modules/locations/locations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    DrizzleModule,
    LocationsModule  
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
