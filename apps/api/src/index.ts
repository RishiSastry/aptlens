import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { analyzeHandler } from "./routes/analyze.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.post("/api/analyze", analyzeHandler);

serve({ fetch: app.fetch, port: 8000 }, () => {
  console.log("API listening on http://localhost:8000");
});
