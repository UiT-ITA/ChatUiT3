import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './List.css';

interface ListProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  // Draws a line between the items
  divided?: boolean;
  // Draws a border around the list
  bordered?: boolean;
}

/** A vertical list of ListItem rows. */
export const List: React.FC<ListProps> = ({ divided = true, bordered = false, className, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  return <div className={cx('list', divided && 'list--divided', bordered && 'list--bordered', className)} style={style} {...rest} />;
};

export interface ListItemProps extends LayoutProps, Omit<React.ComponentProps<'button'>, 'title' | 'width'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  // Content before the text, such as an icon
  leading?: React.ReactNode;
  // Content at the right end, such as a badge or a model name
  trailing?: React.ReactNode;
  density?: 'compact' | 'normal';
  // Buttons beside the row, such as remove. They sit outside the clickable area.
  actions?: React.ReactNode;
}

/** One clickable row in a List. */
export const ListItem: React.FC<ListItemProps> = ({ title, description, leading, trailing, density = 'normal', actions, className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const row = (
    <button type="button" className={cx('list-item', `list-item--${density}`, !actions && className)} style={actions ? undefined : style} {...rest}>
      {leading && <span className="list-item__leading">{leading}</span>}
      <span className="list-item__text">
        <span className="list-item__title t-table-strong">{title}</span>
        {description && <span className="list-item__description t-caption">{description}</span>}
        {children}
      </span>
      {trailing && <span className="list-item__trailing t-meta">{trailing}</span>}
    </button>
  );

  if (!actions) return row;

  return (
    <div className={cx('list-item-group', className)} style={style}>
      {row}
      <span className="list-item__actions">{actions}</span>
    </div>
  );
};
