import { defineConfig } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import gameHandler from "./netlify/functions/game.ts";

export default defineConfig({
  plugins: [
    {
      name: "netlify-function-dev-middleware",
      configureServer(server) {
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url && req.url.startsWith("/.netlify/functions/game")) {
            try {
              const host = req.headers.host || "localhost:5173";
              const fullUrl = new URL(req.url, `http://${host}`);

              let body: string | undefined = undefined;
              if (req.method === "POST" || req.method === "PUT") {
                const chunks: Buffer[] = [];
                for await (const chunk of req as AsyncIterable<Buffer>) {
                  chunks.push(chunk);
                }
                body = Buffer.concat(chunks).toString("utf-8");
              }

              const headersRecord: Record<string, string> = {};
              for (const [key, val] of Object.entries(req.headers)) {
                if (typeof val === "string") {
                  headersRecord[key] = val;
                } else if (Array.isArray(val)) {
                  headersRecord[key] = val.join(", ");
                }
              }

              const webReq = new Request(fullUrl.toString(), {
                method: req.method,
                headers: headersRecord,
                body: (req.method === "POST" || req.method === "PUT") ? body : undefined
              });

              const response = await gameHandler(webReq, {} as any);
              res.statusCode = response.status;
              response.headers.forEach((val, key) => {
                res.setHeader(key, val);
              });
              const resBody = await response.text();
              res.end(resBody);
              return;
            } catch (err: any) {
              console.error("Vite netlify dev function error:", err);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err.message || "Internal server error" }));
              return;
            }
          }
          next();
        });
      }
    }
  ]
});
