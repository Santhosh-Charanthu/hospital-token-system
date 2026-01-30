const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: Number,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["WAITING", "ACTIVE", "COMPLETED"],
      default: "WAITING",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Token", tokenSchema);
