import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

import { COLOR_GROUPS } from 'src/common/constants/color-map.constants';
import { getClosestGroupName, prepareColorGroups, rgbToHex } from 'src/common/utils/color-utils';

interface Cluster {
  centroid: [number, number, number];
  points: number[][];
}

interface ColorProcessingEntry {
  group: string;
  hex: string;
  population: number;
}

/**
 * Represents the final color analysis result for a garment.
 */
export interface ColorResult {
  hex: string;
  group: string;
  percentage: number;
}

@Injectable()
export class ImagesColorsService {
  /**
   * Pre-processed color groups for faster distance calculation.
   */
  private preparedGroups = prepareColorGroups(COLOR_GROUPS);

  /**
   * Extracts dominant colors from an image buffer using K-Means clustering.
   * Maps extracted colors to commercial color names and calculates distribution percentages.
   * @param imageBuffer - The image buffer (ideally with transparent background).
   * @param k - Number of clusters (dominant colors) to extract.
   * @returns An array of ColorResult sorted by prevalence.
   */
  async extractColors(imageBuffer: Buffer, k: number = 3): Promise<ColorResult[]> {
    // 1. Image Pre-processing: Resize to speed up calculation without losing color context.
    const { data } = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: number[][] = [];

    // 2. Pixel Extraction: Ignore transparent or near-transparent background pixels.
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 15) { // Threshold to avoid edge noise
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }

    if (pixels.length === 0) return [];

    // 3. K-Means Execution.
    const clusters = this.kMeans(pixels, k);
    const totalPopulation = clusters.reduce((sum, c) => sum + c.points.length, 0);

    // 4. Semantic Aggregation: Map clusters to commercial color names.
    const aggregatedMap = new Map<string, {
      population: number,
      r: number,
      g: number,
      b: number
    }>();

    for (const cluster of clusters) {
      if (cluster.points.length === 0) continue;

      const [r, g, b] = cluster.centroid;
      const population = cluster.points.length;
      const groupName = getClosestGroupName(r, g, b, this.preparedGroups);

      const current = aggregatedMap.get(groupName) || { population: 0, r: 0, g: 0, b: 0 };

      current.population += population;
      current.r += r * population;
      current.g += g * population;
      current.b += b * population;

      aggregatedMap.set(groupName, current);
    }

    // 5. Noise Filtering: Remove colors with less than 15% presence.
    const MIN_PERCENTAGE = 15;
    const filteredResults: ColorResult[] = [];
    const processedEntries: ColorProcessingEntry[] = [];

    let totalValidPopulation = 0;

    aggregatedMap.forEach((data, groupName) => {
      const percentage = (data.population / totalPopulation) * 100;
      if (percentage >= MIN_PERCENTAGE) {
        totalValidPopulation += data.population;
        processedEntries.push({
          group: groupName,
          hex: rgbToHex(
            Math.round(data.r / data.population),
            Math.round(data.g / data.population),
            Math.round(data.b / data.population)
          ),
          population: data.population
        });
      }
    });

    // Handle edge case where all colors are filtered (e.g., extremely diverse noise).
    if (filteredResults.length === 0 && aggregatedMap.size > 0) {
      // Logic could be added here to take the single most dominant color.
    }

    // 6. Normalization: Re-calculate percentages to ensure they sum exactly 100%.
    const finalResults: ColorResult[] = processedEntries.map(entry => ({
      hex: entry.hex,
      group: entry.group,
      percentage: Math.round((entry.population / totalValidPopulation) * 100)
    })).sort((a, b) => b.percentage - a.percentage);

    // Adjust the sum to 100% (correcting rounding errors).
    const currentSum = finalResults.reduce((sum, r) => sum + r.percentage, 0);
    if (finalResults.length > 0 && currentSum !== 100) {
      const diff = 100 - currentSum;
      finalResults[0].percentage += diff;
    }

    return finalResults;
  }

  /**
   * K-Means clustering algorithm implementation.
   */
  private kMeans(data: number[][], k: number, maxIterations = 10): Cluster[] {
    // Initializing centroids by randomly picking points from data.
    let centroids = [...data]
      .sort(() => 0.5 - Math.random())
      .slice(0, k)
      .map(p => [...p] as [number, number, number]);

    let clusters: Cluster[] = [];

    for (let i = 0; i < maxIterations; i++) {
      clusters = centroids.map(c => ({ centroid: c, points: [] }));

      // Assignment step.
      for (const point of data) {
        let minDist = Infinity;
        let idx = 0;

        for (let j = 0; j < centroids.length; j++) {
          const dist = Math.pow(point[0] - centroids[j][0], 2) +
            Math.pow(point[1] - centroids[j][1], 2) +
            Math.pow(point[2] - centroids[j][2], 2);
          if (dist < minDist) {
            minDist = dist;
            idx = j;
          }
        }
        clusters[idx].points.push(point);
      }

      // Update step: recalculate centroids.
      centroids = clusters.map(cluster => {
        if (cluster.points.length === 0) return cluster.centroid;

        const sum = cluster.points.reduce(
          (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
          [0, 0, 0]
        );
        const count = cluster.points.length;
        return [
          Math.round(sum[0] / count),
          Math.round(sum[1] / count),
          Math.round(sum[2] / count)
        ];
      });
    }
    return clusters;
  }
}