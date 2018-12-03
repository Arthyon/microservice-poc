import * as express from "express";
import * as http from "http";
const inspector = require("inspector");
const app = express();

app.use("/user/:user_id", (req, res) => {
  return res
    .status(200)
    .json({ test: "dwadwa3", usr: req.params.user_id, headers: req.headers });
});
app.use("/test", (req, res) => {
  return res.status(200).send("test");
});

const server = http.createServer(app);

// listen for TERM signal .e.g. kill
process.on("SIGTERM", gracefulShutdown);
// listen for INT signal e.g. Ctrl-C
process.on("SIGINT", gracefulShutdown);
// this function is called when you want the server to die gracefully
// i.e. wait for existing connections
function gracefulShutdown() {
  console.log("shutting down");
  if (inspector.url()) {
    // If already in debugging
    inspector.close(); // Turn off
  }
  server.close(() => {
    process.exit();
  });

  // if after
  setTimeout(() => {
    process.exit();
  }, 20 * 1000);
}

server.listen(8001, () => console.log("Server running on 8001"));
