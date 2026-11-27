/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 *
 * The prompt that opens Agent Builder from the manual entities callout. It names the watchlist,
 * lists up to ten of the entities added by hand, and asks the agent to compare them with the
 * watchlist's current rule and data sources before it proposes options.
 */

import { i18n } from '@kbn/i18n';

export const MAX_PROMPT_ENTITIES = 10;

export interface SuggestRulePromptEntity {
  readonly euid: string;
  readonly name?: string;
  readonly type?: string;
}

const describeEntity = ({ euid, name, type }: SuggestRulePromptEntity): string => {
  const label = name ?? euid;
  return type ? `${label} (${type}, ${euid})` : `${label} (${euid})`;
};

export const buildSuggestRulePrompt = ({
  watchlistName,
  entities,
  total,
}: {
  watchlistName: string;
  entities: readonly SuggestRulePromptEntity[];
  total: number;
}): string => {
  const shown = entities.slice(0, MAX_PROMPT_ENTITIES);

  return i18n.translate('xpack.securitySolution.entityAnalytics.watchlistPrototype.suggestPrompt', {
    defaultMessage:
      'The watchlist "{watchlistName}" has {total} entities that were added to it by hand. These are the first {shown}: {entityList}. Look at what these entities have in common, and at the current rule and data sources of the watchlist. Check how many entities a few candidate rules would match, then propose two or three options, from narrow to broad. Describe each option in plain language, with how many entities it matches and how it differs from the current rule, without showing the query unless I ask for it. Ask me to choose one. Warn me if the chosen rule would replace or remove an existing data source. The tools ask for my confirmation before anything is saved.',
    values: {
      watchlistName,
      total,
      shown: shown.length,
      entityList: shown.map(describeEntity).join('; '),
    },
  });
};
