/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { renderHook } from '@testing-library/react';
import { useQuery } from '@kbn/react-query';
import { useEntityStoreEuidApi } from '@kbn/entity-store/public';
import { useKibana } from '../../../../../common/lib/kibana';
import { useResolvedLatestEntitiesIndexName } from '../../../../../common/hooks/use_resolved_latest_entities_index_name';
import { useAlertBasedTilesTrend } from './use_alert_based_tiles_trend';
import { useAlertBasedTilesWithDelta, withLiveLastDot } from './use_entities_with_alerts_tiles';

jest.mock('@kbn/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@kbn/entity-store/public', () => ({ useEntityStoreEuidApi: jest.fn() }));
jest.mock('../../../../../common/lib/kibana', () => ({ useKibana: jest.fn() }));
jest.mock('../../../../../common/hooks/use_error_toast', () => ({ useErrorToast: jest.fn() }));
jest.mock('../../../../../common/hooks/use_resolved_latest_entities_index_name', () => ({
  useResolvedLatestEntitiesIndexName: jest.fn(),
}));
jest.mock('./use_alert_based_tiles_trend', () => ({ useAlertBasedTilesTrend: jest.fn() }));

const mockUseQuery = useQuery as jest.Mock;
const mockTrend = useAlertBasedTilesTrend as jest.Mock;

const loading = { data: undefined, isLoading: true, isFetching: true, error: undefined };
const loaded = (data: Record<string, unknown>) => ({
  data,
  isLoading: false,
  isFetching: false,
  error: undefined,
});
const counts = (alertsCount: number, watchlistedCount: number) => ({
  alertsCount,
  alertsEntityIds: [],
  watchlistedCount,
  watchlistedEntityIds: [],
});

/** Sets whether the tile count and the previous-period query have resolved. */
const setQueries = ({ count, prev }: { count: boolean; prev: boolean }) => {
  mockUseQuery.mockImplementation(([key]: [string]) => {
    if (key === 'alertBasedTilesPrevPeriod') return prev ? loaded(counts(40, 4)) : loading;
    return count ? loaded(counts(50, 5)) : loading;
  });
};

const lastTrendOpts = () => mockTrend.mock.calls[mockTrend.mock.calls.length - 1][0];

describe('useAlertBasedTilesWithDelta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useKibana as jest.Mock).mockReturnValue({
      services: { data: { search: { search: jest.fn() } } },
    });
    (useEntityStoreEuidApi as jest.Mock).mockReturnValue({
      euid: {
        esql: {
          getFieldEvaluations: () => undefined,
          getEuidEvaluation: (_type: string, varName: string) => `${varName} = "mock_euid"`,
        },
      },
    });
    (useResolvedLatestEntitiesIndexName as jest.Mock).mockReturnValue({
      data: { indexName: '.entities-v1' },
      isLoading: false,
    });
    mockTrend.mockReturnValue({
      alertsTrend: [1, 2],
      watchlistedTrend: [1, 2],
      isLoading: false,
    });
  });

  it('holds the sparkline back until the count has loaded', () => {
    setQueries({ count: false, prev: false });
    renderHook(() => useAlertBasedTilesWithDelta({ spaceId: 'default' }));
    expect(lastTrendOpts().skip).toBe(true);
  });

  it('starts the sparkline once the count has loaded, without waiting for the delta', () => {
    setQueries({ count: true, prev: false });
    const { result } = renderHook(() => useAlertBasedTilesWithDelta({ spaceId: 'default' }));
    expect(lastTrendOpts().skip).toBe(false);
    expect(result.current.isDeltaLoading).toBe(true);
  });

  it('does not run the sparkline when the tiles are skipped', () => {
    setQueries({ count: true, prev: true });
    renderHook(() => useAlertBasedTilesWithDelta({ spaceId: 'default', skip: true }));
    expect(lastTrendOpts().skip).toBe(true);
  });

  it('computes the delta from the count and the previous period, whatever the sparkline does', () => {
    setQueries({ count: true, prev: true });
    mockTrend.mockReturnValue({
      alertsTrend: undefined,
      watchlistedTrend: undefined,
      isLoading: false,
    });
    const { result } = renderHook(() => useAlertBasedTilesWithDelta({ spaceId: 'default' }));
    expect(result.current.alertsDelta).toBe(10);
    expect(result.current.watchlistedDelta).toBe(1);
    expect(result.current.alertsCount).toBe(50);
  });
});

describe('withLiveLastDot', () => {
  it('replaces only the newest dot with the live count', () => {
    expect(withLiveLastDot([3, 5, 4], 9, true)).toEqual([3, 5, 9]);
  });

  it('keeps the cached dots while the live count is loading', () => {
    expect(withLiveLastDot([3, 5, 4], 9, false)).toEqual([3, 5, 4]);
  });

  it('shows nothing when there is no series', () => {
    expect(withLiveLastDot(undefined, 9, true)).toBeUndefined();
    expect(withLiveLastDot([], 9, true)).toEqual([]);
  });

  it('does not change the cached array', () => {
    const cached = [3, 5, 4];
    withLiveLastDot(cached, 9, true);
    expect(cached).toEqual([3, 5, 4]);
  });
});

describe('useAlertBasedTilesWithDelta sparkline ends on the live count', () => {
  it('ends both sparklines on the live counts, for any range', () => {
    mockUseQuery.mockImplementation(([key]: [string]) =>
      key === 'alertBasedTilesPrevPeriod' ? loaded(counts(40, 4)) : loaded(counts(50, 5))
    );
    mockTrend.mockReturnValue({
      alertsTrend: [10, 20, 30],
      watchlistedTrend: [1, 2, 3],
      isLoading: false,
    });
    (useKibana as jest.Mock).mockReturnValue({
      services: { data: { search: { search: jest.fn() } } },
    });
    (useEntityStoreEuidApi as jest.Mock).mockReturnValue({
      euid: {
        esql: {
          getFieldEvaluations: () => undefined,
          getEuidEvaluation: (_type: string, varName: string) => `${varName} = "mock_euid"`,
        },
      },
    });
    (useResolvedLatestEntitiesIndexName as jest.Mock).mockReturnValue({
      data: { indexName: '.entities-v1' },
      isLoading: false,
    });

    (['24h', '7d', '30d'] as const).forEach((timeRange) => {
      const { result } = renderHook(() =>
        useAlertBasedTilesWithDelta({ spaceId: 'default', timeRange })
      );
      expect(result.current.alertsTrend).toEqual([10, 20, 50]);
      expect(result.current.watchlistedTrend).toEqual([1, 2, 5]);
    });
  });
});
