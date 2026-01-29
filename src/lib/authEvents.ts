// src/lib/authEvents.ts
export const AUTH_LOGOUT_EVENT = "auth:logout";

export function emitLogout(reason?: string) {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } }));
}
