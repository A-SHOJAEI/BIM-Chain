/**
 * WebSocket service for real-time event broadcasting.
 * Pushes audit trail updates, governance status changes, and
 * IP attribution events to connected frontend clients.
 */

export interface WebSocketEvent {
  type: 'audit' | 'governance' | 'ip';
  action: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface IWebSocketService {
  /** Broadcast an event to all connected clients. */
  broadcast(event: WebSocketEvent): void;

  /** Get the count of currently connected clients. */
  getConnectionCount(): number;
}

/**
 * In-memory mock implementation for development and testing.
 */
export class MockWebSocketService implements IWebSocketService {
  private events: WebSocketEvent[] = [];

  broadcast(event: WebSocketEvent): void {
    this.events.push(event);
  }

  getConnectionCount(): number {
    return 0;
  }

  /** Test helper: retrieve all broadcast events. */
  getEvents(): WebSocketEvent[] {
    return [...this.events];
  }

  /** Test helper: clear recorded events. */
  clearEvents(): void {
    this.events = [];
  }
}
