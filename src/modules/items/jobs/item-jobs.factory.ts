export class ItemJobsFactory {

    static removeBackground(imageId: string, mainFilePath: string, thumbFilePath: string) {
        return {
            name: 'remove-background',
            queueName: 'image-processing',
            data: { imageId, mainFilePath, thumbFilePath },
            opts: { jobId: `remove-bg-${imageId}`, attempts: 3 },
        };
    }

    static generateEmbedding(itemId, name, notes, mainFilePath?: string | null) {
        return {
            name: 'generate-embedding',
            queueName: 'item-embedding',
            data: {
                itemId,
                name,
                notes,
                mainFilePath
            },
            opts: { jobId: `embedding-${itemId}`, attempts: 2 },
        };
    }
}