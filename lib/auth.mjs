// SuperAdmin sessions live in the server process. Restarting revokes all sessions.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { loadSync, saveNow } from "./store.mjs";
import { MIN_PASSWORD_LENGTH } from "./constants.mjs";

export const SESSION_COOKIE = "sw_admin";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const MAX_SESSIONS = 128;

const state = (globalThis.__SW_ADMIN ??= {
  passwordHash: "",
  salt: "",
  secret: "",
  createdAt: 0,
  ...loadSync("admin", {}),
});
const sessions = (globalThis.__SW_ADMIN_SESSIONS ??= new Map());
let passwordChange;

export function isSetupComplete() {
  return Boolean(state.passwordHash && state.salt && state.secret);
}

function validPassword(password) {
  return typeof password === "string" && Buffer.byteLength(password) <= 1024;
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

export async function setAdminPassword(password) {
  if (!validPassword(password) || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters and at most 1024 bytes.`);
  }
  if (passwordChange) throw new Error("A password change is already in progress.");
  const salt = randomBytes(16).toString("hex");
  const next = {
    salt,
    passwordHash: hashPassword(password, salt),
    secret: randomBytes(32).toString("hex"),
    createdAt: state.createdAt || Date.now(),
  };
  passwordChange = saveNow("admin", next);
  try {
    await passwordChange;
    Object.assign(state, next);
    for (const key of sessions.keys()) invalidateSession(key);
  } finally {
    passwordChange = undefined;
  }
}

export function verifyPassword(password) {
  if (!isSetupComplete() || !validPassword(password) || !password) return false;
  const given = Buffer.from(hashPassword(password, state.salt), "hex");
  const known = Buffer.from(state.passwordHash, "hex");
  return given.length === known.length && timingSafeEqual(given, known);
}

function sessionKey(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}

function invalidateSession(key) {
  const session = sessions.get(key);
  if (!session) return;
  sessions.delete(key);
  clearTimeout(session.timer);
  for (const listener of session.listeners) listener();
}

export function revokeSession(token) {
  const key = sessionKey(token);
  if (key) invalidateSession(key);
}

export function createSession(previousToken) {
  revokeSession(previousToken);
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) invalidateSession(key);
  }
  while (sessions.size >= MAX_SESSIONS) invalidateSession(sessions.keys().next().value);
  const token = randomBytes(32).toString("base64url");
  const key = sessionKey(token);
  const ttl = SESSION_MAX_AGE_SECONDS * 1000;
  const timer = setTimeout(() => invalidateSession(key), ttl);
  timer.unref();
  sessions.set(key, { expiresAt: now + ttl, timer, listeners: new Set() });
  return token;
}

export function verifySession(token) {
  const key = sessionKey(token);
  if (!key) return false;
  const session = sessions.get(key);
  if (!session) return false;
  if (session.expiresAt > Date.now()) return true;
  invalidateSession(key);
  return false;
}

export function onSessionRevoked(token, listener) {
  if (!verifySession(token)) return () => {};
  const listeners = sessions.get(sessionKey(token)).listeners;
  listeners.add(listener);
  return () => listeners.delete(listener);
}
