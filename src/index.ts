import express from "express";

const app = express();

//listen port 8080
app.listen(8080, () => {
  console.log("Server is listening on port 8080");
})
