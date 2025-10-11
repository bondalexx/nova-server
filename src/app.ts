import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import roomsRoutes from "./routes/rooms.routes";
import messagesRoutes from "./routes/messages.routes";
import friendsRoutes from "./routes/friends.routes";
import usersRoutes from "./routes/users.routes";
import { PrismaClient } from "@prisma/client";

const app = express();

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(express.json());
app.use(cookieParser());

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

app.use("/auth", authRoutes);

app.use("/rooms", roomsRoutes);
app.use("/", friendsRoutes);
app.use("/", usersRoutes);
app.use("/messages", messagesRoutes);

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// Simple error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

export default app;
