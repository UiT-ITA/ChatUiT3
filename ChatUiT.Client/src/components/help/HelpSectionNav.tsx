import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { helpActiveHeadingSignal } from '../../services/uiService';
import { HELP_SECTIONS, type HelpSectionId } from './helpSections';
import { parseHeadings } from './helpHeadings';
import { useHelpDoc } from './useHelpDoc';
import NavItem from '../common/NavItem';
import './HelpSectionNav.css';

interface HelpSectionNavProps {
  activeSection: HelpSectionId;
}

/**
 * The help entries in the context column. The open section expands to show its
 * `##` headings; the one currently in view is highlighted.
 */
const HelpSectionNav = ({ activeSection }: HelpSectionNavProps) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const doc = useHelpDoc(activeSection);
  const activeHeading = helpActiveHeadingSignal.value;

  const headings = useMemo(
    () => (doc.status === 'ready' ? parseHeadings(doc.markdown).filter(h => h.level === 2) : []),
    [doc],
  );

  return (
    <>
      {HELP_SECTIONS.map((id, index) => {
        const isActive = id === activeSection;
        return (
          <div key={id} className={`help-nav-section ${isActive ? 'active' : ''}`}>
            <NavItem
              active={isActive}
              leading={<span className="help-nav-number t-meta">{index + 1}</span>}
              onClick={() => navigate(`/help/${id}`)}
            >
              {t(`help.sections.${id}`)}
            </NavItem>
            {isActive && headings.length > 0 && (
              <ol className="help-nav-headings">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <NavItem
                      level={2}
                      active={activeHeading === heading.id}
                      onClick={() => navigate(`/help/${id}#${heading.id}`)}
                    >
                      {heading.text}
                    </NavItem>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </>
  );
};

export default HelpSectionNav;
