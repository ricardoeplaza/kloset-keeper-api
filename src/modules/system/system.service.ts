import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { COLOR_GROUPS } from 'src/common/constants/color-map.constants';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { SystemSetupService } from './system-setup.service';

/**
 * Service to manage the general state and configuration of the system.
 */
@Injectable()
export class SystemService {
  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    private readonly usersService: UsersService,
    private readonly setupService: SystemSetupService,
  ) { }

  /**
   * Generates the configuration required by the frontend to initialize the app.
   * Based on Immich's architecture.
   */
  async getBootstrapConfig() {
    const isInitialized = !(await this.usersService.isFirstRun());
    const categoriesList = await this._db.query.categories.findMany();

    return {
      isInitialized, // True if the admin user exists
      version: '1.0.0',
      uiConfig: {
        categories: categoriesList.map(c => (c.name)),
        supportedColors: COLOR_GROUPS.map((color) => color.name),
      }
    };
  }

  /**
   * Handles the manual initial setup (Admin creation and system sync).
   */
  async runInitialSetup(createUserDto: CreateUserDto) {
    const isInitialized = !(await this.usersService.isFirstRun());

    if (isInitialized) {
      throw new ForbiddenException('Setup already completed. Use admin panel to create users.');
    }

    // 1. Create user. The first user alwais is Admin
    const admin = await this.usersService.create({
      ...createUserDto,
      isAdmin: true,
    });

    // 2. Trigger category synchronization (just in case)
    await this.setupService.initializeCategories();

    return admin;
  }

  /**
 * Orchestrates the synchronization of categories.
 * This is the bridge between the administrative controller and the setup logic.
 */
  async syncCategories() {
    // We can add extra checks here, like maintenance mode flags
    const result = await this.setupService.initializeCategories();

    return {
      message: 'Category synchronization completed',
      ...result
    };
  }
}