import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './PageTitleBar.css';

/** The accent bar under a page title. */
const PageTitleBar: React.FC<LayoutProps & { className?: string }> = ({ className, ...props }) => (
  <div className={cx('page-title-bar', className)} style={splitLayoutProps(props)[0]} />
);

export default PageTitleBar;
