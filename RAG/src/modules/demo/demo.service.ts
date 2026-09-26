import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import { join } from 'path';
import { IDocument } from '../documents/schema/documents.schema';
import { IChunk } from '../chunking/schema/chunk.schema';
import { DocumentParserService } from 'src/common/services/document-parser.service';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embeddings/embeddings.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { RerankService } from 'src/common/services/rerank.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    @InjectModel('Document')
    private readonly documentModel: Model<IDocument>,
    @InjectModel('Chunk')
    private readonly chunkModel: Model<IChunk>,
    private readonly documentParserService: DocumentParserService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly rerankService: RerankService,
    private readonly chatService: ChatService,
  ) {}

  //whether the CALLING USER currently has an active document, so a freshly
  //logged-in browser can hydrate its UI without forcing a re-upload
  async getStatus(userId: string) {
    const document = await this.documentModel.findOne({ uploadedBy: userId }).lean();
    if (!document) {
      return { active: false };
    }

    const file = document.files?.[0];
    const chunkCount = await this.chunkModel.countDocuments({ documentId: String(document._id) });

    return {
      active: true,
      fileName: file?.originalName ?? document.title,
      fileUrl: file?.filePath ? file.filePath.replace(/\\/g, '/') : undefined,
      chunks: chunkCount,
      strategies: document.strategies ?? null,
    };
  }

  //wipes whatever this user's previous upload left behind (one active PDF per user)
  //returns the deleted document, if any, so callers know whether a replace happened
  private async resetUserDocument(userId: string) {
    const existing = await this.documentModel.findOne({ uploadedBy: userId }).lean();
    if (!existing) return null;

    await this.chunkModel.deleteMany({ documentId: String(existing._id) });

    try {
      await this.vectorStoreService.deleteByDocumentId(String(existing._id));
    } catch (error) {
      this.logger.warn(`Failed to clear previous vectors for user ${userId}: ${error}`);
    }

    if (existing.files?.length) {
      for (const file of existing.files) {
        if (!file.filePath) continue;
        const fullPath = join(process.cwd(), file.filePath);
        try {
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch {
          this.logger.warn(`Failed to delete old file: ${fullPath}`);
        }
      }
    }

    await this.documentModel.findByIdAndDelete(existing._id);
    return existing;
  }

  async uploadAndProcess(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A PDF file is required');
    }

    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (ext !== 'pdf' && !file.mimetype.includes('pdf')) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // ignore cleanup errors
      }
      throw new BadRequestException('Only PDF files are supported in this demo');
    }

    const previousDocument = await this.resetUserDocument(userId);

    const parsed = await this.documentParserService.extract(file.path, file.mimetype);

    const document = await this.documentModel.create({
      title: file.originalname,
      files: [
        {
          originalName: file.originalname,
          filePath: file.path.replace(process.cwd(), ''),
          mimeType: file.mimetype,
          fileSize: file.size,
        },
      ],
      uploadedBy: userId,
      status: 'UPLOADED',
    });
    const documentId = String(document._id);

    // 1. simple chunking — measured for the progress panel, not embedded/searched.
    // Real quality signal: % of chunks that happen to end on a clean sentence
    // boundary (fixed-word-count splitting cuts mid-sentence often, so this
    // is genuinely usually below 100%, not a decorative number).
    // Chunk size is scaled to the document so short demo PDFs still produce
    // several chunks to measure — a single-chunk document makes this metric
    // a meaningless 0-or-100 coin flip instead of a real percentage.
    const wordCount = parsed.text.split(/\s+/).filter(Boolean).length;
    const demoChunkSize = Math.max(30, Math.min(500, Math.ceil(wordCount / 6)));
    const demoOverlap = Math.floor(demoChunkSize * 0.1);
    const simpleChunks = this.chunkingService.splitText(parsed.text, demoChunkSize, demoOverlap);
    const simpleCleanBoundaryPct = this.chunkingService.computeCleanBoundaryRate(simpleChunks);
    this.logger.log(`DEBUG simple chunk endings: ${JSON.stringify(simpleChunks.map((c) => c.trim().slice(-15)))}`);

    // 2. semantic chunking — these chunks are the ones actually embedded/searched.
    // Real quality signal: average cosine similarity between sentences that
    // ended up merged into the same chunk (topical coherence), which varies
    // per document instead of always reading 100%.
    const { chunks: semanticChunkTexts, avgCoherence } = await this.chunkingService.semanticSplit(
      parsed.text,
      (sentence) => this.embeddingService.generateEmbedding(sentence),
    );

    const savedChunks = await this.chunkingService.saveChunks(documentId, semanticChunkTexts);
    await this.documentModel.findByIdAndUpdate(documentId, { status: 'CHUNKED' });

    // 3. embed + push into Qdrant — this is what powers hybrid search
    const embeddingResult = await this.embeddingService.processDocument(documentId);

    // 4. reranking readiness — real check, not a decorative number
    const rerankAvailable = this.rerankService.isAvailable();

    const pages = Number(parsed.meta?.pages ?? 1);
    const sizeKB = Math.round((file.size / 1024) * 10) / 10;

    const strategies = {
      simpleChunking: { count: simpleChunks.length, pct: simpleCleanBoundaryPct },
      semanticChunking: { count: savedChunks.length, pct: Math.round(avgCoherence * 100) },
      hybridSearch: {
        embedded: embeddingResult.embeddedChunk,
        total: savedChunks.length,
        pct: savedChunks.length
          ? Math.round((embeddingResult.embeddedChunk / savedChunks.length) * 100)
          : 0,
      },
      reranking: { available: rerankAvailable, pct: rerankAvailable ? 100 : 0 },
    };

    // Persisted so a reload/relogin can restore the strategy panel via
    // getStatus() instead of it only ever existing in this response.
    await this.documentModel.findByIdAndUpdate(documentId, { status: 'EMBEDDED', strategies });

    // Only reset the chat when a PREVIOUS document existed — on someone's
    // very first upload there's nothing stale to clear, so the initial
    // greeting stays intact.
    if (previousDocument) {
      await this.chatService.resetConversationForNewDocument(userId, file.originalname);
    }

    return {
      pages,
      sizeKB,
      chunks: savedChunks.length,
      fileUrl: `/uploads/document/${file.filename}`,
      strategies,
    };
  }
}
