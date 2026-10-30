import React from 'react';
import { cx, space, splitLayoutProps, type LayoutProps, type Space } from './layout';
import './Card.css';

interface CardProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // The element to render. Use 'button' for a card that is clicked.
  as?: 'div' | 'section' | 'article' | 'button';
  padding?: Space;
  // Space between the card's children
  gap?: Space;
  // Lifts the card with a shadow
  elevated?: boolean;
  // Highlights the border on hover
  interactive?: boolean;
  // Marks the card as the chosen one of a set
  selected?: boolean;
  // Border color that signals a state, such as waiting for the user
  tone?: 'default' | 'warning' | 'danger';
  // A light-blue brand edge on one side
  accent?: 'none' | 'start' | 'top';
  disabled?: boolean;
}

/** A framed surface for grouped content, or a clickable choice. */
const Card: React.FC<CardProps> = ({ as: Element = 'div', padding = 'md', gap = 'sm', elevated = false, interactive, selected = false, accent = 'none', tone = 'default', disabled, className, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const clickable = interactive ?? Element === 'button';
  const buttonProps = Element === 'button' ? { type: 'button' as const, disabled, 'aria-pressed': selected || undefined } : {};

  return (
    <Element
      className={cx('card', elevated && 'card--elevated', clickable && 'card--interactive', selected && 'card--selected', accent !== 'none' && `card--accent-${accent}`, tone !== 'default' && `card--tone-${tone}`, className)}
      style={{ padding: space(padding), gap: space(gap), ...layout }}
      {...buttonProps}
      {...rest}
    />
  );
};

export default Card;
