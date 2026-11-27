/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { WatchlistObject } from '../../../common/api/entity_analytics/watchlists/management/common.gen';

/** The part of a watchlist the v5 chat attachment carries. */
export type AttachableWatchlist = Pick<WatchlistObject, 'id' | 'name'> &
  Partial<Pick<WatchlistObject, 'riskModifier' | 'entityCount' | 'entitySourceIds' | 'managed'>>;

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 * The data of a `security.watchlist` attachment, from the watchlist record the page already has.
 * Fields the record lacks are left out, so the agent is never told something we did not read.
 */
export const buildWatchlistAttachmentData = (
  watchlist: AttachableWatchlist,
  addedEntityLabel?: string
) => ({
  attachmentLabel: watchlist.name,
  watchlist_id: watchlist.id,
  watchlist_name: watchlist.name,
  ...(watchlist.riskModifier !== undefined ? { risk_modifier: watchlist.riskModifier } : {}),
  ...(watchlist.entityCount !== undefined ? { entity_count: watchlist.entityCount } : {}),
  ...(watchlist.entitySourceIds !== undefined
    ? { source_count: watchlist.entitySourceIds.length }
    : {}),
  ...(watchlist.managed !== undefined ? { managed: watchlist.managed } : {}),
  ...(addedEntityLabel ? { added_entity_label: addedEntityLabel } : {}),
});
