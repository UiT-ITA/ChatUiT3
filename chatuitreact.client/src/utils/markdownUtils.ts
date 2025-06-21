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
    
    // Check for separator lines first (when in table, skip without closing)
    const isSeparatorLine = line.match(/^\|[\s\-\|:]+\|?$/);
    
    if (isSeparatorLine) {
      // Skip separator lines entirely - don't close table if we're in one
      continue;
    }
    
    // Check if this is a table row (contains | but not separator lines)
    const isTableRow = line.includes('|');
    
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
      
      // Add non-table lines
      processedLines.push(line);
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
  
  // Step 6: Process lists with proper nesting and types
  html = processLists(html);
  
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
  
  // Step 9: Post-process to add table borders (after all table structure is complete)
  html = html.replace(/<table>/g, '<table style="border-collapse: collapse; border: 1px solid black;">');
  html = html.replace(/<th>/g, '<th style="border: 1px solid black; padding: 8px;">');
  html = html.replace(/<td>/g, '<td style="border: 1px solid black; padding: 8px;">');
  
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

// Helper function to process lists with proper nesting and types
function processLists(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this is a list item
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    const orderedMatch = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
    
    if (unorderedMatch || orderedMatch) {
      // Process the entire list starting from this line
      const listResult = processListBlock(lines, i);
      result.push(listResult.html);
      i = listResult.nextIndex;
    } else {
      // Not a list item, add as-is
      result.push(line);
      i++;
    }
  }
  
  return result.join('\n');
}

// Helper function to process a complete list block
function processListBlock(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  interface ListItem {
    indentLevel: number;
    type: 'ul' | 'ol';
    content: string;
    children: ListItem[];
  }
  
  const listItems: ListItem[] = [];
  let i = startIndex;
  
  // Collect all consecutive list items
  while (i < lines.length) {
    const line = lines[i];
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    const orderedMatch = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
    
    if (unorderedMatch || orderedMatch) {
      const indent = (unorderedMatch || orderedMatch)![1];
      const content = (unorderedMatch || orderedMatch)![3];
      const indentLevel = Math.floor(indent.length / 2);
      const listType = unorderedMatch ? 'ul' : 'ol';
      
      listItems.push({
        indentLevel,
        type: listType,
        content,
        children: []
      });
      i++;
    } else {
      break; // End of list
    }
  }
  
  // Build nested structure
  const rootItems = buildNestedStructure(listItems);
  
  // Convert to HTML
  const html = renderListItems(rootItems);
  
  return { html, nextIndex: i };
}

// Helper function to build nested list structure
function buildNestedStructure(items: any[]): any[] {
  const stack: any[] = [];
  const result: any[] = [];
  
  for (const item of items) {
    // Pop items with equal or greater indent level
    while (stack.length > 0 && stack[stack.length - 1].indentLevel >= item.indentLevel) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      // Root level item
      result.push(item);
    } else {
      // Child item
      stack[stack.length - 1].children.push(item);
    }
    
    stack.push(item);
  }
  
  return result;
}

// Helper function to render list items as HTML
function renderListItems(items: any[]): string {
  if (items.length === 0) return '';
  
  // Group by type and consecutive indentation
  const groups: any[][] = [];
  let currentGroup: any[] = [];
  let currentType = items[0].type;
  
  for (const item of items) {
    if (item.type === currentType) {
      currentGroup.push(item);
    } else {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
      }
      currentGroup = [item];
      currentType = item.type;
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  // Render each group
  return groups.map(group => {
    const listType = group[0].type;
    const listItems = group.map(item => {
      let html = `<li>${item.content}`;
      if (item.children.length > 0) {
        html += renderListItems(item.children);
      }
      html += '</li>';
      return html;
    }).join('');
    
    return `<${listType}>${listItems}</${listType}>`;
  }).join('');
}
