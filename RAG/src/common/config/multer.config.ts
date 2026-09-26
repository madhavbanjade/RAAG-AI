import {
  applyDecorators,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

//Multer checks size before you know the file type. !!!
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
const DOC_EXT = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
];

const VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const AUDIO_EXT = ['.mp3', '.wav', '.aac', '.ogg'];
const ARCHIVE_EXT = ['.zip', '.rar', '.7z', '.tar', '.gz'];

export const ALL_EXT = [
  ...IMAGE_EXT,
  ...DOC_EXT,
  // ...VIDEO_EXT,
  // ...AUDIO_EXT,
  // ...ARCHIVE_EXT,
];

const MAX_FILE_SIZE = {
  image: 5 * 1024 * 1024, //5mb
  document: 10 * 1024 * 1024, //10mb
  // video: 100 * 1024 * 1024, //100mb
  // audio: 20 * 1024 * 1024, //20mb
  // archive: 200 * 1024 * 1024, //200mb
};

export const getFileCategory = (ext: string) => {
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (DOC_EXT.includes(ext)) return 'document';
  // if (VIDEO_EXT.includes(ext)) return 'video';
  // if (AUDIO_EXT.includes(ext)) return 'audio';
  // if (ARCHIVE_EXT.includes(ext)) return 'archive';
  return null;
};

// whether accept or reject files globally accepted "Is this a known file type?""
const fileFilter = (
  req: Request,
  file: Express.Multer.File, //name,mimetype, size
  callback: (error: Error | null, acceptFile: boolean) => void, //stop upload with error
) => {
  const ext = extname(file.originalname).toLocaleLowerCase(); //shirt.png => .png

  const category = getFileCategory(ext);
  if (!category) {
    return callback(
      new BadRequestException(
        `Invalid file type: ${ext}. Allowed: ${ALL_EXT.join(', ')}`,
      ),
      false,
    );
  }
  //allow upload
  callback(null, true);
};

//storgae engine
const storage = diskStorage({
  destination: (req: Request, file: Express.Multer.File, callback) => {
    const ext = extname(file.originalname).toLocaleLowerCase();
    const category = getFileCategory(ext);

    if (!category) {
      return callback(new Error('Invalid file category'), '');
    }

    //build folder path localhost:3333/uploads/category
    const folder = join(process.cwd(), 'uploads', category);
    console.log('📁 Saving to folder:', folder);
    try {
      //Creates the folder if it doesn’t exist. src/uploads/<category>
      fs.mkdirSync(folder, { recursive: true });
      //No error, and use this folder path
      callback(null, folder);
    } catch (error) {
      callback(error as Error, folder);
    }
  },

  //Save the file with THIS name
  //1707462338123-834928374.png
  //1707462338123-192837465.mp4
  filename: (req: Request, file: Express.Multer.File, callback) => {
    const ext = extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${unique}${ext}`);
  },
});

// Limits (pick largest allowed file size)
const limits = {
  fileSize: Math.max(...Object.values(MAX_FILE_SIZE)),
  // files: 50,
};

//export decorators
export const UploadSingle = (fieldName = 'file') => {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, { storage, fileFilter, limits }),
    ),
  );
};

export const UploadMultiple = (fieldName = 'files', maxCount = 10) => {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor(fieldName, maxCount, { storage, fileFilter, limits }),
    ),
  );
};