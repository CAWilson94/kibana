/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { EuiSpacer } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { KbnInfoCallout } from '@kbn/ui-callout';
import { SecurityAgentBuilderAttachments } from '../../../common/constants';
import { useGetWatchlists } from '../api/hooks/use_get_watchlists';
import { useManualWatchlistEntities } from '../api/hooks/use_manual_watchlist_entities';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import { NewAgentBuilderAttachment } from '../../agent_builder/components/new_agent_builder_attachment';
import { useAgentBuilderAttachment } from '../../agent_builder/hooks/use_agent_builder_attachment';
import { useAgentBuilderAvailability } from '../../agent_builder/hooks/use_agent_builder_availability';
import { buildSuggestRulePrompt, MAX_PROMPT_ENTITIES } from './suggest_rule_prompt';
import { buildWatchlistAttachmentData } from './watchlist_attachment_data';
import { useWatchlistPrototypeFeatures } from './watchlist_prototype_state';

export const MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID = 'watchlistManualEntitiesRuleCallout';

const SUGGEST_LABEL = i18n.translate(
  'xpack.securitySolution.entityAnalytics.watchlistPrototype.suggestRuleButton',
  { defaultMessage: 'Suggest a rule' }
);

const getTitle = (count: number): string =>
  i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.calloutTitle', {
    defaultMessage:
      '{count, plural, one {# entity} other {# entities}} added manually. Want a rule that catches entities like these?',
    values: { count },
  });

interface ManualEntitiesRuleCalloutProps {
  watchlistId: string;
  watchlistName: string;
}

const ManualEntitiesRuleCalloutContent = ({
  watchlistId,
  watchlistName,
}: ManualEntitiesRuleCalloutProps) => {
  const { isAgentChatExperienceEnabled } = useAgentBuilderAvailability();
  const { watchlistAttachment } = useWatchlistPrototypeFeatures();
  const { data: watchlists } = useGetWatchlists();
  const watchlist = watchlists?.find(({ id }) => id === watchlistId);
  const { data } = useManualWatchlistEntities({
    watchlistId,
    page: 1,
    perPage: MAX_PROMPT_ENTITIES,
  });
  const total = data?.total ?? 0;
  const entities = useMemo(() => data?.entities ?? [], [data?.entities]);

  const attachment = useMemo(() => {
    const [first] = entities;
    // v5: the chat starts from the watchlist's real state. The prompt still lists the entities.
    if (watchlistAttachment && watchlist) {
      return {
        attachmentType: SecurityAgentBuilderAttachments.watchlist,
        attachmentData: buildWatchlistAttachmentData(watchlist),
        origin: 'watchlist_manual_entities_callout',
        attachmentPrompt: buildSuggestRulePrompt({ watchlistName, entities, total }),
        autoSendInitialMessage: true,
      };
    }
    return {
      attachmentType: SecurityAgentBuilderAttachments.entity,
      attachmentData: {
        identifierType: first?.type,
        identifier: first?.name ?? first?.euid,
        attachmentLabel: first ? `${first.type ?? 'entity'}: ${first.name ?? first.euid}` : '',
      },
      origin: 'watchlist_manual_entities_callout',
      attachmentPrompt: buildSuggestRulePrompt({ watchlistName, entities, total }),
      autoSendInitialMessage: true,
    };
  }, [entities, total, watchlist, watchlistAttachment, watchlistName]);
  const { openAgentBuilderFlyout } = useAgentBuilderAttachment(attachment);

  if (total === 0 || !isAgentChatExperienceEnabled) {
    return null;
  }

  return (
    <>
      <KbnInfoCallout
        size="s"
        title={getTitle(total)}
        text={
          <NewAgentBuilderAttachment
            onClick={openAgentBuilderFlyout}
            size="s"
            label={SUGGEST_LABEL}
            iconType="sparkles"
          />
        }
        data-test-subj={MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID}
      />
      <EuiSpacer size="m" />
    </>
  );
};

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 * The count of manually added entities and a callout that opens Agent Builder to suggest a rule
 * covering them. It shows in v2 and v3, and only while the manual watchlist entities flag is on.
 */
export const ManualEntitiesRuleCallout = (props: ManualEntitiesRuleCalloutProps) => {
  const isEnabled = useWatchlistManualEntitiesEnabled();
  const { callout } = useWatchlistPrototypeFeatures();

  if (!isEnabled || !callout) {
    return null;
  }

  return <ManualEntitiesRuleCalloutContent {...props} />;
};
