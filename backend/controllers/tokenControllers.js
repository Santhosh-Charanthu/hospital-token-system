const Token = require("../models/Token");

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
    const lastToken = await Token.findOne().sort({ tokenNumber: -1 });
    const nextTokenNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    const activeToken = await Token.findOne({ status: "ACTIVE" });

    const newToken = new Token({
      tokenNumber: nextTokenNumber,
      status: activeToken ? "WAITING" : "ACTIVE",
    });

    await newToken.save();

    res.status(201).json({
      message: "Token generated successfully",
      token: newToken,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.completeToken = async (req, res) => {
  try {
    const activeToken = await Token.findOne({ status: "ACTIVE" });

    if (!activeToken) {
      return res.status(400).json({ message: "No active token found" });
    }

    activeToken.status = "COMPLETED";
    await activeToken.save();

    const nextToken = await Token.findOne({ status: "WAITING" }).sort({
      createdAt: 1,
    });

    if (nextToken) {
      nextToken.status = "ACTIVE";
      await nextToken.save();
    }

    // 🔥 Emit update
    // const io = req.app.get("io");
    // await emitTokenUpdate(io);

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
    // const io = req.app.get("io");
    // io.emit("TOKEN_UPDATE", {
    //   activeToken: null,
    //   upcomingTokens: [],
    // });

    res.json({ message: "Tokens reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// // controller
// exports.confirmIssued = async (req, res) => {
//   const { tokenId } = req.body;

//   // mark token as issued
//   await Token.findByIdAndUpdate(tokenId, { issued: true });

//   const activeToken = await Token.findOne({ status: "active" });
//   const upcomingTokens = await Token.find({ status: "pending" });

//   // 🔥 EMIT ONLY HERE
//   io.emit("TOKEN_UPDATE", { activeToken, upcomingTokens });

//   res.json({ success: true });
// };

exports.confirmIssued = async (req, res) => {
  const { tokenId } = req.body;

  // Mark token as officially issued
  await Token.findByIdAndUpdate(tokenId, { issued: true });

  // ✅ NOW emit update
  // await emitTokenUpdate(req.app.get("io"));

  res.json({ success: true });
};
