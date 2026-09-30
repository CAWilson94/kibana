/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EntityStoreEuid } from '@kbn/entity-store/public';
import type { TimeRange } from '../../use_time_range_param';
import { buildAlertEuidPipeline, buildAlertEuidPipelineWithPeriod } from './alert_euid_pipeline';

const alertsIndex = (spaceId: string) => `.alerts-security.alerts-${spaceId}`;

/**
 * Builds a single ES|QL query that computes both the entities-with-alerts count
 * and the watchlisted-entities-with-alerts count in one pass over the alerts index.
 *
 * This avoids running the EUID pipeline twice (once per tile). Both tile 1 and tile 5
 * consume their respective columns from the single STATS result.
 *
 * Performance: a STATS BY entity.id deduplication step runs before the LOOKUP JOIN,
 * reducing join cardinality from O(alerts) to O(distinct entities). The @timestamp
 * rename dance is not needed because @timestamp is dropped by the deduplication STATS.
 *
 * Watchlist filtering uses entity.attributes.watchlists IS NOT NULL evaluated after
 * the LOOKUP JOIN, replacing the old entity-latest last_seen approach. An entity
 * qualifies for the watchlist tile when it is watchlisted AND has an alert in the
 * selected time window (based on alert @timestamp, per Marios call 2025-09-18).
 *
 * COUNT_DISTINCT and VALUES ignore null values, so nulling out non-watchlisted rows
 * is all that is needed to produce the watchlist-only aggregation.
 */
export const buildAlertBasedTilesQuery = (
  euid: EntityStoreEuid,
  entitiesIndexName: string,
  spaceId: string,
  timeRange: TimeRange = '24h',
  entityFilterClauses: string[] = []
): string => {
  const parts: string[] = [];

  parts.push(`SET unmapped_fields="nullify";`);
  parts.push(`FROM ${alertsIndex(spaceId)}`);
  parts.push(`| WHERE @timestamp >= NOW() - ${timeRange}`);
  parts.push(...buildAlertEuidPipeline(euid));

  parts.push(`| LOOKUP JOIN ${entitiesIndexName} ON entity.id`);
  // Discard entity IDs that have no entity-latest record (unrecognised identifiers).
  parts.push(`| WHERE entity.name IS NOT NULL`);
  parts.push(...entityFilterClauses);

  parts.push(
    `| EVAL effective_id = COALESCE(\`entity.relationships.resolution.resolved_to\`, entity.id)`
  );

  // Compute watchlist columns — null for non-watchlisted rows so COUNT_DISTINCT/VALUES ignore them.
  parts.push(`| EVAL is_watchlisted = entity.attributes.watchlists IS NOT NULL`);
  parts.push(`| EVAL watchlisted_effective_id = CASE(is_watchlisted, effective_id, null)`);
  parts.push(`| EVAL watchlisted_entity_id    = CASE(is_watchlisted, entity.id, null)`);

  parts.push(`| STATS`);
  parts.push(`    alerts_count           = COUNT_DISTINCT(effective_id),`);
  parts.push(`    alerts_entity_ids      = VALUES(effective_id),`);
  parts.push(`    watchlisted_count      = COUNT_DISTINCT(watchlisted_effective_id),`);
  parts.push(`    watchlisted_entity_ids = VALUES(watchlisted_entity_id)`);

  return parts.join('\n');
};

// Maps each time range to a 2x fetch window for the delta query.
const DOUBLE_TIME_RANGE: Record<TimeRange, string> = {
  '24h': '48h',
  '7d': '14d',
  '30d': '60d',
};

/**
 * Delta variant of buildAlertBasedTilesQuery.
 *
 * Fetches 2× the selected time range in one scan and labels each alert as
 * "current" (within the selected range) or "previous" (the preceding equal
 * period). The EUID pipeline carries `is_current` through the dedup STATS so
 * COUNT_DISTINCT can be split per period without a second query.
 *
 * Adds two extra columns to the STATS result:
 *   alerts_prev_count      — entity count for the previous period
 *   watchlisted_prev_count — watchlisted entity count for the previous period
 *
 * All existing columns (alerts_count, alerts_entity_ids, watchlisted_count,
 * watchlisted_entity_ids) retain the same meaning as in the original query.
 */
export const buildAlertBasedTilesQueryWithDelta = (
  euid: EntityStoreEuid,
  entitiesIndexName: string,
  spaceId: string,
  timeRange: TimeRange = '24h',
  entityFilterClauses: string[] = []
): string => {
  const parts: string[] = [];
  const doubleRange = DOUBLE_TIME_RANGE[timeRange];

  parts.push(`SET unmapped_fields="nullify";`);
  parts.push(`FROM ${alertsIndex(spaceId)}`);
  parts.push(`| WHERE @timestamp >= NOW() - ${doubleRange}`);
  // Label each alert before FORK so both branches can KEEP the column.
  parts.push(`| EVAL is_current = @timestamp >= NOW() - ${timeRange}`);
  parts.push(...buildAlertEuidPipelineWithPeriod(euid));

  parts.push(`| LOOKUP JOIN ${entitiesIndexName} ON entity.id`);
  parts.push(`| WHERE entity.name IS NOT NULL`);
  parts.push(...entityFilterClauses);

  parts.push(
    `| EVAL effective_id = COALESCE(\`entity.relationships.resolution.resolved_to\`, entity.id)`
  );
  parts.push(`| EVAL is_watchlisted = entity.attributes.watchlists IS NOT NULL`);

  // Null out IDs by period so COUNT_DISTINCT naturally splits the two buckets.
  parts.push(`| EVAL current_effective_id    = CASE(is_current,                    effective_id, null)`);
  parts.push(`| EVAL previous_effective_id   = CASE(NOT is_current,                effective_id, null)`);
  parts.push(`| EVAL current_watchlisted_id  = CASE(is_current AND is_watchlisted,  effective_id, null)`);
  parts.push(`| EVAL previous_watchlisted_id = CASE(NOT is_current AND is_watchlisted, effective_id, null)`);

  parts.push(`| STATS`);
  parts.push(`    alerts_count           = COUNT_DISTINCT(current_effective_id),`);
  parts.push(`    alerts_prev_count      = COUNT_DISTINCT(previous_effective_id),`);
  parts.push(`    alerts_entity_ids      = VALUES(current_effective_id),`);
  parts.push(`    watchlisted_count      = COUNT_DISTINCT(current_watchlisted_id),`);
  parts.push(`    watchlisted_prev_count = COUNT_DISTINCT(previous_watchlisted_id),`);
  parts.push(`    watchlisted_entity_ids = VALUES(current_watchlisted_id)`);

  return parts.join('\n');
};
