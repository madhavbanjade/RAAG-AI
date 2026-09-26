import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
} from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { EmbeddingService } from '../embeddings/embeddings.service';

@Controller('vector-store')
export class VectorStoreController {
  constructor(
    private readonly vectorStoreService: VectorStoreService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Post('test-search')
  async testSearch(@Body() body: { query: string }) {
    const vector = await this.embeddingService.generateEmbedding(body.query);
    return this.vectorStoreService.search(vector, body.query);
  }

  @Get('points')
  async getPoints() {
    return this.vectorStoreService.getPoints();
  }

  @Delete('collection')
  async deleteCollection() {
    return this.vectorStoreService.deleteCollection();
  }
}
