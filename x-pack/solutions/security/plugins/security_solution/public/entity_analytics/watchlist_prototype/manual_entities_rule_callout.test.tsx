/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TestProviders } from '../../common/mock';
import { useManualWatchlistEntities } from '../api/hooks/use_manual_watchlist_entities';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import { useAgentBuilderAttachment } from '../../agent_builder/hooks/use_agent_builder_attachment';
import { useAgentBuilderAvailability } from '../../agent_builder/hooks/use_agent_builder_availability';
import {
  MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID,
  ManualEntitiesRuleCallout,
} from './manual_entities_rule_callout';
import { setWatchlistPrototypeVersion } from './watchlist_prototype_state';

jest.mock('../api/hooks/use_manual_watchlist_entities');
jest.mock('../hooks/use_watchlist_manual_entities_enabled');
jest.mock('../../agent_builder/hooks/use_agent_builder_attachment');
jest.mock('../../agent_builder/hooks/use_agent_builder_availability');
jest.mock('../../agent_builder/components/new_agent_builder_attachment', () => ({
  NewAgentBuilderAttachment: ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

const mockUseManual = useManualWatchlistEntities as jest.Mock;
const mockUseEnabled = useWatchlistManualEntitiesEnabled as jest.Mock;
const mockUseAttachment = useAgentBuilderAttachment as jest.Mock;
const mockUseAvailability = useAgentBuilderAvailability as jest.Mock;
const mockOpen = jest.fn();

const entities = (count: number) =>
  Array.from({ length: Math.min(count, 10) }, (_, index) => ({
    euid: `user:person-${index + 1}`,
    name: `person-${index + 1}`,
    type: 'user',
    sources: ['manual'],
  }));

const withTotal = (total: number) =>
  mockUseManual.mockReturnValue({
    data: { entities: entities(total), total, page: 1, per_page: 10 },
  });

const renderCallout = () =>
  render(
    <TestProviders>
      <ManualEntitiesRuleCallout watchlistId="wl-1" watchlistName="Contractors" />
    </TestProviders>
  );

describe('ManualEntitiesRuleCallout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v2'));
    mockUseEnabled.mockReturnValue(true);
    mockUseAvailability.mockReturnValue({ isAgentChatExperienceEnabled: true });
    mockUseAttachment.mockReturnValue({ openAgentBuilderFlyout: mockOpen });
    withTotal(3);
  });

  it('shows the count of manually added entities in v2', () => {
    withTotal(14);

    renderCallout();

    expect(screen.getByTestId(MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID)).toHaveTextContent(
      '14 entities added manually. Want a rule that catches entities like these?'
    );
  });

  it('uses the singular for one entity', () => {
    withTotal(1);

    renderCallout();

    expect(screen.getByTestId(MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID)).toHaveTextContent(
      '1 entity added manually.'
    );
  });

  it('shows in v3 too', () => {
    act(() => setWatchlistPrototypeVersion('v3'));

    renderCallout();

    expect(screen.getByTestId(MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID)).toBeInTheDocument();
  });

  it('shows nothing in v1', () => {
    act(() => setWatchlistPrototypeVersion('v1'));

    renderCallout();

    expect(screen.queryByTestId(MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID)).not.toBeInTheDocument();
  });

  it('shows nothing while the manual watchlist entities flag is off', () => {
    mockUseEnabled.mockReturnValue(false);

    renderCallout();

    expect(screen.queryByTestId(MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID)).not.toBeInTheDocument();
  });

  it('shows nothing when no entity was added by hand', () => {
    withTotal(0);

    renderCallout();

    expect(screen.queryByTestId(MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID)).not.toBeInTheDocument();
  });

  it('shows nothing when Agent Builder is not available', () => {
    mockUseAvailability.mockReturnValue({ isAgentChatExperienceEnabled: false });

    renderCallout();

    expect(screen.queryByTestId(MANUAL_ENTITIES_RULE_CALLOUT_TEST_ID)).not.toBeInTheDocument();
  });

  it('asks for the first page of ten manual entities', () => {
    renderCallout();

    expect(mockUseManual).toHaveBeenCalledWith({ watchlistId: 'wl-1', page: 1, perPage: 10 });
  });

  it('opens Agent Builder with a prompt that names the watchlist and its manual entities', () => {
    withTotal(14);

    renderCallout();
    fireEvent.click(screen.getByText('Suggest a rule'));

    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockUseAttachment).toHaveBeenLastCalledWith(
      expect.objectContaining({
        autoSendInitialMessage: true,
        attachmentPrompt: expect.stringContaining('"Contractors"'),
      })
    );
    const { attachmentPrompt } = mockUseAttachment.mock.calls.slice(-1)[0][0];
    expect(attachmentPrompt).toContain('14 entities');
    expect(attachmentPrompt).toContain('person-10 (user, user:person-10)');
  });
});
