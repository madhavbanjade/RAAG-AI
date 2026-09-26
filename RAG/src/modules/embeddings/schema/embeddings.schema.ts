import mongoose from 'mongoose';

export const embeddingSceham = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    chunkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chunk',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    vector: {
      type: [Number],
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    dimensions: {
      type: Number,
      required: true,
    },
  },

  {
    timestamps: true,
  },
);


export interface Embedding extends Omit<mongoose.Document, 'model'> {
  documentId: string;
  chunkId: string;
  content: string;
  vector: number[];
  model: string;
  dimensions: number;
}
