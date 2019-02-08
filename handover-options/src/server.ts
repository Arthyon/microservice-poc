import * as http from "http";
import * as express from "express";
const inspector = require("inspector");
const app = express();

app.use("/handover-options", (req, res) => {
    return res.status(200).json({ test: "handover-options", options: "none atm" });
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

server.listen(8002, () => console.log("Server running on 8002"));