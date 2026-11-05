import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { helpActiveHeadingSignal } from '../../services/uiService';
import { HELP_SECTIONS, type HelpSectionId } from './helpSections';
import { parseHeadings } from './helpHeadings';
import { useHelpDoc } from './useHelpDoc';
import NavOutline from '../common/NavOutline';

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
    <NavOutline
      sections={HELP_SECTIONS.map(id => ({
        id,
        label: t(`help.sections.${id}`),
        headings: id === activeSection ? headings.map(heading => ({ id: heading.id, label: heading.text })) : undefined,
      }))}
      activeSection={activeSection}
      activeHeading={activeHeading}
      onSelectSection={(id) => navigate(`/help/${id}`)}
      onSelectHeading={(id, headingId) => navigate(`/help/${id}#${headingId}`)}
    />
  );
};

export default HelpSectionNav;
