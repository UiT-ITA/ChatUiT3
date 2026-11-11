import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Alert from '../common/Alert';
import Box from '../common/Box';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Card from '../common/Card';
import ChoiceOption from '../common/ChoiceOption';
import DescriptionList from '../common/DescriptionList';
import Flag from '../common/Flag';
import { Icon } from '../common/Icon';
import IconButton from '../common/IconButton';
import { List, ListItem } from '../common/List';
import LoadingIndicator from '../common/LoadingIndicator';
import Page from '../common/Page';
import RichText, { RichTextLink } from '../common/RichText';
import Stack from '../common/Stack';
import Text from '../common/Text';
import { MOBILE } from '../common/breakpoints';
import { AppShell, AppShellMain, AppShellSidebar, Rail, RailButton, RailSeal, RailSpacer } from '../layout/AppShell';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useSettings } from '../../hooks/useSettings';
import { resolveMode } from '../../utils/themeUtils';
import {
  checkTrainingAnswer,
  downloadTrainingCertificate,
  fetchTrainingCourse,
  submitTraining,
  trainingOpenSignal,
  trainingStatusSignal,
  type TrainingCourse,
  type TrainingQuestionResult,
  type TrainingSubmitResult,
} from '../../services/trainingService';
import './TrainingScreen.css';

type CourseState =
  | { status: 'loading' }
  | { status: 'ready'; language: string; course: TrainingCourse }
  | { status: 'error' };

/** Course text as markdown. Links open in a new tab. */
const CourseText = ({ children }: { children: string }) => (
  <RichText>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ a: ({ href, children: label }) => <RichTextLink href={href} target="_blank" rel="noopener noreferrer">{label}</RichTextLink> }}
    >
      {children}
    </ReactMarkdown>
  </RichText>
);

/** A row of equal segments, one per step. The steps up to and including the current one are filled. */
const Steps = ({ count, current }: { count: number; current: number }) => (
  <div className="training-steps" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <span key={index} className={index < current ? 'training-steps__step training-steps__step--done' : 'training-steps__step'} />
    ))}
  </div>
);

/**
 * The mandatory training over the whole window: the rail with the language, mode and close
 * buttons, and one page at a time beside it. The pages are the intro, the course parts, the
 * test with one question at a time, and the graded result. A user without a stored result
 * cannot close it before passing the test.
 */
