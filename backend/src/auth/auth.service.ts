import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../users/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      phone: dto.phone,
      role: UserRole.CLIENT,
    });
    return this.buildTokenResponse(user.id, user.name, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta está desactivada. Contactá al administrador.');
    }

    return this.buildTokenResponse(user.id, user.name, user.email, user.role);
  }

  private buildTokenResponse(id: number, name: string, email: string, role: UserRole) {
    const payload = { sub: id, email, role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id, name, email, role },
    };
  }
}
