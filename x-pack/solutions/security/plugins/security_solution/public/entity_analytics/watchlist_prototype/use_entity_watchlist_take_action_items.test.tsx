/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { TestProviders } from '../../common/mock';
import { useIsExperimentalFeatureEnabled } from '../../common/hooks/use_experimental_features';
import { useWatchlistsPrivileges } from '../api/hooks/use_watchlists_privileges';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import {
  ADD_TO_EXISTING_WATCHLIST_TEST_ID,
  ADD_TO_NEW_WATCHLIST_TEST_ID,
  useEntityWatchlistTakeActionItems,
} from './use_entity_watchlist_take_action_items';
import { setWatchlistPrototypeVersion } from './watchlist_prototype_state';

jest.mock('../../common/hooks/use_experimental_features');
jest.mock('../hooks/use_watchlist_manual_entities_enabled');
jest.mock('../api/hooks/use_watchlists_privileges');
jest.mock('../components/home/entities_grid/hooks/use_invalidate_entity_grid', () => ({
  useInvalidateEntityGrid: () => jest.fn(),
}));
jest.mock('../components/home/entities_grid/components/add_to_watchlist_modal', () => ({
  AddToWatchlistModal: ({
    entityId,
    entity,
    assignedWatchlistIds,
    startInCreateMode,
  }: {
    entityId: string;
    entity: { type: string; name: string };
    assignedWatchlistIds: string[];
    startInCreateMode?: boolean;
  }) => (
    <div
      data-test-subj="mockPicker"
      data-entity-id={entityId}
      data-entity-type={entity.type}
      data-assigned={assignedWatchlistIds.join(',')}
      data-create={String(Boolean(startInCreateMode))}
    />
  ),
}));

const mockUseExperimental = useIsExperimentalFeatureEnabled as jest.Mock;
const mockUseEnabled = useWatchlistManualEntitiesEnabled as jest.Mock;
const mockUsePrivileges = useWatchlistsPrivileges as jest.Mock;

const ENTITY = { id: 'user:jane', name: 'jane', type: 'user' };

const renderItemsHook = () =>
  renderHook(
    () => useEntityWatchlistTakeActionItems({ entity: ENTITY, watchlistIds: ['wl-1', 'wl-2'] }),
    { wrapper: TestProviders }
  );

describe('useEntityWatchlistTakeActionItems', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v4'));
    mockUseExperimental.mockReturnValue(true);
    mockUseEnabled.mockReturnValue(true);
    mockUsePrivileges.mockReturnValue({ data: { has_all_required: true }, error: null });
  });

  it('adds "Add to existing watchlist" and "Add to new watchlist" in v4', () => {
    const { result } = renderItemsHook();

    const items = result.current.additionalItems(jest.fn());
    render(<TestProviders>{items}</TestProviders>);

    expect(screen.getByTestId(ADD_TO_EXISTING_WATCHLIST_TEST_ID)).toHaveTextContent(
      'Add to existing watchlist'
    );
    expect(screen.getByTestId(ADD_TO_NEW_WATCHLIST_TEST_ID)).toHaveTextContent(
      'Add to new watchlist'
    );
  });

  it('gives both items the list icon of the prototype menu', () => {
    const { result } = renderItemsHook();

    render(<TestProviders>{result.current.additionalItems(jest.fn())}</TestProviders>);

    [ADD_TO_EXISTING_WATCHLIST_TEST_ID, ADD_TO_NEW_WATCHLIST_TEST_ID].forEach((testId) => {
      expect(
        screen.getByTestId(testId).querySelector('[data-euiicon-type="listCheck"]')
      ).not.toBeNull();
    });
  });

  it.each(['v1', 'v2', 'v3'] as const)('adds no items in %s', (version) => {
    act(() => setWatchlistPrototypeVersion(version));
    const { result } = renderItemsHook();

    expect(result.current.additionalItems(jest.fn())).toEqual([]);
  });

  it('adds no items while the manual watchlist entities flag is off', () => {
    mockUseEnabled.mockReturnValue(false);
    const { result } = renderItemsHook();

    expect(result.current.additionalItems(jest.fn())).toEqual([]);
  });

  it('adds no items without the watchlist privileges', () => {
    mockUsePrivileges.mockReturnValue({ data: { has_all_required: false }, error: null });
    const { result } = renderItemsHook();

    expect(result.current.additionalItems(jest.fn())).toEqual([]);
  });

  it('opens the picker for the entity from "Add to existing watchlist", and closes the menu', () => {
    const { result } = renderItemsHook();
    const closePopover = jest.fn();
    render(<TestProviders>{result.current.additionalItems(closePopover)}</TestProviders>);

    expect(result.current.modal).toBeNull();
    fireEvent.click(screen.getByTestId(ADD_TO_EXISTING_WATCHLIST_TEST_ID));

    expect(closePopover).toHaveBeenCalledTimes(1);
    render(<TestProviders>{result.current.modal}</TestProviders>);
    const picker = screen.getByTestId('mockPicker');
    expect(picker).toHaveAttribute('data-entity-id', 'user:jane');
    expect(picker).toHaveAttribute('data-entity-type', 'user');
    expect(picker).toHaveAttribute('data-assigned', 'wl-1,wl-2');
    expect(picker).toHaveAttribute('data-create', 'false');
  });

  it('opens the picker with the create flow started from "Add to new watchlist"', () => {
    const { result } = renderItemsHook();
    render(<TestProviders>{result.current.additionalItems(jest.fn())}</TestProviders>);

    fireEvent.click(screen.getByTestId(ADD_TO_NEW_WATCHLIST_TEST_ID));

    render(<TestProviders>{result.current.modal}</TestProviders>);
    expect(screen.getByTestId('mockPicker')).toHaveAttribute('data-create', 'true');
  });
});
