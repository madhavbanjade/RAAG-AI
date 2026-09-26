import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);

  constructor(private readonly configService: ConfigService) {}

  isAvailable(): boolean {
    return !!this.configService.get<string>('JINA_API_KEY');
  }

  async rerank(query: string, chunks: any[]) {
    if (!chunks.length) return [];

    const apiKey = this.configService.get<string>('JINA_API_KEY');

    if (!apiKey) {
      this.logger.warn('JINA_API_KEY not set — skipping rerank, using hybrid-search order as-is');
      return chunks.map((c) => ({ ...c, rerankScore: c.score }));
    }

    const model =
      this.configService.get<string>('JINA_RERANK_MODEL') ?? 'jina-reranker-v3';

    try {
      const response = await axios.post(
        'https://api.jina.ai/v1/rerank',
        {
          model,
          query,
          documents: chunks.map((c) => c.content),
          top_n: 8,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const results = response.data.results;

      return results.map((item: any) => ({
        ...chunks[item.index],
        rerankScore: item.relevance_score,
      }));
    } catch (error) {
      this.logger.error('Rerank request failed — falling back to hybrid-search order', error);
      return chunks.map((c) => ({ ...c, rerankScore: c.score }));
    }
  }
}
