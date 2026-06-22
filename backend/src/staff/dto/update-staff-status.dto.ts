import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateStaffStatusDto {
  @ApiProperty({ example: false, description: 'true = activo, false = desactivado' })
  @IsBoolean()
  isActive: boolean;
}
