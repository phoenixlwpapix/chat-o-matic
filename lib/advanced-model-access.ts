import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "chat-advanced-model";
const COOKIE_PATH = "/api/chat";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])[A-Za-z0-9]{8}$/;

function getCredentials() {
  const password = process.env.ADVANCED_MODEL_PASSWORD;
  const signingKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!password || !PASSWORD_PATTERN.test(password) || !signingKey) return;
  return { password, signingKey };
}

function signExpiry(expires: number, { password, signingKey }: NonNullable<ReturnType<typeof getCredentials>>) {
  return createHmac("sha256", signingKey)
    .update(`chat-advanced-model:${password}:${expires}`)
    .digest("base64url");
}

export async function getAdvancedModelAccess() {
  const credentials = getCredentials();
  if (!credentials) return { available: false, enabled: false };

  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  const match = cookie?.match(/^(\d{10})\.([\w-]{43})$/);
  if (!match) return { available: true, enabled: false };

  const [, expiry, signature] = match;
  const expires = Number(expiry);
  const enabled = expires > Math.floor(Date.now() / 1000)
    && timingSafeEqual(Buffer.from(signature), Buffer.from(signExpiry(expires, credentials)));
  return { available: true, enabled };
}

export async function enableAdvancedModel(password: unknown, secure: boolean) {
  const credentials = getCredentials();
  if (!credentials) return "unavailable";
  if (
    typeof password !== "string" || !PASSWORD_PATTERN.test(password)
    || !timingSafeEqual(Buffer.from(password), Buffer.from(credentials.password))
  ) return "invalid";

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${expires}.${signExpiry(expires, credentials)}`, cookieOptions(secure, SESSION_SECONDS));
  return "enabled";
}

export async function disableAdvancedModel(secure: boolean) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", cookieOptions(secure, 0));
}

function cookieOptions(secure: boolean, maxAge: number) {
  return { httpOnly: true, sameSite: "strict", secure, maxAge, path: COOKIE_PATH } as const;
}
