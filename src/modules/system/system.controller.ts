import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Public } from 'src/infra/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guards';
import { SystemService } from './system.service';

/**
 * Controller to expose system-wide configuration and initialization status.
 */
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) { }

  /**
   * Public endpoint to get server status and frontend configuration.
   */
  @Public()
  @Get('config')
  async getConfig() {
    return this.systemService.getBootstrapConfig();
  }

  /**
   * Public endpoint to perform the first-time setup.
   */
  @Public()
  @Post('setup')
  async initialize(@Body() dto: any) {
    return this.systemService.runInitialSetup(dto);
  }

  /**
   * Manually triggers the synchronization of garment categories with the AI Worker.
   * This should be called when WEAR_CATEGORIES constants are updated.
   * * @returns A summary of the synchronization process.
   */
  @Post('setup/categories')
  @UseGuards(AdminGuard) // Restricts access to administrators only
  async initializeCategories() {
    return await this.systemService.syncCategories();
  }
}