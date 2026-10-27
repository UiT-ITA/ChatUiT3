import type { ChatFile } from '../../types/fileModels';
import { countKnowledgeFileTokens, type ParsedScheme, type Tokenizer } from '../../utils/tokenCounting';
import type { KnowledgeFileItemData } from './KnowledgeFileItem';

const countedFiles = new WeakMap<ChatFile, Map<string, number>>();

/**
 * What a knowledge file costs under the scheme. Stored files carry the server's count; new
 * files are counted here, once per file and scheme. Undefined while the tokenizer loads, or
 * when a stored file has no count for the scheme.
 */
export function knowledgeFileTokens(
  item: KnowledgeFileItemData,
  scheme: ParsedScheme,
  tokenizer: Tokenizer | undefined
): number | undefined {
  if (!item.ChatFile) {
    return item.tokenCounts?.[scheme.id];
  }
  if (!tokenizer) {
    return undefined;
  }

  let byScheme = countedFiles.get(item.ChatFile);
  if (!byScheme) {
    byScheme = new Map();
    countedFiles.set(item.ChatFile, byScheme);
  }

  let tokens = byScheme.get(scheme.id);
  if (tokens === undefined) {
    tokens = countKnowledgeFileTokens(item.ChatFile, tokenizer, scheme);
    byScheme.set(scheme.id, tokens);
  }
  return tokens;
}

/** The files' total under the scheme. Undefined while any of them cannot be counted yet. */
export function knowledgeFilesTokens(
  items: KnowledgeFileItemData[],
  scheme: ParsedScheme,
  tokenizer: Tokenizer | undefined
): number | undefined {
  let total = 0;
  for (const item of items) {
    const tokens = knowledgeFileTokens(item, scheme, tokenizer);
    if (tokens === undefined) {
      return undefined;
    }
    total += tokens;
  }
  return total;
}
