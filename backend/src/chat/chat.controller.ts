import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { OpenConversationDto } from './dto/open-conversation.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  listConversations(@CurrentUser() user: any) {
    return this.chatService.listConversations(user);
  }

  @Post('conversations')
  openConversation(@CurrentUser() user: any, @Body() dto: OpenConversationDto) {
    return this.chatService.openConversation(user.id, dto.targetUserId);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.chatService.getMessages(id, user);
  }

  @Get('unread')
  getUnreadCounts(@CurrentUser() user: any) {
    return this.chatService.getUnreadCounts(user);
  }
}
