// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const dotenv = require("dotenv");
// const { Server } = require("socket.io");

// const connectDB = require("./config/db");
// const tokenRoutes = require("./routes/tokenRoutes");

// dotenv.config();

// const app = express();
// const server = http.createServer(app);

// // 🔥 Socket.IO setup
// const io = new Server(server, {
//   cors: {
//     origin: "*",
//   },
// });

// // Make io accessible everywhere
// app.set("io", io);

// // MongoDB
// connectDB();

// // Middlewares
// app.use(cors());
// app.use(express.json());

// // Routes
// app.use("/api/tokens", tokenRoutes);

// // Health check
// app.get("/", (req, res) => {
//   res.send("Hospital Token System Backend is running");
// });

// // Socket connection
// io.on("connection", (socket) => {
//   console.log("🟢 Client connected:", socket.id);

//   socket.on("disconnect", () => {
//     console.log("🔴 Client disconnected:", socket.id);
//   });
// });

// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

// module.exports = app;

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("../config/db");
const tokenRoutes = require("../routes/tokenRoutes");

dotenv.config();

const app = express();

// MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/tokens", tokenRoutes);

// Health
app.get("/", (req, res) => {
  res.send("Hospital Token System Backend running on Vercel ✅");
});

module.exports = app;
