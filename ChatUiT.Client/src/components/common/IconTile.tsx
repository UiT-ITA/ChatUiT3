import React from 'react';
import { Icon, type IconName } from './Icon';
import './IconTile.css';

interface IconTileProps {
  icon: IconName;
}

/** A square tile with an accent icon on a soft info fill. Decorative. */
const IconTile: React.FC<IconTileProps> = ({ icon }) => (
  <span className="icon-tile" aria-hidden="true">
    <Icon name={icon} size="sm" />
  </span>
);

export default IconTile;
