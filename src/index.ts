import express from "express";

import { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";

import { ValidationError, NotFoundError, ForbiddenError } from "./errors.js";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import {
  createUser,
  getUserByEmail,
  deleteAllUsers,
  updateUser,
  upgradeUserToChirpyRed,
} from "./db/queries/users.js";
import {
  createChirp,
  getAllChirps,
  getChirpById,
  deleteChirp,
  getChirpsByAuthorId,
} from "./db/queries/chirps.js";

import {
  createRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
} from "./db/queries/tokens.js";

import {
  hashPassword,
  checkPasswordHash,
  makeJWT,
  getBearerToken,
  validateJWT,
  makeRefreshToken,
  getAPIKey,
} from "./auth.js";

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
    const { email, password } = req.body;
    // Simple check to ensure email exists
    if (!email || !password) {
      // You can just respond with 400 or throw a ValidationError
      throw new ValidationError("Email and password are required");
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await createUser({ email, hashedPassword });

    // strip the password before returing
    // we create a new object without the sensitive Database
    const { hashedPassword: _, ...userWithoutPassword } = newUser;

    res.status(201).json(userWithoutPassword);
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
    const { body } = req.body; // We NO LONGER read 'userId' from the body

    // 1. Get Token
    // This throws an error if header is missing, so it goes to catch block
    const token = getBearerToken(req);

    // 2. Validate Token & Extract User ID
    // This throws if signature is wrong or expired
    const validUserID = validateJWT(token, apiConfig.jwtSecret);

    // 3. Validation (Same as before)
    if (!body || body.length > 140) {
      throw new ValidationError("Chirp is too long");
    }

    const badWords = ["kerfuffle", "sharbert", "fornax"];
    const cleanedBody = body
      .split(" ")
      .map((word: string) => {
        const lower = word.toLowerCase();
        return badWords.includes(lower) ? "****" : word;
      })
      .join(" ");

    // 4. Create Chirp using the SECURE ID from the token
    const newChirp = await createChirp({
      body: cleanedBody,
      userId: validUserID, // Use the ID from the token!
    });

    res.status(201).json(newChirp);
  } catch (err) {
    // If it's an auth error (token missing/invalid), we might want to return 401
    // You can check err.message or just pass to global handler
    // Ideally, you wrap the auth calls in a specific try/catch or use custom AuthError
    if (
      err instanceof Error &&
      (err.message.includes("token") || err.message.includes("authorization"))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next(err);
  }
};

// updated handler that can return all chirps or chirps by an author
const handlerGetChirps = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Check for the query param "?authorId=..."
    const { authorId } = req.query;

    let dbResult;

    // 2. If authorId exists AND is a string, filter by it
    if (typeof authorId === "string" && authorId.length > 0) {
      dbResult = await getChirpsByAuthorId(authorId);
    } else {
      // 3. Otherwise, return everything (default behavior)
      dbResult = await getAllChirps();
    }

    res.status(200).json(dbResult);
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

//login handler
const handlerLogin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;
    const user = (await getUserByEmail(email))[0];

    if (!user || !(await checkPasswordHash(password, user.hashedPassword))) {
      res.status(401).json({ error: "Incorrect email or password" });
      return;
    }

    // 1. Create Access Token (JWT) - 1 Hour Fixed
    const expiresInSeconds = 60 * 60;
    const accessToken = makeJWT(user.id, expiresInSeconds, apiConfig.jwtSecret);

    // 2. Create Refresh Token - 60 Days
    const refreshToken = makeRefreshToken();
    const dbExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days in ms

    await createRefreshToken(refreshToken, user.id, dbExpiresAt);

    // 3. Return both
    const { hashedPassword: _, ...userWithoutPassword } = user;
    res.status(200).json({
      ...userWithoutPassword,
      token: accessToken,
      refreshToken: refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

//handlerRefresh takes a refresh token and gives back a new access token
const handlerRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Get token from header
    const refreshToken = getBearerToken(req);

    // 2. Lookup in DB
    const tokenRecord = await getRefreshToken(refreshToken);

    // 3. Validation: Exists? Revoked? Expired?
    if (!tokenRecord) {
      res.status(401).json({ error: "Refresh token not found" });
      return;
    }
    if (tokenRecord.revokedAt) {
      res.status(401).json({ error: "Refresh token revoked" });
      return;
    }
    if (new Date() > tokenRecord.expiresAt) {
      res.status(401).json({ error: "Refresh token expired" });
      return;
    }

    // 4. Issue NEW Access Token (1 hour)
    const accessToken = makeJWT(
      tokenRecord.userId,
      60 * 60,
      apiConfig.jwtSecret,
    );

    res.status(200).json({ token: accessToken });
  } catch (err) {
    // Map generic auth errors to 401
    if (
      err instanceof Error &&
      (err.message.includes("header") || err.message.includes("token"))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next(err);
  }
};

//handlerRevoke invalidates a specific refresh token (e.g., Logout)
const handlerRevoke = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refreshToken = getBearerToken(req);

    // Update the DB record
    await revokeRefreshToken(refreshToken);

    // 204 No Content (Successful, but nothing to return)
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const handlerUpdateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Validate Auth (Get User ID from Token)
    const token = getBearerToken(req);
    const userId = validateJWT(token, apiConfig.jwtSecret);

    // 2. Parse Body
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // 3. Hash New Password
    const hashedPassword = await hashPassword(password);

    // 4. Update Database
    const updatedUser = await updateUser(userId, email, hashedPassword);

    // 5. Sanitize & Respond
    const { hashedPassword: _, ...userWithoutPassword } = updatedUser;
    res.status(200).json(userWithoutPassword);
  } catch (err) {
    // Handle Auth errors as 401
    if (
      err instanceof Error &&
      (err.message.includes("token") || err.message.includes("header"))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next(err);
  }
};

const handlerDeleteChirp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Authenticate (Get User ID from Token)
    const token = getBearerToken(req);
    const userId = validateJWT(token, apiConfig.jwtSecret);

    // 2. Get the Chirp ID from the URL
    const { chirpID } = req.params;

    // 3. Find the Chirp in the DB
    const dbResult = await getChirpById(chirpID);
    const chirp = dbResult[0];

    // Check if it exists
    if (!chirp) {
      res.status(404).send(); // "Not Found"
      return;
    }

    // 4. Authorize (Check Ownership)
    // We compare the user ID from the token vs the user ID on the chirp
    if (chirp.userId !== userId) {
      res.status(403).send(); // "Forbidden"
      return;
    }

    // 5. Delete
    await deleteChirp(chirpID);

    // 204 No Content (Success, but no body returned)
    res.status(204).send();
  } catch (err) {
    // Standard Auth error handling
    if (
      err instanceof Error &&
      (err.message.includes("token") || err.message.includes("header"))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next(err);
  }
};

