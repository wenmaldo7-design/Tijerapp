import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Se consulta la DB en cada request para que una desactivación corte el
    // acceso al instante, no recién cuando expire el JWT (hasta 7 días).
    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tu cuenta está desactivada. Contactá al administrador.');
    }
    // Lo que retornamos acá queda disponible como req.user en los controllers
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
