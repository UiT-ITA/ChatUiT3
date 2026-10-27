/** Serializes form values with arrays of strings sorted, so they compare as sets. */
function comparableJson(values: unknown): string {
    return JSON.stringify(values, (_key, value: unknown) =>
        Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value].sort() : value);
}

/** Whether a form's current values differ from its saved values. */
export function hasChanges(current: unknown, saved: unknown): boolean {
    return comparableJson(current) !== comparableJson(saved);
}
