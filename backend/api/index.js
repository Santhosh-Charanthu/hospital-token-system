const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { Server } = require("socket.io");
const cron = require("node-cron");
const axios = require("axios");

const connectDB = require("../config/db");
const tokenRoutes = require("../routes/tokenRoutes");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const server = http.createServer(app);

// 🔥 Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
});

// Make io accessible everywhere
app.set("io", io);

// MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/tokens", tokenRoutes);

// Health check
app.get("/", (req, res) => {
  res.send(process.env.BACKEND_URL);
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

const PORT = process.env.PORT || 5000;

cron.schedule("*/14 * * * *", async () => {
  try {
    const response = await axios.get(`${process.env.BACKEND_URL}/ping`);
    console.log(
      `✅ Self-ping successful: ${response.data} at ${new Date().toISOString()}`,
    );
  } catch (error) {
    console.error("❌ Self-ping failed:", error.message);
  }
});

// Socket connection
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;

// const express = require("express");
// const cors = require("cors");
// const dotenv = require("dotenv");

// const connectDB = require("../config/db");
// const tokenRoutes = require("../routes/tokenRoutes");

// dotenv.config();

// const app = express();

// // MongoDB
// connectDB();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Routes
// app.use("/api/tokens", tokenRoutes);

// app.get("/api", (req, res) => {
//   res.send("Hospital Token System Backend running on Vercel ✅");
// });

// module.exports = app;
