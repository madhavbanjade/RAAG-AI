import * as fs from "fs"; //to read files from disk
import * as path from "path"; //to extract the extension from the file
import { Injectable, Logger } from "@nestjs/common";


//it shows how the response should be 
export interface parseResult {
    text: string,
    meta: Record<string, unknown>
    warnings?: string[]
}

@Injectable()
export class DocumentParserService{
    private readonly logger = new Logger(DocumentParserService.name);
    private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; //50mb




    //extarct the filepatha and the type of the file
    async extract(filePath: string, mimeType:string): Promise<parseResult>{
        await this.validateFile(filePath);
        const ext = path.extname(filePath).toLowerCase();

    this.logger.log(`Parsing file: ${ext} | mimeType: ${mimeType}`);

          if(mimeType.includes("pdf") || ext === ".pdf") return this.parsePDF(filePath);
          if(mimeType.includes("word") || ext === ".docx" || ext === ".doc") return this.parseDocx(filePath);
          if(mimeType.includes("sheet") || ext === ".xlsx" || ext === ".xls") return this.parseExcel(filePath);

          throw new Error(`Unsupported file type: ${mimeType} (${ext})`);

    }

    
//validated the file does the file fullfiled the requirements
    private async validateFile(filePath: string): Promise<void>{
        if(!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);//confirm if file exists on disk
        const stats = fs.statSync(filePath);  //catches empty files that would crash parsers
        if(stats.size === 0) throw new Error("File is empty");
        if(stats.size > this.MAX_FILE_SIZE) throw new Error(`File too large: ...`) //ejects files over 50MB early, before loading them into
    }


    //text from pdf
    private async parsePDF(filePath: string): Promise<parseResult>{
        try {
            const buffer = fs.readFileSync(filePath);
            const uint8array = new Uint8Array(buffer);
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

            const pdf = await pdfjs.getDocument({ data: uint8array }).promise;
            const pageCount = pdf.numPages;

            let fullText = '';
            for (let i = 1; i <= pageCount; i++) {
                try {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += pageText + '\n';
                } catch (pageError) {
                    this.logger.warn(`Failed to extract text from page ${i}: ${pageError}`);
                }
            }

            const text = this.cleanText(fullText);

            if(!text) {
                throw new Error('PDF has no extractable text - maybe scanned/image-based');
            }

            return {
                text,
                meta:{
                    type: "PDF",
                    pages: pageCount,
                    title: null,
                    author: null,
                    wordCount: this.countWords(text)
                }
            }
        } catch (error) {
            this.logger.error(`PDF parsing error: ${error}`);
            throw error;
        }

    }


    //text from docx
    private async parseDocx(filePath: string): Promise<parseResult>{
        const mammoth = await import("mammoth");
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({buffer})
        const text  = this.cleanText(result.value);

        const warnings  = result.messages.filter((m) => m.type === "warning").map((m) => m.message)
          return{
            text,
            meta:{type: 'docx', wordCount: this.countWords(text)},
            warnings: warnings.length ? warnings : undefined
          }
    }


    //text from excel
    private async parseExcel(filePath: string): Promise<parseResult> {
    const xlsx = require("xlsx");
    const workbook = xlsx.readFile(filePath, { cellDates: true, cellText: true });

    const sections: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(sheet, { blankrows: false });
      const cleaned = csv.split("\n").filter((line) => line.replace(/,/g, "").trim()).join("\n");
      sections.push(`=== SHEET: ${sheetName} ===\n${cleaned}`);
    }

    const text = sections.join("\n\n");
     return {
      text,
      meta: {
        type: "xlsx",
        sheets: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
        wordCount: this.countWords(text),
      },
    }
    
}



//this clean up the inconsistent line endings form the pdf/docx and sheets
private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")   // Windows line endings → Unix
      .replace(/\r/g, "\n")     // old Mac line endings → Unix
      .replace(/\t/g, " ")      // tabs → single space
      .replace(/[ ]{2,}/g, " ") // multiple spaces → single space
      .replace(/\n{3,}/g, "\n\n") // 3+ blank lines → max 2
      .trim();
}

//remove the whitespace and only count the real words only
private countWords(text: string): number{
  return text.split(/\s+/).filter(Boolean).length;

}

}
