import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(50),
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_.]+$/i, "Only letters, numbers, underscore, dot"),
});

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
