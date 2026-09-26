import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IChunk } from './schema/chunk.schema';
import { Model } from 'mongoose';

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  constructor(
    @InjectModel('Chunk')
    private readonly chunkModel: Model<IChunk>,
  ) {}

  //splits text into chunks with overlap
  splitText(text: string, chunkSize = 500, overlap = 50): string[] {
    if (!text?.trim()) {
      return [];
    }

    const words = text.replace(/\s+/g, ' ').trim().split(' ');

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words
        .slice(i, i + chunkSize)
        .join(' ')
        .trim();
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  //save chunks in database
  async saveChunks(documentId: string, chunks: string[]): Promise<IChunk[]> {
    if (!chunks.length) {
      return [];
    }
    const chunkDocuments = chunks.map((current, index) => ({
      documentId,
      chunkIndex: index,
      content: current,
      tokenCount: current.split(/\s+/).length,
      embeddingStatus: 'PENDING' as const,
    }));

    return await this.chunkModel.insertMany(chunkDocuments);
  }

  //chauk and save documnets
  async processDocument(
    documentId: string,
    extactedText: string,


  ): Promise<IChunk[]>{
 this.logger.log(`Processing document ${documentId}`);

 const chunks = this.splitText(extactedText);

 this.logger.log(`Generated ${chunks.length} chunks`);

 const savedChunks = await this.saveChunks(
  documentId,
  chunks
 );
   this.logger.log(`${savedChunks.length} chunks saved`)

   return savedChunks;

  }


  //real, varying quality signal for the naive fixed-size splitter: the % of
  //chunks that happen to end on a clean sentence boundary. Word-count-based
  //splitting cuts mid-sentence often, so this is usually well below 100%.
  computeCleanBoundaryRate(chunks: string[]): number {
    if (!chunks.length) return 0;
    const clean = chunks.filter((c) => /[.!?]["')\]]?\s*$/.test(c.trim())).length;
    return Math.round((clean / chunks.length) * 100);
  }

  //split raw text into sentences (rough, punctuation-based)
  private splitSentences(text: string): string[] {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];

    const matches = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g);
    if (!matches || !matches.length) return [cleaned];

    return matches.map((s) => s.trim()).filter(Boolean);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom ? dot / denom : 0;
  }

  //semantic chunking: groups consecutive sentences together while they stay
  //topically similar (cosine similarity of their embeddings), and breaks off
  //a new chunk once similarity drops or a size cap is hit.
  //Also returns avgCoherence — the real, varying average similarity between
  //sentences that ended up merged together, used as a genuine quality score
  //instead of a hardcoded "100% done" number.
  async semanticSplit(
    text: string,
    embedFn: (sentence: string) => Promise<number[]>,
    options: {
      similarityThreshold?: number;
      maxWords?: number;
      minWords?: number;
    } = {},
  ): Promise<{ chunks: string[]; avgCoherence: number }> {
    const { similarityThreshold = 0.72, maxWords = 400, minWords = 40 } = options;

    const sentences = this.splitSentences(text);
    if (!sentences.length) return { chunks: [], avgCoherence: 0 };

    const embeddings: number[][] = [];
    for (const sentence of sentences) {
      embeddings.push(await embedFn(sentence));
    }

    const chunks: string[] = [];
    let currentSentences: string[] = [sentences[0]];
    let currentWordCount = sentences[0].split(/\s+/).filter(Boolean).length;

    const mergedSimilarities: number[] = [];

    for (let i = 1; i < sentences.length; i++) {
      const similarity = this.cosineSimilarity(embeddings[i - 1], embeddings[i]);
      const sentenceWordCount = sentences[i].split(/\s+/).filter(Boolean).length;

      const shouldBreak = similarity < similarityThreshold && currentWordCount >= minWords;
      const tooLarge = currentWordCount + sentenceWordCount > maxWords;

      if (shouldBreak || tooLarge) {
        chunks.push(currentSentences.join(' '));
        currentSentences = [sentences[i]];
        currentWordCount = sentenceWordCount;
      } else {
        mergedSimilarities.push(similarity);
        currentSentences.push(sentences[i]);
        currentWordCount += sentenceWordCount;
      }
    }

    if (currentSentences.length) {
      chunks.push(currentSentences.join(' '));
    }

    const avgCoherence = mergedSimilarities.length
      ? mergedSimilarities.reduce((sum, s) => sum + s, 0) / mergedSimilarities.length
      : 1; // a single-sentence-per-chunk document has nothing to merge — trivially coherent

    return { chunks, avgCoherence };
  }

  //get chunks by document
  async findChunkdByDocument(
    documentId: string

  ): Promise<IChunk[]>{
    return await this.chunkModel.find({documentId}).sort({chunkIndex: 1});
  }

//delete chunks by documents
async deleteChunksByDocument(documentId: string): Promise<void>{
  await this.chunkModel.deleteMany({
    documentId,
  })



}





}
