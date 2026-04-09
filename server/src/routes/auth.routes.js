const express = require("express");
const { createNonce, register, login, me, userByWallet, updateCibilByPan } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/nonce", createNonce);
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.get("/user/:walletAddress", requireAuth, userByWallet);
router.patch("/cibil", requireAuth, updateCibilByPan);

module.exports = router;
