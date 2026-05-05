import { User } from "@/types";
import {
  getUserByEmail,
  addUser,
  getUserById,
  claimOrphanedEstimates,
} from "./db";
import { generateSalt, hashPassword, verifyPassword } from "./crypto";

const SESSION_KEY = "arborist-session-v1";

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function signUp(
  email: string,
  password: string
): Promise<AuthResult> {
  const cleaned = email.toLowerCase().trim();
  if (!isValidEmail(cleaned)) {
    return { ok: false, error: "Enter a valid email" };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }

  const existing = await getUserByEmail(cleaned);
  if (existing) {
    return { ok: false, error: "An account with that email already exists" };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const user: User = {
    id: crypto.randomUUID(),
    email: cleaned,
    passwordHash,
    passwordSalt: salt,
    createdAt: Date.now(),
  };

  await addUser(user);

  // First-ever account claims any pre-existing data in IndexedDB
  await claimOrphanedEstimates(user.id);

  saveSession(user.id);
  return { ok: true, user };
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const cleaned = email.toLowerCase().trim();
  const user = await getUserByEmail(cleaned);
  if (!user) {
    return { ok: false, error: "Email or password incorrect" };
  }
  const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Email or password incorrect" };
  }

  // Edge case: a user existed but data hasn't been claimed because there were
  // no other users when they signed up. Claim now (idempotent).
  await claimOrphanedEstimates(user.id);

  saveSession(user.id);
  return { ok: true, user };
}

export function signOut(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getStoredUserId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

function saveSession(userId: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SESSION_KEY, userId);
  }
}

export async function loadCurrentUser(): Promise<User | null> {
  const id = getStoredUserId();
  if (!id) return null;
  const user = await getUserById(id);
  return user ?? null;
}