import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import './HelpPage.css';

// Type for TOC item
type TocItem = {
  id: string;
  title: string;
  level: number; // 1 for h1, 2 for h2, 3 for h3
  parentH2Id?: string; // Only for h3
  parentH1Id?: string; // For h2 and h3
};

const Help: React.FC = () => {
  const [docContent, setDocContent] = useState<string>('# Loading...');
  const [tableOfContents, setTableOfContents] = useState<TocItem[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [activeH1, setActiveH1] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/documentation.md')
      .then(response => response.text())
      .then(text => {
        setDocContent(text);
        setTableOfContents(extractTableOfContents(text));
      })
      .catch(error => {
        console.error('Error loading documentation:', error);
        setDocContent('# Error Loading Documentation');
      });
  }, []);

  // Extract h1, h2, h3 and their parent relationships
  const extractTableOfContents = (content: string): TocItem[] => {
    const toc: TocItem[] = [];
    const lines = content.split('\n');
    let insideCodeBlock = false;
    let lastH1Id: string | undefined = undefined;
    let lastH2Id: string | undefined = undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        insideCodeBlock = !insideCodeBlock;
        continue;
      }
      if (insideCodeBlock) continue;
      if (line.startsWith('# ')) {
        const title = line.substring(2).trim();
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        toc.push({ id, title, level: 1 });
        lastH1Id = id;
        lastH2Id = undefined;
      } else if (line.startsWith('## ')) {
        const title = line.substring(3).trim();
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        toc.push({ id, title, level: 2, parentH1Id: lastH1Id });
        lastH2Id = id;
      } else if (line.startsWith('### ')) {
        const title = line.substring(4).trim();
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (lastH2Id && lastH1Id) {
          toc.push({ id, title, level: 3, parentH2Id: lastH2Id, parentH1Id: lastH1Id });
        }
      }
    }
    return toc;
  };

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'auto' }); // Changed from 'smooth' to 'auto'
      setActiveHeading(id);
      // Set active h1 based on the clicked item
      const tocItem = tableOfContents.find(item => item.id === id);
      if (tocItem) {
        if (tocItem.level === 1) {
          setActiveH1(tocItem.id);
        } else if (tocItem.level === 2 || tocItem.level === 3) {
          if (tocItem.parentH1Id) setActiveH1(tocItem.parentH1Id);
        }
      }
    }
  };

  const generateHeadingId = (text: string): string => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };

  // Debounced scroll handler
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const headings = Array.from(contentRef.current.querySelectorAll('h1[id], h2[id], h3[id]')) as HTMLElement[];
    // Find the heading closest to the top (but not past it)
    let closest: { id: string; top: number; level: number; parentH1Id?: string } | null = null;
    for (const heading of headings) {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 80) { // 80px from top, tweak as needed
        const tocItem = tableOfContents.find(item => item.id === heading.id);
        if (!closest || rect.top > closest.top) {
          closest = {
            id: heading.id,
            top: rect.top,
            level: tocItem?.level ?? 1,
            parentH1Id: tocItem?.parentH1Id
          };
        }
      }
    }
    if (closest) {
      setActiveHeading(prev => prev !== closest!.id ? closest!.id : prev);
      if (closest.level === 1) {
        setActiveH1(prev => prev !== closest!.id ? closest!.id : prev);
      } else if (closest.parentH1Id) {
        setActiveH1(prev => prev !== closest.parentH1Id ? closest.parentH1Id! : prev);
      }
    } else if (tableOfContents.length > 0) {
      // fallback to first h1
      const firstH1 = tableOfContents.find(item => item.level === 1);
      if (firstH1) {
        setActiveHeading(firstH1.id);
        setActiveH1(firstH1.id);
      }
    }
  }, [tableOfContents]);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const onScroll = () => {
      handleScroll();
    };

    contentElement.addEventListener('scroll', onScroll);
    // Initial call
    handleScroll();

    return () => {
      contentElement.removeEventListener('scroll', onScroll);
    };
  }, [handleScroll]);

  return (
    <div className="help-page">
      <div className="doc-content" ref={contentRef}>
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ className, inline, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={atomOneDark}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              h1({ children }) {
                const text = Array.isArray(children)
                  ? children.join('')
                  : String(children || '');
                const id = generateHeadingId(text);
                return <h1 id={id}>{children}</h1>;
              },
              h2({ children }) {
                const text = Array.isArray(children)
                  ? children.join('')
                  : String(children || '');
                const id = generateHeadingId(text);
                return <h2 id={id}>{children}</h2>;
              },
              h3({ children }) {
                const text = Array.isArray(children)
                  ? children.join('')
                  : String(children || '');
                const id = generateHeadingId(text);
                return <h3 id={id}>{children}</h3>;
              }
            }}
          >
            {docContent}
          </ReactMarkdown>
        </div>
      </div>
      <div className="doc-toc">
        <div className="toc-header">Contents</div>
        <nav className="toc-nav">
          {tableOfContents.map((item) => {
            if (item.level === 1 || item.level === 2) {
              return (
                <React.Fragment key={item.id}>
                  <div
                    className={`toc-item level-${item.level} ${activeHeading === item.id ? 'active' : ''}`}
                    onClick={() => scrollToHeading(item.id)}
                  >
                    {item.title}
                  </div>
                  {/* Show all h3s under this h2 if it belongs to the active h1 */}
                  {item.level === 2 && item.parentH1Id === activeH1 &&
                    tableOfContents
                      .filter(h3 => h3.level === 3 && h3.parentH2Id === item.id)
                      .map(h3 => (
                        <div
                          key={h3.id}
                          className={`toc-item level-3 ${activeHeading === h3.id ? 'active' : ''}`}
                          onClick={() => scrollToHeading(h3.id)}
                        >
                          {h3.title}
                        </div>
                      ))
                  }
                </React.Fragment>
              );
            }
            // h3s are rendered only under their parent h2
            return null;
          })}
        </nav>
      </div>
    </div>
  );
};

export default Help;