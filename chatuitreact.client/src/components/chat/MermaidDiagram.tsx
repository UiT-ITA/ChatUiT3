import { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import './MermaidDiagram.css';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export default function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Initialize mermaid once on mount
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      fontFamily: 'inherit',
      fontSize: 16,
      htmlLabels: false,
      
    });
  }, []);

  // Render diagram when chart changes
  useEffect(() => {
    const renderDiagram = async () => {
      if (!chart || !chart.trim()) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          chart.trim()
        );

        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setLoading(false);
      }
    };

    renderDiagram();
  }, [chart]);

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
