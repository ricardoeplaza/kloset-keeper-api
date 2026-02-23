import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import axios from 'axios';
import FormData from 'form-data';

/**
 * Service responsible for communicating with the Python AI worker (FastAPI)
 * to handle category-related AI tasks.
 */
@Injectable()
export class SystemCategoriesService {
  constructor(private readonly configService: ConfigService) { }

  /**
   * Generates a CLIP embedding vector for a given text prompt.
   * @param text The descriptive prompt (e.g., 'A photo of a shirt')
   * @returns A promise that resolves to a 512-dimension vector
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    // 1. Prepare Multipart Form Data for the AI Worker
    const form = new FormData();
    form.append('text', text);

    // 2. Request embedding generation from the FastAPI worker
    const { data } = await axios.post(
      `${this.configService.get<string>('IA_WORKER_BASE_URL')}/embeddings/text`,
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 10000,
      }
    );

    return data.embedding;
  }
}