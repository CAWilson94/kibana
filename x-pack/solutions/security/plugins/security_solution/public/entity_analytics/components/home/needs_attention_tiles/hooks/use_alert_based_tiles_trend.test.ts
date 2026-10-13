/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { renderHook } from '@testing-library/react';
import { of } from 'rxjs';
import { useQuery } from '@kbn/react-query';
import type { ESQLSearchResponse } from '@kbn/es-types';
import { useEntityStoreEuidApi } from '@kbn/entity-store/public';
import { useKibana } from '../../../../../common/lib/kibana';
import { useErrorToast } from '../../../../../common/hooks/use_error_toast';
import { useResolvedLatestEntitiesIndexName } from '../../../../../common/hooks/use_resolved_latest_entities_index_name';
import { parseAlertBasedTilesTrend, useAlertBasedTilesTrend } from './use_alert_based_tiles_trend';

jest.mock('@kbn/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@kbn/entity-store/public', () => ({ useEntityStoreEuidApi: jest.fn() }));
jest.mock('../../../../../common/lib/kibana', () => ({ useKibana: jest.fn() }));
jest.mock('../../../../../common/hooks/use_error_toast', () => ({ useErrorToast: jest.fn() }));
jest.mock('../../../../../common/hooks/use_resolved_latest_entities_index_name', () => ({
  useResolvedLatestEntitiesIndexName: jest.fn(),
}));
jest.mock('../queries/entities_with_alerts_trailing_series_query', () => ({
  ...jest.requireActual('../queries/entities_with_alerts_trailing_series_query'),
  buildAlertBasedTilesAllRangesTrailingSeriesQuery: () => 'FROM alerts | STATS ...',
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseKibana = useKibana as jest.Mock;
const mockUseErrorToast = useErrorToast as jest.Mock;
const mockUseEuidApi = useEntityStoreEuidApi as jest.Mock;
const mockUseIndexName = useResolvedLatestEntitiesIndexName as jest.Mock;
const mockSearch = jest.fn();

const response = (columns: string[], row: Array<number | null>): ESQLSearchResponse =>
  ({
    columns: columns.map((name) => ({ name, type: 'long' })),
    values: [row],
  } as unknown as ESQLSearchResponse);

describe('parseAlertBasedTilesTrend', () => {
  it('returns the dots of every range oldest first, so the last value is the newest dot (0)', () => {
    const { '24h': day, '7d': week } = parseAlertBasedTilesTrend(
      response(
        ['alerts_0_24h', 'alerts_1_24h', 'watchlisted_0_24h', 'alerts_0_7d'],
        [10, 20, 1, 99]
      )
    );
    expect(day.alerts.slice(-2)).toEqual([20, 10]);
    expect(day.watchlisted.slice(-1)).toEqual([1]);
    expect(week.alerts.slice(-1)).toEqual([99]);
  });

  it.each([
    ['24h', 24],
    ['7d', 28],
    ['30d', 30],
  ] as const)('returns %s dots for each tile (%i)', (range, dots) => {
    const trend = parseAlertBasedTilesTrend(response([], []))[range];
    expect(trend.alerts).toHaveLength(dots);
    expect(trend.watchlisted).toHaveLength(dots);
  });

  it('keeps the same dot of different ranges apart', () => {
    const trend = parseAlertBasedTilesTrend(response(['alerts_0_24h', 'alerts_0_30d'], [3, 8]));
    expect(trend['24h'].alerts.slice(-1)).toEqual([3]);
    expect(trend['30d'].alerts.slice(-1)).toEqual([8]);
  });

  it('counts a missing column as 0', () => {
    const { alerts } = parseAlertBasedTilesTrend(response(['alerts_0_24h'], [7]))['24h'];
    expect(alerts[alerts.length - 1]).toBe(7);
    expect(alerts.slice(0, -1).every((value) => value === 0)).toBe(true);
  });

  it('counts a null value as 0', () => {
    const { alerts } = parseAlertBasedTilesTrend(
      response(['alerts_0_24h', 'alerts_1_24h'], [null, 4])
    )['24h'];
    expect(alerts.slice(-2)).toEqual([4, 0]);
  });

  it('returns all zeros for an empty response', () => {
    const trend = parseAlertBasedTilesTrend({
      columns: [],
      values: [],
    } as unknown as ESQLSearchResponse);
    expect(trend['30d'].alerts.every((value) => value === 0)).toBe(true);
    expect(trend['30d'].watchlisted.every((value) => value === 0)).toBe(true);
  });
});

describe('useAlertBasedTilesTrend', () => {
  const allRanges = parseAlertBasedTilesTrend(
    response(['alerts_0_24h', 'alerts_0_7d', 'alerts_0_30d', 'watchlisted_0_30d'], [1, 7, 30, 3])
  );
  const queryResult = (overrides = {}) => ({
    data: allRanges,
    isLoading: false,
    isFetching: false,
    error: undefined,
    ...overrides,
  });
  const opts = { spaceId: 'default' };
  const lastCall = () => mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseKibana.mockReturnValue({ services: { data: { search: { search: mockSearch } } } });
    mockUseEuidApi.mockReturnValue({ euid: {} });
    mockUseIndexName.mockReturnValue({ data: { indexName: '.entities-v1' }, isLoading: false });
    mockUseQuery.mockReturnValue(queryResult());
  });

  it('uses the same cache key for every time range', () => {
    renderHook(() => useAlertBasedTilesTrend({ ...opts, timeRange: '24h' }));
    const key24h = lastCall()[0];
    renderHook(() => useAlertBasedTilesTrend({ ...opts, timeRange: '30d' }));
    expect(lastCall()[0]).toEqual(key24h);
    expect(key24h).not.toContain('24h');
  });

  it('keeps the result fresh for an hour', () => {
    renderHook(() => useAlertBasedTilesTrend(opts));
    expect(lastCall()[2].staleTime).toBe(60 * 60_000);
  });

  it('returns the dots of the selected range from the one cached result', () => {
    const { result: day } = renderHook(() =>
      useAlertBasedTilesTrend({ ...opts, timeRange: '24h' })
    );
    expect(day.current.alertsTrend).toHaveLength(24);
    expect(day.current.alertsTrend?.slice(-1)).toEqual([1]);

    const { result: month } = renderHook(() =>
      useAlertBasedTilesTrend({ ...opts, timeRange: '30d' })
    );
    expect(month.current.alertsTrend).toHaveLength(30);
    expect(month.current.alertsTrend?.slice(-1)).toEqual([30]);
    expect(month.current.watchlistedTrend?.slice(-1)).toEqual([3]);
  });

  it('is enabled only when not skipped and the index and euid api are ready', () => {
    renderHook(() => useAlertBasedTilesTrend(opts));
    expect(lastCall()[2].enabled).toBe(true);

    renderHook(() => useAlertBasedTilesTrend({ ...opts, skip: true }));
    expect(lastCall()[2].enabled).toBe(false);
  });

  it('only shows an error toast when the query fails', () => {
    const error = new Error('boom');
    mockUseQuery.mockReturnValue(queryResult({ data: undefined, error }));
    const { result } = renderHook(() => useAlertBasedTilesTrend(opts));
    expect(mockUseErrorToast).toHaveBeenLastCalledWith(expect.any(String), error);
    expect(result.current.alertsTrend).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not toast for an unknown index', () => {
    mockUseQuery.mockReturnValue(queryResult({ error: new Error('Unknown index [x]') }));
    renderHook(() => useAlertBasedTilesTrend(opts));
    expect(mockUseErrorToast).toHaveBeenLastCalledWith(expect.any(String), undefined);
  });

  it('runs the search with the ES|QL query', async () => {
    mockSearch.mockReturnValue(
      of({ rawResponse: { columns: [{ name: 'alerts_0_24h' }], values: [[5]] } })
    );
    renderHook(() => useAlertBasedTilesTrend(opts));
    const trend = await lastCall()[1]({ signal: undefined });
    expect(mockSearch).toHaveBeenCalledWith(
      { params: { query: 'FROM alerts | STATS ...' } },
      expect.objectContaining({ strategy: 'esql_async' })
    );
    expect(trend['24h'].alerts.slice(-1)).toEqual([5]);
  });
});
