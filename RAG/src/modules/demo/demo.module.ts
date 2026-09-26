import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { documentSchema } from '../documents/schema/documents.schema';
import { chunkSchema } from '../chunking/schema/chunk.schema';
import { DocumentParserService } from 'src/common/services/document-parser.service';
import { ChunkingModule } from '../chunking/chunking.module';
import { EmbeddingModule } from '../embeddings/embeddings.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { RerankService } from 'src/common/services/rerank.service';
import { AuthModule } from 'src/common/auth/auth.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'Document', schema: documentSchema },
      { name: 'Chunk', schema: chunkSchema },
    ]),
    ChunkingModule,
    EmbeddingModule,
    VectorStoreModule,
    ChatModule,
  ],
  controllers: [DemoController],
  providers: [DemoService, DocumentParserService, RerankService],
})
export class DemoModule {}
