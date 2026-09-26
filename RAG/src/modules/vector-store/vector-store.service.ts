import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Model } from 'mongoose';
import { IChunk } from '../chunking/schema/chunk.schema';
import { IDocument } from '../documents/schema/documents.schema';

type SearchResult = {
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  searchType: 'vector' | 'keyword' | 'hybrid';
  documentId?: unknown;
  documentName?: unknown;
  chunkId?: unknown;
  page?: unknown;
  content?: unknown;
};


@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly client = new QdrantClient({
    host: 'localhost',
    port: 6333,
  })

  constructor(
    @InjectModel('Chunk')
    private readonly chunkModel: Model<IChunk>,
    @InjectModel('Document')
    private readonly documentModel: Model<IDocument>,
  ) {}

 
  
  
 //check collections get
  async onModuleInit() {
    await this.creatCollection(); 
    const collections = await this.client.getCollections();

    console.log(collections)
  }


  //create collections

async creatCollection(){
  try {
    await this.client.createCollection('documents', {
      vectors:{
        size: 1024, 
        distance: 'Cosine'
      }
    })
    console.log('Collection Created')
  } catch (error) {
    console.log('Collection already exists!')
  }
}



private toUUID(mongoId: string): string {
  const padded = mongoId.padEnd(32, '0');
  return `${padded.slice(0,8)}-${padded.slice(8,12)}-${padded.slice(12,16)}-${padded.slice(16,20)}-${padded.slice(20,32)}`;
}

//store embeddings
async storeEmbedding(
  chunkId: string,
  documentId: string,
  documentName: string,
  vector: number[],
  content: string,
  page: number

){

  await this.client.upsert('documents', {
    wait: true,
    points:[
    {
      id: this.toUUID(chunkId),
      vector,
      payload:{
        documentId,
        documentName,
        chunkId,
        content,
        page

      }
    }
    ]
  })
  return true;
}


//get points
async getPoints(){
  return this.client.scroll('documents', {
    limit: 10,
    with_payload: true,
    with_vector: false
  })
}

private mapPoint(point: any): SearchResult {
  return {
    score: point.score,
    vectorScore: point.score,
    searchType: 'vector',
    documentId: point.payload?.documentId,
    documentName: point.payload?.documentName,
    chunkId: point.payload?.chunkId,
    page: point.payload?.page,
    content: point.payload?.content
  };
}

private getSearchTerms(query: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how',
    'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
    'was', 'what', 'when', 'where', 'which', 'who', 'why', 'with',
  ]);

  return [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((term) => term.length > 1 && !stopWords.has(term)),
    ),
  ];
}

private escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

private async searchVector(vector: number[], limit = 20, documentId?: string): Promise<SearchResult[]> {
  const results = await this.client.query('documents', {
    query: vector,
    limit,
    with_payload: true,
    ...(documentId && {
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
    }),
  })

  if (!results.points.length) {
    return [];
  }
  console.log("========== SEARCH ==========");
console.log("Total Results:", results.points.length);

  const bestScore = results.points[0].score;
// Loosened from (bestScore - 0.05, 0.45): that cut off legitimately relevant
// chunks whenever a question was phrased differently than the source text
// (synonyms, paraphrasing) since cosine scores drop faster than 0.05 for
// those cases. Reranking + the groundedness check downstream are what keep
// answer quality honest, so retrieval can afford to be more permissive here.
const threshold = Math.max(bestScore - 0.15, 0.3)

  const filtered = results.points.filter(
    point => point.score >= threshold
  )

console.log("After Threshold:", filtered.length);

  
  const seen = new Set<string>();
  const unique: typeof filtered = [];
  for (const point of filtered){
    const content = point.payload?.content;
    if(typeof content !== 'string' || !content)
      continue;
    if(seen.has(content))
      continue;
    seen.add(content);
    unique.push(point)
  }
  console.log("After Deduplication:", unique.length);

  const selected = unique.slice(0, limit)
  console.log("Final Selected:", selected.length);


  selected.forEach((item, index) => {
  console.log(
    `${index + 1}. Score=${item.score.toFixed(3)} | Chunk=${item.payload?.chunkId}`
  );
});

console.log("============================");

  return selected.map((item) => this.mapPoint(item))
}

