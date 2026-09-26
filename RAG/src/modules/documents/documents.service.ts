import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { InjectModel } from '@nestjs/mongoose';
import { IDocument } from './schema/documents.schema';
import { Model } from 'mongoose';
import { ErrorHandler } from 'src/common/handlers/error-handlers';
import { SuccessResponseHandler } from 'src/common/handlers/success-handlers';
import * as fs from 'fs';
import { join } from 'path';
import { DocumentParserService } from 'src/common/services/document-parser.service';
import { createHash } from 'crypto';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embeddings/embeddings.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel('Document')
    private readonly documentModel: Model<IDocument>,
    private readonly documentParserService: DocumentParserService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  private calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  //the documents service is created to get metasdata from the pdf. the only purpose of the modules.
  async create(documentData: CreateDocumentDto, userId: string) {
    return ErrorHandler.execute(async () => {
      const document = await this.documentModel.create({
        ...documentData,
        files: [],
        uploadedBy: userId,
      });

      return SuccessResponseHandler.created('Documents', document);
    }, 'Failed to Create Document');
  }

  async findAll() {
    return ErrorHandler.execute(async () => {
      const documents = await this.documentModel
        .find()
        .populate('uploadedBy', 'name email role');

      if (documents.length === 0) {
        throw ErrorHandler.notFound('Documents');
      }

      return SuccessResponseHandler.retrived('Documents', documents);
    }, 'Failed to getall documents');
  }

  async findOne(id: string) {
    return ErrorHandler.execute(async () => {
      const document = await this.documentModel.findById(id);
      console.log(await this.documentModel.findById(id));

      if (!document) {
        throw ErrorHandler.notFound('Document');
      }
      return SuccessResponseHandler.retrived('Document', document);
    }, 'Failed to get one document');
  }

  async findMyDocuments(userId: string) {
    return ErrorHandler.execute(async () => {
      const myDocument = await this.documentModel.find({
        uploadedBy: userId,
      });

      if (myDocument.length === 0) {
        throw ErrorHandler.notFound('My Documents');
      }

      return SuccessResponseHandler.retrived('myDocs', myDocument);
    }, 'Failed to get my Document');
  }

  async update(id: string, documentData: UpdateDocumentDto) {
    return ErrorHandler.execute(async () => {
      const document = await this.documentModel.findByIdAndUpdate(
        id,
        documentData,
        {
          new: true,
        },
      );
      return SuccessResponseHandler.updated('Documents', document);
    }, 'Failed to update documents');
  }

  async remove(id: string) {
    return ErrorHandler.execute(async () => {
      const document = await this.documentModel.findById(id);

      if (!document) {
        throw ErrorHandler.notFound('Document');
      }

      // 1. Delete files from disk
      if (document.files && document.files.length > 0) {
        for (const file of document.files) {
          if (file.filePath) {
            const fullPath = join(process.cwd(), file.filePath);

            try {
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath); // delete file
              }
            } catch (err) {
              console.error(`Failed to delete file: ${fullPath}`, err);
            }
          }
        }
      }

      // 2. Delete document from DB
      const deleted = await this.documentModel.findByIdAndDelete(id);

      return SuccessResponseHandler.deleted('Document', deleted);
    }, 'Failed to delete document');
  }

  //upload-single docs
  async uploadFile(id: string, file: Express.Multer.File) {
    return ErrorHandler.execute(async () => {
      const document = await this.documentModel.findById(id);
      if (!document) {
        throw ErrorHandler.notFound('Document');
      }

      if (!file) {
        throw ErrorHandler.operationFailed('File is Required !');
      }

      if (!file || !file.originalname || !file.path) {
        throw new BadRequestException('Invalid file upload');
      }

      const fileHash = this.calculateFileHash(file.path);

      const isDuplicate = document.files.some((f) => f.fileHash === fileHash);
      if (isDuplicate) {
        fs.unlinkSync(file.path);
        throw new BadRequestException(
          `Duplicate file detected: "${file.originalname}" has already been uploaded to this document`,
        );
      }

      document.files.push({
        originalName: file.originalname,
        filePath: file.path.replace(process.cwd(), ''),
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash,
      });

      document.status = 'UPLOADED';

      await document.save();

      //parse after save
      const parsed = await this.documentParserService.extract(
        file.path,
        file.mimetype,
      );

      console.log('Parsed', parsed);

      await this.documentModel.findByIdAndUpdate(id, { status: 'PARSED' });

      await this.chunkingService.processDocument(document.id, parsed.text);
      await this.documentModel.findByIdAndUpdate(id, { status: 'CHUNKED' });

      await this.embeddingService.processDocument(document.id);

      await this.documentModel.findByIdAndUpdate(id, { status: 'EMBEDDED' });

      return SuccessResponseHandler.uploaded('Document', parsed);
    }, 'Failed to upload single file');
  }

  //upload multiple files
  async uploadMultipleFile(id: string, files: Express.Multer.File[]) {
    return ErrorHandler.execute(async () => {
      const document = await this.documentModel.findById(id);

      if (!document) {
        throw ErrorHandler.notFound('Document');
      }

      // ✅ IMPORTANT: validate files properly
      if (!files || files.length === 0) {
        throw ErrorHandler.operationFailed('Files are required!');
      }

      // ✅ safety: remove invalid files if any
      const validFiles = files.filter(
        (file) => file?.originalname && file?.path,
      );

      if (validFiles.length === 0) {
        throw ErrorHandler.operationFailed('No valid files found!');
      }

      const mapped = validFiles.map((file) => {
        const fileHash = this.calculateFileHash(file.path);
        return {
          originalName: file.originalname,
          filePath: file.path.replace(process.cwd(), ''),
          mimeType: file.mimetype,
          fileSize: file.size,
          fileHash,
        };
      });

      // ✅ Check for duplicates in existing document files
      const existingHashes = document.files.map((f) => f.fileHash);
      const newHashes = mapped.map((f) => f.fileHash);

      for (const newFile of mapped) {
        if (existingHashes.includes(newFile.fileHash)) {
          validFiles.forEach((f) => {
            try {
              fs.unlinkSync(f.path);
            } catch (e) {
              // ignore cleanup errors
            }
          });
          throw new BadRequestException(
            `Duplicate file detected: "${newFile.originalName}" has already been uploaded to this document`,
          );
        }
      }

      // ✅ Check for duplicates within the new files being uploaded
      const duplicateInBatch = newHashes.some(
        (hash, index) => newHashes.indexOf(hash) !== index,
      );
      if (duplicateInBatch) {
        validFiles.forEach((f) => {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {
            // ignore cleanup errors
          }
        });
        throw new BadRequestException(
          'Duplicate files detected within this batch upload',
        );
      }

      // ✅ push correctly
      document.files.push(...mapped);

      document.status = 'UPLOADED';

      await document.save();

      //parse each files
      const parsedResults: Array<{
        originalName: string | undefined;
        text: string;
        meta: Record<string, unknown>;
        warnings?: string[];
      }> = [];

      for (const file of validFiles) {
        const parsed = await this.documentParserService.extract(
          file.path,
          file.mimetype,
        );

        parsedResults.push({
          originalName: file.originalname,
          ...parsed,
        });

        await this.documentModel.findByIdAndUpdate(id, { status: 'PARSED' });

        await this.chunkingService.processDocument(document.id, parsed.text);

        await this.documentModel.findByIdAndUpdate(id, { status: 'CHUNKED' });

        await this.embeddingService.processDocument(document.id);

        await this.documentModel.findByIdAndUpdate(id, { status: 'EMBEDDED' });
      }

      return SuccessResponseHandler.uploaded('Multiple Files', {
        parsed: parsedResults,
      });
    }, 'Failed to upload multiple files');
    //hello
  }
}
