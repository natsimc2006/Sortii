/**
 * User-scoped AsyncStorage key factory.
 *
 * Schema: `sortii:u:{userId}:{domain}`
 *
 * userId is always the top-level scope — all user data lives under their ID.
 * When migrating to server-side sync, replace AsyncStorage calls in each store
 * with API requests. The {domain} names map directly to server-side
 * collections/tables. No key redesign required — just lift the data layer.
 */

export function userKey(userId: string, domain: string): string {
  return `sortii:u:${userId}:${domain}`;
}

export const SK = {
  // Meal planning
  plan:           (uid: string) => userKey(uid, "plan"),
  prefs:          (uid: string) => userKey(uid, "prefs"),
  savedPlans:     (uid: string) => userKey(uid, "savedPlans"),
  hiddenRecipes:  (uid: string) => userKey(uid, "hiddenRecipes"),
  onboarded:      (uid: string) => userKey(uid, "onboarded"),
  favorites:      (uid: string) => userKey(uid, "favorites"),

  // Life data
  onboarding:     (uid: string) => userKey(uid, "onboarding"),
  family:         (uid: string) => userKey(uid, "family"),
  bills:          (uid: string) => userKey(uid, "bills"),
  appts:          (uid: string) => userKey(uid, "appts"),
  household:      (uid: string) => userKey(uid, "household"),

  // Money & goals
  snapshotSeen:   (uid: string) => userKey(uid, "snapshotSeen"),
  moneyNudge:     (uid: string) => userKey(uid, "moneyNudge"),

  // Calendar
  calAppleConn:         (uid: string) => userKey(uid, "calAppleConn"),
  calAppleIds:          (uid: string) => userKey(uid, "calAppleIds"),
  calGoogleConn:        (uid: string) => userKey(uid, "calGoogleConn"),
  calGoogleToken:       (uid: string) => userKey(uid, "calGoogleToken"),
  calGoogleRefreshToken:(uid: string) => userKey(uid, "calGoogleRefreshToken"),
  calGoogleIds:         (uid: string) => userKey(uid, "calGoogleIds"),
  calGoogleEmail:       (uid: string) => userKey(uid, "calGoogleEmail"),
  calEvents:            (uid: string) => userKey(uid, "calEvents"),
  calPushed:            (uid: string) => userKey(uid, "calPushed"),

  // UI state (dismissals / nudges)
  welcomeTip:     (uid: string) => userKey(uid, "welcomeTip"),
  crossSellNudge: (uid: string) => userKey(uid, "crossSellNudge"),
  juggle:         (uid: string) => userKey(uid, "juggle"),
  nudgeDate:      (uid: string) => userKey(uid, "nudgeDate"),
  lastOpened:     (uid: string) => userKey(uid, "lastOpened"),
};
