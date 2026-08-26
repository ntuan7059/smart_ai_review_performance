import crypto from "node:crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function adminEmail() {
  return process.env.ADMIN_EMAIL || "admin-ai-review@dssolution.jp";
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "123456";
}

function sessionSecret() {
  // Falls back to a fixed dev value so tokens survive a restart in local/dev use;
  // set ADMIN_SESSION_SECRET in any shared/production deployment.
  return process.env.ADMIN_SESSION_SECRET || "dev-admin-session-secret";
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length so the failure path takes constant time.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(email, password) {
  if (!email || !password) return false;
  return timingSafeStringEqual(email, adminEmail()) && timingSafeStringEqual(password, adminPassword());
}

function sign(payload) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createToken(email) {
  const payload = JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS });
  const encodedPayload = Buffer.from(payload, "utf-8").toString("base64url");
  const signature = sign(encodedPayload);
  return { token: `${encodedPayload}.${signature}`, expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString() };
}

export function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!timingSafeStringEqual(signature, sign(encodedPayload))) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return { email: payload.email };
}

export function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const session = verifyToken(token);
  if (!session) return res.status(401).json({ error: { message: "Unauthorized" } });
  req.admin = session;
  next();
}
