import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  32,
);

export const TOKEN_RE = /^[0-9A-Za-z]{32}$/;

export function newToken(): string {
  return nanoid();
}

export function parseToken(raw: string | undefined): string | null {
  if (!raw || !TOKEN_RE.test(raw)) return null;
  return raw;
}
