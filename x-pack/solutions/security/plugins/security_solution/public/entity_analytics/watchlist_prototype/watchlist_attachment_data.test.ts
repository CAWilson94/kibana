/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildWatchlistAttachmentData } from './watchlist_attachment_data';

describe('buildWatchlistAttachmentData', () => {
  it('carries the real state of the watchlist, and the entity just added', () => {
    expect(
      buildWatchlistAttachmentData(
        {
          id: 'wl-1',
          name: 'Contractors',
          riskModifier: 1.5,
          entityCount: 13,
          entitySourceIds: ['src-1', 'src-2'],
          managed: true,
        },
        'user: jane'
      )
    ).toEqual({
      attachmentLabel: 'Contractors',
      watchlist_id: 'wl-1',
      watchlist_name: 'Contractors',
      risk_modifier: 1.5,
      entity_count: 13,
      source_count: 2,
      managed: true,
      added_entity_label: 'user: jane',
    });
  });

  it('counts no sources as zero, so the agent knows there is no rule', () => {
    expect(
      buildWatchlistAttachmentData({ id: 'wl-1', name: 'Contractors', entitySourceIds: [] })
    ).toEqual(expect.objectContaining({ source_count: 0 }));
  });

  it('leaves out what the record does not have, instead of telling the agent a guess', () => {
    expect(buildWatchlistAttachmentData({ id: 'wl-1', name: 'Contractors' })).toEqual({
      attachmentLabel: 'Contractors',
      watchlist_id: 'wl-1',
      watchlist_name: 'Contractors',
    });
  });
});
