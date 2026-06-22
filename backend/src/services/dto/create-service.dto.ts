import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty({ example: 'Corte de cabello' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Corte clásico con tijera o máquina' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 30, description: 'Duración en minutos' })
  @IsInt()
  @Min(5)
  @Type(() => Number)
  durationMinutes: number;

  @ApiProperty({ example: 1500.0, description: 'Precio en pesos' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;
}
