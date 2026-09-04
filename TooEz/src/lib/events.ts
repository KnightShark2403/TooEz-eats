import { EventEmitter } from 'node:events';

/**
 * In-process pub/sub used to push dashboard updates over SSE the instant a
 * webhook or an agent action lands. Single-node only — for multi-instance
 * deployment swap this for Redis pub/sub behind the same interface.
 */
class Bus extends EventEmitter {}

const g = globalThis as unknown as { __tooez_bus?: Bus };
export const bus: Bus = g.__tooez_bus ?? (g.__tooez_bus = new Bus());
bus.setMaxListeners(200);

export type StreamEvent =
  | { type: 'audit'; payload: unknown }
  | { type: 'refresh'; payload: { reason: string } };

export function publishRefresh(reason: string) {
  bus.emit('refresh', { reason });
}
