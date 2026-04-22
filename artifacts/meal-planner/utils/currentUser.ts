/**
 * Module-level current user ID.
 *
 * Set once at app boot (in _layout.tsx) when auth resolves.
 * All data stores call getCurrentUserId() to namespace their AsyncStorage keys.
 *
 * Migration path: when adding server-side sync, replace each store's
 * AsyncStorage calls with API calls, passing the userId for scoping.
 * This module stays as-is — it's just the ID source.
 */

let _currentUserId = "default";

export function setCurrentUserId(uid: string): void {
  _currentUserId = uid;
}

export function getCurrentUserId(): string {
  return _currentUserId;
}
