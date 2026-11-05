import React from 'react';
import './BrandHero.css';

interface BrandHeroProps {
  overline: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}

/** A banner in the brand colour with the skewed stripes of the UiT profile: an overline, a large title and a line under it. */
const BrandHero: React.FC<BrandHeroProps> = ({ overline, title, subtitle }) => (
  <div className="brand-hero">
    <div className="brand-hero__stripe-gap" />
    <div className="brand-hero__stripe" />
    <div className="brand-hero__content">
      <div className="brand-hero__overline t-overline">{overline}</div>
      <h1 className="brand-hero__title t-hero">{title}</h1>
      {subtitle && <p className="brand-hero__sub t-body">{subtitle}</p>}
    </div>
  </div>
);

export default BrandHero;
