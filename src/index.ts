import express from "express";

const app = express();
const PORT = 8080;

//tell express: "serve any files found in the current directory"
app.use(express.static("."));

//listen port 8080
app.listen(8080, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
