import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}


  @Post('conversation')
  async creatConversation(@Req() req: any){
    return this.chatService.createConversation(
      req.user.id,
    )
  }

  // Rename Conversation
@Patch('conversation/:id/rename')
async renameConversation(
  @Param('id') conversationId: string,
  @Req() req: any,
  @Body()
  body: {
    title: string;
  },
) {
  return this.chatService.renameConversation(
    conversationId,
    req.user.id,
    body.title,
  );
}

@Get('search')
async searchConversation(
  @Req() req: any,
  @Query('q') keyword: string,
  @Query('keyword') keywordAlias?: string,
  @Query('query') queryAlias?: string,
  @Query('search') searchAlias?: string,
) {
  const searchTerm = keyword ?? keywordAlias ?? queryAlias ?? searchAlias;

  return this.chatService.searchConverations(
    req.user.id,
    searchTerm,
  );
}

    // Get Conversation
  @Get('conversation/:id')
  async getConversation(
    @Param('id') id: string,
  ) {
    return this.chatService.getConversation(id);
  }

  // Get User Conversations
@Get("user")
async getUserConversations(
  @Req() req: any,
  @Query("page") page = 1,
  @Query("limit") limit = 10,
) {
  return this.chatService.getUserConversations(
    req.user.id,
    Number(page),
    Number(limit),
  );
}

   // Save Message
  @Post('message')
  async saveMessage(
    @Body()
    body: {
      conversationId: string;
      role: 'user' | 'assistant';
      content: string;
    },
  ) {
    return this.chatService.saveMessage(
      body.conversationId,
      body.role,
      body.content,
    );
  }

    @Get('history/:conversationId')
  async getHistory(
    @Param('conversationId')
    conversationId: string,
  ) {
    return this.chatService.getChatHistory(
      conversationId,
      20
        );
  }


@Patch("conversation/:id/archive")
async archiveConversation(
  @Param("id") conversationId: string,
  @Req() req: any,
) {
  return this.chatService.archiveConversation(
    conversationId,
    req.user.id,
  );
}

@Patch("conversation/:id/unarchive")
async unarchiveConversation(
  @Param("id") conversationId: string,
  @Req() req: any,
) {
  return this.chatService.unarchiveConversation(
    conversationId,
    req.user.id,
  );
}

    // Delete Conversation
  @Delete('conversation/:id')
  async deleteConversation(
    @Param('id') id: string,
  ) {
    return this.chatService.deleteConversation(
      id,
    );
  }


  @Post('conversation/:id/message')
  async sendMessage(
    @Param('id') conversationId: string,
    @Req() req: any,
    @Body()
    body:{
      message: string
    }

  ){
    return this.chatService.sendMessage(
      conversationId,
      req.user.id,
      body.message
    )
  }
}
