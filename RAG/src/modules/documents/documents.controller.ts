import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UploadedFiles } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadMultiple, UploadSingle } from 'src/common/config/multer.config';
import { DEMO_USER_ID } from 'src/common/constants/demo-user';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentsService.create(createDocumentDto, DEMO_USER_ID);
  }

//upload single
  @Post(':id/upload')
  @UploadSingle('file')
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ){
     console.log("FILE RECEIVED:", file);
    return this.documentsService.uploadFile(id, file)
  }

//upload multiple
  @Post(':id/upload-multiple')
  @UploadMultiple('files', 5)
  uploadMultiple(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ){
    return this.documentsService.uploadMultipleFile(id, files)
  }



  @Get()
  findAll() {
    return this.documentsService.findAll();
  }


   @Get('/my')
   findMyDocuments(){
    return this.documentsService.findMyDocuments(DEMO_USER_ID);
   }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  // check

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto) {
    return this.documentsService.update(id, updateDocumentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
