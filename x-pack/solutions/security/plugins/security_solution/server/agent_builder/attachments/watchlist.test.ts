/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Attachment } from '@kbn/agent-builder-common/attachments';
import { agentBuilderMocks } from '@kbn/agent-builder-plugin/server/mocks';
import { SecurityAgentBuilderAttachments } from '../../../common/constants';
import { createWatchlistAttachmentType } from './watchlist';

describe('createWatchlistAttachmentType', () => {
  const attachmentType = createWatchlistAttachmentType();
  const formatContext = agentBuilderMocks.attachments.createFormatContextMock();

  const data = {
    watchlist_id: 'wl-1',
    watchlist_name: 'High risk vendors',
    risk_modifier: 1.5,
    entity_count: 13,
    source_count: 0,
    added_entity_label: 'service: portal',
  };

  const format = async (input: unknown) => {
    const attachment = {
      id: 'att-1',
      type: SecurityAgentBuilderAttachments.watchlist,
      data: input,
    } as Attachment<string, unknown>;
    const formatted = await attachmentType.format(attachment, formatContext);
    return formatted.getRepresentation?.();
  };

  it('uses the security.watchlist id', () => {
    expect(attachmentType.id).toBe('security.watchlist');
  });

  it('is valid with a watchlist id and name', async () => {
    expect((await attachmentType.validate(data)).valid).toBe(true);
  });

  it('is invalid without a watchlist id', async () => {
    expect((await attachmentType.validate({ watchlist_name: 'x' })).valid).toBe(false);
  });

  it('tells the agent the real state, and that a rule does not change the risk modifier', async () => {
    const representation = await format(data);

    expect(representation).toEqual({ type: 'text', value: expect.any(String) });
    const { value } = representation as { value: string };
    expect(value).toContain('High risk vendors');
    expect(value).toContain('wl-1');
    expect(value).toContain('Risk modifier: 1.5');
    expect(value).toContain('never this value');
    expect(value).toContain('Entities on the watchlist when the chat opened: 13');
    expect(value).toContain('none yet');
    expect(value).toContain('service: portal');
  });

  it('warns that a source of the same type is replaced when sources exist', async () => {
    const { value } = (await format({ ...data, source_count: 2 })) as { value: string };

    expect(value).toContain('2 already linked');
    expect(value).toContain('replaces');
  });

  it('tells the agent to point the user to the edit page and the history once a rule is saved', () => {
    const description = attachmentType.getAgentDescription?.() ?? '';

    expect(description).toContain('edit page in Settings');
    expect(description).toContain('revert');
    expect(description).toContain('risk modifier is unchanged');
    expect(description).toContain('security.build_redirect_url');
    expect(description).toContain('editWatchlistId=');
  });

  it('throws for invalid data', async () => {
    await expect(format({ nothing: true })).rejects.toThrow('Invalid watchlist attachment data');
  });
});
