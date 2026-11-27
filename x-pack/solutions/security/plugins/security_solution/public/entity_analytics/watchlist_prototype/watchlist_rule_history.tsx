/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  EuiBadge,
  EuiBasicTable,
  EuiButtonEmpty,
  EuiCode,
  EuiConfirmModal,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import type { EuiBasicTableColumn } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import moment from 'moment';
import { buildRevertedVersion, getSampleRuleHistory } from './sample_rule_history';
import type { SampleRuleVersion } from './sample_rule_history';
import { useWatchlistPrototypeFeatures } from './watchlist_prototype_state';

export const WATCHLIST_RULE_HISTORY_TEST_ID = 'watchlistRuleHistory';
export const WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID = 'watchlistRuleHistoryConfirm';

/** The name shown for the person who reverts, in the mock. */
const CURRENT_USER = 'you';

const i18nStrings = {
  title: i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.historyTitle', {
    defaultMessage: 'Rule history',
  }),
  description: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyDescription',
    {
      defaultMessage:
        'Earlier versions of this watchlist rule, with who changed it and when. Mock data for the prototype: nothing here is saved.',
    }
  ),
  tableCaption: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyTableCaption',
    { defaultMessage: 'Rule history of the watchlist' }
  ),
  ruleColumn: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyRuleColumn',
    { defaultMessage: 'Rule' }
  ),
  changedByColumn: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyChangedByColumn',
    { defaultMessage: 'Changed by' }
  ),
  whenColumn: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyWhenColumn',
    { defaultMessage: 'When' }
  ),
  current: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyCurrent',
    { defaultMessage: 'Current' }
  ),
  revertLabel: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyRevertLabel',
    { defaultMessage: 'Revert' }
  ),
  revertAria: (when: string) =>
    i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.historyRevertAria', {
      defaultMessage: 'Revert to the rule from {when}',
      values: { when },
    }),
  restoredFrom: (when: string) =>
    i18n.translate(
      'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyRestoredFrom',
      { defaultMessage: 'Reverted to the version from {when}', values: { when } }
    ),
  confirmTitle: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyConfirmTitle',
    { defaultMessage: 'Revert to this rule?' }
  ),
  confirmBody: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyConfirmBody',
    {
      defaultMessage:
        'The older rule is saved as a new version. The next time the watchlist updates, which can take up to 10 minutes, entities that only the current rule matches are removed and entities the older rule matches are added. Entities added by hand stay.',
    }
  ),
  confirmButton: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyConfirmButton',
    { defaultMessage: 'Revert' }
  ),
  cancelButton: i18n.translate(
    'xpack.securitySolution.entityAnalytics.watchlistPrototype.historyCancelButton',
    { defaultMessage: 'Cancel' }
  ),
};

const fromNow = (isoDate: string): string => moment(isoDate).fromNow();

const WatchlistRuleHistoryContent = () => {
  const { watchlistAttachment } = useWatchlistPrototypeFeatures();
  const [history, setHistory] = useState<SampleRuleVersion[]>(() =>
    getSampleRuleHistory(Date.now(), { agentConfirmedByYou: watchlistAttachment })
  );
  const [versionToRevert, setVersionToRevert] = useState<SampleRuleVersion | undefined>();

  const closeConfirm = useCallback(() => setVersionToRevert(undefined), []);

  const confirmRevert = useCallback(() => {
    if (!versionToRevert) return;
    const reverted = buildRevertedVersion({
      history,
      versionId: versionToRevert.id,
      changedBy: CURRENT_USER,
    });
    if (reverted) {
      setHistory([reverted, ...history]);
    }
    setVersionToRevert(undefined);
  }, [history, versionToRevert]);

  const columns = useMemo<Array<EuiBasicTableColumn<SampleRuleVersion>>>(
    () => [
      {
        field: 'queryRule',
        name: i18nStrings.ruleColumn,
        render: (queryRule: string, { id, kind, restoredFromChangedAt }: SampleRuleVersion) => (
          <EuiFlexGroup direction="column" gutterSize="xs" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
                <EuiFlexItem grow={false}>
                  <EuiCode transparentBackground>{queryRule}</EuiCode>
                </EuiFlexItem>
                {id === history[0].id && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="success">{i18nStrings.current}</EuiBadge>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiFlexItem>
            {kind === 'revert' && restoredFromChangedAt && (
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  {i18nStrings.restoredFrom(fromNow(restoredFromChangedAt))}
                </EuiText>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        ),
      },
      { field: 'changedBy', name: i18nStrings.changedByColumn, width: '22%' },
      {
        field: 'changedAt',
        name: i18nStrings.whenColumn,
        width: '16%',
        render: (changedAt: string) => fromNow(changedAt),
      },
      {
        width: '96px',
        render: (version: SampleRuleVersion) =>
          version.id === history[0].id ? null : (
            <EuiButtonEmpty
              size="xs"
              iconType="undo"
              aria-label={i18nStrings.revertAria(fromNow(version.changedAt))}
              onClick={() => setVersionToRevert(version)}
              data-test-subj={`watchlistRuleHistoryRevert-${version.id}`}
            >
              {i18nStrings.revertLabel}
            </EuiButtonEmpty>
          ),
      },
    ],
    [history]
  );

  return (
    <div data-test-subj={WATCHLIST_RULE_HISTORY_TEST_ID}>
      <EuiSpacer size="l" />
      <EuiFlexGroup direction="column" gutterSize="xs" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiText size="s">
            <strong>{i18nStrings.title}</strong>
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued">
            <p>{i18nStrings.description}</p>
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <EuiBasicTable<SampleRuleVersion>
        tableCaption={i18nStrings.tableCaption}
        items={history}
        itemId="id"
        columns={columns}
      />
      {versionToRevert && (
        <EuiConfirmModal
          aria-label={i18nStrings.confirmTitle}
          title={i18nStrings.confirmTitle}
          onCancel={closeConfirm}
          onConfirm={confirmRevert}
          cancelButtonText={i18nStrings.cancelButton}
          confirmButtonText={i18nStrings.confirmButton}
          data-test-subj={WATCHLIST_RULE_HISTORY_CONFIRM_TEST_ID}
        >
          <p>{i18nStrings.confirmBody}</p>
        </EuiConfirmModal>
      )}
    </div>
  );
};

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 * The rule history of a watchlist with a Revert action, in the edit flyout. It shows from v3 on. The
 * versions are mocked, and a revert changes the list on screen but is not saved anywhere.
 */
export const WatchlistRuleHistory = () => {
  const { history } = useWatchlistPrototypeFeatures();

  if (!history) {
    return null;
  }

  return <WatchlistRuleHistoryContent />;
};
