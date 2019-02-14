import * as http from "http";
import * as express from "express";
import { getAllStoresAsIStoreFull } from "./modules/services/stores";
const inspector = require("inspector");
const app = express();

app.use("/:chain_id", async (req, res) => {
    const chainId = req.params.chain_id;
    const options = {
      chain_id: chainId,
    }

    try { 
      const stores = await getAllStoresAsIStoreFull(options);

      return res.status(200).json(stores);
    } catch (err) {
      console.log("error when trying to get stores");
      return res.status(500).json({ test: "stores", error: err });
    }
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