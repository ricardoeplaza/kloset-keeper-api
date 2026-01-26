import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from 'src/db/drizzle.module';
import { ItemsModule } from 'src/modules/items/items.module';
import { LocationsModule } from 'src/modules/locations/locations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    DrizzleModule,
    ItemsModule,
    LocationsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
