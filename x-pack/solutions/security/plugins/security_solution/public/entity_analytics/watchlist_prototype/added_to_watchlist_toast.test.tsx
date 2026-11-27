/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { useKibana } from '../../common/lib/kibana';
import { createStartServicesMock } from '../../common/lib/kibana/kibana_react.mock';
import { APP_UI_ID } from '../../../common/constants';
import { useWatchlistManualEntitiesEnabled } from '../hooks/use_watchlist_manual_entities_enabled';
import {
  getReviewRulePath,
  NUDGE_TOAST_LIFETIME_MS,
  useAddedToWatchlistToast,
} from './added_to_watchlist_toast';
import { setWatchlistPrototypeVersion } from './watchlist_prototype_state';

jest.mock('../../common/lib/kibana');
jest.mock('../hooks/use_watchlist_manual_entities_enabled');

const mockUseEnabled = useWatchlistManualEntitiesEnabled as jest.Mock;
const toasts = { addSuccess: jest.fn() };
const navigateToApp = jest.fn();
const openChat = jest.fn();
const getUrlForApp = jest.fn((appId: string, { path }: { path: string }) => `/app/${appId}${path}`);

type MountPoint = (element: HTMLElement) => () => void;

const showToast = () => {
  const { result } = renderHook(() => useAddedToWatchlistToast());
  result.current({ title: 'Added to watchlist', watchlistId: 'wl-2' });
};

const lastToast = () => toasts.addSuccess.mock.calls.slice(-1)[0][0];

const mountToastText = (): HTMLElement => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    (lastToast().text as MountPoint)(container);
  });
  return container;
};

describe('useAddedToWatchlistToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v2'));
    mockUseEnabled.mockReturnValue(true);
    (useKibana as jest.Mock).mockReturnValue({
      services: {
        ...createStartServicesMock(),
        notifications: { toasts },
        application: { navigateToApp, getUrlForApp },
        agentBuilder: { openChat },
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows only the title in v1, as the PR does', () => {
    act(() => setWatchlistPrototypeVersion('v1'));

    showToast();

    expect(toasts.addSuccess).toHaveBeenCalledTimes(1);
    expect(toasts.addSuccess).toHaveBeenCalledWith({ title: 'Added to watchlist' });
  });

  it('shows only the title while the manual watchlist entities flag is off', () => {
    mockUseEnabled.mockReturnValue(false);

    showToast();

    expect(toasts.addSuccess).toHaveBeenCalledWith({ title: 'Added to watchlist' });
  });

  it('adds the nudge to the toast in v2, and keeps it up long enough to read', () => {
    showToast();

    expect(toasts.addSuccess).toHaveBeenCalledTimes(1);
    expect(lastToast()).toEqual(
      expect.objectContaining({
        title: 'Added to watchlist',
        toastLifeTimeMs: NUDGE_TOAST_LIFETIME_MS,
      })
    );
    mountToastText();
    expect(screen.getByText('Did the rule miss this entity?')).toBeInTheDocument();
  });

  it('adds the nudge in v3 too', () => {
    act(() => setWatchlistPrototypeVersion('v3'));

    showToast();

    expect(lastToast().text).toBeDefined();
  });

  it('opens the edit flyout of the watchlist that was added to, when the link is clicked', () => {
    showToast();
    mountToastText();

    fireEvent.click(screen.getByText('Review the rule'));

    expect(navigateToApp).toHaveBeenCalledWith(APP_UI_ID, {
      path: '/entity_analytics_management/watchlists?editWatchlistId=wl-2',
    });
  });

  it('gives the link a real address, so it can open in a new tab', () => {
    showToast();
    mountToastText();

    expect(screen.getByText('Review the rule').closest('a')).toHaveAttribute(
      'href',
      '/app/securitySolutionUI/entity_analytics_management/watchlists?editWatchlistId=wl-2'
    );
  });

  it('leaves a Ctrl or Cmd click to the browser', () => {
    showToast();
    mountToastText();

    fireEvent.click(screen.getByText('Review the rule'), { ctrlKey: true });

    expect(navigateToApp).not.toHaveBeenCalled();
  });

  it('does not navigate until the link is clicked', () => {
    showToast();
    mountToastText();

    expect(navigateToApp).not.toHaveBeenCalled();
  });
});

