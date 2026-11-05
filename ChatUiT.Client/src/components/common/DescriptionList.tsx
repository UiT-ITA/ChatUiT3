import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import type { TextVariant } from './Text';
import './DescriptionList.css';

export interface DescriptionListItem {
  term: React.ReactNode;
  details: React.ReactNode;
}

interface DescriptionListProps extends LayoutProps {
  items: DescriptionListItem[];
  // Typography roles of the terms and of the values
  termVariant?: TextVariant;
  detailsVariant?: TextVariant;
  // 'compact' has tighter gaps, wrapping values in the main text colour, and one column on very narrow screens
  density?: 'normal' | 'compact';
  className?: string;
}

/** Terms with their values, in two columns. */
const DescriptionList: React.FC<DescriptionListProps> = ({ items, termVariant = 'label', detailsVariant = 'body', density = 'normal', className, ...props }) => {
  const [style] = splitLayoutProps(props);
  return (
    <dl className={cx('description-list', density === 'compact' && 'description-list--compact', className)} style={style}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <dt className={cx('description-list__term', `t-${termVariant}`)}>{item.term}</dt>
          <dd className={cx('description-list__details', `t-${detailsVariant}`)}>{item.details}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
};

export default DescriptionList;
