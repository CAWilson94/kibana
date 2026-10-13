/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EntityStoreEuid } from '@kbn/entity-store/public';
import type { TimeRange } from '../../use_time_range_param';
import { alertsIndex } from './entities_with_alerts_query';
import { buildAlertEuidPipeline } from './alert_euid_pipeline';
import { TRAILING_WINDOW, trailingFetchHours } from './tile_trailing_window';

/** Returns the result column of dot `k` (0 = newest) for the Entities with alerts tile. */
export const trailingAlertsColumn = (k: number): string => `alerts_${k}`;

/** Returns the result column of dot `k` (0 = newest) for the Watchlisted tile. */
export const trailingWatchlistedColumn = (k: number): string => `watchlisted_${k}`;

const ALL_RANGES = Object.keys(TRAILING_WINDOW) as TimeRange[];
const HOUR_BUCKET_COLUMN = 'hour_bucket';

const rangeBucketColumn = (timeRange: TimeRange): string => `bucket_${timeRange}`;

/** Returns the result column of dot `k` (0 = newest) of the Entities with alerts tile for a time range. */
export const trailingAlertsRangeColumn = (timeRange: TimeRange, k: number): string =>
  `${trailingAlertsColumn(k)}_${timeRange}`;

/** Returns the result column of dot `k` (0 = newest) of the Watchlisted tile for a time range. */
export const trailingWatchlistedRangeColumn = (timeRange: TimeRange, k: number): string =>
  `${trailingWatchlistedColumn(k)}_${timeRange}`;

/**
 * Builds one query that returns the sparkline dots of the Entities with alerts and Watchlisted
 * tiles for every time range at once, as columns of a single row.
 *
 * Alerts are deduplicated per (hour, entity) before the LOOKUP JOIN; the 6-hour and 1-day buckets
 * are derived from the hour bucket, so each dot still counts distinct entities over its own
 * window. The query reads as far back as the widest range needs.
 */
export const buildAlertBasedTilesAllRangesTrailingSeriesQuery = (
  euid: EntityStoreEuid,
  entitiesIndexName: string,
  spaceId: string,
  entityFilterClauses: string[] = []
): string => {
  const fetchHours = Math.max(...ALL_RANGES.map(trailingFetchHours));
  const parts: string[] = [];

  parts.push(`SET unmapped_fields="nullify";`);
  parts.push(`FROM ${alertsIndex(spaceId)}`);
  parts.push(`| WHERE @timestamp >= NOW() - ${fetchHours}h`);
  parts.push(
    ...buildAlertEuidPipeline(euid, `${HOUR_BUCKET_COLUMN} = DATE_DIFF("hour", @timestamp, NOW())`)
  );

  parts.push(`| LOOKUP JOIN ${entitiesIndexName} ON entity.id`);
  parts.push(`| WHERE entity.name IS NOT NULL`);
  parts.push(...entityFilterClauses);

  parts.push(
    `| EVAL effective_id = COALESCE(\`entity.relationships.resolution.resolved_to\`, entity.id)`
  );
  parts.push(
    `| EVAL watchlisted_effective_id = CASE(entity.attributes.watchlists IS NOT NULL, effective_id, null)`
  );
  parts.push(
    `| EVAL ${ALL_RANGES.map(
      (range) =>
        `${rangeBucketColumn(range)} = ${HOUR_BUCKET_COLUMN} / ${TRAILING_WINDOW[range].stepHours}`
    ).join(', ')}`
  );

  const aggregations = ALL_RANGES.flatMap((range) => {
    const { dots } = TRAILING_WINDOW[range];
    const bucket = rangeBucketColumn(range);
    return Array.from({ length: dots }, (_, k) => {
      const dotWindow = `WHERE ${bucket} >= ${k} AND ${bucket} <= ${k + dots - 1}`;
      return [
        `${trailingAlertsRangeColumn(range, k)} = COUNT_DISTINCT(effective_id) ${dotWindow}`,
        `${trailingWatchlistedRangeColumn(
          range,
          k
        )} = COUNT_DISTINCT(watchlisted_effective_id) ${dotWindow}`,
      ];
    }).flat();
  });
  parts.push(`| STATS`);
  parts.push(`    ${aggregations.join(',\n    ')}`);

  return parts.join('\n');
};
