import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { Pool } from "pg";

const globalForAuth = globalThis as typeof globalThis & {
  prexetAuthPool?: Pool;
};

const authPool = globalForAuth.prexetAuthPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: false },
});

if (process.env.NODE_ENV !== "production") globalForAuth.prexetAuthPool = authPool;

export const auth = betterAuth({
  appName: "Prexet",
  baseURL: process.env.BETTER_AUTH_URL,
  database: authPool,
  trustedOrigins: [
    "https://prexet.com",
    "https://www.prexet.com",
    "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "prexet_users",
  },
  session: {
    modelName: "prexet_sessions",
  },
  account: {
    modelName: "prexet_accounts",
  },
  verification: {
    modelName: "prexet_verifications",
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    dash({
      apiKey: process.env.BETTER_AUTH_API_KEY,
    }),
  ],
});
