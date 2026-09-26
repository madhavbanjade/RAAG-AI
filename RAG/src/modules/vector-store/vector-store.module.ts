import { forwardRef, Module } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { VectorStoreController } from './vector-store.controller';
import { EmbeddingModule } from '../embeddings/embeddings.module';
import { MongooseModule } from '@nestjs/mongoose';
import { chunkSchema } from '../chunking/schema/chunk.schema';
import { documentSchema } from '../documents/schema/documents.schema';

@Module({
  imports: [
    forwardRef(() => EmbeddingModule),
    MongooseModule.forFeature([
      { name: 'Chunk', schema: chunkSchema },
      { name: 'Document', schema: documentSchema },
    ]),
  ],
  controllers: [VectorStoreController],
  providers: [VectorStoreService],
  exports: [VectorStoreService],
})
export class VectorStoreModule {}
