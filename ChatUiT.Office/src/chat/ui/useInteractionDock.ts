import { useState } from "react";
import type { ApprovalAnswer, ApprovalPreview, ApprovalQuestion } from "../api/types";
import {
  describeError,
  openFunctionCalls,
  pendingApprovalRequests,
  type ApprovalDecision,
  type PendingAnswer,
  type ConversationState,
} from "../conversation/conversation";

/** An approval request, question or own function call that waits for the user. */
export type Interaction =
  | { kind: "approval"; id: string; name: string; arguments: string; preview: ApprovalPreview }
  | { kind: "question"; id: string; name: string; questions: ApprovalQuestion[] };

export interface InteractionDock {
  /** The interaction shown, or null when nothing waits for the user. */
  current: Interaction | null;
  /** 1-based position of the current interaction among those waiting. */
  position: number;
  count: number;
  /** Questions: the 0-based question shown, of `current.questions`. */
  step: number;
  /** Questions: the option labels picked for the question shown. */
  selected: string[];
  /** Questions: what the user wrote for the question shown. */
  text: string;
  /** Questions: picks or unpicks an option. On a single-choice question the pick also shows the next question or sends. */
  toggleOption(label: string): void;
  setText(text: string): void;
  busy: boolean;
  error: string | null;
  approve(editedArguments?: string): Promise<void>;
  reject(): Promise<void>;
  /** Questions: shows the next question, or sends every answer from the last one. */
  next(): Promise<void>;
  /** Questions: clears the answer to the question shown, then shows the next or sends every answer. */
  skip(): Promise<void>;
  /** Questions: shows another question; what was picked or written stays. */
  goTo(step: number): void;
  /** The answers filled in on the card shown, to send with a new message the user writes instead. */
  pendingAnswers(): PendingAnswer[];
}

/** What the user has picked and written for one question so far. */
interface Draft {
  selected: string[];
  text: string;
}

/** What waits for the user, in the order the calls were made. */
export function waitingInteractions(state: ConversationState): Interaction[] {
  const requests = new Set(pendingApprovalRequests(state.items));
  const calls = new Set(openFunctionCalls(state.items).filter((call) => state.previews[call.call_id]));
  return state.items.flatMap((item): Interaction[] => {
    if (item.type === "mcp_approval_request" && requests.has(item)) {
      if (item.chatuit_kind === "question" && item.chatuit_questions && item.chatuit_questions.length > 0) {
        return [{ kind: "question", id: item.id, name: item.name, questions: item.chatuit_questions }];
      }
      const preview = item.chatuit_preview ?? { title: item.name, fields: [], allow_edit: false };
      return [{ kind: "approval", id: item.id, name: item.name, arguments: item.arguments, preview }];
    }
    if (item.type === "function_call" && calls.has(item)) {
      return [
        {
          kind: "approval",
          id: item.call_id,
          name: item.name,
          arguments: item.arguments,
          preview: state.previews[item.call_id],
        },
      ];
    }
    return [];
  });
}

/** The approvals and questions the conversation waits on, one at a time, and the actions that answer them. */
export function useInteractionDock(
  state: ConversationState,
  answer: (id: string, decision: ApprovalDecision) => Promise<void>
): InteractionDock {
  const waiting = waitingInteractions(state);
  const current = waiting[0] ?? null;
  const [answeredCount, setAnsweredCount] = useState(0);
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentId = current?.id ?? null;
  const [shownId, setShownId] = useState(currentId);
  if (shownId !== currentId) {
    setShownId(currentId);
    setStep(0);
    setDrafts([]);
    setError(null);
    if (currentId === null) {
      setAnsweredCount(0);
    }
  }

  const selected = drafts[step]?.selected ?? [];
  const text = drafts[step]?.text ?? "";

  const updateDraft = (draft: Draft) =>
    setDrafts((previous) => {
      const next = [...previous];
      next[step] = draft;
      return next;
    });

  /** One answer per question from the drafts, null for a question left empty; null when every one is. */
  const toAnswers = (questions: ApprovalQuestion[], all: Draft[]): (ApprovalAnswer | null)[] | null => {
    const answers = questions.map((_, index): ApprovalAnswer | null => {
      const draft = all[index];
      const written = draft?.text.trim() ?? "";
      if (!draft || (draft.selected.length === 0 && !written)) {
        return null;
      }
      return written ? { selected: draft.selected, text: written } : { selected: draft.selected };
    });
    return answers.some((a) => a !== null) ? answers : null;
  };

  /** Shows the next question, or sends every answer when the question shown is the last. */
  const advance = async (all: Draft[]) => {
    if (current?.kind !== "question") {
      return;
    }
    if (step < current.questions.length - 1) {
      setStep(step + 1);
      return;
    }
    const answers = toAnswers(current.questions, all);
    await settle(answers ? { approve: true, answers } : { approve: false });
  };

  const settle = async (decision: ApprovalDecision) => {
    if (!current) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await answer(current.id, decision);
      setAnsweredCount((count) => count + 1);
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      setBusy(false);
    }
  };

  return {
    current,
    position: answeredCount + 1,
    count: answeredCount + waiting.length,
    step,
    selected,
    text,
    toggleOption: (label) => {
      if (current?.kind !== "question" || busy) {
        return;
      }
      if (!current.questions[step].multi_select) {
        const picked = [...drafts];
        picked[step] = { selected: [label], text };
        setDrafts(picked);
        void advance(picked);
        return;
      }
      updateDraft({
        selected: selected.includes(label) ? selected.filter((l) => l !== label) : [...selected, label],
        text,
      });
    },
    setText: (value) => updateDraft({ selected, text: value }),
    busy,
    error,
    approve: (editedArguments) =>
      settle(editedArguments === undefined ? { approve: true } : { approve: true, editedArguments }),
    reject: () => settle({ approve: false }),
    next: () => advance(drafts),
    skip: () => {
      const cleared = [...drafts];
      cleared[step] = { selected: [], text: "" };
      setDrafts(cleared);
      return advance(cleared);
    },
    goTo: (target) => {
      if (current?.kind === "question" && target >= 0 && target < current.questions.length) {
        setStep(target);
      }
    },
    pendingAnswers: () => {
      const answers = current?.kind === "question" ? toAnswers(current.questions, drafts) : null;
      return current && answers ? [{ requestId: current.id, answers }] : [];
    },
  };
}
