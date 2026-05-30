import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

// TODO: implement /api/analyze route (see apps/api/src/routes/analyze.ts)
app.post("/api/analyze", async (c) => {
  return c.json({ error: "Not implemented yet" }, 501);
});

serve({ fetch: app.fetch, port: 8000 }, () => {
  console.log("API listening on http://localhost:8000");
});
