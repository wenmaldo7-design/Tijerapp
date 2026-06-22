import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  async create(dto: CreateServiceDto): Promise<Service> {
    const existing = await this.serviceRepo.findOneBy({ name: dto.name });
    if (existing) {
      throw new ConflictException(`Ya existe un servicio con el nombre "${dto.name}"`);
    }
    const service = this.serviceRepo.create(dto);
    return this.serviceRepo.save(service);
  }

  findAll(): Promise<Service[]> {
    return this.serviceRepo.find({ where: { isActive: true } });
  }

  findAllIncludingInactive(): Promise<Service[]> {
    return this.serviceRepo.find();
  }

  async findOne(id: number): Promise<Service> {
    const service = await this.serviceRepo.findOneBy({ id });
    if (!service) throw new NotFoundException(`Servicio #${id} no encontrado`);
    return service;
  }

  async update(id: number, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);
    Object.assign(service, dto);
    return this.serviceRepo.save(service);
  }

  async remove(id: number): Promise<void> {
    const service = await this.findOne(id);
    // Soft-delete: marcamos como inactivo en lugar de borrar
    service.isActive = false;
    await this.serviceRepo.save(service);
  }
}
