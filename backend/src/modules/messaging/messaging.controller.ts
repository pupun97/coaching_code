import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messages')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations for authenticated user' })
  getConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
  ) {
    return this.messagingService.getMyConversations(user, search);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'List authorized messaging contacts based on user role' })
  getContacts(@CurrentUser() user: AuthenticatedUser) {
    return this.messagingService.getAvailableContacts(user);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get message history for a conversation and mark unread as read' })
  getConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagingService.getConversationMessages(conversationId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Send a message in an existing or new conversation' })
  sendMessage(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.messagingService.sendMessage(dto, user);
  }

  @Post('typing')
  @ApiOperation({ summary: 'Broadcast real-time typing indicator to conversation participants' })
  emitTyping(
    @Body() dto: { conversationId: string; isTyping: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagingService.emitTyping(dto.conversationId, Boolean(dto.isTyping), user);
  }
}
