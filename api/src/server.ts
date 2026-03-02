import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin === "*" ? true : config.frontendOrigin,
    credentials: true
  })
);
app.use(express.json());

registerRoutes(app);

app.use((_, res) => {
  res.status(404).json({ message: "Not found", status: 404 });
});

app.listen(config.port, () => {
  console.log(`[nimblerate-api] listening on http://localhost:${config.port}`);
});
