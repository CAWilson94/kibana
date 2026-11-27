/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * DESIGN PROTOTYPE, NOT FOR MERGE.
 *
 * Fake rule history for the v3 demo. Nothing here is stored or read from the server. The rules and
 * the people are made up. Real storage is a later decision (option E in the research notes).
 */

export type SampleRuleVersionKind = 'edit' | 'agent' | 'revert';

export interface SampleRuleVersion {
  readonly id: string;
  /** The KQL of the rule at this version. */
  readonly queryRule: string;
  readonly changedBy: string;
  /** An ISO timestamp. */
  readonly changedAt: string;
  readonly kind: SampleRuleVersionKind;
  /** For a revert, when the restored version was first saved. */
  readonly restoredFromChangedAt?: string;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const ago = (now: number, ms: number): string => new Date(now - ms).toISOString();

/** Newest first. The first item is the current rule. */
export const getSampleRuleHistory = (
  now: number = Date.now(),
  { agentConfirmedByYou = false }: { agentConfirmedByYou?: boolean } = {}
): SampleRuleVersion[] => [
  {
    id: 'sample-4',
    queryRule: 'entity.type: "user" and asset.criticality: ("high_impact" or "extreme_impact")',
    // v5: the agent's change in the chat, as the demo user confirmed it a few minutes ago.
    changedBy: agentConfirmedByYou
      ? 'Agent Builder, confirmed by you'
      : 'Agent Builder, confirmed by alex.kim',
    changedAt: ago(now, agentConfirmedByYou ? 5 * MINUTE_MS : 2 * HOUR_MS),
    kind: 'agent',
  },
  {
    id: 'sample-3',
    queryRule: 'entity.type: "user" and asset.criticality: "extreme_impact"',
    changedBy: 'alex.kim',
    changedAt: ago(now, 3 * DAY_MS),
    kind: 'edit',
  },
  {
    id: 'sample-2',
    queryRule: 'entity.type: "user" and user.roles: "contractor"',
    changedBy: 'sam.patel',
    changedAt: ago(now, 12 * DAY_MS),
    kind: 'edit',
  },
  {
    id: 'sample-1',
    queryRule: 'entity.type: "user" and user.roles: ("contractor" or "vendor")',
    changedBy: 'sam.patel',
    changedAt: ago(now, 30 * DAY_MS),
    kind: 'edit',
  },
];

/**
 * The new current version after a revert. A revert writes the older rule back as a new version, so
 * the history keeps every step and nothing is rewritten.
 */
export const buildRevertedVersion = ({
  history,
  versionId,
  changedBy,
  now = Date.now(),
}: {
  history: readonly SampleRuleVersion[];
  versionId: string;
  changedBy: string;
  now?: number;
}): SampleRuleVersion | undefined => {
  const restored = history.find(({ id }) => id === versionId);
  if (!restored) return undefined;

  return {
    id: `sample-revert-${history.length + 1}`,
    queryRule: restored.queryRule,
    changedBy,
    changedAt: new Date(now).toISOString(),
    kind: 'revert',
    restoredFromChangedAt: restored.changedAt,
  };
};
