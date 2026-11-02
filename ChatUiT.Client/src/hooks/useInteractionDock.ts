import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getChat, respondToToolCall } from '../services/chatService';
import {
  declineClientToolCall,
  needsClientApproval,
  previewClientToolCall,
  runClientToolCall,
} from '../services/clientTools/clientToolRunner';
import { ApiError } from '../services/apiService';
import { isAwaitingStatus } from '../types/chatModels';
import type { ActivityEntryDto, PendingAnswerDto, ToolPreviewDto, UserAnswerDto, UserQuestionDto } from '../types/chatModels';

/** A call the chat's last message waits on that the user must answer. */
export type Interaction =
  | { kind: 'approval'; messageId: string; entry: ActivityEntryDto; preview: ToolPreviewDto; source: 'server' | 'client' }
  | { kind: 'question'; messageId: string; entry: ActivityEntryDto; questions: UserQuestionDto[] };

export interface InteractionDock {
  /** The interaction shown, or null when nothing waits on the user. */
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
  toggleOption: (label: string) => void;
  setText: (text: string) => void;
  busy: boolean;
  error: string | null;
  approve: (editedArgumentsJson?: string | null) => Promise<void>;
  reject: () => Promise<void>;
  /** Questions: shows the next question, or sends every answer from the last one. */
  next: () => Promise<void>;
  /** Questions: clears the answer to the question shown, then shows the next or sends every answer. */
  skip: () => Promise<void>;
  /** Questions: shows another question; what was picked or written stays. */
  goTo: (step: number) => void;
  /** The answers filled in on the card shown, to send with a new message the user writes instead. */
  pendingAnswers: () => PendingAnswerDto[];
}

/** What the user has picked and written for one question so far. */
interface Draft {
  selected: string[];
  text: string;
}

/**
 * The approvals and questions the chat's last message waits on, one at a time, and the actions
 * that answer them. Calls to this client's own tools run here: right away, or after the user
 * approves when the tool has a preview.
 */
