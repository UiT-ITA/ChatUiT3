import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * Convert markdown to clean HTML for clipboard operations
 * Uses ReactMarkdown with the same plugins as the display component for perfect consistency
 * Produces semantic HTML that works well with rich text editors like Word, Google Docs, etc.
 */
export const markdownToHtml = (markdown: string): string => {
  try {
    // Render ReactMarkdown component to static HTML string
    let html = renderToStaticMarkup(
      ReactMarkdown({
        children: markdown,
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeKatex]
      })
    );

    // Clean up React-specific attributes
    html = html.replace(/data-reactroot="[^"]*"/g, '');
    html = html.replace(/data-react[^=]*="[^"]*"/g, '');

    // Post-process to add table borders for better clipboard compatibility
    html = html.replace(/<table>/g, '<table style="border-collapse: collapse; border: 1px solid black;">');
    html = html.replace(/<th>/g, '<th style="border: 1px solid black; padding: 8px;">');
    html = html.replace(/<td>/g, '<td style="border: 1px solid black; padding: 8px;">');

    return html;
  } catch (error) {
    console.error('Error processing markdown:', error);
    return markdown;
  }
};
