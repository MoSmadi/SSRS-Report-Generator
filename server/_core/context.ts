import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "@shared/dbTypes";
import { sdk } from "./sdk";
import { ENV } from "./env";

// Mock user for development when OAuth is not configured
const MOCK_DEV_USER: User = {
  id: 1,
  openId: "dev-user",
  name: "Dev User",
  email: "dev@example.com",
  role: "admin",
  loginMethod: "dev",
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // In development mode without OAuth configured, use mock user
    if (!ENV.isProduction && !ENV.oAuthServerUrl) {
      user = MOCK_DEV_USER;
    } else {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
