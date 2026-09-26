import { Controller, Get, Post, Req, UploadedFile, UseGuards } from '@nestjs/common';
import { DemoService } from './demo.service';
import { UploadSingle } from 'src/common/config/multer.config';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('demo')
@UseGuards(JwtAuthGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get('status')
  status(@Req() req: any) {
    return this.demoService.getStatus(req.user.id);
  }

  @Post('upload')
  @UploadSingle('file')
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.demoService.uploadAndProcess(req.user.id, file);
  }
}
