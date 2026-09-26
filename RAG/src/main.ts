import * as  dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
// de
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import "./modules/database/database.providers.js"

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);



  //upload files
  //changing while deplying
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      //forbidNonWhitelisted: true, // throws error for extra fields
      transform: true, // auto-transform types
    }),
  );

  // No auth/cookies anywhere in this app anymore, so the frontend can be
  // opened from any local origin (file://, a static server on any port, etc).
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  app.setGlobalPrefix('api/v1'); // all routes will be prefixed with /apif
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
console.log('RAG is running in port');
console.log(`your app in running ${process.env.PORT}`);
console.log('Database Connected ✅');