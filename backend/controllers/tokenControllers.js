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

    /* ================= FINAL VISIT MESSAGE ================= */

    const completedAlerts = await TokenAlert.find({
      patientTokenNumber: activeToken.tokenNumber,
      stage: { $lt: 6 },
    });

    for (const alert of completedAlerts) {
      try {
        await admin.messaging().send({
          token: alert.deviceToken,
          webpush: {
            headers: { Urgency: "high", TTL: "86400" },
            data: {
              title: "Visit Completed",
              body: "Thank you for visiting Hope Homoeopathy. We wish you good health!",
              tokenNumber: String(activeToken.tokenNumber),
              stage: "6",
              url: "/",
            },
          },
        });

        alert.stage = 6;
        await alert.save();
        await TokenAlert.deleteOne({ _id: alert._id });

        console.log("Final visit notification sent");
      } catch (err) {
        console.log("Final FCM ERROR:", err.message);
      }
    }

    // 2️⃣ activate next
    const nextToken = await Token.findOne({ status: "WAITING" }).sort({
      createdAt: 1,
    });

    const completedTokenNumber = activeToken.tokenNumber;

    if (nextToken) {
      nextToken.status = "ACTIVE";
      await nextToken.save();

      const currentTokenNumber = nextToken.tokenNumber;

      // find all subscribed users whose turn is still pending
      // find all relevant subscriptions
      const alerts = await TokenAlert.find({
        patientTokenNumber: { $gte: currentTokenNumber - 1 }, // include completed token
        stage: { $lt: 6 },
      });

      for (const alert of alerts) {
        const diff = alert.patientTokenNumber - currentTokenNumber;

        let stageToSend = null;
        let message = null;

        // 5th prior token
        if (diff === 5 && alert.stage < 1) {
          stageToSend = 1;
          message =
            "Your appointment is coming up soon. Please plan to reach the clinic.";

          // 4th prior token (INTENTIONALLY SKIPPED)

          // 3rd prior token
        } else if (diff === 3 && alert.stage < 2) {
          stageToSend = 2;
          message = "Your turn is approaching. Please be ready.";

          // 2nd prior token
        } else if (diff === 2 && alert.stage < 3) {
          stageToSend = 3;
          message = "Only 2 patients ahead. Please come near OP room.";

          // 1st prior token
        } else if (diff === 1 && alert.stage < 4) {
          stageToSend = 4;
          message = "You are next. Kindly wait outside the doctor's room.";

          // current token
        } else if (diff === 0 && alert.stage < 5) {
          stageToSend = 5;
          message = "It is your turn now. Please enter the consultation room.";

          // AFTER completion (courtesy notification)
        } else if (
          alert.patientTokenNumber === completedTokenNumber &&
          alert.stage < 6
        ) {
          stageToSend = 6;
          message =
            "Thank you for visiting Hope Homoeopathy. We wish you good health!";
        }

        if (!stageToSend) continue;

        console.log(
          `Sending stage ${stageToSend} alert for token ${alert.patientTokenNumber}`,
        );

        const notificationTitle =
          stageToSend === 6 ? "Visit Completed" : "Hospital Token Update";

        try {
          const response = await admin.messaging().send({
            token: alert.deviceToken,
            webpush: {
              headers: {
                Urgency: "high",
                TTL: "86400",
              },
              data: {
                title: notificationTitle,
                body: `Token ${alert.patientTokenNumber}: ${message}`,
                tokenNumber: String(alert.patientTokenNumber),
                stage: String(stageToSend),
                url: "/",
              },
            },
          });

          console.log("Notification sent:", response);

          alert.stage = stageToSend;
          await alert.save();

          // auto-unsubscribe after final message
          if (stageToSend === 6) {
            await TokenAlert.deleteOne({ _id: alert._id });
          }
        } catch (err) {
          console.log("FCM ERROR:", err.message);
        }
      }

      /* ======================================================= */
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
