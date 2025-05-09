/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { METRIC_TYPE, TELEMETRY_EVENT, track } from '../../../common/lib/telemetry';

export type TrackLinkClick = (linkId: string) => void;

export const trackOnboardingLinkClick = (linkId: string) => {
  track(METRIC_TYPE.CLICK, `${TELEMETRY_EVENT.ONBOARDING}_${linkId}`);
};
