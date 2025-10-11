import { supabase, handleSupabaseError } from '../lib/supabase';
import { Logger } from '../utils/logger';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import type { ApiResponse } from '../types';

// NOTE: The special 'pdfjsWorker' import has been removed.

interface FileUploadResponse {
  fileId: string;
  filePath: string;
  processedContent?: string;
}

interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export class StorageService {
  private static instance: StorageService;
  
  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/octet-stream'
  ];

  validateFile(file: File): FileValidationResult {
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds ${this.MAX_FILE_SIZE / 1024 / 1024}MB limit`
      };
    }

    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: 'File type not supported. Please use PDF, DOCX, TXT, or MD files.'
      };
    }

    return { isValid: true };
  }

  async uploadKnowledgeBaseFile(
    file: File, 
    userId: string
  ): Promise<ApiResponse<FileUploadResponse>> {
    try {
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const processedContent = await this.extractTextFromFile(file);
      
      const { data: fileRecord, error: dbError } = await supabase
        .from('knowledge_base_files')
        .insert({
          user_id: userId,
          filename: fileName,
          original_filename: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          mime_type: file.type,
          processed_content: processedContent,
          processing_status: processedContent ? 'completed' : 'failed',
        })
        .select('id')
        .single();

      if (dbError) {
        await supabase.storage.from('knowledge-base').remove([fileName]);
        throw dbError;
      }

      return {
        success: true,
        data: {
          fileId: fileRecord.id,
          filePath: uploadData.path,
          processedContent,
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async extractTextFromFile(file: File): Promise<string> {
    switch (file.type) {
      case 'text/plain':
      case 'text/markdown':
      case 'application/octet-stream':
        return this.extractTextFile(file);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return this.extractDocxFile(file);
      
      case 'application/pdf':
        return this.extractPdfFile(file);
        
      default:
        Logger.warn('Unsupported file type for content extraction', { fileName: file.name, fileType: file.type });
        return `[Content from ${file.name} - File type not supported for content extraction]`;
    }
  }

  private async extractTextFile(file: File): Promise<string> {
    return file.text();
  }

  private async extractDocxFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractPdfFile(file: File): Promise<string> {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => (item as any).str).join(' ') + '\n';
    }
    return fullText;
  }
}