describe('useAddedToWatchlistToast in v4', () => {
  const showV4Toast = () => {
    const { result } = renderHook(() => useAddedToWatchlistToast());
    result.current({
      title: 'Added to watchlist',
      watchlistId: 'wl-2',
      watchlistName: 'Contractors',
      entity: { type: 'user', name: 'jane' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v4'));
    mockUseEnabled.mockReturnValue(true);
    (useKibana as jest.Mock).mockReturnValue({
      services: {
        ...createStartServicesMock(),
        notifications: { toasts },
        application: { navigateToApp, getUrlForApp },
        agentBuilder: { openChat },
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('offers one button, "Suggest a rule", and no link to the edit page', () => {
    showV4Toast();
    mountToastText();

    expect(screen.getByText('Did the rule miss this entity?')).toBeInTheDocument();
    expect(screen.getByText('Suggest a rule')).toBeInTheDocument();
    expect(screen.queryByText('Review the rule')).not.toBeInTheDocument();
  });

  it('opens the chat on the same page, with the watchlist in the prompt and the entity attached', () => {
    showV4Toast();
    mountToastText();

    fireEvent.click(screen.getByText('Suggest a rule'));

    expect(navigateToApp).not.toHaveBeenCalled();
    expect(openChat).toHaveBeenCalledTimes(1);
    const options = openChat.mock.calls[0][0];
    expect(options.initialMessage).toContain('"Contractors"');
    expect(options.autoSendInitialMessage).toBe(true);
    expect(options.attachments).toHaveLength(1);
    expect(options.attachments[0].type).toBe('security.entity');
    expect(options.attachments[0].data).toEqual(
      expect.objectContaining({ identifierType: 'user', identifier: 'jane' })
    );
  });

  it('keeps the title-only toast while the manual watchlist entities flag is off', () => {
    mockUseEnabled.mockReturnValue(false);

    showV4Toast();

    expect(toasts.addSuccess).toHaveBeenCalledWith({ title: 'Added to watchlist' });
  });

  it('does nothing when Agent Builder is not available', () => {
    (useKibana as jest.Mock).mockReturnValue({
      services: {
        ...createStartServicesMock(),
        notifications: { toasts },
        application: { navigateToApp, getUrlForApp },
        agentBuilder: undefined,
      },
    });
    showV4Toast();
    mountToastText();

    fireEvent.click(screen.getByText('Suggest a rule'));

    expect(openChat).not.toHaveBeenCalled();
  });
});

describe('useAddedToWatchlistToast in v5', () => {
  const WATCHLIST = {
    id: 'wl-2',
    name: 'Contractors',
    riskModifier: 1.5,
    entityCount: 13,
    entitySourceIds: [],
    managed: false,
  };

  const showV5Toast = (watchlist: typeof WATCHLIST | null = WATCHLIST) => {
    const { result } = renderHook(() => useAddedToWatchlistToast());
    result.current({
      title: 'Added to watchlist',
      watchlistId: 'wl-2',
      watchlistName: 'Contractors',
      entity: { type: 'user', name: 'jane' },
      watchlist,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    act(() => setWatchlistPrototypeVersion('v5'));
    mockUseEnabled.mockReturnValue(true);
    (useKibana as jest.Mock).mockReturnValue({
      services: {
        ...createStartServicesMock(),
        notifications: { toasts },
        application: { navigateToApp, getUrlForApp },
        agentBuilder: { openChat },
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('attaches the watchlist with its real state, and the entity, to the chat', () => {
    showV5Toast();
    mountToastText();

    fireEvent.click(screen.getByText('Suggest a rule'));

    const { attachments } = openChat.mock.calls[0][0];
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toEqual(
      expect.objectContaining({
        type: 'security.watchlist',
        origin: 'watchlist_added_toast',
        data: expect.objectContaining({
          watchlist_id: 'wl-2',
          watchlist_name: 'Contractors',
          risk_modifier: 1.5,
          entity_count: 13,
          source_count: 0,
          added_entity_label: 'user: jane',
        }),
      })
    );
    expect(attachments[1].type).toBe('security.entity');
  });

  it('attaches only the entity when the watchlist record is not known', () => {
    showV5Toast(null);
    mountToastText();

    fireEvent.click(screen.getByText('Suggest a rule'));

    const { attachments } = openChat.mock.calls[0][0];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].type).toBe('security.entity');
  });
});

describe('getReviewRulePath', () => {
  it('encodes the watchlist id', () => {
    expect(getReviewRulePath('a b&c')).toBe(
      '/entity_analytics_management/watchlists?editWatchlistId=a%20b%26c'
    );
  });
});
