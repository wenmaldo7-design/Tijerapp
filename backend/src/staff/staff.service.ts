import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { StaffProfile } from './entities/staff-profile.entity';
import { WorkingHours } from './entities/working-hours.entity';
import { TimeOff } from './entities/time-off.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user-role.enum';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateStaffWithUserDto } from './dto/create-staff-with-user.dto';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { UpdateTimeOffDto } from './dto/update-time-off.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffProfile)
    private readonly profileRepo: Repository<StaffProfile>,
    @InjectRepository(WorkingHours)
    private readonly workingHoursRepo: Repository<WorkingHours>,
    @InjectRepository(TimeOff)
    private readonly timeOffRepo: Repository<TimeOff>,
    private readonly usersService: UsersService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // --- StaffProfile ---

  async createProfile(dto: CreateStaffProfileDto): Promise<StaffProfile> {
    const user = await this.usersService.findById(dto.userId);
    if (user.role !== UserRole.STAFF) {
      throw new BadRequestException('El usuario debe tener rol STAFF');
    }
    const existing = await this.profileRepo.findOneBy({ userId: dto.userId });
    if (existing) {
      throw new ConflictException('Este usuario ya tiene un perfil de staff');
    }
    const profile = this.profileRepo.create(dto);
    return this.profileRepo.save(profile);
  }

  /**
   * Alta de peluquero desde el panel admin: crea el User (rol STAFF) y su
   * StaffProfile en una sola transacción. El registro público (POST /auth/register)
   * siempre fuerza rol CLIENT, así que esta es la única vía para crear STAFF.
   */
  async createStaffWithUser(dto: CreateStaffWithUserDto): Promise<StaffProfile> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const user = manager.create(User, {
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone: dto.phone,
        role: UserRole.STAFF,
      });
      const savedUser = await manager.save(user);

      const profile = manager.create(StaffProfile, {
        userId: savedUser.id,
        specialties: dto.specialties,
        bio: dto.bio,
      });
      const savedProfile = await manager.save(profile);
      savedProfile.user = savedUser;
      return savedProfile;
    });
  }

  findAllProfiles(includeInactive = false): Promise<StaffProfile[]> {
    return this.profileRepo.find({
      where: includeInactive ? {} : { user: { isActive: true } },
      relations: { user: true, workingHours: true },
    });
  }

  /** Activa o desactiva la cuenta de usuario asociada al peluquero (solo ADMIN). */
  async setActive(staffProfileId: number, isActive: boolean): Promise<StaffProfile> {
    const profile = await this.findProfileById(staffProfileId);
    await this.usersService.setActive(profile.userId, isActive);
    return this.findProfileById(staffProfileId);
  }

  async findProfileById(id: number): Promise<StaffProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: { user: true, workingHours: true },
    });
    if (!profile) throw new NotFoundException(`Perfil de staff #${id} no encontrado`);
    return profile;
  }

  async findProfileByUserId(userId: number): Promise<StaffProfile> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: { user: true, workingHours: true },
    });
    if (!profile) throw new NotFoundException(`Perfil de staff para usuario #${userId} no encontrado`);
    return profile;
  }

  async updateProfile(
    id: number,
    dto: UpdateStaffProfileDto,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<StaffProfile> {
    const profile = await this.findProfileById(id);
    this.assertOwnerOrAdmin(profile.userId, requesterId, requesterRole);
    Object.assign(profile, dto);
    return this.profileRepo.save(profile);
  }

  async removeProfile(id: number): Promise<void> {
    const profile = await this.findProfileById(id);
    await this.profileRepo.remove(profile);
  }

  // --- WorkingHours ---

  async addWorkingHours(
    staffProfileId: number,
    dto: CreateWorkingHoursDto,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<WorkingHours> {
    const profile = await this.findProfileById(staffProfileId);
    this.assertOwnerOrAdmin(profile.userId, requesterId, requesterRole);

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la de fin');
    }

    const wh = this.workingHoursRepo.create({ ...dto, staffProfileId });
    return this.workingHoursRepo.save(wh);
  }

  async updateWorkingHours(
    staffProfileId: number,
    whId: number,
    dto: UpdateWorkingHoursDto,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<WorkingHours> {
    const profile = await this.findProfileById(staffProfileId);
    this.assertOwnerOrAdmin(profile.userId, requesterId, requesterRole);

    const wh = await this.workingHoursRepo.findOneBy({ id: whId, staffProfileId });
    if (!wh) throw new NotFoundException(`Horario #${whId} no encontrado`);

    Object.assign(wh, dto);
    if (wh.startTime >= wh.endTime) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la de fin');
    }
    return this.workingHoursRepo.save(wh);
  }

  async removeWorkingHours(
    staffProfileId: number,
    whId: number,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<void> {
    const profile = await this.findProfileById(staffProfileId);
    this.assertOwnerOrAdmin(profile.userId, requesterId, requesterRole);

    const wh = await this.workingHoursRepo.findOneBy({ id: whId, staffProfileId });
    if (!wh) throw new NotFoundException(`Horario #${whId} no encontrado`);
    await this.workingHoursRepo.remove(wh);
  }

  // --- TimeOff ---

  listTimeOffs(staffProfileId: number): Promise<TimeOff[]> {
    return this.timeOffRepo.findBy({ staffProfileId });
  }

  async createTimeOff(
    staffProfileId: number,
    dto: CreateTimeOffDto,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<TimeOff> {
    const profile = await this.findProfileById(staffProfileId);
    this.assertOwnerOrAdmin(profile.userId, requesterId, requesterRole);

    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('startDate debe ser anterior o igual a endDate');
    }

    const timeOff = this.timeOffRepo.create({ ...dto, staffProfileId });
    return this.timeOffRepo.save(timeOff);
  }

  async updateTimeOff(
    staffProfileId: number,
    timeOffId: number,
    dto: UpdateTimeOffDto,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<TimeOff> {
    const profile = await this.findProfileById(staffProfileId);
    this.assertOwnerOrAdmin(profile.userId, requesterId, requesterRole);

    const timeOff = await this.timeOffRepo.findOneBy({ id: timeOffId, staffProfileId });
    if (!timeOff) throw new NotFoundException(`Bloqueo #${timeOffId} no encontrado`);

    Object.assign(timeOff, dto);
    if (timeOff.startDate > timeOff.endDate) {
      throw new BadRequestException('startDate debe ser anterior o igual a endDate');
    }
    return this.timeOffRepo.save(timeOff);
  }

  async removeTimeOff(
    staffProfileId: number,
    timeOffId: number,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<void> {
    const profile = await this.findProfileById(staffProfileId);
    this.assertOwnerOrAdmin(profile.userId, requesterId, requesterRole);

    const timeOff = await this.timeOffRepo.findOneBy({ id: timeOffId, staffProfileId });
    if (!timeOff) throw new NotFoundException(`Bloqueo #${timeOffId} no encontrado`);
    await this.timeOffRepo.remove(timeOff);
  }

  private assertOwnerOrAdmin(
    ownerId: number,
    requesterId: number,
    requesterRole: UserRole,
  ): void {
    if (requesterRole === UserRole.ADMIN) return;
    if (ownerId !== requesterId) {
      throw new ForbiddenException('Solo podés modificar tu propio perfil');
    }
  }
}
