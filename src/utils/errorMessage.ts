// Texto de um erro capturado em `catch (e)`, que o TypeScript tipa como unknown.
export function errorMessage(e: unknown, fallback = ''): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string') return e || fallback;
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message || fallback;
  return fallback;
}
