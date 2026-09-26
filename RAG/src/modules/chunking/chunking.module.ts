import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service';
import { MongooseModule } from '@nestjs/mongoose';
import { chunkSchema } from './schema/chunk.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Chunk',
        schema: chunkSchema,
      },
    ]),
  ],
  providers: [ChunkingService],
  exports: [ChunkingService],
})
export class ChunkingModule {}
