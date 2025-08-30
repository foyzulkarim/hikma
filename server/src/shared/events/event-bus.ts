export interface EventBus {
  emit<T>(event: string, data: T): void;
  on<T>(event: string, handler: (data: T) => void): void;
  off(event: string, handler: Function): void;
}

class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Function[]>();

  emit<T>(event: string, data: T): void {
    const eventHandlers = this.handlers.get(event) || [];
    eventHandlers.forEach(handler => handler(data));
  }

  on<T>(event: string, handler: (data: T) => void): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  off(event: string, handler: Function): void {
    const handlers = this.handlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.handlers.set(event, handlers);
    }
  }
}

export const eventBus = new InMemoryEventBus();
