import { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { useSettings } from '../../contexts/SettingsContext';
import { getMermaidTheme } from '../../utils/themeUtils';
import './MermaidDiagram.css';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  // Initialize mermaid when theme changes
  useEffect(() => {
    const mermaidTheme = getMermaidTheme(settings.mode);
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      fontFamily: 'inherit',
      htmlLabels: false
    });
  }, [settings.mode]);

  // Render diagram when chart or theme changes
  useEffect(() => {
    const renderDiagram = async () => {
      if (!chart || !chart.trim()) {
        setLoading(false);
        return;
      }

      let container: HTMLDivElement | null = null;
      try {
        setLoading(true);
        setError('');

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        container = document.createElement('div');
        container.setAttribute('aria-hidden', 'true');
        container.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
        document.body.appendChild(container);

        const { svg: renderedSvg } = await mermaid.render(
          id,
          chart.trim(),
          container
        );

        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setLoading(false);
        if (container && container.parentElement === document.body) {
          try { container.remove(); } catch {}
        }
      }
    };

    renderDiagram();
  }, [chart, settings.mode]);

  if (loading) {
    return (
      <div className={`mermaid-diagram loading ${className}`}>
        <span>Rendering diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mermaid-diagram error ${className}`}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`mermaid-diagram empty ${className}`}>
        No diagram to display
      </div>
    );
  }

  return (
    <div
      className={`mermaid-diagram ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default MermaidDiagram;
