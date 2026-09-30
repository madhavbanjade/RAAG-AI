import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    // get point
    return 'Hello Rag!';
  }
}
