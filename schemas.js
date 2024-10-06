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
  originalFishId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Fish",
    default: null,
  },
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
  previousSpot: Number,
  lastFishTime: Date,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  inventory: [
    {
      fish: { type: mongoose.Schema.Types.ObjectId, ref: "Fish" },
      customized: { type: Boolean, default: false },
      customName: { type: String, default: null },
      customImage: { type: String, default: null },
      caughtAt: { type: Date, default: Date.now },
    },
  ],
  pendingCatch: {
    fishId: { type: mongoose.Schema.Types.ObjectId, ref: "Fish" },
    catchTime: { type: Date },
  },
  guild: { type: mongoose.Schema.Types.ObjectId, ref: "Guild" },
  lastFishingTime: { type: Date, default: null },
  lastRerollTime: { type: Date, default: null },
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

// Submitted Fish Schema
const submittedFishSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  originalFishId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Fish",
    required: true,
  },
  name: { type: String, required: true },
  image: { type: String, required: true },
  rarity: {
    type: String,
    enum: ["rare", "super rare", "epic", "legendary", "mythical"],
    required: true,
  },
  submittedAt: { type: Date, default: Date.now },
  approved: { type: Boolean, default: false },
  approvedAt: { type: Date, default: null },
});

const SubmittedFish = mongoose.model("SubmittedFish", submittedFishSchema);

// Create models
const Fish = mongoose.model("Fish", fishSchema);
const Spot = mongoose.model("Spot", spotSchema);
const User = mongoose.model("User", userSchema);
const Guild = mongoose.model("Guild", guildSchema);

module.exports = { Fish, Spot, User, Guild, SubmittedFish };
