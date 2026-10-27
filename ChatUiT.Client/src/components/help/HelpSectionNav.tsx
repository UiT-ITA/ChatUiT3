import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { helpActiveHeadingSignal } from '../../services/uiService';
import { HELP_SECTIONS, type HelpSectionId } from './helpSections';
import { parseHeadings } from './helpHeadings';
import { useHelpDoc } from './useHelpDoc';
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
            <button
              className={`context-nav-row help-nav-row t-ui ${isActive ? 'active' : ''}`}
              onClick={() => navigate(`/help/${id}`)}
            >
              <span className="help-nav-number t-meta">{index + 1}</span>
              <span className="help-nav-title">{t(`help.sections.${id}`)}</span>
            </button>
            {isActive && headings.length > 0 && (
              <ol className="help-nav-headings">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <button
                      className={`help-nav-heading t-ui-plain ${activeHeading === heading.id ? 'active' : ''}`}
                      onClick={() => navigate(`/help/${id}#${heading.id}`)}
                    >
                      {heading.text}
                    </button>
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
