import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'juan@ejemplo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'contraseña123' })
  @IsString()
  password: string;
}
