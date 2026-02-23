export class SystemConfigDto {
    isInitialized: boolean;
    version: string;
    config: {
        categories: { id: string; name: string }[];
        colors: string[];
        maxBulkSize: number;
    };
}