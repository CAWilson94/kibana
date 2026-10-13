/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EntityStoreEuid } from '@kbn/entity-store/public';
import {
  buildAlertBasedTilesAllRangesTrailingSeriesQuery,
  trailingAlertsRangeColumn,
  trailingWatchlistedRangeColumn,
} from './entities_with_alerts_trailing_series_query';

const mockEuid = {
  esql: {
    getFieldEvaluations: () => undefined,
    getEuidEvaluation: (_type: string, varName: string) => `${varName} = "mock_euid"`,
  },
} as unknown as EntityStoreEuid;

const build = (filters: string[] = []) =>
  buildAlertBasedTilesAllRangesTrailingSeriesQuery(mockEuid, '.entities-v1', 'default', filters);

describe('buildAlertBasedTilesAllRangesTrailingSeriesQuery', () => {
  it('queries the alerts index for the given space', () => {
    const query = buildAlertBasedTilesAllRangesTrailingSeriesQuery(
      mockEuid,
      '.entities-v1',
      'my-space'
    );
    expect(query).toContain('FROM .alerts-security.alerts-my-space');
  });

  it('reads as far back as the widest range needs', () => {
    expect(build()).toContain('| WHERE @timestamp >= NOW() - 1416h');
  });

  it("groups alerts by hour, then derives each range's own bucket from the hour bucket", () => {
    const query = build();
    expect(query).toContain(
      '| STATS BY hour_bucket = DATE_DIFF("hour", @timestamp, NOW()), _ea_entity_id'
    );
    expect(query).toContain(
      '| EVAL bucket_24h = hour_bucket / 1, bucket_7d = hour_bucket / 6, bucket_30d = hour_bucket / 24'
    );
  });

  it.each([
    ['24h', 24],
    ['7d', 28],
    ['30d', 30],
  ] as const)('returns %s dots for each tile (%i)', (range, dots) => {
    const query = build();
    Array.from({ length: dots }, (_, k) => k).forEach((k) => {
      expect(query).toContain(`${trailingAlertsRangeColumn(range, k)} = COUNT_DISTINCT(`);
      expect(query).toContain(`${trailingWatchlistedRangeColumn(range, k)} = COUNT_DISTINCT(`);
    });
    expect(query).not.toContain(`${trailingAlertsRangeColumn(range, dots)} =`);
  });

  it('gives each dot the buckets of its own range and trailing window', () => {
    const query = build();
    expect(query).toContain(
      `${trailingAlertsRangeColumn(
        '7d',
        5
      )} = COUNT_DISTINCT(effective_id) WHERE bucket_7d >= 5 AND bucket_7d <= 32`
    );
    expect(query).toContain(
      `${trailingWatchlistedRangeColumn(
        '30d',
        29
      )} = COUNT_DISTINCT(watchlisted_effective_id) WHERE bucket_30d >= 29 AND bucket_30d <= 58`
    );
    expect(query).toContain(
      `${trailingAlertsRangeColumn(
        '24h',
        0
      )} = COUNT_DISTINCT(effective_id) WHERE bucket_24h >= 0 AND bucket_24h <= 23`
    );
  });

  it('deduplicates per hour and entity before the LOOKUP JOIN, then renames to entity.id', () => {
    const query = build();
    const statsIdx = query.indexOf('| STATS BY hour_bucket');
    const renameIdx = query.indexOf('| RENAME _ea_entity_id AS `entity.id`');
    const joinIdx = query.indexOf('| LOOKUP JOIN .entities-v1');
    expect(statsIdx).toBeGreaterThan(-1);
    expect(renameIdx).toBeGreaterThan(statsIdx);
    expect(joinIdx).toBeGreaterThan(renameIdx);
  });

  it('counts resolved entities and masks non-watchlisted rows like the tile query', () => {
    const query = build();
    expect(query).toContain(
      '| EVAL effective_id = COALESCE(`entity.relationships.resolution.resolved_to`, entity.id)'
    );
    expect(query).toContain(
      '| EVAL watchlisted_effective_id = CASE(entity.attributes.watchlists IS NOT NULL, effective_id, null)'
    );
  });

  it('does not return entity ids or group the final STATS', () => {
    const query = build();
    expect(query).not.toContain('VALUES(');
    expect(query.split('| STATS\n')[1]).not.toContain(' BY ');
  });

  it('applies entity filter clauses after the LOOKUP JOIN and before the aggregation', () => {
    const filter = '| WHERE entity.type == "user"';
    const query = build([filter]);
    expect(query.indexOf(filter)).toBeGreaterThan(query.indexOf('| LOOKUP JOIN'));
    expect(query.indexOf(filter)).toBeLessThan(query.indexOf('| STATS\n'));
  });
});
