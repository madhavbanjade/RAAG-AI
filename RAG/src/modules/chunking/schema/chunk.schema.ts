import mongoose from 'mongoose';

export const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document is required'],
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    content: {
      type: String,
      required: [true, 'Chunk content is required'],
      trim: true,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    embeddingStatus: {
      type: String,
      enum: ['PENDING', 'EMBEDDED', 'FAILED'],
      default: 'PENDING',
    },
    embeddingModel:{
        type: String,
        default: null
    },
    vectorDemensions: {
      type: Number,
      default: null,
    },
    metadata: {
      pageNumber: {
        type: Number,
        default: null,
      },
      section: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);



export interface IChunk extends mongoose.Document{
    documentId: string;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    embeddingStatus: "PENDING" | "EMBEDDED" | "FAILED";
    embeddingModel?: string;
    vectorDemensions?: number;
    metadata?:{
        pageNumber?: number;
        section?: string;

    }

}
