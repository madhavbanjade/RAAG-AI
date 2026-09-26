import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../embeddings/embeddings.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import axios from 'axios';
import { LlmService } from 'src/common/services/llm.service';

@Injectable()
export class RagService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly llmService: LlmService
  ) {}

  //ask question
  async ask(question: string) {
    //generating embedding

    const queryVector = await this.embeddingService.generateEmbedding(question);

    //search qdrant
    const results = await this.vectorStoreService.search(queryVector, question);

    //build context
    const context = results.map((r: any) => r.content).join('\n\n');

    //prompt
    const prompt = `
    You are helpful RAG assistant.

    Answer ONLY from the provided context.
     If the answer is not found in the context, say:
     "I could not find the information that are you seacrching for in the provided documents. Upload relevent documents. Thank you😊"

Context: ${context}
Question: ${question}

  `;


//aks groq
const answer = await this.llmService.generate(prompt);
  return {
    answer,
    sources: results.map(r => ({
      documentId: r.documentId,
      chunkId: r.chunkId,
      score: r.score
    }))
  }


  }
}
