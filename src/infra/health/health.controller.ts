import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult, } from '@nestjs/terminus';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.checkDatabase(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.db.execute('SELECT 1');
      return {
        database: {
          status: 'up',
        },
      } as HealthIndicatorResult;
    } catch (error) {
      return {
        database: {
          status: 'down',
          message: error.message,
        },
      } as HealthIndicatorResult;
    }
  }
}
