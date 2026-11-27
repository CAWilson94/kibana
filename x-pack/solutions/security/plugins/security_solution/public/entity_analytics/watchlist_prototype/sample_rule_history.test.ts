/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildRevertedVersion, getSampleRuleHistory } from './sample_rule_history';

const NOW = Date.parse('2026-11-27T12:00:00.000Z');

describe('getSampleRuleHistory', () => {
  it('has at least three versions, newest first', () => {
    const history = getSampleRuleHistory(NOW);

    expect(history.length).toBeGreaterThanOrEqual(3);
    const times = history.map(({ changedAt }) => Date.parse(changedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('gives every version a rule, a person and a unique id', () => {
    const history = getSampleRuleHistory(NOW);

    expect(history.every(({ queryRule, changedBy }) => queryRule && changedBy)).toBe(true);
    expect(new Set(history.map(({ id }) => id)).size).toBe(history.length);
  });
});

describe('getSampleRuleHistory in v5', () => {
  it('shows the agent change as confirmed by you, a few minutes ago', () => {
    const [current] = getSampleRuleHistory(NOW, { agentConfirmedByYou: true });

    expect(current.kind).toBe('agent');
    expect(current.changedBy).toBe('Agent Builder, confirmed by you');
    expect(NOW - new Date(current.changedAt).getTime()).toBe(5 * 60 * 1000);
  });

  it('keeps the older versions as they are', () => {
    expect(getSampleRuleHistory(NOW, { agentConfirmedByYou: true }).slice(1)).toEqual(
      getSampleRuleHistory(NOW).slice(1)
    );
  });
});

describe('buildRevertedVersion', () => {
  it('writes the older rule back as a new version by the person who reverted', () => {
    const history = getSampleRuleHistory(NOW);
    const older = history[2];

    const reverted = buildRevertedVersion({
      history,
      versionId: older.id,
      changedBy: 'you',
      now: NOW,
    });

    expect(reverted).toEqual(
      expect.objectContaining({
        queryRule: older.queryRule,
        changedBy: 'you',
        changedAt: '2026-11-27T12:00:00.000Z',
        kind: 'revert',
        restoredFromChangedAt: older.changedAt,
      })
    );
    expect(history.some(({ id }) => id === reverted?.id)).toBe(false);
  });

  it('does not change the history it was given', () => {
    const history = getSampleRuleHistory(NOW);
    const before = JSON.stringify(history);

    buildRevertedVersion({ history, versionId: history[1].id, changedBy: 'you', now: NOW });

    expect(JSON.stringify(history)).toBe(before);
  });

  it('returns nothing for a version that is not in the history', () => {
    const history = getSampleRuleHistory(NOW);

    expect(buildRevertedVersion({ history, versionId: 'nope', changedBy: 'you' })).toBeUndefined();
  });
});
