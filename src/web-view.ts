// create express server and start index.html
import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// send all filenames as a json array
app.get("/data", (req, res) => {
  res.send(
    JSON.stringify(
      fs.readdirSync(path.join(__dirname, "../public/data")),
      null,
      2,
    ),
  );
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
