const COUNTER_KEY = 'visitor-counter';
const COUNTER_NAME = 'global';

export type CounterState = {
  totalReach: number;
  updatedAt: string;
};

export type ReachPayload = {
  totalReach: number;
  updatedAt: string;
};

type DurableObjectStorageLike = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

type DurableObjectStateLike = {
  storage: DurableObjectStorageLike;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
};

type CounterDependencies = {
  now: () => number;
};

type DurableObjectStubLike = {
  fetch(request: Request): Promise<Response>;
};

type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
};

type WorkerEnvironment = {
  VISITOR_COUNTER?: DurableObjectNamespaceLike;
};

type WorkerContext = {
  waitUntil(promise: Promise<unknown>): void;
};

export function recordVisit(state: CounterState | undefined, timestamp: number): CounterState {
  return {
    totalReach: (state?.totalReach ?? 0) + 1,
    updatedAt: new Date(timestamp).toISOString(),
  };
}

export function buildReachSnapshot(
  state: CounterState | undefined,
  timestamp: number,
): ReachPayload {
  return {
    totalReach: state?.totalReach ?? 0,
    updatedAt: state?.updatedAt ?? new Date(timestamp).toISOString(),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

export class VisitorCounter {
  private counter: CounterState | undefined;
  private readonly ready: Promise<void>;
  private writeQueue: Promise<unknown> = Promise.resolve();
  private readonly now: () => number;

  constructor(
    private readonly state: DurableObjectStateLike,
    dependencies: Partial<CounterDependencies> = {},
  ) {
    this.now = dependencies.now ?? Date.now;
    this.ready = state.blockConcurrencyWhile(async () => {
      this.counter = await state.storage.get<CounterState>(COUNTER_KEY);
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (request.method === 'GET') {
      await this.writeQueue;
      return jsonResponse(buildReachSnapshot(this.counter, this.now()));
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const update = this.writeQueue.then(async () => {
      const next = recordVisit(this.counter, this.now());
      await this.state.storage.put(COUNTER_KEY, next);
      this.counter = next;
      return buildReachSnapshot(next, this.now());
    });
    this.writeQueue = update.then(() => undefined, () => undefined);

    try {
      return jsonResponse(await update);
    } catch (error) {
      console.error('Unable to persist the visitor count:', error);
      return jsonResponse({ error: 'Visitor counter is unavailable' }, 503);
    }
  }
}

export async function handleReachRequest(
  request: Request,
  environment: WorkerEnvironment,
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
    },
  });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!environment.VISITOR_COUNTER) {
    return jsonResponse({ error: 'Visitor counter is not configured' }, 503);
  }

  try {
    const namespace = environment.VISITOR_COUNTER;
    const id = namespace.idFromName(COUNTER_NAME);
    const response = await namespace.get(id).fetch(new Request('https://counter.internal/', {
      method: request.method,
      headers: { Accept: 'application/json' },
    }));
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error('Unable to read the visitor counter:', error);
    return jsonResponse({ error: 'Visitor counter is unavailable' }, 502);
  }
}

export default {
  fetch(request: Request, environment: WorkerEnvironment, _context: WorkerContext): Promise<Response> {
    return handleReachRequest(request, environment);
  },
};
