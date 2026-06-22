import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateWorkingHoursDto {
  @ApiProperty({ example: 1, description: '0=Dom, 1=Lun, …, 6=Sáb' })
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime debe tener formato HH:MM' })
  startTime: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime debe tener formato HH:MM' })
  endTime: string;
}
