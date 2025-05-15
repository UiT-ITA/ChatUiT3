import React, { useState, useEffect, useRef } from 'react';
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
  level: number; // 1 for h1, 2 for h2
};

const Help: React.FC = () => {
  const [docContent, setDocContent] = useState<string>('# Loading...');
  const [tableOfContents, setTableOfContents] = useState<TocItem[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>('');
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

  const extractTableOfContents = (content: string): TocItem[] => {
    const toc: TocItem[] = [];
    const lines = content.split('\n');
    let insideCodeBlock = false;
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
      } else if (line.startsWith('## ')) {
        const title = line.substring(3).trim();
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        toc.push({ id, title, level: 2 });
      }
    }
    return toc;
  };

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveHeading(id);
    }
  };

  const generateHeadingId = (text: string): string => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;
      const headings = contentRef.current.querySelectorAll('h1[id], h2[id]');
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i] as HTMLElement;
        const rect = heading.getBoundingClientRect();
        if (rect.top >= 0 && rect.top <= 300) {
          setActiveHeading(heading.id);
          break;
        }
      }
    };
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll);
      return () => {
        contentElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, [docContent]);

  return (
    <div className="help-page">
      <div className="doc-content" ref={contentRef}>
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({className, inline, children, ...props}: any) {
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
              h1({children}) {
                const text = Array.isArray(children) 
                  ? children.join('') 
                  : String(children || '');
                const id = generateHeadingId(text);
                return <h1 id={id}>{children}</h1>;
              },
              h2({children}) {
                const text = Array.isArray(children) 
                  ? children.join('') 
                  : String(children || '');
                const id = generateHeadingId(text);
                return <h2 id={id}>{children}</h2>;
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
          {tableOfContents.map((item) => (
            <div
              key={item.id}
              className={`toc-item level-${item.level} ${activeHeading === item.id ? 'active' : ''}`}
              onClick={() => scrollToHeading(item.id)}
            >
              {item.title}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Help;