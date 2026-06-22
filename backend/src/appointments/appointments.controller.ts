import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';
import { AdminAppointmentsQueryDto } from './dto/admin-appointments-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/user-role.enum';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un turno',
    description:
      'El cliente autenticado reserva un turno. ' +
      'Valida horario laboral, bloqueos de TimeOff y solapamiento con turnos activos. ' +
      'Devuelve 409 si el horario ya está ocupado.',
  })
  createAppointment(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.appointmentsService.createAppointment(user.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Listar todos los turnos (ADMIN/STAFF)' })
  findAll() {
    return this.appointmentsService.findAll();
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar turnos con filtros y paginación (ADMIN)' })
  findAdminAppointments(@Query() query: AdminAppointmentsQueryDto) {
    return this.appointmentsService.findAdminAppointments(query);
  }

  @Get('my')
  @ApiOperation({ summary: 'Listar turnos del cliente autenticado' })
  findMine(@CurrentUser() user: { id: number; role: UserRole }) {
    return this.appointmentsService.findByClient(user.id);
  }

  // Ruta literal antes de :id para que Express no la absorba como parámetro
  @Get('slots')
  @ApiOperation({
    summary: 'Consultar slots libres para un peluquero, servicio y fecha',
    description:
      'Devuelve franjas horarias disponibles en intervalos de 15 min. ' +
      'Excluye días sin horario laboral, bloqueos de TimeOff y turnos PENDING/CONFIRMED existentes.',
  })
  @ApiQuery({ name: 'staffProfileId', type: Number })
  @ApiQuery({ name: 'serviceId', type: Number })
  @ApiQuery({ name: 'date', type: String, example: '2026-07-15' })
  getSlots(@Query() query: GetSlotsQueryDto) {
    return this.appointmentsService.getAvailableSlots(query);
  }

  @Get('agenda')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Agenda del staff autenticado (STAFF/ADMIN)' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-07-15' })
  getAgenda(
    @CurrentUser() user: { id: number; role: UserRole },
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.findAgenda(user.id, date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener turno por ID' })
  @ApiParam({ name: 'id', type: Number })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    const appt = await this.appointmentsService.findById(id);
    const isOwner = appt.clientId === user.id;
    const isStaffOrAdmin =
      user.role === UserRole.STAFF || user.role === UserRole.ADMIN;
    if (!isOwner && !isStaffOrAdmin) {
      throw new ForbiddenException('No tenés acceso a este turno');
    }
    return appt;
  }

  // --- Cambios de estado ---

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Confirmar turno — PENDING → CONFIRMED (STAFF/ADMIN)',
    description: 'Devuelve 409 si el turno no está en estado PENDING.',
  })
  @ApiParam({ name: 'id', type: Number })
  confirm(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.confirmAppointment(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar turno — PENDING|CONFIRMED → CANCELLED',
    description:
      'Un CLIENT solo puede cancelar sus propios turnos. ' +
      'STAFF/ADMIN puede cancelar cualquiera. ' +
      'Devuelve 409 si el turno ya está CANCELLED o COMPLETED.',
  })
  @ApiParam({ name: 'id', type: Number })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.appointmentsService.cancelAppointment(id, user.id, user.role);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Completar turno — CONFIRMED → COMPLETED (STAFF/ADMIN)',
    description: 'Devuelve 409 si el turno no está en estado CONFIRMED.',
  })
  @ApiParam({ name: 'id', type: Number })
  complete(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.completeAppointment(id);
  }
}
