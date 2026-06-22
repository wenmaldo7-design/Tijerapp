import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Health check — verifica que el servidor está corriendo' })
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
