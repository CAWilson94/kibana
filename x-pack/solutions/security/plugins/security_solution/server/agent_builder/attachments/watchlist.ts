/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Attachment } from '@kbn/agent-builder-common/attachments';
import type { AttachmentTypeDefinition } from '@kbn/agent-builder-server/attachments';
import { z, lazySchema } from '@kbn/zod/v4';
import { SecurityAgentBuilderAttachments } from '../../../common/constants';
import { securityAttachmentDataSchema } from './security_attachment_data_schema';
import { buildWatchlistEditPath } from '../skills/ui_navigation';

const watchlistAttachmentDataSchema = lazySchema(() =>
  securityAttachmentDataSchema.extend({
    watchlist_id: z.string().min(1).max(512),
    watchlist_name: z.string().min(1).max(512),
    risk_modifier: z.number().optional(),
    entity_count: z.number().int().min(0).optional(),
    source_count: z.number().int().min(0).optional(),
    managed: z.boolean().optional(),
    added_entity_label: z.string().max(512).optional(),
  })
);

export type WatchlistAttachmentData = z.infer<typeof watchlistAttachmentDataSchema>;

const isWatchlistAttachmentData = (data: unknown): data is WatchlistAttachmentData =>
  watchlistAttachmentDataSchema.safeParse(data).success;

const formatWatchlistForAgent = (attachmentId: string, data: WatchlistAttachmentData): string => {
  const lines = [
    `Watchlist "${data.watchlist_name}" (watchlist id: "${data.watchlist_id}", attachment id: "${attachmentId}")`,
  ];
  if (data.risk_modifier !== undefined) {
    lines.push(
      `Risk modifier: ${data.risk_modifier}. It is set on the watchlist itself, so a rule-based data source changes who is on the watchlist and never this value.`
    );
  }
  if (data.entity_count !== undefined) {
    lines.push(`Entities on the watchlist when the chat opened: ${data.entity_count}.`);
  }
  if (data.source_count !== undefined) {
    lines.push(
      data.source_count === 0
        ? 'Data sources: none yet, so no rule runs for this watchlist.'
        : `Data sources: ${data.source_count} already linked. Check them with the list tool before changing one, because setting a source of the same type replaces it.`
    );
  }
  if (data.managed) {
    lines.push('This watchlist is managed by the system.');
  }
  if (data.added_entity_label) {
    lines.push(`The user has just added ${data.added_entity_label} to this watchlist by hand.`);
  }
  return lines.join('\n');
};

/** DESIGN PROTOTYPE, NOT FOR MERGE. Gives the agent a watchlist's real state as context. */
export const createWatchlistAttachmentType = (): AttachmentTypeDefinition => ({
  id: SecurityAgentBuilderAttachments.watchlist,
  validate: (input) => {
    const parseResult = watchlistAttachmentDataSchema.safeParse(input);
    return parseResult.success
      ? { valid: true, data: parseResult.data }
      : { valid: false, error: parseResult.error.message };
  },
  format: (attachment: Attachment<string, unknown>) => {
    const { data } = attachment;
    if (!isWatchlistAttachmentData(data)) {
      throw new Error(`Invalid watchlist attachment data for attachment ${attachment.id}`);
    }
    return {
      getRepresentation: () => ({
        type: 'text',
        value: formatWatchlistForAgent(attachment.id, data),
      }),
    };
  },
  getTools: () => [],
  getAgentDescription: () =>
    `A security watchlist attachment carries one watchlist's real state: its id and name, its risk modifier, how many entities it holds and how many data sources it has. Use it as the starting point when the user asks about a watchlist's rule: you already know the id, so do not ask whether the watchlist exists, and do not ask what its risk score should be, because that belongs to the watchlist and a rule does not change it. Say what the risk modifier is when you describe the effect of a rule. Once a rule is saved, finish by saying who was added or removed, that the risk modifier is unchanged, and that the user can review the rule and its history, and revert it, on the watchlist's edit page in Settings. Give that page as a clickable link: call \`security.build_redirect_url\` with \`path: '${buildWatchlistEditPath(
      '<the watchlist id>'
    )}'\` (no \`flyout\`) and render the returned \`url\` as a markdown link. Never write the URL by hand.`,
});