const handlerPolkaWebhooks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    //securty check
    const apiKey = getAPIKey(req);
    if (apiKey !== apiConfig.polkaKey) {
      res.status(401).send();
      return;
    }

    const { event, data } = req.body;

    // 1. Ignore irrelevant events
    if (event !== "user.upgraded") {
      res.status(204).send();
      return;
    }

    // 2. Validate data structure (optional but good practice)
    if (!data || !data.userId) {
      // If data is missing, we technically can't process it.
      // Polka expects 2xx to stop retrying, so 204 is safer than 400 here
      // unless you want them to keep retrying a broken request.
      res.status(204).send();
      return;
    }

    // 3. Attempt to upgrade the user
    try {
      const upgradedUser = await upgradeUserToChirpyRed(data.userId);

      // 4. Handle "User Not Found"
      if (!upgradedUser) {
        res.status(404).send();
        return;
      }

      // 5. Success
      res.status(204).send();
    } catch (err) {
      // If the DB ID format is invalid (not a UUID), it might throw.
      // Polka will retry on 500s, which is what we want for transient DB errors.
      throw err;
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("header") || err.message.includes("key"))
    ) {
      res.status(401).send();
      return;
    }
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
app.post("/api/login", handlerLogin);
app.post("/api/refresh", handlerRefresh);
app.post("/api/revoke", handlerRevoke);
app.put("/api/users", handlerUpdateUser);
app.delete("api/users", handlerDeleteChirp);
app.post("/api/polka/webhooks", handlerPolkaWebhooks);

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
