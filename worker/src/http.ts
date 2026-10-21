export const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export const errorJson = (status: number, error: string, headers: HeadersInit = {}) =>
  json(status, { error }, headers);
