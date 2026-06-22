import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateStaffWithUserDto } from './dto/create-staff-with-user.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { UpdateTimeOffDto } from './dto/update-time-off.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/user-role.enum';

@ApiTags('Staff')
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // --- Perfiles ---

  @Get()
  @ApiOperation({ summary: 'Listar todos los perfiles de staff' })
  findAll() {
    return this.staffService.findAllProfiles();
  }

  @Get('me')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener mi perfil de staff (usuario autenticado)' })
  getMyProfile(@CurrentUser() user: { id: number; role: UserRole }) {
    return this.staffService.findProfileByUserId(user.id);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos los peluqueros, incluidos inactivos (solo ADMIN)' })
  findAllAdmin() {
    return this.staffService.findAllProfiles(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener perfil de staff por ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.findProfileById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear perfil de staff para un usuario STAFF existente (solo ADMIN)' })
  createProfile(@Body() dto: CreateStaffProfileDto) {
    return this.staffService.createProfile(dto);
  }

  @Post('with-account')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Alta de peluquero: crea el usuario STAFF y su perfil (solo ADMIN)' })
  createWithAccount(@Body() dto: CreateStaffWithUserDto) {
    return this.staffService.createStaffWithUser(dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activar/desactivar la cuenta del peluquero (solo ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffStatusDto) {
    return this.staffService.setActive(id, dto.isActive);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Actualizar perfil de staff (propio STAFF o ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffProfileDto,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.staffService.updateProfile(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar perfil de staff (solo ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProfile(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.removeProfile(id);
  }

  // --- Horarios laborales ---

  @Post(':id/working-hours')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Agregar horario laboral (propio STAFF o ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  addWorkingHours(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWorkingHoursDto,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.staffService.addWorkingHours(id, dto, user.id, user.role);
  }

  @Patch(':id/working-hours/:whId')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Actualizar horario laboral (propio STAFF o ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  @ApiParam({ name: 'whId', type: Number, description: 'ID del horario' })
  updateWorkingHours(
    @Param('id', ParseIntPipe) id: number,
    @Param('whId', ParseIntPipe) whId: number,
    @Body() dto: UpdateWorkingHoursDto,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.staffService.updateWorkingHours(id, whId, dto, user.id, user.role);
  }

  @Delete(':id/working-hours/:whId')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Eliminar horario laboral (propio STAFF o ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  @ApiParam({ name: 'whId', type: Number, description: 'ID del horario' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWorkingHours(
    @Param('id', ParseIntPipe) id: number,
    @Param('whId', ParseIntPipe) whId: number,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.staffService.removeWorkingHours(id, whId, user.id, user.role);
  }

  // --- Bloqueos de agenda (TimeOff) ---

  @Get(':id/time-off')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Listar bloqueos de agenda de un peluquero (STAFF/ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  listTimeOffs(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.listTimeOffs(id);
  }

  @Post(':id/time-off')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Crear bloqueo de agenda (propio STAFF o ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  createTimeOff(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTimeOffDto,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.staffService.createTimeOff(id, dto, user.id, user.role);
  }

  @Patch(':id/time-off/:toId')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Actualizar bloqueo de agenda (propio STAFF o ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  @ApiParam({ name: 'toId', type: Number, description: 'ID del bloqueo' })
  updateTimeOff(
    @Param('id', ParseIntPipe) id: number,
    @Param('toId', ParseIntPipe) toId: number,
    @Body() dto: UpdateTimeOffDto,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.staffService.updateTimeOff(id, toId, dto, user.id, user.role);
  }

  @Delete(':id/time-off/:toId')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Eliminar bloqueo de agenda (propio STAFF o ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del StaffProfile' })
  @ApiParam({ name: 'toId', type: Number, description: 'ID del bloqueo' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTimeOff(
    @Param('id', ParseIntPipe) id: number,
    @Param('toId', ParseIntPipe) toId: number,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.staffService.removeTimeOff(id, toId, user.id, user.role);
  }
}
