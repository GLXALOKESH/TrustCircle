const mongoose = require("mongoose");

const authNonceSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["register", "login"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

authNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuthNonce", authNonceSchema);
