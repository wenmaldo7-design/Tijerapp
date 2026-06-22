import { IsInt, IsPositive } from 'class-validator';

export class OpenConversationDto {
  @IsInt()
  @IsPositive()
  targetUserId: number;
}
