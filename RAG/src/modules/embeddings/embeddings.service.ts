import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Embedding } from './schema/embeddings.schema';
import { IChunk } from '../chunking/schema/chunk.schema';
import { Model } from 'mongoose';
import { ErrorHandler } from 'src/common/handlers/error-handlers';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { IDocument } from '../documents/schema/documents.schema';

@Injectable()
export class EmbeddingService {
  constructor(
    @InjectModel('Embedding')
    private readonly embeddingModel: Model<Embedding>,

    @InjectModel('Chunk')
    private readonly chunkModel: Model<IChunk>,

    @InjectModel('Document')
    private readonly documentModel: Model<IDocument>,

    private readonly vectorStoreService: VectorStoreService
  ) {}

  //generateEmbeddings
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await axios.post('http://localhost:11434/api/embed', {
      model: 'bge-m3',
      input: text,
    });

    return response.data.embeddings[0];
  }

  //test
  async testEmbedding() {
    const vector = await this.generateEmbedding(
      'What is Retrieval Augmented Generation?',
    );

    console.log('Dimensions:', vector.length);

    return vector.length;
  }

  //proces the chunk to embedded
  async processDocument(documentId: string) {
    const document = await this.documentModel.findById(documentId);
    if (!document) {
      throw ErrorHandler.notFound('Document');
    }

    const chunks = await this.chunkModel.find({
      documentId,
      embeddingStatus: 'PENDING',
    });

    if (!chunks.length) {
       return {
    success: true,
    embeddedChunk: 0,
  };
    }

    let embeddedCount = 0;
    const documentName = document.files?.[0]?.originalName || document.title;

    for (const chunk of chunks) {
      const vector = await this.generateEmbedding(chunk.content);
      const page = chunk.metadata?.pageNumber ?? 1;

   

             //store in qdrant
      await this.vectorStoreService.storeEmbedding(
        chunk._id!.toString(),
        chunk.documentId!.toString(),
        documentName,
        vector,
        chunk.content,
        page,

      )

    


      chunk.embeddingStatus = 'EMBEDDED';
        chunk.embeddingModel = 'bge-m3';
        chunk.vectorDemensions = vector.length;

      await chunk.save();

      embeddedCount++;

      
   
    }

    return {
      success: true,
      embeddedChunk: embeddedCount,
    };
  }
}
