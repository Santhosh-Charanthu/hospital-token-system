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

    const io = req.app.get("io");
    io.emit("TOKEN_CREATED", {
      tokenNumber: newToken.tokenNumber,
    });

    // 🔥 Fetch updated state for socket emit
    const updatedActiveToken = await Token.findOne({ status: "ACTIVE" });
    const upcomingTokens = await Token.find({ status: "WAITING" })
      .sort({ createdAt: 1 })
      .limit(5);

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
    }

    const currentTokenNumber = nextToken
      ? nextToken.tokenNumber
      : activeToken.tokenNumber + 1;

    // find all subscribed users whose turn is still pending
    const alerts = await TokenAlert.find({
      patientTokenNumber: { $gte: currentTokenNumber - 1 },
      stage: { $lt: 6 },
    });

    for (const alert of alerts) {
      const diff = alert.patientTokenNumber - currentTokenNumber;

      let stageToSend = null;
      let message = null;

      if (diff === 5 && alert.stage < 1) {
        stageToSend = 1;
        message = "5 patients ahead. Please be ready.";
      } else if (diff === 3 && alert.stage < 2) {
        stageToSend = 2;
        message = "3 patients ahead. Please be ready.";
      } else if (diff === 2 && alert.stage < 3) {
        stageToSend = 3;
        message = "Only 2 patients ahead. Please be ready.";
      } else if (diff === 1 && alert.stage < 4) {
        stageToSend = 4;
        message = "You are next. Kindly wait for your turn.";
      } else if (diff === 0 && alert.stage < 5) {
        stageToSend = 5;
        message = "It is your turn now. Please enter the consultation room.";
      } else if (diff === -1 && alert.stage < 6) {
        stageToSend = 6;
        message =
          "Thank you for visiting. We hope you had a comfortable consultation.";
      }

      // If no stage applies, skip
      if (!stageToSend) continue;

      console.log(
        `Sending stage ${stageToSend} alert for token ${alert.patientTokenNumber}`,
      );

      try {
        const title = "Hospital Token Update";
        const body = `Token ${alert.patientTokenNumber}: ${message}`;
        const notificationTag = `${alert.patientTokenNumber}-${stageToSend}`;

        const response = await admin.messaging().send({
          token: alert.deviceToken,

          data: {
            title,
            body,
            tokenNumber: String(alert.patientTokenNumber),
            stage: String(stageToSend),
            url: "/",
          },

          webpush: {
            headers: {
              Urgency: "high",
              TTL: "86400",
            },

            notification: {
              title,
              body,
              icon: "/notification-icon.png",
              badge: "/notification-icon.png",
              tag: notificationTag,
              requireInteraction: true,
            },

            fcmOptions: {
              link: FRONTEND_URL || "/",
            },
          },
        });

        console.log("Notification sent:", response);

        // update progress stage
        alert.stage = stageToSend;
        await alert.save();
      } catch (err) {
        console.log("FCM ERROR:", err.message);
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
    await TokenAlert.deleteMany({});

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

// module.exports.tokenAlert = async (req, res) => {
//   try {
//     const { deviceToken, tokenNumber } = req.body;

//     console.log("DEVICE TOKEN RECEIVED:", deviceToken);

//     if (!deviceToken || !tokenNumber) {
//       return res.status(400).json({ message: "Missing data" });
//     }

//     // remove previous subscriptions for this device
//     await TokenAlert.deleteMany({ deviceToken });

//     await TokenAlert.create({
//       deviceToken,
//       patientTokenNumber: tokenNumber,
//     });

//     res.json({ success: true, message: "Alert subscribed" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

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
    console.log("tokenAlert error:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to subscribe alert" });
  }
};
