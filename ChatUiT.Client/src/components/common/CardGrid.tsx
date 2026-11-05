import React, { useState } from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import { scrollFadeClass } from './scrollFade';
import './CardGrid.css';

interface CardGridProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  // Each Card spans this many grid rows, and the rows of the cards line up across the grid row
  cardRows?: number;
  // A fixed number of equal columns, in place of columns of at least the minimum width
  columns?: number;
  // On narrow screens: 'stack' puts the cards in one column, 'carousel' in one row that scrolls sideways and snaps each card to the centre
  mobileLayout?: 'grid' | 'stack' | 'carousel';
  // Fades the cut edge of a row that scrolls sideways
  fadeX?: boolean;
  // Hides the scrollbar of a sideways row and snaps each card to the start edge
  snap?: boolean;
  // Shows a dot per card under a carousel on narrow screens, the card nearest the centre filled
  pageDots?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** The index of the child whose centre is nearest the centre of the scroll area. */
const centredChild = (element: HTMLElement): number => {
  const centre = element.scrollLeft + element.clientWidth / 2;
  const children = Array.from(element.children) as HTMLElement[];
  const distances = children.map(child => Math.abs(child.offsetLeft + child.offsetWidth / 2 - centre));
  return distances.indexOf(Math.min(...distances));
};

/** Cards in columns of at least a minimum width, at most three to a row. */
export const CardGrid: React.FC<CardGridProps> = ({ cardRows, columns, mobileLayout = 'grid', fadeX = false, snap = false, pageDots = false, className, onScroll, children, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const [page, setPage] = useState(0);
  const count = React.Children.count(children);
  const style = {
    ...layout,
    ...(cardRows ? { ['--card-grid-rows' as string]: cardRows } : {}),
    ...(columns ? { ['--card-grid-columns' as string]: columns } : {}),
  };
  return (
    <>
      <div
        className={cx('card-grid', cardRows && 'card-grid--subgrid', columns && 'card-grid--fixed-columns', mobileLayout !== 'grid' && `card-grid--${mobileLayout}-mobile`, snap && 'h-scroller', fadeX && scrollFadeClass('x'), className)}
        style={style}
        onScroll={(event) => {
          if (pageDots) setPage(centredChild(event.currentTarget));
          onScroll?.(event);
        }}
        {...rest}
      >
        {children}
      </div>
      {pageDots && count > 1 && <CarouselDots count={count} active={page} mt="md" mobileOnly />}
    </>
  );
};

interface CarouselDotsProps extends LayoutProps {
  count: number;
  // The index of the filled dot
  active: number;
  // Shows the dots on narrow screens only
  mobileOnly?: boolean;
}

/** A dot per item of a carousel, the current one filled and wider. */
export const CarouselDots: React.FC<CarouselDotsProps> = ({ count, active, mobileOnly = false, ...props }) => {
  const [style] = splitLayoutProps(props);
  return (
    <div className={cx('carousel-dots', mobileOnly && 'carousel-dots--mobile-only')} style={style} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={cx('carousel-dots__dot', index === active && 'carousel-dots__dot--active')} />
      ))}
    </div>
  );
};
