/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { EuiContextMenuItem } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useQueryClient } from '@kbn/react-query';
import { useIsExperimentalFeatureEnabled } from '../../common/hooks/use_experimental_features';
import { GET_WATCHLISTS_QUERY_KEY } from '../api/hooks/use_get_watchlists';
import { useWatchlistsPrivileges } from '../api/hooks/use_watchlists_privileges';
import { AddToWatchlistModal } from '../components/home/entities_grid/components/add_to_watchlist_modal';
import { useInvalidateEntityGrid } from '../components/home/entities_grid/hooks/use_invalidate_entity_grid';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import { useWatchlistPrototypeFeatures } from './watchlist_prototype_state';

export const ADD_TO_EXISTING_WATCHLIST_TEST_ID = 'takeActionAddToExistingWatchlist';
export const ADD_TO_NEW_WATCHLIST_TEST_ID = 'takeActionAddToNewWatchlist';

const ADD_TO_EXISTING_LABEL = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.addToExistingWatchlist',
  { defaultMessage: 'Add to existing watchlist' }
);
const ADD_TO_NEW_LABEL = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.addToNewWatchlist',
  { defaultMessage: 'Add to new watchlist' }
);

type Mode = 'existing' | 'new';

interface WatchlistTakeActionEntity {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 * The "Add to existing watchlist" and "Add to new watchlist" items of the entity flyout's Take
 * action menu, shown in v4. Both open the grid's Select watchlist modal. The footer has to render
 * the modal: the menu removes its items when it closes, and a modal inside one would go with it.
 */
export const useEntityWatchlistTakeActionItems = ({
  entity,
  watchlistIds,
  onChanged,
}: {
  entity: WatchlistTakeActionEntity;
  /** The watchlists the entity is already on. */
  watchlistIds: string[];
  /** Called after an add, so the flyout can refetch the entity. */
  onChanged?: () => void;
}): {
  additionalItems: (closePopover: () => void) => React.ReactElement[];
  modal: React.ReactElement | null;
} => {
  const { takeAction } = useWatchlistPrototypeFeatures();
  const isWatchlistsEnabled = useIsExperimentalFeatureEnabled('entityAnalyticsWatchlistEnabled');
  const isManualEntitiesEnabled = useWatchlistManualEntitiesEnabled();
  const { data: privileges, error: privilegesError } = useWatchlistsPrivileges();
  const invalidateEntityGrid = useInvalidateEntityGrid();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode | undefined>();

  const canAdd =
    takeAction &&
    isWatchlistsEnabled &&
    isManualEntitiesEnabled &&
    !privilegesError &&
    (privileges?.has_all_required ?? false) &&
    Boolean(entity.id);

  const closeModal = useCallback(() => setMode(undefined), []);

  const onAssigned = useCallback(() => {
    invalidateEntityGrid();
    queryClient.invalidateQueries({ queryKey: ['watchlists-management-table'] });
    queryClient.invalidateQueries({ queryKey: GET_WATCHLISTS_QUERY_KEY });
    onChanged?.();
  }, [invalidateEntityGrid, onChanged, queryClient]);

  const additionalItems = useCallback(
    (closePopover: () => void): React.ReactElement[] => {
      if (!canAdd) return [];
      const open = (next: Mode) => () => {
        closePopover();
        setMode(next);
      };
      return [
        <EuiContextMenuItem
          key="addToExistingWatchlist"
          icon="listCheck"
          onClick={open('existing')}
          data-test-subj={ADD_TO_EXISTING_WATCHLIST_TEST_ID}
        >
          {ADD_TO_EXISTING_LABEL}
        </EuiContextMenuItem>,
        <EuiContextMenuItem
          key="addToNewWatchlist"
          icon="listCheck"
          onClick={open('new')}
          data-test-subj={ADD_TO_NEW_WATCHLIST_TEST_ID}
        >
          {ADD_TO_NEW_LABEL}
        </EuiContextMenuItem>,
      ];
    },
    [canAdd]
  );

  const modal = useMemo(
    () =>
      canAdd && mode ? (
        <AddToWatchlistModal
          entityId={entity.id}
          entity={{ type: entity.type, name: entity.name }}
          assignedWatchlistIds={watchlistIds}
          startInCreateMode={mode === 'new'}
          onClose={closeModal}
          onAssigned={onAssigned}
        />
      ) : null,
    [canAdd, closeModal, entity.id, entity.name, entity.type, mode, onAssigned, watchlistIds]
  );

  return { additionalItems, modal };
};
