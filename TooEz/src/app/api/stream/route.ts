import { bus } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Server-sent events: the dashboard reacts the moment a webhook lands. */
export async function GET() {
  const encoder = new TextEncoder();
  let onAudit: (r: unknown) => void;
  let onRefresh: (r: unknown) => void;
  let ping: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { closed = true; }
      };
      send('hello', { ok: true });
      onAudit = (row) => send('audit', row);
      onRefresh = (p) => send('refresh', p);
      bus.on('audit', onAudit);
      bus.on('refresh', onRefresh);
      ping = setInterval(() => send('ping', { t: Date.now() }), 20000);
    },
    cancel() {
      clearInterval(ping);
      bus.off('audit', onAudit);
      bus.off('refresh', onRefresh);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
