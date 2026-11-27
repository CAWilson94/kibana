/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TestProviders } from '../../common/mock';
import {
  WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID,
  WATCHLIST_RULE_HISTORY_TEST_ID,
  WatchlistRuleHistory,
} from './watchlist_rule_history';
import { setWatchlistPrototypeVersion } from './watchlist_prototype_state';

// Any call to the entity analytics API is recorded. A revert in the prototype must make none.
const apiCalls: string[] = [];
jest.mock('../api/api', () => ({
  useEntityAnalyticsRoutes: () =>
    new Proxy(
      {},
      {
        get: (_target, name) => () => {
          apiCalls.push(String(name));
        },
      }
    ),
}));

const renderHistory = () =>
  render(
    <TestProviders>
      <WatchlistRuleHistory />
    </TestProviders>
  );

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('WatchlistRuleHistory', () => {
  beforeEach(() => {
    apiCalls.length = 0;
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v3'));
  });

  it.each(['v1', 'v2'] as const)('shows nothing in %s', (version) => {
    act(() => setWatchlistPrototypeVersion(version));

    renderHistory();

    expect(screen.queryByTestId(WATCHLIST_RULE_HISTORY_TEST_ID)).not.toBeInTheDocument();
  });

  it('shows at least three versions in v3, with who changed each and when', () => {
    renderHistory();

    expect(rows().length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('alex.kim')).toBeInTheDocument();
    expect(screen.getAllByText('sam.patel').length).toBeGreaterThan(0);
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('shows the agent change as confirmed by you, a few minutes ago, in v5', () => {
    act(() => setWatchlistPrototypeVersion('v5'));

    renderHistory();

    expect(screen.getByText('Agent Builder, confirmed by you')).toBeInTheDocument();
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    expect(screen.queryByText('Agent Builder, confirmed by alex.kim')).not.toBeInTheDocument();
  });

  it('marks the newest version as current and gives it no revert button', () => {
    renderHistory();

    expect(screen.getAllByText('Current')).toHaveLength(1);
    expect(within(rows()[0]).getByText('Current')).toBeInTheDocument();
    expect(within(rows()[0]).queryByText('Revert')).not.toBeInTheDocument();
    rows()
      .slice(1)
      .forEach((row) => expect(within(row).getByText('Revert')).toBeInTheDocument());
  });

  it('asks before reverting, and explains what the next update does', () => {
    renderHistory();

    fireEvent.click(screen.getByTestId('watchlistRuleHistoryRevert-sample-2'));

    const confirm = screen.getByTestId(WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID);
    expect(within(confirm).getByText('Revert to this rule?')).toBeInTheDocument();
    expect(within(confirm).getByText(/up to 10 minutes/)).toBeInTheDocument();
    expect(within(confirm).getByText(/Entities added by hand stay/)).toBeInTheDocument();
  });

  it('adds the older rule as a new current version once the revert is confirmed', () => {
    renderHistory();
    const before = rows().length;

    fireEvent.click(screen.getByTestId('watchlistRuleHistoryRevert-sample-2'));
    fireEvent.click(
      within(screen.getByTestId(WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID)).getByText('Revert')
    );

    expect(rows()).toHaveLength(before + 1);
    expect(within(rows()[0]).getByText('Current')).toBeInTheDocument();
    expect(within(rows()[0]).getByText('you')).toBeInTheDocument();
    expect(
      within(rows()[0]).getByText('entity.type: "user" and user.roles: "contractor"')
    ).toBeInTheDocument();
    expect(within(rows()[0]).getByText(/Reverted to the version from/)).toBeInTheDocument();
    expect(screen.getAllByText('Current')).toHaveLength(1);
  });

  it('changes nothing when the revert is cancelled', () => {
    renderHistory();
    const before = rows().length;

    fireEvent.click(screen.getByTestId('watchlistRuleHistoryRevert-sample-2'));
    fireEvent.click(
      within(screen.getByTestId(WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID)).getByText('Cancel')
    );

    expect(rows()).toHaveLength(before);
    expect(screen.queryByTestId(WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID)).not.toBeInTheDocument();
  });

  it('makes no call to the entity analytics API, so nothing is saved', () => {
    renderHistory();

    fireEvent.click(screen.getByTestId('watchlistRuleHistoryRevert-sample-2'));
    fireEvent.click(
      within(screen.getByTestId(WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID)).getByText('Revert')
    );

    expect(apiCalls).toEqual([]);
  });
});
