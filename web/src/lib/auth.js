const TOKEN_KEY = "tooez_auth_token";
const USER_KEY = "tooez_auth_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

// { id, role, email, name } | null
export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
