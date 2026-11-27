/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { css } from '@emotion/react';
import { EuiBadge, EuiFlexGroup, EuiFlexItem, EuiSelect, useEuiTheme } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import {
  isWatchlistPrototypeVersion,
  setWatchlistPrototypeVersion,
  useWatchlistPrototypeVersion,
  WATCHLIST_PROTOTYPE_VERSIONS,
} from './watchlist_prototype_state';
import type { WatchlistPrototypeVersion } from './watchlist_prototype_state';

export const WATCHLIST_PROTOTYPE_BAR_TEST_ID = 'watchlistPrototypeBar';
export const WATCHLIST_PROTOTYPE_SELECT_TEST_ID = 'watchlistPrototypeVersionSelect';

const BADGE_LABEL = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.badgeLabel',
  { defaultMessage: 'Prototype' }
);
const SELECT_LABEL = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.versionLabel',
  { defaultMessage: 'Watchlist flow version' }
);

const VERSION_NAMES: Record<WatchlistPrototypeVersion, string> = {
  v1: i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.versionV1', {
    defaultMessage: 'v1: the two PRs as they are',
  }),
  v2: i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.versionV2', {
    defaultMessage: 'v2: nudge, callout and rule suggestion',
  }),
  v3: i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.versionV3', {
    defaultMessage: 'v3: v2 plus rule history and revert (mock)',
  }),
  v4: i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.versionV4', {
    defaultMessage: 'v4: Take action menu, and the toast opens the chat',
  }),
  v5: i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.versionV5', {
    defaultMessage: 'v5: v4 plus a watchlist attachment in the chat',
  }),
};

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 * A slim bar at the top of the All entities page and the Settings page. It switches the version of
 * the combined watchlist flow. It shows only while the manual watchlist entities flag is on.
 */
export const WatchlistPrototypeBar: React.FC = () => {
  const { euiTheme } = useEuiTheme();
  const isEnabled = useWatchlistManualEntitiesEnabled();
  const version = useWatchlistPrototypeVersion();

  const options = useMemo(
    () => WATCHLIST_PROTOTYPE_VERSIONS.map((value) => ({ value, text: VERSION_NAMES[value] })),
    []
  );

  const onChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isWatchlistPrototypeVersion(value)) {
      setWatchlistPrototypeVersion(value);
    }
  }, []);

  if (!isEnabled) {
    return null;
  }

  return (
    <EuiFlexGroup
      alignItems="center"
      gutterSize="s"
      responsive={false}
      data-test-subj={WATCHLIST_PROTOTYPE_BAR_TEST_ID}
      css={css`
        background: ${euiTheme.colors.backgroundBaseSubdued};
        border-block-end: ${euiTheme.border.thin};
        padding: ${euiTheme.size.xs} ${euiTheme.size.base};
      `}
    >
      <EuiFlexItem grow={false}>
        <EuiBadge color="accent">{BADGE_LABEL}</EuiBadge>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiSelect
          compressed
          aria-label={SELECT_LABEL}
          options={options}
          value={version}
          onChange={onChange}
          data-test-subj={WATCHLIST_PROTOTYPE_SELECT_TEST_ID}
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};
