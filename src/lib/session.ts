import { SignJWT, jwtVerify } from "jose";
import { config } from "./env";

export const USER_COOKIE = "lw_user";
export const PARTICIPANT_COOKIE_PREFIX = "lw_p_";
export const OAUTH_STATE_COOKIE = "lw_oauth";

export type UserSession = { userId: number; role: string };
export type ParticipantSession = { participantId: number; workshopId: number };

const key = () => new TextEncoder().encode(config.sessionSecret);

export async function signToken(payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
}

export async function verifyToken<T = Record<string, unknown>>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}

export const USER_TTL = 60 * 60 * 24 * 14;
export const PARTICIPANT_TTL = 60 * 60 * 24 * 7;

export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.isProd,
    path: config.basePath,
    maxAge,
  };
}

export async function makeUserCookie(s: UserSession) {
  return { name: USER_COOKIE, value: await signToken({ uid: s.userId, role: s.role }, USER_TTL), options: cookieOptions(USER_TTL) };
}

export async function makeParticipantCookie(s: ParticipantSession) {
  return {
    name: PARTICIPANT_COOKIE_PREFIX + s.workshopId,
    value: await signToken({ pid: s.participantId, wid: s.workshopId }, PARTICIPANT_TTL),
    options: cookieOptions(PARTICIPANT_TTL),
  };
}
