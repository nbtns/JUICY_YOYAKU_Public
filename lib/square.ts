type SquareEnv = { SQUARE_WEBHOOK_SIGNATURE_KEY?: string; SQUARE_WEBHOOK_URL?: string };

export async function verifySquareSignature(request: Request, rawBody: string, runtime: SquareEnv) {
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  if (!runtime.SQUARE_WEBHOOK_SIGNATURE_KEY || !runtime.SQUARE_WEBHOOK_URL || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(runtime.SQUARE_WEBHOOK_SIGNATURE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${runtime.SQUARE_WEBHOOK_URL}${rawBody}`));
  const expected = toBase64(new Uint8Array(bytes));
  return constantTimeEqual(expected, signature);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
