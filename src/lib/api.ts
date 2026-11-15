// In-memory token store (never stored in localStorage)
let inMemoryAuthToken: string | null = null;

export function setMemoryAuthToken(token: string | null) {
  inMemoryAuthToken = token;
}

export function getMemoryAuthToken(): string | null {
  return inMemoryAuthToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null; churchId?: number | null } = {}
): Promise<T> {
  const { token, churchId, headers, ...rest } = options;
  const authToken = token !== undefined ? token : inMemoryAuthToken;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (authToken) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }
  if (churchId) {
    finalHeaders['X-Church-Id'] = String(churchId);
  }

  const response = await fetch(path, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();
  const trimmed = text.trimStart();

  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<') ||
    (contentType && !contentType.includes('json') && text.length > 0 && !response.ok)
  ) {
    throw new ApiError(
      'Réponse serveur invalide (HTML reçu au lieu de JSON). Vérifiez que le backend API est actif.',
      response.status || 502
    );
  }

  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(`Réponse JSON invalide du serveur (${response.status}).`, response.status || 502);
    }
  }

  if (!response.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Erreur serveur (${response.status})`;
    throw new ApiError(errMsg, response.status);
  }

  return data as T;
}
