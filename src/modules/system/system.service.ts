import { ForbiddenException, Injectable } from '@nestjs/common';
import { COLOR_GROUPS } from 'src/common/constants/color-map.constants';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { SystemSetupService } from './system-setup.service';
import { AuthService } from '../auth/auth.service';
import { SystemRepository } from './repositories/system.repository';

/**
 * Service to manage the general state and configuration of the system.
 */
@Injectable()
export class SystemService {
  constructor(
    private readonly systemRepository: SystemRepository,
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
    const categoriesList = await this.systemRepository.findAllCategories();

    return {
      isInitialized,
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

    const admin = await this.usersService.create({
      ...createUserDto,
      isAdmin: true,
    });

    const login_token = await this.authService.generateToken(admin);

    await this.setupService.initializeCategories();

    return {...admin, access_token: login_token.access_token };
  }

  /**
   * Orchestrates the synchronization of categories.
   */
  async syncCategories() {
    const result = await this.setupService.initializeCategories();

    return {
      message: 'Category synchronization completed',
      ...result
    };
  }
}
