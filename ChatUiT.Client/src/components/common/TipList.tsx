import React from 'react';
import { Icon, type IconName } from './Icon';
import './TipList.css';

interface TipListProps {
  children?: React.ReactNode;
}

/** Short tips side by side, one per row on phone screens. */
export const TipList: React.FC<TipListProps> = ({ children }) => (
  <div className="tip-list" style={{ ['--tip-list-columns' as string]: React.Children.count(children) }}>{children}</div>
);

interface TipProps {
  icon: IconName;
  title: React.ReactNode;
  text: React.ReactNode;
}

/** One tip: an accent icon, a title and a line of text under it. */
export const Tip: React.FC<TipProps> = ({ icon, title, text }) => (
  <div className="tip">
    <Icon name={icon} size="sm" color="accent" className="tip__icon" />
    <strong className="tip__title t-ui">{title}</strong>
    <span className="tip__text t-ui-plain">{text}</span>
  </div>
);
