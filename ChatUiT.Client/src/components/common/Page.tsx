import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Page.css';

interface PageProps {
  // 'wide' widens the content column, for pages with several card columns
  width?: 'default' | 'wide';
  // 'column' lays the content out as a flex column, 'block' as normal flow
  flow?: 'column' | 'block';
  // 'size' fills the main area with the page background, 'grow' takes the remaining height of the main column
  fill?: 'size' | 'grow';
  // More space under the content on narrow screens
  mobileEndSpace?: 'default' | 'large';
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** A page in the main area: scrolls, and centres its content in a column with the page padding. */
const Page: React.FC<PageProps> = ({ width = 'default', flow = 'column', fill = 'size', mobileEndSpace = 'default', className, children, ref }) => (
  <div ref={ref} className={cx('page', fill === 'grow' && 'page--grow', className)}>
    <div className={cx('page__content', width === 'wide' && 'page__content--wide', flow === 'block' && 'page__content--block', mobileEndSpace === 'large' && 'page__content--mobile-end-large')}>{children}</div>
  </div>
);

interface PageIntroProps extends LayoutProps {
  // 'large' is the lead size, for a document page
  size?: 'medium' | 'large';
  children?: React.ReactNode;
}

/** The lead paragraph under a page title. */
export const PageIntro: React.FC<PageIntroProps> = ({ size = 'medium', children, ...props }) => {
  const [style] = splitLayoutProps(props);
  return <p className={cx('page-intro', size === 'large' ? 't-lead' : 't-body-lg')} style={style}>{children}</p>;
};

export default Page;
