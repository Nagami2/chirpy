import express from "express";

import { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";

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
  res.status(200);
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("Reser OK");
};

const handlerReadiness = (req: Request, res: Response) => {
  res.status(200);
  res.set("Content-Type", "text/plain; charset=utf-8"); // set the header
  res.send("OK"); // send the body text
};

// --- validate chirp handler ---
const handlerValidateChirp = (req: Request, res: Response) => {
  // as the app uses express.json() we can read req.body directly!
  const chirp = req.body;

  if (chirp.body && chirp.body.length > 140) {
    res.status(400).json({ error: "Chirp is too long" });
    return;
  }

  // define forbidden words
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

//listen port 8080
app.listen(8080, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
