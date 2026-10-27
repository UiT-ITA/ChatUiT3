import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';


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

    // Post-process to add table borders for better clipboard compatibility
    html = html.replace(/<table>/g, '<table style="border-collapse: collapse; border: 1px solid black;">');
    html = html.replace(/<th>/g, '<th style="border: 1px solid black; padding: 8px;">');
    html = html.replace(/<td>/g, '<td style="border: 1px solid black; padding: 8px;">');

    // Add proper header styling for rich text editors
    html = html.replace(/<h1>/g, '<h1 style="font-size: 2em; font-weight: bold; margin: 0.67em 0;">');
    html = html.replace(/<h2>/g, '<h2 style="font-size: 1.5em; font-weight: bold; margin: 0.75em 0;">');
    html = html.replace(/<h3>/g, '<h3 style="font-size: 1.17em; font-weight: bold; margin: 0.83em 0;">');
    html = html.replace(/<h4>/g, '<h4 style="font-size: 1em; font-weight: bold; margin: 1.12em 0;">');
    html = html.replace(/<h5>/g, '<h5 style="font-size: 0.83em; font-weight: bold; margin: 1.5em 0;">');
    html = html.replace(/<h6>/g, '<h6 style="font-size: 0.75em; font-weight: bold; margin: 1.67em 0;">');

    return html;
  } catch (error) {
    console.error('Error processing markdown:', error);
    return markdown;
  }
};
