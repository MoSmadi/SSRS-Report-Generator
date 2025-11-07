import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "<empty>";
  }

  try {
    const json = JSON.stringify(payload);
    if (!json) return "<empty>";
    return json.length > 1024 ? `${json.slice(0, 1024)}… (truncated)` : json;
  } catch {
    return "<unserializable>";
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use((req, res, next) => {
    const start = Date.now();
    const preview = summarizePayload(req.body);

    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} -> body: ${preview}`
    );

    res.on("finish", () => {
      const duration = Date.now() - start;
      const contentLength = res.get("content-length");
      console.log(
        `[HTTP] ${req.method} ${req.originalUrl} <- ${res.statusCode} ${
          contentLength ? `${contentLength}b` : ""
        } (${duration}ms)`
      );
    });

    next();
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
