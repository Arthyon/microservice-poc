import * as http from "http";
import * as express from "express";
const inspector = require("inspector");
const app = express();

app.use("/:chain_id", (req, res, next) => {
    const chainId = req.params.chain_id;

    if (!chainId) {
      next({code: 500, msg: "missing chainId"})
    }

    let data = '';
    // http://stores.default.svc.cluster.local/handover-options
    http.get(`http://ingress-nginx/api/stores/${chainId}`, response => {
        response.on('data', chunk => {
            data += chunk;
        });
        response.on('end', () => {
          res.type("application/json");
          return res.send(data);
        });
      }).on('error', err => {
          next(err);
      });
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