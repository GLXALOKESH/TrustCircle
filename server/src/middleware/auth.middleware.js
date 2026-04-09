const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ ok: false, message: "JWT_SECRET is missing" });
    }

    const payload = jwt.verify(token, secret);
    const user = await User.findOne({ walletAddress: payload.walletAddress });

    if (!user) {
      return res.status(401).json({ ok: false, message: "User not found" });
    }

    req.user = {
      id: user._id,
      walletAddress: user.walletAddress,
      name: user.name,
      panCardNumber: user.panCardNumber,
      age: user.age,
      cibilScore: user.cibilScore,
      lastLoginAt: user.lastLoginAt,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
