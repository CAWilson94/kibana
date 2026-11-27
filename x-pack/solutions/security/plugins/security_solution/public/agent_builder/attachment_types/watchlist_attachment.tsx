/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiBadge, EuiFlexGroup, EuiFlexItem, EuiPanel, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type {
  AttachmentUIDefinition,
  AttachmentRenderProps,
  AttachmentServiceStartContract,
} from '@kbn/agent-builder-browser/attachments';
import { ActionButtonType } from '@kbn/agent-builder-browser/attachments';
import type { Attachment } from '@kbn/agent-builder-common/attachments';
import type { ApplicationStart } from '@kbn/core-application-browser';
import { APP_UI_ID, SecurityAgentBuilderAttachments } from '../../../common/constants';
import { getReviewRulePath } from '../../entity_analytics/watchlist_prototype/added_to_watchlist_toast';

export const WATCHLIST_ATTACHMENT_TEST_ID = 'watchlistAttachment';

export type WatchlistAttachment = Attachment<
  typeof SecurityAgentBuilderAttachments.watchlist,
  {
    attachmentLabel?: string;
    watchlist_id: string;
    watchlist_name: string;
    risk_modifier?: number;
    entity_count?: number;
    source_count?: number;
    managed?: boolean;
    added_entity_label?: string;
  }
>;

const i18nStrings = {
  pillLabel: i18n.translate('xpack.securitySolution.agentBuilder.watchlist.pillLabel', {
    defaultMessage: 'Watchlist',
  }),
  riskModifier: i18n.translate('xpack.securitySolution.agentBuilder.watchlist.riskModifier', {
    defaultMessage: 'Risk modifier',
  }),
  entities: i18n.translate('xpack.securitySolution.agentBuilder.watchlist.entities', {
    defaultMessage: 'Entities',
  }),
  sources: i18n.translate('xpack.securitySolution.agentBuilder.watchlist.sources', {
    defaultMessage: 'Data sources',
  }),
  noRule: i18n.translate('xpack.securitySolution.agentBuilder.watchlist.noRule', {
    defaultMessage: 'No rule yet',
  }),
  managed: i18n.translate('xpack.securitySolution.agentBuilder.watchlist.managed', {
    defaultMessage: 'Managed',
  }),
  openInSettings: i18n.translate('xpack.securitySolution.agentBuilder.watchlist.openInSettings', {
    defaultMessage: 'Open in Settings',
  }),
  added: (label: string) =>
    i18n.translate('xpack.securitySolution.agentBuilder.watchlist.justAdded', {
      defaultMessage: 'Just added by hand: {label}',
      values: { label },
    }),
};

const Stat = ({ label, value, testId }: { label: string; value: string; testId: string }) => (
  <EuiFlexItem grow={false} data-test-subj={testId}>
    <EuiText size="xs" color="subdued">
      {label}
    </EuiText>
    <EuiText size="s">
      <strong>{value}</strong>
    </EuiText>
  </EuiFlexItem>
);

/** The watchlist's real state, as it was when the chat opened. */
export const WatchlistAttachmentInlineContent = ({
  attachment,
}: AttachmentRenderProps<WatchlistAttachment>) => {
  const {
    watchlist_name: name,
    risk_modifier: riskModifier,
    entity_count: entityCount,
    source_count: sourceCount,
    managed,
    added_entity_label: added,
  } = attachment.data;

  return (
    <EuiPanel hasBorder paddingSize="m" data-test-subj={WATCHLIST_ATTACHMENT_TEST_ID}>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiText size="s">
            <strong>{name}</strong>
          </EuiText>
        </EuiFlexItem>
        {managed && (
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{i18nStrings.managed}</EuiBadge>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
      <EuiFlexGroup gutterSize="l" responsive={false} wrap>
        {riskModifier !== undefined && (
          <Stat
            label={i18nStrings.riskModifier}
            value={String(riskModifier)}
            testId={`${WATCHLIST_ATTACHMENT_TEST_ID}RiskModifier`}
          />
        )}
        {entityCount !== undefined && (
          <Stat
            label={i18nStrings.entities}
            value={String(entityCount)}
            testId={`${WATCHLIST_ATTACHMENT_TEST_ID}Entities`}
          />
        )}
        {sourceCount !== undefined && (
          <Stat
            label={i18nStrings.sources}
            value={sourceCount === 0 ? i18nStrings.noRule : String(sourceCount)}
            testId={`${WATCHLIST_ATTACHMENT_TEST_ID}Sources`}
          />
        )}
      </EuiFlexGroup>
      {added && (
        <EuiText size="xs" color="subdued" data-test-subj={`${WATCHLIST_ATTACHMENT_TEST_ID}Added`}>
          {i18nStrings.added(added)}
        </EuiText>
      )}
    </EuiPanel>
  );
};

export const createWatchlistAttachmentDefinition = ({
  application,
}: {
  application: ApplicationStart;
}): AttachmentUIDefinition<WatchlistAttachment> => ({
  getLabel: (attachment) => attachment.data.attachmentLabel ?? i18nStrings.pillLabel,
  getIcon: () => 'list',
  renderInlineContent: (props) => <WatchlistAttachmentInlineContent {...props} />,
  getActionButtons: ({ attachment }) => [
    {
      label: i18nStrings.openInSettings,
      icon: 'external',
      type: ActionButtonType.SECONDARY,
      handler: () => {
        application.navigateToApp(APP_UI_ID, {
          path: getReviewRulePath(attachment.data.watchlist_id),
        });
      },
    },
  ],
});

/** DESIGN PROTOTYPE, NOT FOR MERGE. Registers the `security.watchlist` attachment renderer. */
export const registerWatchlistAttachment = ({
  attachments,
  application,
}: {
  attachments: AttachmentServiceStartContract;
  application: ApplicationStart;
}): void => {
  attachments.addAttachmentType(
    SecurityAgentBuilderAttachments.watchlist,
    createWatchlistAttachmentDefinition({ application })
  );
};
