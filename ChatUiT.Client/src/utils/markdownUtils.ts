import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { tokenValue } from './cssTokens';

export const markdownToHtml = (markdown: string): string => {
  try {
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

    // Table borders for clipboard compatibility; headings keep the target app's own styles
    const border = `${tokenValue('--border-sm')} solid ${tokenValue('--uit-black')}`;
    html = html.replace(/<table>/g, `<table style="border-collapse: collapse; border: ${border};">`);
    html = html.replace(/<(th|td)>/g, `<$1 style="border: ${border}; padding: ${tokenValue('--space-sm')};">`);

    return html;
  } catch (error) {
    console.error('Error processing markdown:', error);
    return markdown;
  }
};
