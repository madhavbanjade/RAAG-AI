import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from './schema/conversation.schema';
import { Message } from './schema/message.schema';
import mongoose from 'mongoose';
import { ErrorHandler } from 'src/common/handlers/error-handlers';
import { SuccessResponseHandler } from 'src/common/handlers/success-handlers';
import { EmbeddingService } from '../embeddings/embeddings.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { LlmService } from 'src/common/services/llm.service';
import { IChunk } from '../chunking/schema/chunk.schema';
import { IDocument } from '../documents/schema/documents.schema';
import { RerankService } from 'src/common/services/rerank.service';

const BOT_NAME = 'DocuMind';
const GREETING_MESSAGE =
  `Hi! I'm ${BOT_NAME}, your AI assistant. Ask me anything about your uploaded document and I'll do my best to help.`;
const NOT_FOUND_ANSWER =
  'I could not find the information you are searching for in the provided document. Upload a relevant document. Thank you \u{1F60A}';
const NO_DOCUMENT_ANSWER =
  'You don’t have a document uploaded yet. Upload a PDF to start asking questions.';

// Mirrors the confidence bucketing the frontend used to compute client-side —
// now computed once here so it can be persisted and reused after reload.
function confidenceLabel(verification: { grounded?: boolean; confidence?: number }): 'high' | 'medium' | 'low' {
  if (typeof verification?.confidence === 'number') {
    if (verification.confidence >= 0.75) return 'high';
    if (verification.confidence >= 0.4) return 'medium';
    return 'low';
  }
  return verification?.grounded === false ? 'low' : 'medium';
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel('Conversation')
    private readonly conversationModel: Model<Conversation>,
    @InjectModel('Message')
    private readonly messageModel: Model<Message>,
    @InjectModel('Chunk')
    private readonly chunkModel: Model<IChunk>,
    @InjectModel('Document')
    private readonly documentModel: Model<IDocument>,

    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly llmService: LlmService,
    private readonly rerankService: RerankService,
  ) {}

  private async buildSources(chunks: any[]) {
    // Only show sources that genuinely contributed to the answer
    const relevant = chunks
      .filter((item) => (item.rerankScore ?? 0) >= 0.1)
      .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
      .slice(0, 3);

    if (!relevant.length) return [];

    const chunkIds = relevant.map((item) => item.chunkId).filter(Boolean);

    const dbChunks = await this.chunkModel
      .find({ _id: { $in: chunkIds } })
      .select('_id documentId content metadata')
      .lean();

    const documentIds = [
      ...new Set(dbChunks.map((chunk: any) => chunk.documentId?.toString()).filter(Boolean)),
    ];

    const documents = await this.documentModel
      .find({ _id: { $in: documentIds } })
      .select('_id title files.originalName')
      .lean();

    const chunkById = new Map(
      dbChunks.map((chunk: any) => [chunk._id.toString(), chunk]),
    );
    const documentById = new Map(
      documents.map((document: any) => [document._id.toString(), document]),
    );

    const seen = new Set<string>();
    const sources: { documentName: string; text: string; page: number; score: number; rerankScore: number }[] = [];

    for (const item of relevant) {
      const dbChunk = item.chunkId ? chunkById.get(String(item.chunkId)) : null;
      const document = dbChunk?.documentId
        ? documentById.get((dbChunk as any).documentId.toString())
        : null;

      // Prefer MongoDB (authoritative), fall back to Qdrant payload
      const documentName =
        (document as any)?.files?.[0]?.originalName ||
        (document as any)?.title ||
        item.documentName ||
        null;

      if (!documentName) continue;

      const page: number = (dbChunk as any)?.metadata?.pageNumber ?? item.page ?? 1;
      const key = `${documentName}::${page}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const content: string = (dbChunk as any)?.content || item.content || '';
      sources.push({
        documentName,
        text: content.slice(0, 220),
        page,
        score: item.score,
        rerankScore: item.rerankScore,
      });
    }

    return sources;
  }

  // Called after a user replaces their active PDF. Their old conversation
  // still references the previous document's content in its message
  // history, which would confuse follow-up questions about the new one —
  // so it's wiped and replaced with a note instead of silently kept around.
  async resetConversationForNewDocument(userId: string, fileName: string) {
    const conversation = await this.conversationModel
      .findOne({ userId })
      .sort({ updatedAt: -1 });

    if (!conversation) return;

    await this.messageModel.deleteMany({ conversationId: conversation._id });
    await this.messageModel.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: `\u{1F4C4} New document uploaded: "${fileName}". Your previous conversation has been cleared — ask me anything about this document.`,
    });
  }

  //create conversation
  async createConversation(
    userId: string, title = 'New Chat'
  ) {
    const conversation = await this.conversationModel.create({
      userId,
      title,
    });

    if (!conversation) {
      throw ErrorHandler.notFound(conversation);
    }

    await this.messageModel.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: GREETING_MESSAGE,
    });

    return SuccessResponseHandler.created('Conversation', conversation);
  }

    //rename converstation
async renameConversation(
  conversationId: string,
  userId: string,
  title: string,
) {
  const conversation = await this.conversationModel.findOneAndUpdate(
    {
      _id: conversationId,
      userId,
    },
    {
      title,
    },
    {
      new: true,
    },
  );

  if (!conversation) {
    throw ErrorHandler.notFound('Conversation');
  }

  return SuccessResponseHandler.updated(
    'Conversation',
    conversation,
  );
}

//search conversation 
async searchConverations(
  userId: string,
  keyword: string
){
  const searchTerm = keyword?.trim();

  if (!searchTerm) {
    throw new BadRequestException('Search keyword is required');
  }

  const escapedKeyword = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keywordRegex = new RegExp(escapedKeyword, 'i');

  const userConversations = await this.conversationModel
    .find({
      userId: new mongoose.Types.ObjectId(userId),
      isArchived: { $ne: true },
    })
    .select('_id title');

  const userConversationIds = userConversations.map(
    (conversation) => conversation._id,
  );

  const matchingMessages = await this.messageModel
    .find({
      conversationId: { $in: userConversationIds },
      content: keywordRegex,
    })
    .select('conversationId');

  const conversationIds = matchingMessages.map((message) => message.conversationId);

  const conversations = await this.conversationModel
    .find({
      userId: new mongoose.Types.ObjectId(userId),
      isArchived: { $ne: true },
      $or: [
        { title: keywordRegex },
        { _id: { $in: conversationIds } },
      ],
    })
    .sort({ updatedAt: -1 });

  console.log('Search debug:', {
    userId,
    searchTerm,
    userConversationCount: userConversations.length,
    matchingMessageCount: matchingMessages.length,
    resultCount: conversations.length,
    userConversationTitles: userConversations.map(
      (conversation) => conversation.title,
    ),
  });

  return SuccessResponseHandler.retrived(
    'Conversations',
    conversations
  )
}

  //get conversation
  async getConversation(conversationId: string) {
    const conversation = await this.conversationModel.findById(conversationId);

    if (!conversation) {
      throw ErrorHandler.notFound('conversation');
    }

    return SuccessResponseHandler.retrived('Conversation', conversation);
  }

  //save message
  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ) {
    const message = await this.messageModel.create({
      conversationId,
      role,
      content,
    });

    if (!message) {
      throw ErrorHandler.notFound('Message');
    }

    return SuccessResponseHandler.saved('Message', message);
  }

  //get chat history
  async getChatHistory(conversationId: string, limit: 20) {
    // Same fix as sendMessage: grab the latest `limit` messages, then
    // re-sort ascending for display, instead of returning the oldest ones.
    const chat = (
      await this.messageModel
        .find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
    ).reverse();

    if (chat.length === 0) {
      throw ErrorHandler.notFound('Chat Hisotry');
    }

    return SuccessResponseHandler.retrived('Chat History', chat);
  }

  //getall
async getUserConversations(
  userId: string,
  page = 1,
  limit = 10,
) {
  const skip = (page - 1) * limit;

  const [conversations, total] =
    await Promise.all([
      this.conversationModel
        .find({
          userId,
          isArchived: { $ne: true },
        })
        .sort({
          updatedAt: -1,
        })
        .skip(skip)
        .limit(limit),

      this.conversationModel.countDocuments({
        userId,
        isArchived: { $ne: true },
      }),
    ]);

  return SuccessResponseHandler.retrived(
    "Conversations",
    { page, limit, total, totalPages: Math.ceil(total / limit), conversations },
  );
}






  // Archive Conversation
async archiveConversation(
  conversationId: string,
  userId: string,
) {
  const conversation =
    await this.conversationModel.findOneAndUpdate(
      {
        _id: conversationId,
        userId,
      },
      {
        isArchived: true,
      },
      {
        new: true,
      },
    );

  if (!conversation) {
    throw ErrorHandler.notFound("Conversation");
  }

  return SuccessResponseHandler.updated(
    "Conversation archived",
    conversation,
  );
}

// Unarchive Conversation
async unarchiveConversation(
  conversationId: string,
  userId: string,
) {
  const conversation =
    await this.conversationModel.findOneAndUpdate(
      {
        _id: conversationId,
        userId,
      },
      {
        isArchived: false,
      },
      {
        new: true,
      },
    );

  if (!conversation) {
    throw ErrorHandler.notFound("Conversation");
  }

  return SuccessResponseHandler.updated(
    "Conversation restored",
    conversation,
  );
}

  // Delete Conversation
  async deleteConversation(conversationId: string) {
    await this.messageModel.deleteMany({ conversationId });
    await this.conversationModel.findByIdAndDelete(conversationId);

    return SuccessResponseHandler.deleted('Convesation');
  }

  //send message

  async sendMessage(conversationId: string, userId: string,  message: string) {
    return ErrorHandler.execute(async () => {
      const startedAt = Date.now();
      const userMessage = message?.trim();

      if (!userMessage) {
        throw new BadRequestException('Message content is required');
      }

      const conversation = await this.conversationModel.findOne({
        _id: conversationId,
        userId,
      });
      console.log("convo", conversation);

      if (!conversation) {
        throw ErrorHandler.notFound('Conversation');
      }

      //save user message
      await this.messageModel.create({
        conversationId,
        role: 'user',
        content: userMessage,
      });

      // LLM-based classification instead of a fixed word list — this is what
      // makes typo tolerance and "recognize any greeting" possible: the model
      // corrects spelling and figures out intent, which no regex can do.
      const { intent, normalizedQuery } = await this.llmService.classifyQuery(userMessage);

      if (intent === 'greeting') {
        const reply = await this.llmService.chat([
          {
            role: 'system',
            content: `You are ${BOT_NAME}, a friendly AI assistant that helps users explore their uploaded document.
When greeted, respond warmly and briefly — one or two sentences max.
Let the user know you are ready to answer questions about their document.
Do not mention technical details like embeddings or retrieval.`,
          },
          { role: 'user', content: normalizedQuery },
        ]);
        await this.messageModel.create({
          conversationId,
          role: 'assistant',
          content: reply,
          sources: [],
          confidence: 'high',
          timeMs: Date.now() - startedAt,
        });
        return { answer: reply, sources: [], verification: { grounded: true } };
      }

      // Each user has at most one active document (uploading a new one
      // replaces the previous one), so this is the document to search/answer from.
      const activeDocument = await this.documentModel.findOne({ uploadedBy: userId }).lean();

      if (!activeDocument) {
        await this.messageModel.create({
          conversationId,
          role: 'assistant',
          content: NO_DOCUMENT_ANSWER,
          sources: [],
          confidence: 'low',
          timeMs: Date.now() - startedAt,
        });
        return { answer: NO_DOCUMENT_ANSWER, sources: [], verification: { grounded: false } };
      }
      const activeDocumentId = String(activeDocument._id);

      // Fetch the most RECENT messages (sort desc + limit), then reverse
      // back into chronological order. Sorting ascending + limit(10) instead
      // grabs the oldest 10 messages, so once a conversation passes 10
      // messages the model only ever sees the beginning of the chat and
      // "forgets" everything said afterward.
      const history = (
        await this.messageModel
          .find({ conversationId })
          .sort({ createdAt: -1 })
          .limit(10)
      ).reverse();

  const rewrite = await this.llmService.rewriteQuery(
    history.map((m) => ({
      role: m.role,
      content: m.content
    })),
    normalizedQuery
  )
  console.log("Original:", message);
console.log("Normalized:", normalizedQuery);
console.log("Rewritten:", rewrite);

const searchQuery = rewrite?.trim().length ? rewrite : normalizedQuery;

      let reranked: any[];
      let context: string;

      if (intent === 'summary') {
        // Summary-style questions ("what is this pdf about") rarely score
        // above the similarity threshold used for targeted search, so pull
        // the document's chunks directly instead of relying on vector search.
        const chunks = await this.chunkModel
          .find({ documentId: activeDocumentId })
          .sort({ chunkIndex: 1 })
          .lean();

        reranked = chunks.map((c: any) => ({
          content: c.content,
          chunkId: c._id.toString(),
          page: c.metadata?.pageNumber ?? 1,
          score: 1,
          rerankScore: 1,
        }));
        context = reranked.map((r: any) => r.content).join('\n\n');
      } else {
        //embedded query
        const vector = await this.embeddingService.generateEmbedding(searchQuery);

        //retrived chunks — scoped to this user's active document
        const chunks = await this.vectorStoreService.search(vector, searchQuery, activeDocumentId);

        reranked = await this.rerankService.rerank(searchQuery, chunks);

        //build context
        context = reranked.map((item: any) => item.content).join('\n\n');
      }
      const messages = [
        {
          role: 'system',
          content: `You are ${BOT_NAME}, an intelligent AI assistant.

Your job is to answer questions using ONLY the retrieved context.

Rules:

1. Use the retrieved context as your primary source.
2. If the answer exists, explain it naturally.
3. Never copy entire paragraphs.
4. If the context is incomplete, answer only what is supported.
5. If the answer cannot be found, reply exactly:
"${NOT_FOUND_ANSWER}"
6. Format every answer in clean Markdown:
   - Use numbered lists ("1.", "2.", "3.") for sequential steps or ranked items.
   - Use bullet points ("-") for non-sequential lists of facts or options.
   - Use short paragraphs only for single, simple statements.
7. Keep answers concise unless the user requests detail.
8. Consider previous conversation messages when the user asks follow-up questions like:
   - "why?"
   - "explain more"
   - "what about the second one?"
9. Never invent facts.
10. Never mention internal implementation such as vectors, embeddings, or retrieval unless the user asks.`,
        },
        {
          role: 'system',
          content: `Context:\n${context}`,
        },
        ...history.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ];

      let answer: string;
      try {
        answer = await this.llmService.chat(messages);
      } catch {
        answer = '';
      }

      if (!answer) {
        const fallback = "I'm having trouble generating a response right now. Please try again.";
        await this.messageModel.create({
          conversationId,
          role: 'assistant',
          content: fallback,
          sources: [],
          confidence: 'low',
          timeMs: Date.now() - startedAt,
        });
        return { answer: fallback, sources: [], verification: { grounded: false } };
      }

      // For summary questions we already fed the ENTIRE document as context —
      // there's no retrieval mismatch to guard against. The groundedness
      // checker is too strict for this case: a summary naturally synthesizes
      // and characterizes the document (e.g. "this is a cover letter"),
      // which it flags as an "unsupported claim" even though it's a
      // reasonable reading of the full text, wrongly rejecting good answers.
      const verification = intent === 'summary'
        ? { grounded: true, confidence: 1, reason: 'Full document used as context for a summary question.' }
        : await this.llmService.verify(searchQuery, context, answer);

      if(!verification.grounded){
        const fallback = NOT_FOUND_ANSWER;
        await this.messageModel.create({
          conversationId,
          role: 'assistant',
          content: fallback,
          sources: [],
          confidence: 'low',
          timeMs: Date.now() - startedAt,
        });
        return{ answer: fallback, sources: [], verification };
      }




   const titlePrompt = [
  {
    role: 'system',
    content: `
Generate a short title for this conversation.

Rules:
- Maximum 5 words.
- No quotation marks.
- No punctuation.
- Return ONLY the title.
`,
  },
  {
    role: 'user',
    content: userMessage,
  },
];

try {
  const title = await this.llmService.chat(titlePrompt);
  if (title?.trim()) {
    await this.renameConversation(conversationId, userId, title.trim());
  }
} catch { /* title generation is best-effort */ }


    //save assistent message
      const sources = await this.buildSources(reranked);
      await this.messageModel.create({
        conversationId,
        role: 'assistant',
        content: answer,
        sources,
        confidence: confidenceLabel(verification),
        timeMs: Date.now() - startedAt,
      });

      return {
        answer,
        sources,
        verification,
      };
    }, 'Faild to send-message');
  }
}

  




