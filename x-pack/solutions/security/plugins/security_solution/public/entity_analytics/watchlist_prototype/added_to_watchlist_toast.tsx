/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback } from 'react';
import type { MouseEvent } from 'react';
import { EuiButtonEmpty, EuiLink, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { toMountPoint } from '@kbn/react-kibana-mount';
import {
  APP_UI_ID,
  ENTITY_ANALYTICS_MANAGEMENT_PATH,
  SecurityAgentBuilderAttachments,
} from '../../../common/constants';
import { useKibana } from '../../common/lib/kibana';
import { EDIT_WATCHLIST_URL_PARAM } from '../components/watchlists/flyout/constants';
import { getPrompt } from '../components/watchlists/entity_watchlists_modal/suggest_watchlist_rule_button';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import { buildWatchlistAttachmentData } from './watchlist_attachment_data';
import type { AttachableWatchlist } from './watchlist_attachment_data';
import { useWatchlistPrototypeFeatures } from './watchlist_prototype_state';

/** The path segment of the Watchlists tab on the settings page (`TabId.Watchlists`). */
const WATCHLISTS_TAB_PATH_SEGMENT = 'watchlists';

/** Long enough to read the nudge. The toast's close button dismisses it sooner. */
export const NUDGE_TOAST_LIFETIME_MS = 15_000;

const NUDGE_TEXT = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.nudgeText',
  { defaultMessage: 'Did the rule miss this entity?' }
);
const NUDGE_LINK = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.nudgeLink',
  { defaultMessage: 'Review the rule' }
);
const SUGGEST_BUTTON = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.nudgeSuggestButton',
  { defaultMessage: 'Suggest a rule' }
);

interface WatchlistRuleNudgeProps {
  href: string;
  onReview: (event: MouseEvent<HTMLElement>) => void;
}

const WatchlistRuleNudge = ({ href, onReview }: WatchlistRuleNudgeProps) => (
  <EuiText size="s" data-test-subj="watchlistRuleNudge">
    <p>{NUDGE_TEXT}</p>
    <EuiLink href={href} onClick={onReview} data-test-subj="watchlistRuleNudgeReview">
      {NUDGE_LINK}
    </EuiLink>
  </EuiText>
);

interface WatchlistSuggestNudgeProps {
  onSuggest: () => void;
}

/** The v4 nudge: one button that opens the chat on the same page. */
const WatchlistSuggestNudge = ({ onSuggest }: WatchlistSuggestNudgeProps) => (
  <EuiText size="s" data-test-subj="watchlistRuleNudge">
    <p>{NUDGE_TEXT}</p>
    <EuiButtonEmpty
      size="xs"
      flush="left"
      iconType="sparkles"
      onClick={onSuggest}
      data-test-subj="watchlistRuleNudgeSuggest"
    >
      {SUGGEST_BUTTON}
    </EuiButtonEmpty>
  </EuiText>
);

/** A click the browser should handle itself, such as Cmd or Ctrl click to open a new tab. */
const isModifiedClick = ({ button, metaKey, ctrlKey, shiftKey, altKey }: MouseEvent): boolean =>
  button !== 0 || metaKey || ctrlKey || shiftKey || altKey;

export const getReviewRulePath = (watchlistId: string): string =>
  `${ENTITY_ANALYTICS_MANAGEMENT_PATH}/${WATCHLISTS_TAB_PATH_SEGMENT}?${EDIT_WATCHLIST_URL_PARAM}=${encodeURIComponent(
    watchlistId
  )}`;

/** The entity that was added, as far as the caller knows it. */
export interface AddedEntity {
  readonly type?: string;
  readonly name?: string;
}

interface ShowAddedToastParams {
  title: string;
  watchlistId: string;
  /** For the v4 chat prompt. */
  watchlistName?: string;
  /** For the v4 chat attachment. */
  entity?: AddedEntity;
  /** For the v5 watchlist attachment: the record the page already has. */
  watchlist?: AttachableWatchlist;
}

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 * Shows the "added to watchlist" toast. In v2 and v3 the toast also carries a nudge, "Did the rule
 * miss this entity?", with a link that opens the watchlist's edit flyout on the settings page. In
 * v4 the nudge has a "Suggest a rule" button that opens the chat on the same page instead. The
 * toast's close button dismisses it, and nothing else about the add changes.
 */
export const useAddedToWatchlistToast = () => {
  const { services } = useKibana();
  const {
    notifications: { toasts },
    application,
    agentBuilder,
  } = services;
  const isEnabled = useWatchlistManualEntitiesEnabled();
  const { nudge, suggestFromToast, watchlistAttachment } = useWatchlistPrototypeFeatures();
  const showNudge = isEnabled && nudge;

  return useCallback(
    ({ title, watchlistId, watchlistName, entity, watchlist }: ShowAddedToastParams) => {
      if (!showNudge) {
        toasts.addSuccess({ title });
        return;
      }

      if (suggestFromToast) {
        const onSuggest = () => {
          if (!agentBuilder?.openChat) return;
          const label = entity?.name ?? '';
          const entityLabel = entity?.type ? `${entity.type}: ${label}` : label;
          const watchlistAttachments =
            watchlistAttachment && watchlist
              ? [
                  {
                    id: `${SecurityAgentBuilderAttachments.watchlist}-${watchlist.id}`,
                    type: SecurityAgentBuilderAttachments.watchlist,
                    data: buildWatchlistAttachmentData(watchlist, entityLabel),
                    origin: 'watchlist_added_toast',
                  },
                ]
              : [];
          agentBuilder.openChat({
            autoSendInitialMessage: true,
            newConversation: true,
            initialMessage: getPrompt(watchlistName),
            attachments: [
              ...watchlistAttachments,
              {
                id: `${SecurityAgentBuilderAttachments.entity}-${Date.now()}`,
                type: SecurityAgentBuilderAttachments.entity,
                data: {
                  identifierType: entity?.type,
                  identifier: entity?.name,
                  attachmentLabel: entityLabel,
                },
                origin: 'watchlist_added_toast',
              },
            ],
            sessionTag: 'security',
          });
        };

        toasts.addSuccess({
          title,
          text: toMountPoint(<WatchlistSuggestNudge onSuggest={onSuggest} />, services),
          toastLifeTimeMs: NUDGE_TOAST_LIFETIME_MS,
        });
        return;
      }

      const path = getReviewRulePath(watchlistId);
      const href = application.getUrlForApp(APP_UI_ID, { path });
      const onReview = (event: MouseEvent<HTMLElement>) => {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        application.navigateToApp(APP_UI_ID, { path });
      };

      toasts.addSuccess({
        title,
        text: toMountPoint(<WatchlistRuleNudge href={href} onReview={onReview} />, services),
        toastLifeTimeMs: NUDGE_TOAST_LIFETIME_MS,
      });
    },
    [agentBuilder, application, services, showNudge, suggestFromToast, toasts, watchlistAttachment]
  );
};
