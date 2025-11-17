import express from "express";

import { Request, Response } from "express";

const app = express();
const PORT = 8080;

// --- custom handlers ---
const handlerReadiness = (req: Request, res: Response) => {
  res.status(200);
  res.set("Content-Type", "text/plain; charset=utf-8"); // set the header
  res.send("OK"); // send the body text
};

app.get("/healthz", handlerReadiness);

//updated static files path
app.use(express.static("."));

//listen port 8080
app.listen(8080, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
