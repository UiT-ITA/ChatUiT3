import { signal } from "@preact/signals-react";
import apiService from "./apiService";

/** The user's stored result of the mandatory training, and the current course it is compared to. */
export interface TrainingStatus {
    completed: boolean;
    completedAt: string | null;
    score: number | null;
    questionCount: number | null;
    completedVersion: number | null;
    currentVersion: number;
    currentQuestionCount: number;
    passPercent: number;
}

export interface TrainingSection {
    id: string;
    title: string;
    /** Markdown. */
    body: string;
}

export interface TrainingOption {
    id: string;
    text: string;
}

export interface TrainingQuestion {
    id: string;
    text: string;
    options: TrainingOption[];
}

export interface TrainingCourse {
    version: number;
    title: string;
    intro: string;
    passPercent: number;
    sections: TrainingSection[];
    questions: TrainingQuestion[];
}

/** One graded question. The correct option and the explanation are set on a wrong answer only. */
export interface TrainingQuestionResult {
    questionId: string;
    correct: boolean;
    correctOptionId: string | null;
    explanation: string | null;
}

export interface TrainingSubmitResult {
    passed: boolean;
    score: number;
    questionCount: number;
    results: TrainingQuestionResult[];
    status: TrainingStatus;
}

const TRAINING_ENDPOINT = "/api/users/me/training";
const CERTIFICATE_FILE_NAME = "uit-ai-training-certificate.pdf";
const OBJECT_URL_LIFETIME_MS = 60_000;

/** Undefined until the status has loaded. */
export const trainingStatusSignal = signal<TrainingStatus | undefined>(undefined);

/** True while the training screen is shown over the app. */
export const trainingOpenSignal = signal(false);

export async function loadTrainingStatus(): Promise<void> {
    trainingStatusSignal.value = await apiService<TrainingStatus>(TRAINING_ENDPOINT);
}

export function fetchTrainingCourse(language: string): Promise<TrainingCourse> {
    return apiService<TrainingCourse>(`${TRAINING_ENDPOINT}/course?language=${encodeURIComponent(language)}`);
}

/** Grades one answer. A wrong answer comes back with the correct option and its explanation. */
export function checkTrainingAnswer(version: number, questionId: string, optionId: string, language: string): Promise<TrainingQuestionResult> {
    return apiService.post<TrainingQuestionResult>(`${TRAINING_ENDPOINT}/answer`, { version, questionId, optionId, language });
}

/** Sends the answers (question id to option id) for grading, and keeps the training screen open on a pass. */
export async function submitTraining(version: number, answers: Record<string, string>, language: string): Promise<TrainingSubmitResult> {
    const result = await apiService.post<TrainingSubmitResult>(`${TRAINING_ENDPOINT}/submit`, { version, answers, language });
    if (result.passed) {
        trainingOpenSignal.value = true;
    }
    trainingStatusSignal.value = result.status;
    return result;
}

/** Downloads the certificate of the stored result as a PDF file. */
export async function downloadTrainingCertificate(language: string): Promise<void> {
    const blob = await apiService.getBlob(`${TRAINING_ENDPOINT}/certificate?language=${encodeURIComponent(language)}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = CERTIFICATE_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
}