export function useInteractionDock(chatId: string | undefined): InteractionDock {
  const { t } = useTranslation();
  const chat = chatId !== undefined ? getChat(chatId).value : undefined;
  const message = [...(chat?.messages ?? [])].reverse().find(m => m.role === 'Assistant' && m.status === 'AwaitingUser');
  const waiting = useMemo(
    () => (message?.activity?.entries ?? []).filter(e => e.type === 'Tool' && e.toolCallId && isAwaitingStatus(e.status) && e.response === null),
    [message],
  );

  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const [clientPreviews, setClientPreviews] = useState<ReadonlyMap<string, ToolPreviewDto>>(new Map());
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Builds the previews of this client's tools that ask for approval. The chat store runs the others.
  useEffect(() => {
    if (!chatId || !message) {
      return;
    }

    for (const entry of waiting) {
      if (entry.status !== 'awaitingClient' || !needsClientApproval(entry) || answered.has(entry.toolCallId!)) {
        continue;
      }

      if (!clientPreviews.has(entry.toolCallId!)) {
        void previewClientToolCall(entry).then(preview => {
          if (preview) {
            setClientPreviews(previews => new Map(previews).set(entry.toolCallId!, preview));
          } else {
            void respondToToolCall(chatId, message.id, entry.toolCallId!, { kind: 'clientResult', result: t('interaction.previewFailed'), isError: true });
          }
        });
      }
    }
  }, [chatId, message, waiting, answered, clientPreviews, t]);

  const interactions = useMemo(() => waiting
    .filter(entry => !answered.has(entry.toolCallId!))
    .flatMap((entry): Interaction[] => {
      if (!message) return [];
      if (entry.status === 'awaitingConfirmation' && entry.preview) {
        return [{ kind: 'approval', messageId: message.id, entry, preview: entry.preview, source: 'server' }];
      }
      if (entry.status === 'awaitingAnswer' && entry.questions && entry.questions.length > 0) {
        return [{ kind: 'question', messageId: message.id, entry, questions: entry.questions }];
      }
      const preview = entry.status === 'awaitingClient' ? clientPreviews.get(entry.toolCallId!) : undefined;
      return preview ? [{ kind: 'approval', messageId: message.id, entry, preview, source: 'client' }] : [];
    }), [waiting, answered, clientPreviews, message]);

  const current = interactions[0] ?? null;
  const total = interactions.length + waiting.filter(e => answered.has(e.toolCallId!)).length;
  const currentId = current?.entry.toolCallId ?? null;

  const [shownId, setShownId] = useState(currentId);
  if (shownId !== currentId) {
    setShownId(currentId);
    setStep(0);
    setDrafts([]);
    setError(null);
  }
  const selected = drafts[step]?.selected ?? [];
  const text = drafts[step]?.text ?? '';

  const updateDraft = (draft: Draft) => setDrafts(previous => {
    const next = [...previous];
    next[step] = draft;
    return next;
  });

  /** One answer per question from the drafts, null for a question left empty; null when every one is. */
  const toAnswers = (questions: UserQuestionDto[], all: Draft[]): (UserAnswerDto | null)[] | null => {
    const answers = questions.map((_, index) => {
      const draft = all[index];
      const written = draft?.text.trim() ?? '';
      return draft && (draft.selected.length > 0 || written) ? { selected: draft.selected, text: written || null } : null;
    });
    return answers.some(a => a !== null) ? answers : null;
  };

  /** Shows the next question, or sends every answer when the question shown is the last. */
  const advance = async (all: Draft[]) => {
    if (current?.kind !== 'question') return;
    if (step < current.questions.length - 1) {
      setStep(step + 1);
      return;
    }
    await settle(() => respond({ kind: 'answer', answers: toAnswers(current.questions, all) }));
  };

  const settle = async (send: () => Promise<unknown>) => {
    if (!chatId || !current) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await send();
      setAnswered(previous => new Set(previous).add(current.entry.toolCallId!));
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 400 ? failure.message : t('interaction.failed'));
    } finally {
      setBusy(false);
    }
  };

  const respond = (body: Parameters<typeof respondToToolCall>[3]) =>
    respondToToolCall(chatId!, current!.messageId, current!.entry.toolCallId!, body);

  return {
    current,
    position: total - interactions.length + 1,
    count: total,
    step,
    selected,
    text,
    toggleOption: label => {
      if (current?.kind !== 'question' || busy) return;
      if (!current.questions[step].multiSelect) {
        const picked = [...drafts];
        picked[step] = { selected: [label], text };
        setDrafts(picked);
        void advance(picked);
        return;
      }
      updateDraft({ selected: selected.includes(label) ? selected.filter(l => l !== label) : [...selected, label], text });
    },
    setText: value => updateDraft({ selected, text: value }),
    busy,
    error,
    approve: editedArgumentsJson => settle(async () => {
      if (current?.kind !== 'approval') return;
      if (current.source === 'client') {
        await runClientToolCall(chatId!, current.messageId, current.entry);
      } else {
        await respond({ kind: 'confirmation', decision: 'approve', editedArgumentsJson: editedArgumentsJson ?? null });
      }
    }),
    reject: () => settle(async () => {
      if (current?.kind !== 'approval') return;
      if (current.source === 'client') {
        await declineClientToolCall(chatId!, current.messageId, current.entry);
      } else {
        await respond({ kind: 'confirmation', decision: 'reject', editedArgumentsJson: null });
      }
    }),
    next: () => advance(drafts),
    skip: () => {
      const cleared = [...drafts];
      cleared[step] = { selected: [], text: '' };
      setDrafts(cleared);
      return advance(cleared);
    },
    goTo: target => {
      if (current?.kind === 'question' && target >= 0 && target < current.questions.length) {
        setStep(target);
      }
    },
    pendingAnswers: () => {
      const answers = current?.kind === 'question' ? toAnswers(current.questions, drafts) : null;
      return current && answers ? [{ toolCallId: current.entry.toolCallId!, response: { kind: 'answer', answers } }] : [];
    },
  };
}
