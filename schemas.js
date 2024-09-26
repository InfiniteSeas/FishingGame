const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

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
    required: true,
  },
  pointValue: { type: Number, required: true },
  probability: { type: Number, required: true },
});

// Spot Schema
const spotSchema = new mongoose.Schema({
  spotNumber: Number,
  fishPopulation: [
    {
      fish: { type: mongoose.Schema.Types.ObjectId, ref: "Fish" },
      quantity: Number,
    },
  ],
});

// User Schema
const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  currentSpot: Number,
  previousSpot: Number, // Add this line
  lastFishTime: Date,
  xp: { type: Number, default: 0 },
  inventory: [
    {
      fishId: { type: mongoose.Schema.Types.ObjectId, ref: "Fish" },
      quantity: Number,
    },
  ],
  pendingCatch: {
    fishId: { type: mongoose.Schema.Types.ObjectId, ref: "Fish" },
    catchTime: { type: Date },
  },
  guild: { type: mongoose.Schema.Types.ObjectId, ref: "Guild" },
  lastFishingTime: { type: Date, default: null },
});

// Guild Schema (if you decide to implement guilds)
const guildSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  maxMembers: { type: Number, default: 5 },
  spot: Number,
  inviteCode: { type: String, required: true, unique: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isActive: { type: Boolean, default: true },
  disbandedAt: { type: Date, default: null },
});

// Create models
const Fish = mongoose.model("Fish", fishSchema);
const Spot = mongoose.model("Spot", spotSchema);
const User = mongoose.model("User", userSchema);
const Guild = mongoose.model("Guild", guildSchema);

module.exports = { Fish, Spot, User, Guild };
