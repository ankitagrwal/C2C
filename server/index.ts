import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users } from "../shared/schema";

const app = express();

// Enable trust proxy for TLS-terminated proxies
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session management setup with standard pg pool
const { Pool } = pg;
const sessionPool = new Pool({ connectionString: process.env.DATABASE_URL });
const PgSession = ConnectPgSimple(session);
app.use(session({
  name: 'clause2case-session', // Explicit session cookie name
  store: new PgSession({
    pool: sessionPool, // Use standard pg pool for session storage
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: (() => {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.error('CRITICAL: SESSION_SECRET environment variable is required for security');
      process.exit(1);
    }
    return secret;
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production, HTTP allowed in development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // CSRF protection
    path: '/', // Explicit path to ensure cookie is sent with all requests
  },
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Ensure admin user exists on startup
async function ensureAdminUser() {
  try {
    console.log('🔐 Ensuring admin user exists...');
    
    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
    
    if (existingAdmin.length === 0) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123!', 10);
      
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      
      console.log('✅ Admin user created successfully');
      console.log('   Username: admin');
      console.log('   Password: admin123!');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error ensuring admin user:', error);
  }
}

(async () => {
  // Ensure admin user exists before starting server
  await ensureAdminUser();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
