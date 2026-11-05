import { createContext, useContext } from 'react';

/** How the navigation lists of a container show their entries. */
export interface NavListStyle {
  // The full-width list view of a narrow screen: rows with dividers, no marked entry, and a chevron on each main entry
  mobileList: boolean;
}

export const NavListContext = createContext<NavListStyle>({ mobileList: false });

/** The list style of the surrounding navigation container. */
export const useNavListStyle = () => useContext(NavListContext);
