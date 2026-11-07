import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Legend, LegendItem } from '../common/Legend';
import type { DataTone } from '../common/dataTone';
import { formatBucket, formatNumber, num } from './insightsFormat';
import type { InsightsRange, InsightsRow } from '../../types/insights';
import './TimeChart.css';

export interface TimeSeries {
  key: string;
  label: string;
  tone: Extract<DataTone, 'viz-1' | 'viz-2' | 'viz-3' | 'viz-4' | 'viz-5'>;
  // What the legend shows for the series: the sum of the buckets or the highest bucket
  summary: 'total' | 'peak';
}

interface TimeChartProps {
  rows: InsightsRow[];
  // The column that holds the start of each bucket
  x: string;
  series: TimeSeries[];
  range: InsightsRange;
}

const X_TICKS = 5;

interface Metrics {
  width: number;
  height: number;
  // Space around the plot for the axis labels
  top: number;
  right: number;
  bottom: number;
  left: number;
  // Space between the plot and the labels
  gap: number;
  // Radius of the dots on the bucket under the pointer
  dot: number;
}

const NO_METRICS: Metrics = { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, gap: 0, dot: 0 };

/** A length in rem or px, in pixels. */
const toPixels = (value: string): number => {
  const amount = parseFloat(value) || 0;
  return value.trim().endsWith('rem') ? amount * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) : amount;
};

/** The size of the chart and the spacing tokens TimeChart.css sets on it, in pixels. */
const measure = (svg: SVGSVGElement, width: number, height: number): Metrics => {
  const style = getComputedStyle(svg);
  const length = (name: string) => toPixels(style.getPropertyValue(name));
  return {
    width,
    height,
    top: length('--time-chart-inset-top'),
    right: length('--time-chart-inset-right'),
    bottom: length('--time-chart-inset-bottom'),
    left: length('--time-chart-inset-left'),
    gap: length('--time-chart-label-gap'),
    dot: length('--time-chart-dot'),
  };
};

/** The smallest of 1, 2 or 5 times a power of ten that is at least the value. */
const niceMax = (value: number): number => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map(step => step * power).find(step => step >= value) ?? value;
};

/** A line chart of time buckets with a legend, and the values of the bucket under the pointer. */
const TimeChart: React.FC<TimeChartProps> = ({ rows, x, series, range }) => {
  const { t, i18n } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Metrics>(NO_METRICS);
  const [hover, setHover] = useState<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  useLayoutEffect(() => {
    if (tooltipRef.current) setTooltipWidth(tooltipRef.current.offsetWidth);
  }, [hover]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => setSize(measure(svg, entry.contentRect.width, entry.contentRect.height)));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const { left, top } = size;
  const plotWidth = Math.max(0, size.width - left - size.right);
  const plotHeight = Math.max(0, size.height - top - size.bottom);
  const max = niceMax(Math.max(0, ...rows.flatMap(row => series.map(item => num(row[item.key])))));
  const xAt = (index: number) => left + (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const yAt = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const tickIndexes = rows.length <= X_TICKS
    ? rows.map((_, index) => index)
    : Array.from({ length: X_TICKS }, (_, step) => Math.round((step / (X_TICKS - 1)) * (rows.length - 1)));

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (rows.length === 0 || plotWidth === 0) return;
    const offset = event.clientX - event.currentTarget.getBoundingClientRect().left - left;
    const index = rows.length === 1 ? 0 : Math.round((offset / plotWidth) * (rows.length - 1));
    setHover(Math.min(rows.length - 1, Math.max(0, index)));
  };

  const summary = (item: TimeSeries) => {
    const values = rows.map(row => num(row[item.key]));
    return item.summary === 'total' ? values.reduce((sum, value) => sum + value, 0) : Math.max(0, ...values);
  };

  const hovered = hover === null ? undefined : rows[hover];
  // The bucket's x, kept far enough from the plot edges that the centred tooltip stays inside them
  const tooltipLeft = hover === null ? 0 : Math.min(Math.max(xAt(hover), tooltipWidth / 2), size.width - tooltipWidth / 2);

  return (
    <div className="time-chart">
      <div className="time-chart__plot">
        <svg ref={svgRef} className="time-chart__svg" width="100%" viewBox={`0 0 ${size.width} ${size.height}`} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)} role="img" aria-label={series.map(item => item.label).join(', ')}>
          {[0, 0.5, 1].map(fraction => (
            <g key={fraction}>
              <line className="time-chart__grid" x1={left} x2={left + plotWidth} y1={yAt(max * fraction)} y2={yAt(max * fraction)} />
              <text className="time-chart__label t-meta" x={left - size.gap} y={yAt(max * fraction)} textAnchor="end" dominantBaseline="middle">
                {formatNumber(max * fraction, i18n.language, Number.isInteger(max * fraction) ? 0 : 1)}
              </text>
            </g>
          ))}
          {tickIndexes.map(index => (
            <text key={index} className="time-chart__label t-meta" x={xAt(index)} y={size.height - size.gap} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}>
              {formatBucket(rows[index][x], range, i18n.language)}
            </text>
          ))}
          {series.map(item => (
            <polyline
              key={item.key}
              className={`time-chart__line time-chart__line--${item.tone}`}
              points={rows.map((row, index) => `${xAt(index)},${yAt(num(row[item.key]))}`).join(' ')}
            />
          ))}
          {hover !== null && (
            <g>
              <line className="time-chart__cursor" x1={xAt(hover)} x2={xAt(hover)} y1={top} y2={top + plotHeight} />
              {series.map(item => (
                <circle key={item.key} className={`time-chart__dot time-chart__dot--${item.tone}`} cx={xAt(hover)} cy={yAt(num(rows[hover][item.key]))} r={size.dot} />
              ))}
            </g>
          )}
        </svg>
        {hovered && (
          <div ref={tooltipRef} className="time-chart__tooltip t-caption" style={{ left: tooltipLeft }}>
            <div className="time-chart__tooltip-title">{formatBucket(hovered[x], range, i18n.language)}</div>
            {series.map(item => (
              <div key={item.key}>{item.label}: {formatNumber(hovered[item.key], i18n.language)}</div>
            ))}
          </div>
        )}
      </div>
      <Legend mt="md">
        {series.map(item => (
          <LegendItem
            key={item.key}
            tone={item.tone}
            label={item.summary === 'peak' ? `${item.label} (${t('insights.peak')})` : `${item.label} (${t('insights.total')})`}
            value={formatNumber(summary(item), i18n.language)}
          />
        ))}
      </Legend>
    </div>
  );
};

export default TimeChart;
