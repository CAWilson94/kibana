/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildSuggestRulePrompt, MAX_PROMPT_ENTITIES } from './suggest_rule_prompt';

const entity = (index: number) => ({
  euid: `user:person-${index}`,
  name: `person-${index}`,
  type: 'user',
});

describe('buildSuggestRulePrompt', () => {
  it('names the watchlist and says how many entities were added by hand', () => {
    const prompt = buildSuggestRulePrompt({
      watchlistName: 'Contractors',
      entities: [entity(1), entity(2)],
      total: 2,
    });

    expect(prompt).toContain('"Contractors"');
    expect(prompt).toContain('2 entities');
  });

  it('lists each entity by name, type and id', () => {
    const prompt = buildSuggestRulePrompt({
      watchlistName: 'Contractors',
      entities: [entity(1)],
      total: 1,
    });

    expect(prompt).toContain('person-1 (user, user:person-1)');
  });

  it('falls back to the id when an entity has no name or type', () => {
    const prompt = buildSuggestRulePrompt({
      watchlistName: 'Contractors',
      entities: [{ euid: 'host:web-01' }],
      total: 1,
    });

    expect(prompt).toContain('host:web-01 (host:web-01)');
  });

  it('lists at most ten entities and still reports the full total', () => {
    const entities = Array.from({ length: 14 }, (_, index) => entity(index + 1));

    const prompt = buildSuggestRulePrompt({ watchlistName: 'Contractors', entities, total: 14 });

    expect(MAX_PROMPT_ENTITIES).toBe(10);
    expect(prompt).toContain('14 entities');
    expect(prompt).toContain('first 10');
    expect(prompt).toContain('person-10 (user, user:person-10)');
    expect(prompt).not.toContain('person-11');
  });

  it('asks the agent to compare with the current rule and to ask before saving', () => {
    const prompt = buildSuggestRulePrompt({
      watchlistName: 'Contractors',
      entities: [entity(1)],
      total: 1,
    });

    expect(prompt).toContain('current rule');
    expect(prompt).toContain('how many entities it matches');
    expect(prompt).toContain('confirmation before anything is saved');
  });
});
