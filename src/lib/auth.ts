import { betterAuth } from "better-auth";
import { memoryAdapter } from "@better-auth/memory-adapter";

export const auth = betterAuth({
  database: memoryAdapter({}),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
  rateLimit: {
    window: 60,
    max: 10,
  },
});
