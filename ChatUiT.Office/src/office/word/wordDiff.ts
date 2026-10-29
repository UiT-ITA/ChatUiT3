/**
 * Word-level text diff for tracked edits. The text is split into words, whitespace and single
 * punctuation marks. Changed tokens next to each other form one change. Unchanged text between
 * two changes in the same sentence joins the change when it has fewer than `MIN_KEPT_WORDS`
 * words. Unchanged text at the start and end of a sentence always stays unchanged.
 */

export interface TextChange {
  /** Offsets of the changed text in the old and the new text. */
  oldStart: number;
  newStart: number;
  oldText: string;
  newText: string;
}

/** Old and new text that are the same, as offsets into both texts. */
export interface EqualSpan {
  oldStart: number;
  newStart: number;
  length: number;
}

export interface TextDiff {
  changes: TextChange[];
  equal: EqualSpan[];
}

const MIN_KEPT_WORDS = 3;
const TOKEN = /\s+|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\s]/gu;
const WORD = /^[\p{L}\p{N}]/u;
const SENTENCE_END = /^[.!?]$/;

export function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

export function words(text: string): string[] {
  return tokenize(text).filter((token) => WORD.test(token));
}

interface Op {
  equal: boolean;
  oldFrom: number;
  oldTo: number;
  newFrom: number;
  newTo: number;
}

export function diffText(oldText: string, newText: string): TextDiff {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  const ops = absorbShortEqualRuns(tokenOps(a, b), a);

  const oldOffsets = offsets(a);
  const newOffsets = offsets(b);
  const changes: TextChange[] = [];
  const equal: EqualSpan[] = [];
  for (const op of ops) {
    const oldStart = oldOffsets[op.oldFrom];
    const oldEnd = oldOffsets[op.oldTo];
    const newStart = newOffsets[op.newFrom];
    const newEnd = newOffsets[op.newTo];
    if (op.equal) {
      equal.push({ oldStart, newStart, length: oldEnd - oldStart });
    } else {
      changes.push({
        oldStart,
        newStart,
        oldText: oldText.slice(oldStart, oldEnd),
        newText: newText.slice(newStart, newEnd),
      });
    }
  }
  return { changes, equal };
}

/** Share of words two texts have in common, from 0 to 1, measured against the longer text. */
export function similarity(oldText: string, newText: string): number {
  const a = words(oldText);
  const b = words(newText);
  if (a.length === 0 && b.length === 0) {
    return 1;
  }
  const counts = new Map<string, number>();
  a.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  let shared = 0;
  for (const word of b) {
    const count = counts.get(word) ?? 0;
    if (count > 0) {
      shared += 1;
      counts.set(word, count - 1);
    }
  }
  return shared / Math.max(a.length, b.length);
}

/** Pairs of indexes into `a` and `b` that match, in order, as many as possible. */
export function longestCommonPairs<A, B>(a: A[], b: B[], matches: (x: A, y: B) => boolean): [number, number][] {
  const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = matches(a[i], b[j]) ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (matches(a[i], b[j]) && lengths[i][j] === lengths[i + 1][j + 1] + 1) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/** Alternating equal and changed token ranges. */
function tokenOps(a: string[], b: string[]): Op[] {
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const middle = longestCommonPairs(
    a.slice(prefix, a.length - suffix),
    b.slice(prefix, b.length - suffix),
    (x, y) => x === y
  ).map(([i, j]): [number, number] => [i + prefix, j + prefix]);
  const matched: [number, number][] = [
    ...Array.from({ length: prefix }, (_, k): [number, number] => [k, k]),
    ...middle,
    ...Array.from({ length: suffix }, (_, k): [number, number] => [a.length - suffix + k, b.length - suffix + k]),
  ];

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  const push = (equal: boolean, oldTo: number, newTo: number) => {
    if (oldTo === i && newTo === j) {
      return;
    }
    const last = ops[ops.length - 1];
    if (last && last.equal === equal) {
      last.oldTo = oldTo;
      last.newTo = newTo;
    } else {
      ops.push({ equal, oldFrom: i, oldTo, newFrom: j, newTo });
    }
    i = oldTo;
    j = newTo;
  };
  for (const [x, y] of matched) {
    push(false, x, y);
    push(true, x + 1, y + 1);
  }
  push(false, a.length, b.length);
  return ops;
}

/** Joins an equal run into the changes around it when it is short and inside one sentence. */
function absorbShortEqualRuns(ops: Op[], a: string[]): Op[] {
  const result: Op[] = [];
  ops.forEach((op, index) => {
    const between = index > 0 && index < ops.length - 1;
    const absorb = op.equal && between && countWords(a, op) < MIN_KEPT_WORDS && !endsSentence(a, op);
    const last = result[result.length - 1];
    if (last && !last.equal && (absorb || !op.equal)) {
      last.oldTo = op.oldTo;
      last.newTo = op.newTo;
    } else {
      result.push({ ...op, equal: op.equal && !absorb });
    }
  });
  return result;
}

function countWords(a: string[], op: Op): number {
  return a.slice(op.oldFrom, op.oldTo).filter((token) => WORD.test(token)).length;
}

/** Whether a sentence ends inside the run: a sentence mark followed by whitespace. */
function endsSentence(a: string[], op: Op): boolean {
  for (let k = op.oldFrom; k < op.oldTo; k++) {
    if (SENTENCE_END.test(a[k]) && (k + 1 >= a.length || /^\s/.test(a[k + 1]))) {
      return true;
    }
  }
  return false;
}

function offsets(tokens: string[]): number[] {
  const result = [0];
  tokens.forEach((token, index) => result.push(result[index] + token.length));
  return result;
}
