import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`Usuario #${id} no encontrado`);
    return user;
  }

  async create(data: Partial<User>): Promise<User> {
    const existing = await this.findByEmail(data.email!);
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }
    const user = this.usersRepo.create(data);
    return this.usersRepo.save(user);
  }

  async setActive(id: number, isActive: boolean): Promise<User> {
    const user = await this.findById(id);
    user.isActive = isActive;
    return this.usersRepo.save(user);
  }
}
