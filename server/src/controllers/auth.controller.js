const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");

const User = require("../models/user.model");
const AuthNonce = require("../models/authNonce.model");
const { buildAuthMessage } = require("../utils/authMessage");

const NONCE_TTL_MINUTES = 10;

function normalizeWallet(address) {
  return ethers.getAddress(address).toLowerCase();
}

function validatePan(value) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(value || "").toUpperCase());
}

function validateCibilScore(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 300 && score <= 900;
}

function signToken(walletAddress) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  return jwt.sign({ walletAddress }, secret, { expiresIn: "7d" });
}

async function createNonce(req, res) {
  try {
    const { walletAddress, action } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ ok: false, message: "walletAddress is required" });
    }

    const normalizedWallet = normalizeWallet(walletAddress);
    const normalizedAction = action === "register" ? "register" : "login";
    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + NONCE_TTL_MINUTES * 60 * 1000);

    await AuthNonce.deleteMany({ walletAddress: normalizedWallet, action: normalizedAction });
    await AuthNonce.create({
      walletAddress: normalizedWallet,
      nonce,
      action: normalizedAction,
      expiresAt,
    });

    return res.status(200).json({
      ok: true,
      nonce,
      action: normalizedAction,
      messageToSign: buildAuthMessage({ nonce, action: normalizedAction }),
      expiresAt,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || "Failed to create nonce" });
  }
}

async function register(req, res) {
  try {
    const { walletAddress, signature, nonce, name, panCardNumber, age } = req.body;

    if (!walletAddress || !signature || !nonce || !name || !panCardNumber || age === undefined || age === null) {
      return res.status(400).json({ ok: false, message: "All fields are required" });
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge > 120) {
      return res.status(400).json({ ok: false, message: "Age must be an integer between 18 and 120" });
    }

    if (parsedAge < 18) {
      return res.status(400).json({ ok: false, message: "Users under 18 are not allowed to register" });
    }

    if (!validatePan(panCardNumber)) {
      return res.status(400).json({ ok: false, message: "Invalid PAN format" });
    }

    const normalizedWallet = normalizeWallet(walletAddress);
    const normalizedPan = String(panCardNumber).toUpperCase();

    const nonceDoc = await AuthNonce.findOne({ walletAddress: normalizedWallet, nonce, action: "register" });
    if (!nonceDoc || nonceDoc.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: "Nonce expired or invalid" });
    }

    const message = buildAuthMessage({ nonce, action: "register" });
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== normalizedWallet) {
      return res.status(401).json({ ok: false, message: "Signature verification failed" });
    }

    const existingWallet = await User.findOne({ walletAddress: normalizedWallet });
    if (existingWallet) {
      return res.status(409).json({ ok: false, message: "Wallet already registered" });
    }

    const existingPan = await User.findOne({ panCardNumber: normalizedPan });
    if (existingPan) {
      return res.status(409).json({ ok: false, message: "PAN already registered with another wallet" });
    }

    const user = await User.create({
      walletAddress: normalizedWallet,
      name: String(name).trim(),
      panCardNumber: normalizedPan,
      age: parsedAge,
      lastLoginAt: new Date(),
    });

    await AuthNonce.deleteMany({ walletAddress: normalizedWallet, action: "register" });

    const token = signToken(normalizedWallet);

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        name: user.name,
        panCardNumber: user.panCardNumber,
        age: user.age,
        cibilScore: user.cibilScore,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Registration failed" });
  }
}

async function login(req, res) {
  try {
    const { walletAddress, signature, nonce } = req.body;

    if (!walletAddress || !signature || !nonce) {
      return res.status(400).json({ ok: false, message: "walletAddress, signature and nonce are required" });
    }

    const normalizedWallet = normalizeWallet(walletAddress);

    const user = await User.findOne({ walletAddress: normalizedWallet });
    if (!user) {
      return res.status(404).json({ ok: false, message: "Wallet not registered" });
    }

    const nonceDoc = await AuthNonce.findOne({ walletAddress: normalizedWallet, nonce, action: "login" });
    if (!nonceDoc || nonceDoc.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: "Nonce expired or invalid" });
    }

    const message = buildAuthMessage({ nonce, action: "login" });
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== normalizedWallet) {
      return res.status(401).json({ ok: false, message: "Signature verification failed" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    await AuthNonce.deleteMany({ walletAddress: normalizedWallet, action: "login" });

    const token = signToken(normalizedWallet);

    return res.status(200).json({
      ok: true,
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        name: user.name,
        panCardNumber: user.panCardNumber,
        age: user.age,
        cibilScore: user.cibilScore,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Login failed" });
  }
}

async function me(req, res) {
  return res.status(200).json({ ok: true, user: req.user });
}

async function userByWallet(req, res) {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ ok: false, message: "walletAddress is required" });
    }

    const normalizedWallet = normalizeWallet(walletAddress);
    const user = await User.findOne({ walletAddress: normalizedWallet });
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    return res.status(200).json({
      ok: true,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        name: user.name,
        panCardNumber: user.panCardNumber,
        age: user.age,
        cibilScore: user.cibilScore,
      },
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || "Invalid wallet address" });
  }
}

async function updateCibilByPan(req, res) {
  try {
    const { panCardNumber, cibilScore } = req.body;

    if (!panCardNumber || cibilScore === undefined || cibilScore === null) {
      return res.status(400).json({ ok: false, message: "panCardNumber and cibilScore are required" });
    }

    const normalizedPan = String(panCardNumber).toUpperCase().trim();
    if (!validatePan(normalizedPan)) {
      return res.status(400).json({ ok: false, message: "Invalid PAN format" });
    }

    if (!validateCibilScore(cibilScore)) {
      return res.status(400).json({ ok: false, message: "CIBIL score must be an integer between 300 and 900" });
    }

    const user = await User.findOneAndUpdate(
      { panCardNumber: normalizedPan },
      { cibilScore: Number(cibilScore) },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ ok: false, message: "No user found for this PAN" });
    }

    return res.status(200).json({
      ok: true,
      message: "CIBIL updated successfully",
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        name: user.name,
        panCardNumber: user.panCardNumber,
        age: user.age,
        cibilScore: user.cibilScore,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Failed to update CIBIL score" });
  }
}

module.exports = {
  createNonce,
  register,
  login,
  me,
  userByWallet,
  updateCibilByPan,
};
