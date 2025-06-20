/**
 * Convert markdown to clean HTML for clipboard operations
 * Produces semantic HTML that works well with rich text editors like Word, Google Docs, etc.
 */
export const markdownToHtml = (markdown: string): string => {
  let html = markdown;
  
  // Step 1: Protect code blocks first (preserve them from other transformations)
  const codeBlocks: string[] = [];
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    const codeContent = match.replace(/```\w*\n?/, '').replace(/```$/, '');
    codeBlocks.push(`<pre><code>${codeContent}</code></pre>`);
    return placeholder;
  });
  
  // Step 2: Process headers
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Step 3: Process tables with proper handling
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Preserve already-converted headers and code block placeholders
    if (line.startsWith('<h1>') || line.startsWith('<h2>') || line.startsWith('<h3>') || 
        line.includes('__CODE_BLOCK_')) {
      // Close any open table before adding other elements
      if (inTable) {
        processedLines.push(buildTable(tableRows));
        tableRows = [];
        inTable = false;
      }
      processedLines.push(line);
      continue;
    }
    
    // Check if this is a table row (contains | but not separator lines)
    const isTableRow = line.includes('|') && !line.match(/^\|[\s\-\|:]+\|?$/);
    
    if (isTableRow) {
      if (!inTable) {
        inTable = true;
      }
      tableRows.push(line);
    } else {
      // Close table if we were in one
      if (inTable) {
        processedLines.push(buildTable(tableRows));
        tableRows = [];
        inTable = false;
      }
      
      // Skip separator lines, add other lines
      if (!line.match(/^\|[\s\-\|:]+\|?$/)) {
        processedLines.push(line);
      }
    }
  }
  
  // Close any remaining table
  if (inTable && tableRows.length > 0) {
    processedLines.push(buildTable(tableRows));
  }
  
  html = processedLines.join('\n');
  
  // Step 4: Process text formatting
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Step 5: Process inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Step 6: Process lists
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive list items in ul
  html = html.replace(/(<li>.*?<\/li>(?:\n<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');
  
  // Step 7: Process paragraphs (but exclude elements that shouldn't be wrapped)
  const paragraphs = html.split(/\n\s*\n/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    
    // Don't wrap these elements in paragraphs
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || 
        p.startsWith('<pre') || p.startsWith('<table') || p.startsWith('<li>') ||
        p.includes('__CODE_BLOCK_')) {
      return p;
    }
    
    // Don't wrap if it contains lists
    if (p.includes('<ul>') || p.includes('<li>')) {
      return p;
    }
    
    return `<p>${p}</p>`;
  }).join('\n');
  
  // Step 8: Restore code blocks
  codeBlocks.forEach((codeBlock, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, codeBlock);
  });
  
  return html;
};

// Helper function to build a complete table from rows
function buildTable(rows: string[]): string {
  if (rows.length === 0) return '';
  
  const tableRows = rows.map((row, index) => {
    const cells = row.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '');
    
    const cellTag = index === 0 ? 'th' : 'td';
    const cellTags = cells.map(cell => `<${cellTag}>${cell}</${cellTag}>`).join('');
    return `<tr>${cellTags}</tr>`;
  });
  
  const headerRow = tableRows[0];
  const dataRows = tableRows.slice(1);
  
  let table = `<table><thead>${headerRow}</thead>`;
  if (dataRows.length > 0) {
    table += `<tbody>${dataRows.join('')}</tbody>`;
  }
  table += '</table>';
  
  return table;
}
