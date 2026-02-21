const mongoose = require("mongoose");

const tokenAlertSchema = new mongoose.Schema({
  deviceToken: {
    type: String,
    required: true,
  },
  patientTokenNumber: {
    type: Number,
    required: true,
  },
  stage: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TokenAlert", tokenAlertSchema);
