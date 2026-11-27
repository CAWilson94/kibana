/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act, renderHook } from '@testing-library/react';
import {
  getWatchlistPrototypeFeatures,
  getWatchlistPrototypeVersion,
  isWatchlistPrototypeVersion,
  setWatchlistPrototypeVersion,
  useWatchlistPrototypeVersion,
  WATCHLIST_PROTOTYPE_STORAGE_KEY,
} from './watchlist_prototype_state';

describe('watchlist prototype features', () => {
  it('turns on nothing new in v1, and keeps the header pencil', () => {
    expect(getWatchlistPrototypeFeatures('v1')).toEqual({
      nudge: false,
      callout: false,
      history: false,
      takeAction: false,
      suggestFromToast: false,
      headerPencil: true,
      watchlistAttachment: false,
    });
  });

  it('turns on the nudge and the callout in v2, but not the history', () => {
    expect(getWatchlistPrototypeFeatures('v2')).toEqual({
      nudge: true,
      callout: true,
      history: false,
      takeAction: false,
      suggestFromToast: false,
      headerPencil: true,
      watchlistAttachment: false,
    });
  });

  it('adds the history in v3, with the pencil and the link toast still as in v2', () => {
    expect(getWatchlistPrototypeFeatures('v3')).toEqual({
      nudge: true,
      callout: true,
      history: true,
      takeAction: false,
      suggestFromToast: false,
      headerPencil: true,
      watchlistAttachment: false,
    });
  });

  it('swaps the pencil for Take action, and the toast link for the chat button, in v4', () => {
    expect(getWatchlistPrototypeFeatures('v4')).toEqual({
      nudge: true,
      callout: true,
      history: true,
      takeAction: true,
      suggestFromToast: true,
      headerPencil: false,
      watchlistAttachment: false,
    });
  });

  it('is v4 plus the watchlist attachment in v5', () => {
    expect(getWatchlistPrototypeFeatures('v5')).toEqual({
      ...getWatchlistPrototypeFeatures('v4'),
      watchlistAttachment: true,
    });
  });

  it('accepts only the five known versions', () => {
    expect(['v1', 'v2', 'v3', 'v4', 'v5'].every(isWatchlistPrototypeVersion)).toBe(true);
    expect(isWatchlistPrototypeVersion('v6')).toBe(false);
    expect(isWatchlistPrototypeVersion(undefined)).toBe(false);
  });
});

describe('watchlist prototype version store', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v1'));
  });

  it('keeps the version it is set to in session storage', () => {
    act(() => setWatchlistPrototypeVersion('v3'));

    expect(getWatchlistPrototypeVersion()).toBe('v3');
    expect(window.sessionStorage.getItem(WATCHLIST_PROTOTYPE_STORAGE_KEY)).toBe('v3');
  });

  it('tells every reader when the version changes', () => {
    const first = renderHook(() => useWatchlistPrototypeVersion());
    const second = renderHook(() => useWatchlistPrototypeVersion());

    act(() => setWatchlistPrototypeVersion('v2'));

    expect(first.result.current).toBe('v2');
    expect(second.result.current).toBe('v2');
  });
});

describe('watchlist prototype version at page load', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.resetModules();
  });

  const loadState = () => import('./watchlist_prototype_state');

  it('starts on v1 when nothing is stored', async () => {
    const { getWatchlistPrototypeVersion: getVersion } = await loadState();

    expect(getVersion()).toBe('v1');
  });

  it('starts on the stored version after a reload in the same session', async () => {
    window.sessionStorage.setItem(WATCHLIST_PROTOTYPE_STORAGE_KEY, 'v3');
    const { getWatchlistPrototypeVersion: getVersion } = await loadState();

    expect(getVersion()).toBe('v3');
  });

  it('falls back to v1 when the stored value is not a known version', async () => {
    window.sessionStorage.setItem(WATCHLIST_PROTOTYPE_STORAGE_KEY, 'v9');
    const { getWatchlistPrototypeVersion: getVersion } = await loadState();

    expect(getVersion()).toBe('v1');
  });
});
