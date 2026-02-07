// Simple event emitter to replace window.dispatchEvent/addEventListener
type Listener = () => void;

class SimpleEventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach((listener) => listener());
  }
}

export const EventEmitter = new SimpleEventEmitter();