private async searchKeyword(query: string, limit = 20, documentId?: string): Promise<SearchResult[]> {
  const terms = this.getSearchTerms(query);

  if (!terms.length) {
    return [];
  }

  const chunks = await this.chunkModel
    .find({
      embeddingStatus: 'EMBEDDED',
      ...(documentId && { documentId }),
      $or: terms.map((term) => ({
        content: { $regex: this.escapeRegex(term), $options: 'i' },
      })),
    })
    .select('_id documentId content metadata')
    .limit(50)
    .lean();

  const documentIds = [
    ...new Set(
      chunks
        .map((chunk: any) => chunk.documentId?.toString())
        .filter(Boolean),
    ),
  ];

  const documents = await this.documentModel
    .find({ _id: { $in: documentIds } })
    .select('_id title files.originalName')
    .lean();

  const documentById = new Map(
    documents.map((document: any) => [document._id.toString(), document]),
  );

  const phrase = query.toLowerCase().trim();

  return chunks
    .map((chunk: any) => {
      const content = String(chunk.content || '');
      const lowerContent = content.toLowerCase();
      const matchedTerms = terms.filter((term) => lowerContent.includes(term));
      const frequency = terms.reduce((total, term) => {
        return total + lowerContent.split(term).length - 1;
      }, 0);
      const exactPhraseBoost = phrase && lowerContent.includes(phrase) ? 0.2 : 0;
      const keywordScore = Math.min(
        1,
        matchedTerms.length / terms.length * 0.75 +
          Math.min(frequency / 10, 1) * 0.15 +
          exactPhraseBoost,
      );
      const document = chunk.documentId
        ? documentById.get(chunk.documentId.toString())
        : null;

      return {
        score: keywordScore,
        keywordScore,
        searchType: 'keyword' as const,
        documentId: chunk.documentId?.toString(),
        documentName: document?.files?.[0]?.originalName || document?.title,
        chunkId: chunk._id.toString(),
        page: chunk.metadata?.pageNumber ?? 1,
        content,
      };
    })
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .slice(0, limit);
}

private mergeHybridResults(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  limit = 8,
): SearchResult[] {
  const results = new Map<string, SearchResult>();

  vectorResults.forEach((item, index) => {
    const key = String(item.chunkId || item.content || index);
    results.set(key, {
      ...item,
      vectorScore: item.vectorScore ?? item.score,
      score: (item.vectorScore ?? item.score) * 0.7 + (1 / (index + 1)) * 0.1,
    });
  });

  keywordResults.forEach((item, index) => {
    const key = String(item.chunkId || item.content || `keyword-${index}`);
    const existing = results.get(key);
    const keywordScore = item.keywordScore ?? item.score;
    const keywordRankBoost = (1 / (index + 1)) * 0.1;

    if (existing) {
      results.set(key, {
        ...existing,
        documentId: existing.documentId || item.documentId,
        documentName: existing.documentName || item.documentName,
        page: existing.page ?? item.page,
        content: existing.content || item.content,
        keywordScore,
        searchType: 'hybrid',
        score:
          (existing.vectorScore ?? existing.score) * 0.65 +
          keywordScore * 0.35 +
          keywordRankBoost,
      });
      return;
    }

    results.set(key, {
      ...item,
      score: keywordScore * 0.6 + keywordRankBoost,
    });
  });

  return [...results.values()]
    .filter((item) => typeof item.content === 'string' && item.content)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

//search similarity + keyword matching
async search(vector: number[], query?: string, documentId?: string){
  const vectorResults = await this.searchVector(vector, 20, documentId);
  const keywordResults = query ? await this.searchKeyword(query, 20, documentId) : [];
  const selected = this.mergeHybridResults(vectorResults, keywordResults);

  console.log("========== HYBRID SEARCH ==========");
  console.log("Vector Results:", vectorResults.length);
  console.log("Keyword Results:", keywordResults.length);
  console.log("Final Selected:", selected.length);
  console.log("============================");

  return selected;
}


async deleteByDocumentId(documentId: string) {
  await this.client.delete('documents', {
    wait: true,
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
  });
  return true;
}

async deleteCollection() {
  try {
    const result = await this.client.deleteCollection('documents');

    return {
      success: true,
      message: 'Collection deleted successfully',
      result,
    };
  } catch (error) {
    throw new Error(`Failed to delete collection: ${error}`);
  }
}
 


}
