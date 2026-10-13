/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useMemo } from 'react';
import { lastValueFrom } from 'rxjs';
import { useQuery } from '@kbn/react-query';
import { i18n } from '@kbn/i18n';
import type { ESQLSearchResponse } from '@kbn/es-types';
import type { SecurityAppError } from '@kbn/securitysolution-t-grid';
import { useEntityStoreEuidApi } from '@kbn/entity-store/public';
import { useErrorToast } from '../../../../../common/hooks/use_error_toast';
import { useKibana } from '../../../../../common/lib/kibana';
import { useResolvedLatestEntitiesIndexName } from '../../../../../common/hooks/use_resolved_latest_entities_index_name';
import {
  buildAlertBasedTilesAllRangesTrailingSeriesQuery,
  trailingAlertsRangeColumn,
  trailingWatchlistedRangeColumn,
} from '../queries/entities_with_alerts_trailing_series_query';
import { TRAILING_WINDOW } from '../queries/tile_trailing_window';
import type { TimeRange } from '../../use_time_range_param';
import {
  getEntityFilterESQL,
  EMPTY_ENTITY_FILTERS,
  type EntityFilters,
} from '../../use_entity_filters_param';

export interface AlertBasedTilesTrend {
  /** Entities with alerts, one value per dot, oldest first; the last one is the tile's number. */
  alerts: number[];
  /** Watchlisted, one value per dot, oldest first; the last one is the tile's number. */
  watchlisted: number[];
}

/** The series are cached for an hour, the longest a new point can lag behind the clock. */
const TREND_STALE_TIME_MS = 60 * 60_000;

/**
 * Reads the single result row into oldest-first dots for every time range. A missing or null
 * column counts as 0, and an empty response gives all zeros.
 */
export const parseAlertBasedTilesTrend = (
  raw: ESQLSearchResponse
): Record<TimeRange, AlertBasedTilesTrend> => {
  const row = raw.values?.[0];

  const dotValues = (
    timeRange: TimeRange,
    columnOf: (range: TimeRange, k: number) => string
  ): number[] => {
    const { dots } = TRAILING_WINDOW[timeRange];
    return Array.from({ length: dots }, (_, i) => {
      const k = dots - 1 - i;
      const index = raw.columns?.findIndex((c) => c.name === columnOf(timeRange, k)) ?? -1;
      const value = index < 0 ? undefined : row?.[index];
      return typeof value === 'number' ? value : 0;
    });
  };

  const trendOf = (timeRange: TimeRange): AlertBasedTilesTrend => ({
    alerts: dotValues(timeRange, trailingAlertsRangeColumn),
    watchlisted: dotValues(timeRange, trailingWatchlistedRangeColumn),
  });

  return { '24h': trendOf('24h'), '7d': trendOf('7d'), '30d': trendOf('30d') };
};

/**
 * Runs one trailing-window series query that covers every time range for the Entities with alerts
 * and Watchlisted tiles, and returns the dots of the selected range. Switching range reuses the
 * cached result. The result is kept for an hour, so its last dot can lag the live tile count by up
 * to that long; `useAlertBasedTilesWithDelta` replaces it with the live count. A failing query only
 * shows an error toast; it never changes the tile's count.
 */
export const useAlertBasedTilesTrend = ({
  spaceId,
  skip,
  timeRange = '24h',
  entityFilters = EMPTY_ENTITY_FILTERS,
}: {
  spaceId: string;
  skip?: boolean;
  timeRange?: TimeRange;
  entityFilters?: EntityFilters;
}) => {
  const { data } = useKibana().services;
  const euidApi = useEntityStoreEuidApi();
  const { data: resolvedIndex, isLoading: isIndexLoading } =
    useResolvedLatestEntitiesIndexName(spaceId);

  const isEnabled =
    !skip && !isIndexLoading && Boolean(euidApi) && Boolean(resolvedIndex?.indexName);

  const query = useMemo(() => {
    if (!resolvedIndex?.indexName || !euidApi) return null;
    return buildAlertBasedTilesAllRangesTrailingSeriesQuery(
      euidApi.euid,
      resolvedIndex.indexName,
      spaceId,
      getEntityFilterESQL(entityFilters)
    );
  }, [euidApi, resolvedIndex?.indexName, spaceId, entityFilters]);

  const {
    data: trend,
    isLoading,
    isFetching,
    error,
  } = useQuery<Record<TimeRange, AlertBasedTilesTrend>, SecurityAppError>(
    ['alertBasedTilesTrend', query],
    async ({ signal }) => {
      if (!query) return parseAlertBasedTilesTrend({ columns: [], values: [] });
      const raw = await lastValueFrom(
        data.search.search({ params: { query } }, { abortSignal: signal, strategy: 'esql_async' })
      );
      return parseAlertBasedTilesTrend(raw.rawResponse as unknown as ESQLSearchResponse);
    },
    {
      enabled: isEnabled && Boolean(query),
      keepPreviousData: true,
      staleTime: TREND_STALE_TIME_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );

  const filteredError = error?.message?.includes('Unknown index') ? undefined : error;

  useErrorToast(
    i18n.translate('xpack.securitySolution.entityAnalytics.home.alertBasedTilesTrend.queryError', {
      defaultMessage: 'There was an error loading the entities with alerts trend',
    }),
    filteredError ?? undefined
  );

  return {
    alertsTrend: trend?.[timeRange].alerts,
    watchlistedTrend: trend?.[timeRange].watchlisted,
    isLoading: isEnabled && (isLoading || isFetching),
  };
};
