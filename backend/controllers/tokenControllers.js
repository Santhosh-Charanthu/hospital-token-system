const Token = require("../models/Token");
const TokenAlert = require("../models/TokenAlert");
const admin = require("../config/firebaseAdmin");
const FRONTEND_URL = process.env.FRONTEND_URL;

const emitTokenUpdate = async (io) => {
  const Token = require("../models/Token");

  const activeToken = await Token.findOne({ status: "ACTIVE" });
  const upcomingTokens = await Token.find({ status: "WAITING" })
    .sort({ createdAt: 1 })
    .limit(5);

  io.emit("TOKEN_UPDATE", {
    activeToken,
    upcomingTokens,
  });
};

module.exports.generateToken = async (req, res) => {
  try {
    // Get last token number
    const lastToken = await Token.findOne().sort({ tokenNumber: -1 });
    const nextTokenNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    // Check if an active token already exists
    const activeToken = await Token.findOne({ status: "ACTIVE" });

    // Create new token
    const newToken = new Token({
      tokenNumber: nextTokenNumber,
      status: activeToken ? "WAITING" : "ACTIVE",
    });

    await newToken.save();

    // 🔥 Fetch updated state for socket emit
    const updatedActiveToken = await Token.findOne({ status: "ACTIVE" });
    const upcomingTokens = await Token.find({ status: "WAITING" })
      .sort({ createdAt: 1 })
      .limit(5);

    const io = req.app.get("io");

    // 🔥 Emit socket update
    io.emit("TOKEN_UPDATE", {
      activeToken: updatedActiveToken,
      upcomingTokens,
    });

    // Response
    res.status(201).json({
      message: "Token generated successfully",
      token: newToken,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// module.exports.completeToken = async (req, res) => {
//   try {
//     const activeToken = await Token.findOne({ status: "ACTIVE" });

//     if (!activeToken) {
//       return res.status(400).json({ message: "No active token found" });
//     }

//     activeToken.status = "COMPLETED";
//     await activeToken.save();

//     const nextToken = await Token.findOne({ status: "WAITING" }).sort({
//       createdAt: 1,
//     });

//     if (nextToken) {
//       nextToken.status = "ACTIVE";
//       await nextToken.save();
//     }

//     // 🔥 Emit update
//     const io = req.app.get("io");
//     await emitTokenUpdate(io);

//     res.json({
//       message: "Token completed successfully",
//       completedToken: activeToken,
//       activeToken: nextToken || null,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

module.exports.completeToken = async (req, res) => {
  try {
    const activeToken = await Token.findOne({ status: "ACTIVE" });

    if (!activeToken) {
      return res.status(400).json({ message: "No active token found" });
    }

    // 1️⃣ complete current
    activeToken.status = "COMPLETED";
    await activeToken.save();

    // 2️⃣ activate next
    const nextToken = await Token.findOne({ status: "WAITING" }).sort({
      createdAt: 1,
    });

    if (nextToken) {
      nextToken.status = "ACTIVE";
      await nextToken.save();

      /* =======================================================
         🔔 FIREBASE ALERT LOGIC STARTS HERE
      ======================================================= */

      const currentTokenNumber = nextToken.tokenNumber;

      // we check 4 reminder stages
      const stages = [
        {
          diff: 3,
          stage: 1,
          message: "Your turn is approaching. Please be ready.",
        },
        {
          diff: 2,
          stage: 2,
          message: "Only 2 patients ahead. Please come near OP room.",
        },
        {
          diff: 1,
          stage: 3,
          message: "You are next. Kindly wait outside the doctor's room.",
        },
        {
          diff: 0,
          stage: 4,
          message: "It is your turn now. Please enter the consultation room.",
        },
      ];

      for (const s of stages) {
        const targetToken = currentTokenNumber + s.diff;

        const alerts = await TokenAlert.find({
          patientTokenNumber: targetToken,
          stage: { $lt: s.stage },
        });

        console.log(`Stage ${s.stage} alerts:`, alerts.length);

        for (const alert of alerts) {
          try {
            const response = await admin.messaging().send({
              token: alert.deviceToken,

              webpush: {
                headers: {
                  Urgency: "high",
                  TTL: "86400",
                },

                data: {
                  title: "Hospital Token Update",
                  body: `Token ${alert.patientTokenNumber}: ${s.message}`,
                  tokenNumber: String(alert.patientTokenNumber),
                  stage: String(s.stage),
                  url: "/", // important for click open
                },
              },
            });

            console.log("Notification sent:", response);

            // update stage
            alert.stage = s.stage;
            await alert.save();
          } catch (err) {
            console.log("FCM ERROR:", err.message);
          }
        }
      }
    }

    /* ======================================================= */

    // socket update (this stays AFTER notification)
    const io = req.app.get("io");
    await emitTokenUpdate(io);

    res.json({
      message: "Token completed successfully",
      completedToken: activeToken,
      activeToken: nextToken || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.currentToken = async (req, res) => {
  try {
    const activeToken = await Token.findOne({ status: "ACTIVE" });

    const upcomingTokens = await Token.find({ status: "WAITING" })
      .sort({ createdAt: 1 })
      .limit(5);

    res.json({
      activeToken,
      upcomingTokens,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.lastGeneratedToken = async (req, res) => {
  try {
    const lastGeneratedToken = await Token.findOne().sort({
      createdAt: -1,
    });

    res.json({ lastGeneratedToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.resetTokens = async (req, res) => {
  try {
    // ⚠️ Delete all tokens
    await Token.deleteMany({});

    // 🔥 Emit empty state
    const io = req.app.get("io");
    io.emit("TOKEN_UPDATE", {
      activeToken: null,
      upcomingTokens: [],
    });

    res.json({ message: "Tokens reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.confirmIssued = async (req, res) => {
  const { tokenId } = req.body;

  // Mark token as officially issued
  await Token.findByIdAndUpdate(tokenId, { issued: true });

  // ✅ NOW emit update
  await emitTokenUpdate(req.app.get("io"));

  res.json({ success: true });
};

module.exports.tokenAlert = async (req, res) => {
  try {
    const { deviceToken, tokenNumber } = req.body;

    console.log("DEVICE TOKEN RECEIVED:", deviceToken);

    if (!deviceToken || !tokenNumber) {
      return res.status(400).json({ message: "Missing data" });
    }

    // remove previous subscriptions for this device
    await TokenAlert.deleteMany({ deviceToken });

    await TokenAlert.create({
      deviceToken,
      patientTokenNumber: tokenNumber,
    });

    res.json({ success: true, message: "Alert subscribed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
