import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { ItemsRepository } from './repositories/items.repository';
import { SearchItemsDto } from './dto/search-items.dto';

@Injectable()
export class ItemsSearchService {
    private readonly logger = new Logger(ItemsSearchService.name);

    constructor(
        private readonly itemsRepository: ItemsRepository,
        private readonly configService: ConfigService
    ) { }

    async search(dto: SearchItemsDto) {
        const {
            query, brand, category, locationId,
            colorGroup, materials, embedding,
            limit = 20, offset = 0
        } = dto;

        let searchEmbedding: number[] | null = null;

        if (query) {
            searchEmbedding = await this.generateTextEmbedding(query);
        }

        return this.itemsRepository.search(dto, searchEmbedding);
    }

    async findSimilar(itemId: string, limit: number = 5) {
        const sourceItem = await this.itemsRepository.getEmbeddingById(itemId);

        if (!sourceItem?.embedding) return [];

        return this.itemsRepository.findSimilar(itemId, sourceItem.embedding, limit);
    }

    async getSearchFacets() {
        return this.itemsRepository.getSearchFacets();
    }

    private async generateTextEmbedding(text: string): Promise<number[] | null> {
        try {
            const form = new FormData();
            form.append('text', text);

            const baseURL = this.configService.get<string>('IA_WORKER_BASE_URL');

            const { data } = await axios.post(
                `${baseURL}/embeddings/text`,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 10000,
                }
            );

            return data.embedding;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error('Error generating embedding:', message);
            return null;
        }
    }
}
