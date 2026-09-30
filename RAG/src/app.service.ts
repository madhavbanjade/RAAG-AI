import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    // get point ma hamro kasko
    return 'Hello Rag!';
  }
}
