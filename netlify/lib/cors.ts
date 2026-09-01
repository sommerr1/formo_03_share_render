const BASE_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function corsOrigin(): string {
  return process.env.ALLOWED_ORIGIN?.trim() || "*";
}

export function withCors(
  init: ResponseInit = {},
  extra: Record<string, string> = {},
): ResponseInit {
  return {
    ...init,
    headers: {
      ...BASE_HEADERS,
      "Access-Control-Allow-Origin": corsOrigin(),
      ...Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([k, v]) => [k, String(v)]),
      ),
      ...extra,
    },
  };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), withCors({ status }, { "Content-Type": "application/json" }));
}

export function options(): Response {
  return new Response(null, withCors({ status: 204 }));
}
