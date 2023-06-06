import { microtask } from "./microtask";

type EventTypes = Record<string, any[]>;

export class EventEmitter<E extends EventTypes = Record<string, any[]>> {
  private listeners: Map<keyof E, ((...args: any[]) => any)[]> = new Map();

  emit<EvKey extends keyof E>(event: EvKey, ...args: E[EvKey]) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.forEach((listener) =>
      microtask(() => {
        listener(...args);
      })
    );
  }

  on<EvKey extends keyof E>(
    event: EvKey,
    listener: (...args: E[EvKey]) => void
  ) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  off<EvKey extends keyof E>(
    event: EvKey,
    listener: (...args: E[EvKey]) => void
  ) {
    const listeners = this.listeners.get(event) ?? [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }
}
