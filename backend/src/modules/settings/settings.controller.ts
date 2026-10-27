import { Body, Controller, Get, Put, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Settings, Branding, Public Site & Global Search')
@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public/home')
  @ApiOperation({ summary: 'Get public marketing website data (branding, courses, faculty, announcements)' })
  getPublicData() {
    return this.settingsService.getPublicWebsiteData();
  }

  @Public()
  @Post('public/enquiry')
  @ApiOperation({ summary: 'Submit admission/course enquiry from public website' })
  submitEnquiry(@Body() dto: any) {
    return this.settingsService.submitPublicEnquiry(dto);
  }

  @ApiBearerAuth()
  @Get('settings')
  @ApiOperation({ summary: 'Get system settings and branding configuration' })
  getSettings() {
    return this.settingsService.getAllSettings();
  }

  @Public()
  @Get('settings/branding')
  @ApiOperation({ summary: 'Get coaching center branding configuration' })
  getBranding() {
    return this.settingsService.getBranding();
  }

  @ApiBearerAuth()
  @Put('settings')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update a system or branding setting' })
  updateSetting(
    @Body() body: { key: string; value: any; category?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateSetting(body.key, body.value, body.category, user);
  }

  @ApiBearerAuth()
  @Get('search')
  @ApiOperation({ summary: 'Global debounced search across authorized entities' })
  globalSearch(@Query('q') q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.globalSearch(q, user);
  }
}
