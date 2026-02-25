export class ItemJobsFactory {

    static removeBackground(imageId: string, mainFilePath: string, thumbFilePath: string) {
        return {
            name: 'remove-background',
            queueName: 'remove-background',
            data: { imageId, mainFilePath, thumbFilePath },
            opts: { jobId: `remove-bg-${imageId}`, attempts: 3 },
        };
    }

    static generateEmbedding(itemId, name, notes, category, mainFilePath?: string | null) {
        return {
            name: 'generate-embedding',
            queueName: 'generate-embedding',
            data: {
                itemId,
                name,
                notes,
                category,
                mainFilePath
            },
            opts: { jobId: `embedding-${itemId}`, attempts: 2 },
        };
    }

    static extractColors(itemId: string, mainFilePath: string, thumbFilePath: string) {
        return {
            name: 'extract-colors',
            queueName: 'extract-colors',
            data: {
                itemId,
                thumbFilePath,
                mainFilePath
            },
            opts: { jobId: `extract-colors-${itemId}`, attempts: 2 },
        };
    }
}