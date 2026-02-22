/**
 * WebSocket client for real-time updates from the BIM-Chain middleware.
 * Connects to the middleware WebSocket endpoint and dispatches events.
 */

export type EventType = 'audit' | 'governance' | 'ip';

export interface BimChainEvent {
  type: EventType;
  action: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type EventHandler = (event: BimChainEvent) => void;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<EventType, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private _lastEventTime: string | null = null;
  private reconnectDelay = 3000;

  get connected(): boolean {
    return this._connected;
  }

  get lastEventTime(): string | null {
    return this._lastEventTime;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this._connected = true;
        this.reconnectDelay = 3000;
      };

      this.ws.onmessage = (msg) => {
        try {
          const event: BimChainEvent = JSON.parse(msg.data);
          this._lastEventTime = event.timestamp || new Date().toISOString();
          const typeHandlers = this.handlers.get(event.type);
          if (typeHandlers) {
            typeHandlers.forEach((handler) => handler(event));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this._connected = false;
      };
    } catch {
      this._connected = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this.connect();
    }, this.reconnectDelay);
  }
}

/** Singleton instance for app-wide use. */
let instance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!instance) {
    instance = new WebSocketClient();
  }
  return instance;
}
