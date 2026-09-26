import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { EmbeddingModule } from '../embeddings/embeddings.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { LlmService } from 'src/common/services/llm.service';

@Module({
  imports:[
    EmbeddingModule,
    VectorStoreModule
  ],
  // controllers: [RagController],
  providers: [RagService, LlmService],
})
export class RagModule {}
