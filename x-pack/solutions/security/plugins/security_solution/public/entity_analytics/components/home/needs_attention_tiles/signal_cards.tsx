/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiButtonIcon, EuiPanel, EuiToolTip, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';

import type { ActiveFilter, SignalCardData, SignalCardId } from './data';
import { SignalMetricChartCard } from './signal_metric_chart_card';

export interface SignalCardsProps {
  activeFilter: ActiveFilter | null;
  /** Card values for the current page filters — see `getSignalCards`. */
  cards: SignalCardData[];
  onFilterForCard: (cardId: SignalCardId) => void;
  /** Kept for MetricChartsPanel wiring; cards are whole-card toggles in v.5. */
  onFilterOutCard?: (cardId: SignalCardId) => void;
  onAddCardToTimeline?: (cardId: SignalCardId) => void;
}

/** Named container so the grid can step columns from its own width, not the viewport. */
const SIGNAL_CARDS_CONTAINER = 'eaSignalCards';
/** Compact: 6-across, then 3 / 2 / 1 so the last row stays even. */
const COMPACT_CARD_MIN_WIDTH = '12rem';
const COMPACT_COLUMN_STEPS = [6, 3, 2, 1] as const;
/** Expanded: two rows of 3, then 2 / 1. */
const EXPANDED_CARD_MIN_WIDTH = '16rem';
const EXPANDED_COLUMN_STEPS = [3, 2, 1] as const;

const spaceForColumns = (count: number, minItemWidth: string, gap: string): string =>
  count === 1 ? minItemWidth : `calc(${count} * ${minItemWidth} + ${count - 1} * ${gap})`;

/**
 * Caps column count (compact 6, expanded 3) and steps down via container queries
 * when tiles would otherwise shrink below `minItemWidth`.
 */
const layoutCappedGridCss = ({
  minItemWidth,
  columnSteps,
  gap,
}: {
  minItemWidth: string;
  columnSteps: readonly number[];
  gap: string;
}) => {
  const [maxColumns, ...narrower] = columnSteps;
  const steps = narrower
    .map((columns, index) => {
      const threshold = spaceForColumns(columnSteps[index], minItemWidth, gap);
      return `
        @container ${SIGNAL_CARDS_CONTAINER} (width < ${threshold}) {
          grid-template-columns: repeat(${columns}, minmax(0, 1fr));
        }
      `;
    })
    .join('');

  return css`
    display: grid;
    gap: ${gap};
    grid-template-columns: repeat(${maxColumns}, minmax(0, 1fr));
    ${steps}
  `;
};

const compactLayoutTooltip = i18n.translate(
  'xpack.securitySolution.entityAnalytics.facelift.signalCards.compactLayoutTooltip',
  { defaultMessage: 'Compact layout' }
);

const expandedLayoutTooltip = i18n.translate(
  'xpack.securitySolution.entityAnalytics.facelift.signalCards.expandedLayoutTooltip',
  { defaultMessage: 'Expanded layout' }
);

const switchToCompactLayoutAriaLabel = i18n.translate(
  'xpack.securitySolution.entityAnalytics.facelift.signalCards.switchToCompactLayoutAriaLabel',
  { defaultMessage: 'Switch to compact layout' }
);

const switchToExpandedLayoutAriaLabel = i18n.translate(
  'xpack.securitySolution.entityAnalytics.facelift.signalCards.switchToExpandedLayoutAriaLabel',
  { defaultMessage: 'Switch to expanded layout' }
);

/**
 * Needs-attention metrics in a capped wrapping grid (6 compact, 3 expanded).
 * Each card toggles an in-page table filter; selection stays on the card itself.
 */
export const SignalCards: React.FC<SignalCardsProps> = ({
  activeFilter,
  cards,
  onFilterForCard,
}) => {
  const { euiTheme } = useEuiTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const anySelected = activeFilter?.type === 'card';

  return (
    <>
      <div
        css={css`
          display: flex;
          justify-content: flex-end;
          margin-block-end: ${euiTheme.size.xs};
        `}
      >
        <EuiToolTip content={isExpanded ? compactLayoutTooltip : expandedLayoutTooltip}>
          <EuiButtonIcon
            iconType={isExpanded ? 'tableOfContents' : 'apps'}
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={
              isExpanded ? switchToCompactLayoutAriaLabel : switchToExpandedLayoutAriaLabel
            }
            size="xs"
            color="text"
          />
        </EuiToolTip>
      </div>
      <EuiPanel
        hasBorder={false}
        hasShadow={false}
        paddingSize="none"
        data-test-subj="eaFaceliftSignalCards"
        css={css`
          container-type: inline-size;
          container-name: ${SIGNAL_CARDS_CONTAINER};
        `}
      >
        <div
          css={layoutCappedGridCss({
            minItemWidth: isExpanded ? EXPANDED_CARD_MIN_WIDTH : COMPACT_CARD_MIN_WIDTH,
            columnSteps: isExpanded ? EXPANDED_COLUMN_STEPS : COMPACT_COLUMN_STEPS,
            gap: euiTheme.size.s,
          })}
        >
          {cards.map((card) => {
            const selected = activeFilter?.type === 'card' && activeFilter.cardId === card.id;
            const dimmed = Boolean(anySelected && !selected);

            return (
              <div
                key={card.id}
                css={css`
                  min-inline-size: 0;
                  position: relative;
                  /* eslint-disable-next-line @elastic/eui/no-static-z-index -- local grid cell stacking, no semantic token applies */
                  z-index: ${selected ? 2 : 1};

                  &:hover,
                  &:focus-within {
                    z-index: 2;
                  }
                `}
              >
                <SignalMetricChartCard
                  card={card}
                  selected={selected}
                  dimmed={dimmed}
                  onToggle={() => onFilterForCard(card.id)}
                />
              </div>
            );
          })}
        </div>
      </EuiPanel>
    </>
  );
};
