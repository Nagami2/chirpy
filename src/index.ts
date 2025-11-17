import express from "express";

import { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";

const app = express();
const PORT = 8080;

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
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send(`Hits: ${apiConfig.fileserverHits}`);
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

// --- register routes ---
// apply the increment middleware to the /app path FIRST
app.use("/app", middlewareMetricsInc);

app.use("/app", express.static("./src/app"));
app.get("/metrics", handlerMetrics);
app.get("/reset", handlerReset);

app.get("/healthz", handlerReadiness);

//listen port 8080
app.listen(8080, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
