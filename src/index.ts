import express from "express";

import { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";

import { ValidationError, NotFoundError, ForbiddenError } from "./errors.js";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { createUser, deleteAllUsers } from "./db/queries/users.js";
import {
  createChirp,
  getAllChirps,
  getChirpById,
} from "./db/queries/chirps.js";

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

// --- updated reset handler to delete all users ---
const handlerReset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Safety Check: Only allow this in "dev" environment
    if (apiConfig.platform !== "dev") {
      throw new ForbiddenError("Reset not allowed in this environment");
    }

    // 1. Delete the users from the DB
    await deleteAllUsers();

    // 2. Reset the metrics counter
    apiConfig.fileserverHits = 0;

    res
      .status(200)
      .set("Content-Type", "text/plain; charset=utf-8")
      .send("Reset OK");
  } catch (err) {
    next(err);
  }
};

const handlerReadiness = (req: Request, res: Response) => {
  res.status(200).set("Content-Type", "text/plain; charset=utf-8").send("OK"); // send the body text
};

// create user handler
const handlerCreateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;
    // Simple check to ensure email exists
    if (!email) {
      // You can just respond with 400 or throw a ValidationError
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const newUser = await createUser({ email });

    // 201 means "Created"
    res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
};

// create chirp handler
const handlerCreateChirp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { body, userId } = req.body;

    // 1. Validation (Ported logic)
    if (!body || body.length > 140) {
      throw new ValidationError("Chirp is too long");
    }

    // 2. Censorship (Ported logic)
    const badWords = ["kerfuffle", "sharbert", "fornax"];
    const cleanedBody = body
      .split(" ")
      .map((word: string) => {
        const lower = word.toLowerCase();
        return badWords.includes(lower) ? "****" : word;
      })
      .join(" ");

    // 3. Save to Database (using the cleaned body)
    const newChirp = await createChirp({
      body: cleanedBody,
      userId: userId,
    });

    // 4. Respond with 201 Created
    res.status(201).json(newChirp);
  } catch (err) {
    next(err);
  }
};

// get all chirps handler
const handlerGetChirps = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const allChirps = await getAllChirps();
    res.status(200).json(allChirps);
  } catch (err) {
    next(err);
  }
};

// get one chirp handler
const handlerGetChirpById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // express puts dynamic parameters (like chirp_id) into req.params
    const { chirp_id } = req.params;

    // fetch from DB
    const result = await getChirpById(chirp_id);

    // if array is empty, the chirp doesn't exists
    if (result.length === 0) {
      throw new NotFoundError("Chirp not found");
    }
    res.status(200).json(result[0]);
  } catch (err) {
    next(err);
  }
};

// --- register routes ---
// apply the increment middleware to the /app path FIRST
// the website (remains at /app)
app.use("/app", middlewareMetricsInc);
app.use("/app", express.static("./src/app"));

// the API (moved to /api namespace)
app.get("/api/healthz", handlerReadiness);
app.post("/api/users", handlerCreateUser);
app.post("/api/chirps", handlerCreateChirp);
app.get("/api/chirps", handlerGetChirps);
app.get("/api/chirps/:chirp_id", handlerGetChirpById);

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
