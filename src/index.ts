import express from "express";

import { Request, Response, NextFunction } from "express";

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

// --- custom handlers ---
const handlerReadiness = (req: Request, res: Response) => {
  res.status(200);
  res.set("Content-Type", "text/plain; charset=utf-8"); // set the header
  res.send("OK"); // send the body text
};

app.get("/healthz", handlerReadiness);
app.use("/app", express.static("./src/app"));

//listen port 8080
app.listen(8080, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
