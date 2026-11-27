/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TestProviders } from '../../common/mock';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import {
  WATCHLIST_PROTOTYPE_BAR_TEST_ID,
  WATCHLIST_PROTOTYPE_SELECT_TEST_ID,
  WatchlistPrototypeBar,
} from './watchlist_prototype_bar';
import {
  getWatchlistPrototypeVersion,
  setWatchlistPrototypeVersion,
} from './watchlist_prototype_state';

jest.mock('../hooks/use_watchlist_manual_entities_enabled');

const mockUseEnabled = useWatchlistManualEntitiesEnabled as jest.Mock;

const renderBar = () =>
  render(
    <TestProviders>
      <WatchlistPrototypeBar />
    </TestProviders>
  );

describe('WatchlistPrototypeBar', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v1'));
    mockUseEnabled.mockReturnValue(true);
  });

  it('shows nothing while the manual watchlist entities flag is off', () => {
    mockUseEnabled.mockReturnValue(false);

    renderBar();

    expect(screen.queryByTestId(WATCHLIST_PROTOTYPE_BAR_TEST_ID)).not.toBeInTheDocument();
  });

  it('shows the current version', () => {
    renderBar();

    expect(screen.getByTestId(WATCHLIST_PROTOTYPE_SELECT_TEST_ID)).toHaveValue('v1');
  });

  it('offers v1 to v5', () => {
    renderBar();

    const options = screen
      .getByTestId(WATCHLIST_PROTOTYPE_SELECT_TEST_ID)
      .querySelectorAll('option');

    expect(Array.from(options).map(({ value }) => value)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
  });

  it('switches the version for every reader', () => {
    renderBar();

    fireEvent.change(screen.getByTestId(WATCHLIST_PROTOTYPE_SELECT_TEST_ID), {
      target: { value: 'v3' },
    });

    expect(getWatchlistPrototypeVersion()).toBe('v3');
    expect(screen.getByTestId(WATCHLIST_PROTOTYPE_SELECT_TEST_ID)).toHaveValue('v3');
  });
});
