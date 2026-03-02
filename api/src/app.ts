import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.frontendOrigin === "*" ? true : config.frontendOrigin,
      credentials: true
    })
  );

  app.use(express.json());

  if (config.rateLimitEnabled) {
    app.use(
      "/api",
      rateLimit({
        windowMs: config.rateLimitWindowMs,
        max: config.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === "/health"
      })
    );
  }

  registerRoutes(app);

  app.use((_, res) => {
    res.status(404).json({ message: "Not found", status: 404 });
  });

  return app;
}
