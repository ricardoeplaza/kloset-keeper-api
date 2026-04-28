import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { COLOR_GROUPS } from 'src/common/constants/color-map.constants';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { SystemSetupService } from './system-setup.service';
import { AuthService } from '../auth/auth.service';
import { access } from 'fs';

/**
 * Service to manage the general state and configuration of the system.
 */
@Injectable()
export class SystemService {
  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    private readonly authService: AuthService,
    private readonly setupService: SystemSetupService,
    private readonly usersService: UsersService,
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

    // 1. Create user. The first user always is Admin
    const admin = await this.usersService.create({
      ...createUserDto,
      isAdmin: true,
    });

    // 2. Autologin
    const login_token = await this.authService.generateToken(admin)

    // 3. Trigger category synchronization (just in case)
    await this.setupService.initializeCategories();

    return {...admin, access_token: login_token.access_token };
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