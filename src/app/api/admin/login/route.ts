import { AppError } from "@/application/errors";
import { loginRequest } from "@/contracts/requests";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, checkPassword } from "@/server/auth";
import { json, parseBody, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const POST = route(async (req) => {
  enforceRateLimit(req, "login", 5);
  const { password } = await parseBody(req, loginRequest);
  const token = checkPassword(password);
  if (!token) throw new AppError("unauthorised", "Incorrect password");
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return res;
});
