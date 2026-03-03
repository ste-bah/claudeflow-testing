import type { HeatmapResponseRaw, HeatmapData, IndexFilter, SectorFilter } from '../types/heatmap';
import { normalizeHeatmapResponse } from '../types/heatmap';
import { client } from './client';

/**
 * Fetch heatmap data from the backend.
 *
 * @param index  - Index filter ('all', 'sp500', or 'nasdaq100')
 * @param sector - Sector filter ('all' or a GICS sector name)
 * @returns Normalised heatmap data ready for rendering
 */
export async function getHeatmap(
  index: IndexFilter = 'all',
  sector: SectorFilter = 'all',
): Promise<HeatmapData> {
  const params: Record<string, string> = {};
  if (index !== 'all') params.index = index;
  if (sector !== 'all') params.sector = sector;
  const response = await client.get<HeatmapResponseRaw>('/heatmap', { params });
  return normalizeHeatmapResponse(response.data);
}
