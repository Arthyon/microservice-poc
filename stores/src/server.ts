import * as http from "http";
import * as express from "express";
import { getAllStoresAsIStoreFull } from "./modules/services/stores";
const inspector = require("inspector");
const app = express();

app.use("/:chain_Id", async (req, res) => {
  //return res.status(200).json({ test: "stores", chainId2: "1300", msg: "test" });
    // const chainId = req.params.chain_id;
    const options = {
      chain_id: "1300",
    }
    try { 
      console.log("try to get stores");
      const stores = await getAllStoresAsIStoreFull(options);
      console.log("got stores. length: " + stores != null ? stores.length : 0);
      return res.status(200).json({ test: "stores", chainId2: "1300", stores });
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