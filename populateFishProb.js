const mongoose = require("mongoose");
const { Fish } = require("./schemas");

mongoose.connect(process.env.MONGODB_URI, {
  dbName: "FishingGame",
});

const fishData = [
  { name: "Common Fish", rarity: "common", pointValue: 10, probability: 0.5 },
  {
    name: "Uncommon Fish",
    rarity: "uncommon",
    pointValue: 20,
    probability: 0.25,
  },
  { name: "Rare Fish", rarity: "rare", pointValue: 30, probability: 0.12 },
  {
    name: "Super Rare Fish",
    rarity: "super rare",
    pointValue: 40,
    probability: 0.06,
  },
  { name: "Epic Fish", rarity: "epic", pointValue: 50, probability: 0.04 },
  {
    name: "Legendary Fish",
    rarity: "legendary",
    pointValue: 60,
    probability: 0.02,
  },
  {
    name: "Mythical Fish",
    rarity: "mythical",
    pointValue: 70,
    probability: 0.01,
  },
];

const populateFish = async () => {
  try {
    await Fish.deleteMany({});
    await Fish.insertMany(fishData);
    console.log("Fish data populated successfully.");
    mongoose.connection.close();
  } catch (error) {
    console.error("Error populating fish data:", error);
    mongoose.connection.close();
  }
};

populateFish();
