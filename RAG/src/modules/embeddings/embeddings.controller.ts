import { Controller, Get } from '@nestjs/common';
import { EmbeddingService } from './embeddings.service';

@Controller('embeddings')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Get('test')
  async test() {
    return this.embeddingService.testEmbedding();
  }
}
