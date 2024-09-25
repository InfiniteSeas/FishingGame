const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// User Schema
const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  walletAddress: { type: String, unique: true, sparse: true },
  currentSpot: { type: Number, min: 1, max: 6 },
  lastFishTime: Date,
  xp: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  inventory: [
    {
      fishId: { type: mongoose.Schema.Types.ObjectId, ref: "Fish" },
      quantity: { type: Number, default: 1 },
    },
  ],
  invites: { type: Number, default: 0 }, // Track the number of invites
  inviteCodes: [{ code: String, used: { type: Boolean, default: false } }], // Track invite codes
});

// Fish Schema
const fishSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rarity: {
    type: String,
    enum: [
      "common",
      "uncommon",
      "rare",
      "super rare",
      "epic",
      "legendary",
      "mythical",
    ],
  },
  pointValue: { type: Number, required: true },
  probability: { type: Number, required: true },
});

// Create models
const User = mongoose.model("User", userSchema);
const Fish = mongoose.model("Fish", fishSchema);

module.exports = { User, Fish };
