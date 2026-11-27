/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 *
 * Which version of the combined watchlist flow is on. It is one small module-level store, kept in
 * session storage, read by the version bar on the All entities page and on the Settings page, and
 * by the parts of the flow that change with the version.
 *
 * v1: the two PRs as they are.
 * v2: v1 plus the nudge after an add, and the count, callout and suggestion on the edit page.
 * v3: v2 plus the mocked rule history and revert.
 * v4: v3, but the entity flyout adds through the Take action menu instead of the header pencil, and
 *     the toast's button opens the chat instead of leaving the page.
 * v5: v4, and the chat gets a watchlist attachment (its risk modifier, size and sources) as well as
 *     the entity, so the agent starts with the watchlist's real state.
 */

import { useSyncExternalStore } from 'react';

export type WatchlistPrototypeVersion = 'v1' | 'v2' | 'v3' | 'v4' | 'v5';

export const WATCHLIST_PROTOTYPE_VERSIONS: readonly WatchlistPrototypeVersion[] = [
  'v1',
  'v2',
  'v3',
  'v4',
  'v5',
];

export const DEFAULT_WATCHLIST_PROTOTYPE_VERSION: WatchlistPrototypeVersion = 'v1';

export const WATCHLIST_PROTOTYPE_STORAGE_KEY = 'securitySolution.watchlistPrototype.version';

export interface WatchlistPrototypeFeatures {
  /** A dismissable "did the rule miss this?" nudge after an add. */
  readonly nudge: boolean;
  /** The count and callout above the manual entities table, and the suggestion from it. */
  readonly callout: boolean;
  /** The mocked rule history and the revert action. */
  readonly history: boolean;
  /** "Add to existing watchlist" and "Add to new watchlist" in the entity flyout's Take action menu. */
  readonly takeAction: boolean;
  /** The toast's button opens the chat on the same page, instead of a link to the edit page. */
  readonly suggestFromToast: boolean;
  /** The pencil beside Watchlists in the entity flyout header. v4 replaces it with Take action. */
  readonly headerPencil: boolean;
  /** The chat gets a watchlist attachment, not only the entity. */
  readonly watchlistAttachment: boolean;
}

export const isWatchlistPrototypeVersion = (value: unknown): value is WatchlistPrototypeVersion =>
  value === 'v1' || value === 'v2' || value === 'v3' || value === 'v4' || value === 'v5';

export const getWatchlistPrototypeFeatures = (
  version: WatchlistPrototypeVersion
): WatchlistPrototypeFeatures => ({
  nudge: version !== 'v1',
  callout: version !== 'v1',
  history: version === 'v3' || version === 'v4' || version === 'v5',
  takeAction: version === 'v4' || version === 'v5',
  suggestFromToast: version === 'v4' || version === 'v5',
  headerPencil: version !== 'v4' && version !== 'v5',
  watchlistAttachment: version === 'v5',
});

const readStoredVersion = (): WatchlistPrototypeVersion => {
  try {
    const stored = window.sessionStorage.getItem(WATCHLIST_PROTOTYPE_STORAGE_KEY);
    return isWatchlistPrototypeVersion(stored) ? stored : DEFAULT_WATCHLIST_PROTOTYPE_VERSION;
  } catch {
    return DEFAULT_WATCHLIST_PROTOTYPE_VERSION;
  }
};

const writeStoredVersion = (version: WatchlistPrototypeVersion): void => {
  try {
    window.sessionStorage.setItem(WATCHLIST_PROTOTYPE_STORAGE_KEY, version);
  } catch {
    // Storage can be blocked. The version then lasts until the page reloads.
  }
};

let currentVersion: WatchlistPrototypeVersion = readStoredVersion();
const listeners = new Set<() => void>();

export const getWatchlistPrototypeVersion = (): WatchlistPrototypeVersion => currentVersion;

export const setWatchlistPrototypeVersion = (version: WatchlistPrototypeVersion): void => {
  if (version === currentVersion) return;
  currentVersion = version;
  writeStoredVersion(version);
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useWatchlistPrototypeVersion = (): WatchlistPrototypeVersion =>
  useSyncExternalStore(subscribe, getWatchlistPrototypeVersion);

export const useWatchlistPrototypeFeatures = (): WatchlistPrototypeFeatures =>
  getWatchlistPrototypeFeatures(useWatchlistPrototypeVersion());
