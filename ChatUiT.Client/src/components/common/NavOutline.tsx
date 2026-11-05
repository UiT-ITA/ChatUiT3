import React from 'react';
import NavItem, { NavSubList } from './NavItem';
import { useNavListStyle } from './navListStyle';
import Box from './Box';

export interface NavOutlineSection {
  id: string;
  label: React.ReactNode;
  // The sub-entries shown under the section while it is the active one
  headings?: { id: string; label: React.ReactNode }[];
}

interface NavOutlineProps {
  sections: NavOutlineSection[];
  activeSection: string;
  activeHeading?: string | null;
  onSelectSection: (sectionId: string) => void;
  onSelectHeading: (sectionId: string, headingId: string) => void;
}

/** A numbered list of sections. The active section shows its headings under it and marks the current one. */
const NavOutline: React.FC<NavOutlineProps> = ({ sections, activeSection, activeHeading, onSelectSection, onSelectHeading }) => {
  const { mobileList } = useNavListStyle();
  return (
    <>
      {sections.map((section, index) => {
        const isActive = section.id === activeSection;
        const headings = isActive ? section.headings ?? [] : [];
        const showHeadings = headings.length > 0;
        return (
          <Box key={section.id} border={mobileList && showHeadings ? 'soft' : undefined} borderSide="bottom">
            <NavItem
              active={isActive}
              quietActive={showHeadings && headings.some(heading => heading.id === activeHeading)}
              expanded={isActive}
              wrap
              leadingAlign="start"
              number={index + 1}
              onClick={() => onSelectSection(section.id)}
            >
              {section.label}
            </NavItem>
            {showHeadings && (
              <NavSubList>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <NavItem level={2} wrap active={activeHeading === heading.id} onClick={() => onSelectHeading(section.id, heading.id)}>
                      {heading.label}
                    </NavItem>
                  </li>
                ))}
              </NavSubList>
            )}
          </Box>
        );
      })}
    </>
  );
};

export default NavOutline;
