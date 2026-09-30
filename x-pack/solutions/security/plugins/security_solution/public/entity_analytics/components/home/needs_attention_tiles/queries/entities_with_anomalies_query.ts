/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EntityStoreEuid } from '@kbn/entity-store/public';
import type { TimeRange } from '../../use_time_range_param';
import { evalGuardedTypedEuids } from './guarded_typed_euid_eval';

const ML_ANOMALIES_INDEX = '.ml-anomalies-shared*';
const ENTITY_TYPES = ['user', 'host', 'service'] as const;

/**
 * Builds a single ES|QL query that counts distinct entities with at least one
 * ML anomaly record within the selected time window, using a LOOKUP JOIN from
 * anomalies → entity-latest on the typed EUID (entity.id).
 */
export const buildEntitiesWithAnomaliesCountQuery = (
  euid: EntityStoreEuid,
  entitiesIndexName: string,
  timeRange: TimeRange = '24h',
  entityFilterClauses: string[] = [],
  jobIds: string[] = []
): string => {
  const parts: string[] = [];

  parts.push(`SET unmapped_fields="nullify";`);
  parts.push(`FROM ${ML_ANOMALIES_INDEX}`);

  const jobFilter =
    jobIds.length > 0 ? ` AND job_id IN (${jobIds.map((id) => `"${id}"`).join(', ')})` : '';
  parts.push(
    `| WHERE result_type == "record" AND is_interim == false AND record_score >= 1 AND @timestamp >= NOW() - ${timeRange}${jobFilter}`
  );

  for (const entityType of ENTITY_TYPES) {
    const fieldEvals = euid.esql.getFieldEvaluations(entityType);
    if (fieldEvals) {
      parts.push(`| EVAL ${fieldEvals}`);
    }
    parts.push(`| EVAL ${euid.esql.getEuidEvaluation(entityType, `${entityType}_euid`)}`);
  }

  parts.push(evalGuardedTypedEuids('derived_euids'));
  parts.push(`| MV_EXPAND derived_euids`);
  parts.push(`| WHERE derived_euids IS NOT NULL`);
  // STATS BY on a temp column avoids grouping on the mapped entity.id field in the anomalies
  // index rather than our computed EUID. RENAME after STATS produces entity.id for the JOIN.
  parts.push(`| STATS BY derived_euids`);
  parts.push(`| RENAME derived_euids AS \`entity.id\``);
  parts.push(`| LOOKUP JOIN ${entitiesIndexName} ON entity.id`);

  parts.push(`| WHERE entity.name IS NOT NULL`);
  parts.push(...entityFilterClauses);

  parts.push(
    `| EVAL effective_id = COALESCE(\`entity.relationships.resolution.resolved_to\`, entity.id)`
  );
  parts.push(`| STATS value = COUNT_DISTINCT(effective_id), entity_ids = VALUES(entity.id)`);

  return parts.join('\n');
};

const DOUBLE_TIME_RANGE: Record<TimeRange, string> = {
  '24h': '48h',
  '7d': '14d',
  '30d': '60d',
};

/**
 * Delta variant of buildEntitiesWithAnomaliesCountQuery.
 *
 * Fetches 2× the selected time range in one scan. Adds `is_current` before the
 * EUID derivation and includes it in the dedup STATS BY so the final STATS can
 * split counts into current and previous periods.
 *
 * Adds `prev_value` to the result alongside the existing `value` and `entity_ids`.
 */
export const buildEntitiesWithAnomaliesCountQueryWithDelta = (
  euid: EntityStoreEuid,
  entitiesIndexName: string,
  timeRange: TimeRange = '24h',
  entityFilterClauses: string[] = [],
  jobIds: string[] = []
): string => {
  const parts: string[] = [];
  const doubleRange = DOUBLE_TIME_RANGE[timeRange];

  parts.push(`SET unmapped_fields="nullify";`);
  parts.push(`FROM ${ML_ANOMALIES_INDEX}`);

  const jobFilter =
    jobIds.length > 0 ? ` AND job_id IN (${jobIds.map((id) => `"${id}"`).join(', ')})` : '';
  parts.push(
    `| WHERE result_type == "record" AND is_interim == false AND record_score >= 1 AND @timestamp >= NOW() - ${doubleRange}${jobFilter}`
  );

  parts.push(`| EVAL is_current = @timestamp >= NOW() - ${timeRange}`);

  for (const entityType of ENTITY_TYPES) {
    const fieldEvals = euid.esql.getFieldEvaluations(entityType);
    if (fieldEvals) {
      parts.push(`| EVAL ${fieldEvals}`);
    }
    parts.push(`| EVAL ${euid.esql.getEuidEvaluation(entityType, `${entityType}_euid`)}`);
  }

  parts.push(evalGuardedTypedEuids('derived_euids'));
  parts.push(`| MV_EXPAND derived_euids`);
  parts.push(`| WHERE derived_euids IS NOT NULL`);
  // Include is_current in the dedup key so current/previous rows survive separately.
  parts.push(`| STATS BY derived_euids, is_current`);
  parts.push(`| RENAME derived_euids AS \`entity.id\``);
  parts.push(`| LOOKUP JOIN ${entitiesIndexName} ON entity.id`);

  parts.push(`| WHERE entity.name IS NOT NULL`);
  parts.push(...entityFilterClauses);

  parts.push(
    `| EVAL effective_id = COALESCE(\`entity.relationships.resolution.resolved_to\`, entity.id)`
  );
  parts.push(`| EVAL current_id  = CASE(is_current,      effective_id, null)`);
  parts.push(`| EVAL previous_id = CASE(NOT is_current, effective_id, null)`);
  parts.push(
    `| STATS value = COUNT_DISTINCT(current_id), prev_value = COUNT_DISTINCT(previous_id), entity_ids = VALUES(current_id)`
  );

  return parts.join('\n');
};
