import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Mock Infrastructure Data
  app.get("/api/infrastructure", (req, res) => {
    res.json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: 1, name: "Power Grid Alpha", status: "stable", load: 65 },
          geometry: { type: "Point", coordinates: [-74.006, 40.7128] },
        },
        {
          type: "Feature",
          properties: { id: 2, name: "Water Main 42", status: "warning", load: 88 },
          geometry: { type: "Point", coordinates: [-74.016, 40.7228] },
        },
        {
          type: "Feature",
          properties: { id: 3, name: "Transit Hub Central", status: "stable", load: 45 },
          geometry: { type: "Point", coordinates: [-73.996, 40.7028] },
        },
      ],
    });
  });

  // Prediction Endpoint
  app.post("/api/predict", (req, res) => {
    const { zoneId, timeframe } = req.body;
    // Mock prediction logic
    const predictions = Array.from({ length: 12 }, (_, i) => ({
      time: i,
      value: 50 + Math.random() * 40 + (timeframe === "long" ? i * 2 : 0),
    }));
    res.json({ zoneId, predictions });
  });

  // --- WebSocket Logic ---
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("simulate-event", (event) => {
      console.log("Simulating event:", event);
      // Broadcast event to all clients
      io.emit("infrastructure-update", {
        timestamp: new Date().toISOString(),
        ...event,
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`GeoMind AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
