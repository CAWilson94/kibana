/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TileSparkline } from './tile_sparkline';

jest.mock('@kbn/charts-theme', () => ({ useElasticChartsTheme: () => ({}) }));
jest.mock('@elastic/charts', () => ({
  Chart: ({ children }: { children: React.ReactNode }) => (
    <div data-test-subj="mockChart">{children}</div>
  ),
  Settings: () => null,
  Tooltip: () => null,
  AreaSeries: () => null,
  ScaleType: { Linear: 'linear' },
  TooltipType: { None: 'none' },
}));

describe('TileSparkline', () => {
  it('keeps its space and its text alternative before the series has loaded', () => {
    render(<TileSparkline ariaLabel="Trend for New entity" />);
    expect(screen.getByRole('img', { name: 'Trend for New entity' })).toBeInTheDocument();
    expect(screen.queryByTestId('mockChart')).not.toBeInTheDocument();
  });

  it('does not draw a chart for an empty series', () => {
    render(<TileSparkline values={[]} ariaLabel="Trend" />);
    expect(screen.queryByTestId('mockChart')).not.toBeInTheDocument();
  });

  it('draws the chart once there are values', () => {
    render(<TileSparkline values={[0, 3, 1, 5]} ariaLabel="Trend" />);
    expect(screen.getByTestId('mockChart')).toBeInTheDocument();
  });
});
