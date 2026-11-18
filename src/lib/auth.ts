import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber, twoFactor } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { db } from "./db";
import { can, isStaffRole, type Permission } from "./permissions";
import { queueAuthMessage } from "./notify";
import { smsNumber } from "./phone";
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      await queueAuthMessage({
        template: "AUTH_RESET_PASSWORD",
        channel: "EMAIL",
        recipient: user.email,
        subject: "Reset your ANLIMA password",
        body: `Hello ${user.name.split(" ")[0]},

Use this link within one hour to choose a new password:
${url}

If you did not ask to reset your password, ignore this email; your password will not change.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 86400,
    async sendVerificationEmail({ user, url }) {
      await queueAuthMessage({
        template: "AUTH_VERIFY_EMAIL",
        channel: "EMAIL",
        recipient: user.email,
        subject: "Confirm your email for ANLIMA Car Rental",
        body: `Hello ${user.name.split(" ")[0]},

Confirm this email address to finish setting up your ANLIMA account:
${url}

The link works for 24 hours. If you did not create an account, ignore this email.`,
      });
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? {
          facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          },
        }
      : {}),
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "CUSTOMER", input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Social sign-in cannot carry a second factor, so staff accounts must
        // use email, password and their authenticator app.
        async before(session, context) {
          if (!context?.path?.startsWith("/callback")) return;
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { role: true },
          });
          if (isStaffRole(user?.role))
            throw new APIError("FORBIDDEN", {
              message:
                "Staff accounts sign in with email, password and an authenticator code.",
            });
        },
      },
    },
  },
  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      // Numbers are stored in the international form texts are sent to.
      phoneNumberValidator: (phone) => smsNumber(phone) === phone,
      async sendOTP({ phoneNumber: phone, code }) {
        await queueAuthMessage({
          template: "AUTH_PHONE_CODE",
          channel: "SMS",
          recipient: phone,
          body: `ANLIMA: your verification code is ${code}. It expires in 5 minutes. Never share this code.`,
        });
      },
      async sendPasswordResetOTP({ phoneNumber: phone, code }) {
        await queueAuthMessage({
          template: "AUTH_PHONE_RESET_CODE",
          channel: "SMS",
          recipient: phone,
          body: `ANLIMA: your password reset code is ${code}. It expires in 5 minutes. If you did not ask for it, ignore this message.`,
        });
      },
    }),
    twoFactor({
      issuer: "ANLIMA Car Rental",
      accountLockout: { maxFailedAttempts: 5, durationSeconds: 900 },
    }),
    nextCookies(),
  ],
});
export async function session() {
  return auth.api.getSession({ headers: await headers() });
}
export async function requireStaff(permission?: Permission) {
  const current = await session();
  if (
    !current ||
    !isStaffRole(current.user.role) ||
    !current.user.twoFactorEnabled ||
    (permission && !can(current.user.role, permission))
  )
    throw new Error("Staff access required");
  return current;
}