const TrainingScreen = () => {
  useSignals();
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { settings, updateSetting } = useSettings();
  const darkNow = resolveMode(settings.mode) === 'dark';
  const completed = trainingStatusSignal.value?.completed ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery(MOBILE);

  const [state, setState] = useState<CourseState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // 0 is the intro, 1 to the number of parts are the parts, and the step after them is the test
  const [step, setStep] = useState(0);
  // The parts the user has opened in this visit
  const [visited, setVisited] = useState<ReadonlySet<number>>(new Set());
  const [questionIndex, setQuestionIndex] = useState(0);
  // The option picked for the open question, before it is answered
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // The grading of each answered question, by question id
  const [feedback, setFeedback] = useState<Record<string, TrainingQuestionResult>>({});
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<TrainingSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTrainingCourse(language).then(
      (course) => { if (!cancelled) setState({ status: 'ready', language, course }); },
      () => { if (!cancelled) setState({ status: 'error' }); },
    );
    return () => { cancelled = true; };
  }, [language, attempt]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [step, questionIndex, result]);

  const close = () => { trainingOpenSignal.value = false; };

  // One rail button with the flag of the current language. It switches to the other language
  const languageButton = (
    <IconButton
      icon={<Flag src={settings.language === 'no-NB' ? '/no.svg' : '/gb.svg'} />}
      label={t('settings.language.title')}
      tooltipPlacement={isMobile ? 'bottom' : 'right'}
      onClick={() => updateSetting('language', settings.language === 'no-NB' ? 'en-US' : 'no-NB')}
    />
  );

  // The rail and the page beside it. On a narrow screen the rail is the top bar
  const frame = (content: React.ReactNode) => (
    <div className="training-screen">
      <AppShell mobile={isMobile} view="detail">
        <AppShellSidebar>
          <Rail mobile={isMobile}>
            <RailSeal src={darkNow ? '/chatuit-logo.svg' : '/chatuit-logo-darkblue.svg'} alt="UiT" title="ChatUiT" />
            <RailSpacer />
            {languageButton}
            <RailButton icon={darkNow ? 'sun' : 'moon'} label={t('sidebar.toggleMode')} active={false} onClick={() => updateSetting('mode', darkNow ? 'light' : 'dark')} />
            {completed && <RailButton icon="close" label={t('common.close')} active={false} onClick={close} />}
          </Rail>
        </AppShellSidebar>
        <AppShellMain>
          <Page ref={scrollRef} fill="grow" flow="block" mobileEndSpace="large">{content}</Page>
        </AppShellMain>
      </AppShell>
    </div>
  );

  if (state.status !== 'ready' || state.language !== language) {
    return frame(state.status === 'error' ? (
      <Stack gap="md" align="start">
        <Text as="p" variant="body" tone="secondary">{t('training.loadError')}</Text>
        <Button variant="primary" onClick={() => { setState({ status: 'loading' }); setAttempt(value => value + 1); }}>{t('training.retry')}</Button>
      </Stack>
    ) : (
      <LoadingIndicator />
    ));
  }

  const { course } = state;
  const testStep = course.sections.length + 1;
  const section = step >= 1 && step < testStep ? course.sections[step - 1] : undefined;
  const question = course.questions[questionIndex];
  const questionFeedback = question ? feedback[question.id] : undefined;
  const lastQuestion = questionIndex === course.questions.length - 1;
  const requiredScore = Math.ceil((course.passPercent * course.questions.length) / 100);

  const resetTest = () => {
    setQuestionIndex(0);
    setPicked(null);
    setAnswers({});
    setFeedback({});
    setResult(null);
  };

  const startTest = () => {
    resetTest();
    setStep(testStep);
  };

  const openStep = (next: number) => {
    if (next >= 1 && next < testStep) {
      setVisited(current => (current.has(next) ? current : new Set(current).add(next)));
    }
    setStep(next);
  };

  const readMark = <Icon name="check" size="sm" color="success" />;

  const readAgain = () => {
    resetTest();
    openStep(1);
  };

  const answer = async () => {
    if (!question || picked === null) return;
    setChecking(true);
    try {
      const graded = await checkTrainingAnswer(course.version, question.id, picked, language);
      setAnswers(current => ({ ...current, [question.id]: picked }));
      setFeedback(current => ({ ...current, [question.id]: graded }));
    } catch {
      // The API service has shown the error.
    } finally {
      setChecking(false);
    }
  };

  const showQuestion = (index: number) => {
    setPicked(null);
    setQuestionIndex(index);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      setResult(await submitTraining(course.version, answers, language));
    } catch {
      // The API service has shown the error.
    } finally {
      setSubmitting(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadTrainingCertificate(language);
    } catch {
      // The API service has shown the error.
    } finally {
      setDownloading(false);
    }
  };

  const optionText = (questionId: string, optionId: string | null | undefined) =>
    course.questions.find(question => question.id === questionId)?.options.find(option => option.id === optionId)?.text ?? '';

  // How a graded option of the open question is marked: the right answer, and a wrong pick
  const optionOutcome = (optionId: string): 'correct' | 'wrong' | undefined => {
    if (!question || !questionFeedback) return undefined;
    const pickedId = answers[question.id];
    const correctId = questionFeedback.correct ? pickedId : questionFeedback.correctOptionId;
    if (optionId === correctId) return 'correct';
    return optionId === pickedId ? 'wrong' : undefined;
  };

  const wrong = result?.results.filter(item => !item.correct) ?? [];
  const stored = trainingStatusSignal.value;

  return frame((
    <>
      {step === 0 && (
        <>
          <Box as="header" mb="xl">
            <Steps count={course.sections.length} current={0} />
            <Text as="div" variant="overline" tone="accent" mt="lg" mb="sm">{t('training.introduction')}</Text>
            <Text as="h1" variant="page-title">{course.title}</Text>
          </Box>

          <Box mb="xl"><CourseText>{course.intro}</CourseText></Box>

          <Card as="section" padding="lg" gap="lg" mb="2xl" aria-label={t('training.status.title')}>
            <DescriptionList
              density="compact"
              items={[
                {
                  term: t('training.status.title'),
                  details: completed
                    ? <Badge tone="accent" variant="solid" icon="check">{t('training.status.completed')}</Badge>
                    : <Badge tone="warning" variant="solid">{t('training.status.notCompleted')}</Badge>,
                },
                ...(completed && stored?.completedAt ? [
                  { term: t('training.status.completedOn'), details: new Date(stored.completedAt).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }) },
                  { term: t('training.status.result'), details: t('training.status.resultValue', { score: stored.score, total: stored.questionCount }) },
                ] : []),
                { term: t('training.status.requirement'), details: t('training.status.requirementValue', { required: requiredScore, total: course.questions.length }) },
                { term: t('training.status.scope'), details: t('training.status.scopeValue', { parts: course.sections.length, questions: course.questions.length }) },
              ]}
            />
            {completed && stored && stored.completedVersion !== null && stored.completedVersion < stored.currentVersion && (
              <Alert tone="note" icon="info" title={t('training.newVersionTitle')}>{t('training.newVersionBody')}</Alert>
            )}
            <Stack direction="row" gap="md" wrap>
              <Button variant="primary" onClick={() => openStep(1)}>{t('training.start')}</Button>
              {completed && <Button variant="secondary" onClick={startTest}>{t('training.goToTest')}</Button>}
              {completed && <Button variant="subtle" onClick={download} loading={downloading}>{t('training.menu.certificate')}</Button>}
            </Stack>
          </Card>

          <Text as="h2" variant="overline" block mb="md">{t('training.contents')}</Text>
          <List bordered>
            {course.sections.map((part, index) => (
              <ListItem
                key={part.id}
                leading={<Text variant="body-strong" tone="accent" numeric wrap="pre">{String(index + 1).padStart(2, '\u2007')}</Text>}
                title={part.title}
                trailing={visited.has(index + 1) ? readMark : undefined}
                onClick={() => openStep(index + 1)}
              />
            ))}
            <ListItem
              leading={<Icon name="help" size="sm" color="accent" />}
              title={t('training.testLabel')}
              description={t('training.status.requirementValue', { required: requiredScore, total: course.questions.length })}
              trailing={completed ? readMark : undefined}
              onClick={() => openStep(testStep)}
            />
          </List>
        </>
      )}

      {section && (
        <>
          <Box as="header" mb="xl">
            <Steps count={course.sections.length} current={step} />
            <Text as="div" variant="overline" tone="accent" mt="lg" mb="sm">{t('training.partOf', { n: step, total: course.sections.length })}</Text>
            <Text as="h1" variant="page-title">{section.title}</Text>
          </Box>

          <CourseText>{section.body}</CourseText>

          <Stack direction="row" gap="md" mt="2xl" justify="between">
            <Button variant="secondary" onClick={() => openStep(step - 1)}>{t('training.back')}</Button>
            <Button variant="primary" onClick={() => (step + 1 === testStep ? startTest() : openStep(step + 1))}>
              {step + 1 === testStep ? t('training.goToTest') : t('training.next')}
            </Button>
          </Stack>
        </>
      )}

      {step === testStep && !result && question && (
        <>
          <Box as="header" mb="xl">
            <Steps count={course.questions.length} current={questionIndex + 1} />
            <Text as="div" variant="overline" tone="accent" mt="lg" mb="sm">{t('training.questionOf', { n: questionIndex + 1, total: course.questions.length })}</Text>
            <Text as="h1" variant="page-title" id="training-question">{question.text}</Text>
          </Box>

          <Stack gap="sm" role="radiogroup" aria-labelledby="training-question">
            {question.options.map(option => (
              <ChoiceOption
                key={option.id}
                mode="radio"
                picked={(questionFeedback ? answers[question.id] : picked) === option.id}
                outcome={optionOutcome(option.id)}
                label={option.text}
                disabled={questionFeedback !== undefined || checking}
                onClick={() => setPicked(option.id)}
              />
            ))}
          </Stack>

          {questionFeedback?.correct && (
            <Alert tone="tip" icon="check" title={t('training.correct')} mt="xl">{t('training.correctBody')}</Alert>
          )}
          {questionFeedback && !questionFeedback.correct && (
            <Alert tone="danger" icon="info" title={t('training.wrong')} mt="xl">{questionFeedback.explanation}</Alert>
          )}

          <Stack direction="row" gap="md" mt="2xl" justify="between">
            <span>
              {questionIndex === 0 && !questionFeedback && (
                <Button variant="secondary" onClick={() => openStep(step - 1)}>{t('training.back')}</Button>
              )}
              {questionIndex > 0 && (
                <Button variant="secondary" onClick={() => showQuestion(questionIndex - 1)}>{t('training.previousQuestion')}</Button>
              )}
            </span>
            {!questionFeedback && (
              <Button variant="primary" onClick={answer} disabled={picked === null} loading={checking}>{t('training.answer')}</Button>
            )}
            {questionFeedback && !lastQuestion && (
              <Button variant="primary" onClick={() => showQuestion(questionIndex + 1)}>{t('training.nextQuestion')}</Button>
            )}
            {questionFeedback && lastQuestion && (
              <Button variant="primary" onClick={submit} loading={submitting}>{t('training.seeResult')}</Button>
            )}
          </Stack>
        </>
      )}

      {step === testStep && result && (
        <>
          <Box as="header" mb="xl">
            <Steps count={course.questions.length} current={course.questions.length} />
            <Text as="div" variant="overline" tone="accent" mt="lg" mb="sm">{t('training.resultLabel')}</Text>
            <Text as="h1" variant="page-title">{t(result.passed ? 'training.passedTitle' : 'training.failedTitle')}</Text>
          </Box>
          <Card as="section" padding="lg" gap="md" mb="xl">
            <Stack direction="row" align="center" gap="lg">
              <Text variant="hero" tone={result.passed ? 'success' : 'danger'} numeric>{result.score}/{result.questionCount}</Text>
              <Stack gap="xs">
                <Text as="p" variant="body-strong">{t('training.score', { score: result.score, total: result.questionCount })}</Text>
                {!result.passed && <Text as="p" variant="body" tone="secondary">{t('training.requiredScore', { required: requiredScore })}</Text>}
                {result.passed && stored?.score != null && stored.score !== result.score && (
                  <Text as="p" variant="body" tone="secondary">{t('training.storedKept', { score: stored.score, total: stored.questionCount })}</Text>
                )}
              </Stack>
            </Stack>
          </Card>
          <Stack direction="row" gap="md" wrap mb="2xl">
            {result.passed ? (
              <>
                <Button variant="primary" onClick={close}>{t('training.continue')}</Button>
                <Button variant="secondary" onClick={download} loading={downloading}>{t('training.menu.certificate')}</Button>
                {wrong.length > 0 && <Button variant="subtle" onClick={startTest}>{t('training.retakeTest')}</Button>}
              </>
            ) : (
              <>
                <Button variant="primary" onClick={startTest}>{t('training.retakeTest')}</Button>
                <Button variant="secondary" onClick={readAgain}>{t('training.readAgain')}</Button>
              </>
            )}
          </Stack>

          {wrong.length > 0 && (
            <>
              <Text as="div" variant="overline" mb="md">{t('training.reviewTitle')}</Text>
              <Stack gap="lg">
                {wrong.map(item => {
                  const index = course.questions.findIndex(question => question.id === item.questionId);
                  return (
                    <Card key={item.questionId} as="section" padding="lg" gap="md">
                      <Text as="h2" variant="body-strong">{index + 1}. {course.questions[index]?.text}</Text>
                      <Text as="p" variant="body">
                        <Text variant="body-strong">{t('training.yourAnswer')}</Text>{' '}
                        {optionText(item.questionId, answers[item.questionId])}
                      </Text>
                      <Text as="p" variant="body">
                        <Text variant="body-strong">{t('training.correctAnswer')}</Text>{' '}
                        {optionText(item.questionId, item.correctOptionId)}
                      </Text>
                      <Alert tone="note" icon="info" title={t('training.why')}>{item.explanation}</Alert>
                    </Card>
                  );
                })}
              </Stack>
            </>
          )}
        </>
      )}
    </>
  ));
};

export default TrainingScreen;
