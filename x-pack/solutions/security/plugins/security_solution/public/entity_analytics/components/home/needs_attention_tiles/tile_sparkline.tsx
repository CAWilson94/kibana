/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { AreaSeries, Chart, ScaleType, Settings, Tooltip, TooltipType } from '@elastic/charts';
import type { PartialTheme } from '@elastic/charts';
import { useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import { useElasticChartsTheme } from '@kbn/charts-theme';

/** Fixed height, so the card does not jump when the chart appears after the count and delta. */
export const SPARKLINE_HEIGHT_PX = 40;

interface TileSparklineProps {
  /** One value per bucket, oldest first. Undefined while the series has not loaded yet. */
  values?: number[];
  /** Text alternative for screen readers; the chart itself is decorative. */
  ariaLabel: string;
}

/**
 * Small area chart for a Needs-attention tile: no axes, legend or tooltip. Renders an empty
 * block of the same height until `values` arrive, so the layout stays put.
 */
export const TileSparkline: React.FC<TileSparklineProps> = ({ values, ariaLabel }) => {
  const { euiTheme } = useEuiTheme();
  const baseTheme = useElasticChartsTheme();

  const theme = useMemo<PartialTheme>(
    () => ({
      background: { color: 'transparent' },
      chartMargins: { left: 0, right: 0, top: 0, bottom: 0 },
      chartPaddings: { left: 0, right: 0, top: 0, bottom: 0 },
      areaSeriesStyle: {
        area: { opacity: 0.2 },
        line: { strokeWidth: 1.5 },
        point: { visible: 'never' },
      },
    }),
    []
  );

  const data = useMemo(() => (values ?? []).map((y, x) => ({ x, y })), [values]);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-test-subj="eaFaceliftSignalCardTrend"
      css={css`
        block-size: ${SPARKLINE_HEIGHT_PX}px;
        inline-size: 100%;
        min-inline-size: 0;
      `}
    >
      {data.length > 0 && (
        <Chart size={{ height: SPARKLINE_HEIGHT_PX }}>
          <Settings baseTheme={baseTheme} theme={theme} showLegend={false} />
          <Tooltip type={TooltipType.None} />
          <AreaSeries
            id="trend"
            data={data}
            xAccessor="x"
            yAccessors={['y']}
            xScaleType={ScaleType.Linear}
            yScaleType={ScaleType.Linear}
            color={euiTheme.colors.primary}
          />
        </Chart>
      )}
    </div>
  );
};
