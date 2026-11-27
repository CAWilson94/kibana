/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TestProviders } from '../../common/mock';
import {
  createWatchlistAttachmentDefinition,
  WATCHLIST_ATTACHMENT_TEST_ID,
  WatchlistAttachmentInlineContent,
} from './watchlist_attachment';
import type { WatchlistAttachment } from './watchlist_attachment';

const attachment = (data: Partial<WatchlistAttachment['data']> = {}): WatchlistAttachment => ({
  id: 'att-1',
  type: 'security.watchlist',
  data: {
    watchlist_id: 'wl-1',
    watchlist_name: 'Contractors',
    risk_modifier: 1.5,
    entity_count: 13,
    source_count: 0,
    added_entity_label: 'user: jane',
    ...data,
  },
});

const renderCard = (value: WatchlistAttachment) =>
  render(
    <TestProviders>
      <WatchlistAttachmentInlineContent
        {...({ attachment: value } as React.ComponentProps<
          typeof WatchlistAttachmentInlineContent
        >)}
      />
    </TestProviders>
  );

describe('WatchlistAttachmentInlineContent', () => {
  it('shows the real state of the watchlist', () => {
    renderCard(attachment());

    expect(screen.getByText('Contractors')).toBeInTheDocument();
    expect(screen.getByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}RiskModifier`)).toHaveTextContent(
      '1.5'
    );
    expect(screen.getByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}Entities`)).toHaveTextContent('13');
    expect(screen.getByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}Added`)).toHaveTextContent(
      'Just added by hand: user: jane'
    );
  });

  it('says there is no rule yet when the watchlist has no data source', () => {
    renderCard(attachment({ source_count: 0 }));

    expect(screen.getByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}Sources`)).toHaveTextContent(
      'No rule yet'
    );
  });

  it('shows the number of data sources when there are some', () => {
    renderCard(attachment({ source_count: 2 }));

    expect(screen.getByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}Sources`)).toHaveTextContent('2');
  });

  it('leaves out what it was not given', () => {
    renderCard(
      attachment({
        risk_modifier: undefined,
        entity_count: undefined,
        source_count: undefined,
        added_entity_label: undefined,
      })
    );

    expect(screen.queryByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}RiskModifier`)).toBeNull();
    expect(screen.queryByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}Entities`)).toBeNull();
    expect(screen.queryByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}Sources`)).toBeNull();
    expect(screen.queryByTestId(`${WATCHLIST_ATTACHMENT_TEST_ID}Added`)).toBeNull();
  });
});

describe('createWatchlistAttachmentDefinition', () => {
  const navigateToApp = jest.fn();
  const definition = createWatchlistAttachmentDefinition({
    application: { navigateToApp } as unknown as Parameters<
      typeof createWatchlistAttachmentDefinition
    >[0]['application'],
  });

  it('labels the pill with the watchlist name, or "Watchlist"', () => {
    expect(definition.getLabel?.(attachment({ attachmentLabel: 'Contractors' }))).toBe(
      'Contractors'
    );
    expect(definition.getLabel?.(attachment())).toBe('Watchlist');
  });

  it('opens the watchlist in Settings from its action button', () => {
    const [button] =
      definition.getActionButtons?.({
        attachment: attachment(),
      } as unknown as Parameters<NonNullable<typeof definition.getActionButtons>>[0]) ?? [];

    button.handler();

    expect(navigateToApp).toHaveBeenCalledWith('securitySolutionUI', {
      path: expect.stringContaining('editWatchlistId=wl-1'),
    });
  });
});
