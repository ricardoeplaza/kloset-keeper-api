/**
 * BullMQ Job Factory for AI Processing Pipeline
 * 
 * MAINTENANCE NOTE: Job Retention Strategy
 * -----------------------------------------
 * By default, BullMQ stores completed and failed jobs in Redis forever.
 * To prevent unbounded growth, all jobs created by this factory include
 * automatic cleanup options:
 * 
 * - Completed jobs: Removed after 1 hour OR when exceeding 100 jobs
 * - Failed jobs: Removed after 24 hours OR when exceeding 500 jobs
 * 
 * This is a lazy cleanup - jobs are only purged when new jobs complete/fail.
 * Adjust these values based on your debugging/monitoring needs.
 * 
 * If you need to keep jobs longer for debugging, temporarily increase the
 * count or age limits, but never remove these options entirely in production.
 * 
 * For manual cleanup, you can also use:
 *   await queue.clean(0, 'completed'); // Remove all completed
 *   await queue.clean(0, 'failed');    // Remove all failed
 */

const DEFAULT_JOB_OPTIONS = {
    removeOnComplete: {
        age: 3600,    // Keep completed jobs for 1 hour
        count: 100,   // Keep max 100 completed jobs
    },
    removeOnFail: {
        age: 24 * 3600,  // Keep failed jobs for 24 hours
        count: 500,      // Keep max 500 failed jobs
    },
};

export class ItemJobsFactory {

    static removeBackground(imageId: string, mainFilePath: string, thumbFilePath: string, jobIdSuffix?: string) {
        return {
            name: 'remove-background',
            queueName: 'remove-background',
            data: { imageId, mainFilePath, thumbFilePath },
            opts: { 
                jobId: `remove-bg-${imageId}${jobIdSuffix ? '-' + jobIdSuffix : ''}`, 
                attempts: 3,
                ...DEFAULT_JOB_OPTIONS,
            },
        };
    }

    static generateEmbedding(itemId, name, notes, category, mainFilePath?: string | null, jobIdSuffix?: string) {
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
            opts: { 
                jobId: `embedding-${itemId}${jobIdSuffix ? '-' + jobIdSuffix : ''}`, 
                attempts: 2,
                ...DEFAULT_JOB_OPTIONS,
            },
        };
    }

    static extractColors(itemId: string, mainFilePath: string, thumbFilePath: string, jobIdSuffix?: string) {
        return {
            name: 'extract-colors',
            queueName: 'extract-colors',
            data: {
                itemId,
                thumbFilePath,
                mainFilePath
            },
            opts: { 
                jobId: `extract-colors-${itemId}${jobIdSuffix ? '-' + jobIdSuffix : ''}`, 
                attempts: 2,
                ...DEFAULT_JOB_OPTIONS,
            },
        };
    }
}
