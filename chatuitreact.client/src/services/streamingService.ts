class StreamingService {
  private streams = new Map<string, string>();
  private activeStreams = new Set<string>();
  private listeners = new Map<string, Set<() => void>>();

  hasStream(messageId: string): boolean {
    return this.activeStreams.has(messageId);
  }

  startStream(messageId: string): void {
    this.activeStreams.add(messageId);
    this.streams.set(messageId, "");
  }

  addChunk(messageId: string, chunk: string): void {
    if (!this.activeStreams.has(messageId)) return;
    
    const current = this.streams.get(messageId) || "";
    this.streams.set(messageId, current + chunk);
    this.notifyListeners(messageId);
  }

  getContent(messageId: string): string {
    return this.streams.get(messageId) || "";
  }

  subscribe(messageId: string, listener: () => void): () => void {
    if (!this.listeners.has(messageId)) {
      this.listeners.set(messageId, new Set());
    }
    this.listeners.get(messageId)!.add(listener);
    
    return () => this.unsubscribe(messageId, listener);
  }

  private unsubscribe(messageId: string, listener: () => void): void {
    const messageListeners = this.listeners.get(messageId);
    if (messageListeners) {
      messageListeners.delete(listener);
      if (messageListeners.size === 0) {
        this.listeners.delete(messageId);
      }
    }
  }

  private notifyListeners(messageId: string): void {
    const messageListeners = this.listeners.get(messageId);
    if (messageListeners) {
      messageListeners.forEach(listener => listener());
    }
  }

  cleanup(messageId: string): void {
    this.activeStreams.delete(messageId);
    this.streams.delete(messageId);
    this.listeners.delete(messageId);
  }

  getAllActiveStreams(): string[] {
    return Array.from(this.activeStreams);
  }
}

export const streamingService = new StreamingService();
