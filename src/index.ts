import express from "express";

import { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";

import { ValidationError, NotFoundError } from "./errors.js";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const app = express();
const PORT = 8080;

// registering JSON middleware
app.use(express.json());

// --- defining middleware ---
const middlewareLogResponses = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  //.on('finish') waits until the response is fully sent to the user
  res.on("finish", () => {
    //check if status is "Non-OK" (400 or higher)
    if (res.statusCode >= 400) {
      console.log(
        `[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`,
      );
    }
  });
  // call next()
  next();
};

//register the middleware
app.use(middlewareLogResponses);

// metrics middleware, this function runs before fileserver handles the Request
const middlewareMetricsInc = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  apiConfig.fileserverHits++;
  next();
};

// error hanlder middleware
const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: "Not Found" });
  } else {
    console.log(err); // log it for the developer
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- custom handlers ---
// --- metrics handler (GET /metrics) ---
const handlerMetrics = (req: Request, res: Response) => {
  res.status(200);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>CHirpy has been visited ${apiConfig.fileserverHits} times! </p>
      </body>
    </html>
  `);
};

// --- reset metrics handler (GET /reset) ---
const handlerReset = (req: Request, res: Response) => {
  apiConfig.fileserverHits = 0;
  res
    .status(200)
    .set("Content-Type", "text/plain; charset=utf-8")
    .send("Reser OK");
};

const handlerReadiness = (req: Request, res: Response) => {
  res.status(200).set("Content-Type", "text/plain; charset=utf-8").send("OK"); // send the body text
};

// --- validate chirp handler ---
const handlerValidateChirp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const chirp = req.body;
    if (chirp.body && chirp.body.length > 140) {
      throw new ValidationError("chirp is too long, max length is 140"); // throw new error
    }

    const badWords = ["kerfuffle", "sharbert", "formax"];
    const words = chirp.body.split(" ");
    const cleanedWords = words.map((word: string) => {
      const lowerCaseWord = word.toLowerCase();
      if (badWords.includes(lowerCaseWord)) {
        return "****";
      }
      return word;
    });
    const cleanedBody = cleanedWords.join(" ");
    res.status(200).json({ cleanedBody: cleanedBody });
  } catch (err) {
    next(err); // pass the error to global error handler
  }
};

// --- register routes ---
// apply the increment middleware to the /app path FIRST
// the website (remains at /app)
app.use("/app", middlewareMetricsInc);
app.use("/app", express.static("./src/app"));

// the API (moved to /api namespace)
app.get("/api/healthz", handlerReadiness);
app.post("/api/validate_chirp", handlerValidateChirp);

// the admin namespace
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);

// the error handler must be registered LAST
app.use(errorMiddleware);

// automatic migrations
// Move your app.listen logic inside this setup function
const startServer = async () => {
  try {
    // 1. Create a specialized connection just for migrations
    // max: 1 means we only need one connection for this quick task
    const migrationClient = postgres(apiConfig.dbURL, { max: 1 });

    // 2. Run the migration
    console.log("⏳ Running database migrations...");
    await migrate(drizzle(migrationClient), { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations completed successfully!");

    // 3. Start the server ONLY after migrations succeed
    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Migration failed. Server will not start.", err);
    process.exit(1); // Kill the process if DB is broken
  }
};

// Call the function to start everything
startServer();
