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

function sanitizeErrorMessage(raw: string, status: number): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<') || /<\s*html/i.test(trimmed) || /<!doctype/i.test(trimmed)) {
    if (status === 404) return 'Service de diffusion temporairement indisponible (Erreur 404).';
    if (status === 502 || status === 503 || status === 504) {
      return 'Serveur temporairement indisponible. Reconnexion en cours...';
    }
    return `Erreur de communication avec le serveur (HTTP ${status}).`;
  }
  return trimmed.slice(0, 300);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null; churchId?: number | null } = {}
): Promise<T> {
  const { token, churchId, headers, ...rest } = options;
  const authToken = token !== undefined ? token : inMemoryAuthToken;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
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

  const text = await response.text();
  let data: unknown = null;
  let isJson = false;
  if (text) {
    try {
      data = JSON.parse(text);
      isJson = true;
    } catch {
      data = null;
      isJson = false;
    }
  }

  if (!response.ok) {
    let errMsg = `Erreur serveur (${response.status})`;
    if (isJson && typeof data === 'object' && data !== null && 'error' in data) {
      const rawErr = (data as { error: unknown }).error;
      errMsg = typeof rawErr === 'string' ? sanitizeErrorMessage(rawErr, response.status) : String(rawErr);
    } else if (text) {
      errMsg = sanitizeErrorMessage(text, response.status);
    }
    throw new ApiError(errMsg, response.status);
  }

  if (!isJson && text && (text.trim().startsWith('<') || /<\s*html/i.test(text))) {
    throw new ApiError('Format de données inattendu (reçu HTML au lieu de JSON).', 500);
  }

  return (data ?? {}) as T;
}

