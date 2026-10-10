/** Resolves when the browser is idle, so background work does not compete with startup. */
export function whenIdle(): Promise<void> {
    return new Promise(resolve => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => resolve());
        } else {
            setTimeout(resolve, 1);
        }
    });
}
