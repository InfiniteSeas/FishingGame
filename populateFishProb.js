const mongoose = require("mongoose");
const { Fish, Spot } = require("./schemas");
const poolDistributions = require("./poolDistributions");

mongoose.connect(
  "mongodb+srv://sunil07t:K8lClGgNA4YJZk88@cluster0.hs60tch.mongodb.net/",
  {
    dbName: "FishingGame",
  }
);

const fishData = [
  {
    name: "Spiny Pufferfish",
    rarity: "common",
    pointValue: 15,
    probability: 0.5,
    emoji: "🐡", // Pufferfish emoji
  },
  {
    name: "Tropical Clownfish",
    rarity: "uncommon",
    pointValue: 30,
    probability: 0.25,
    emoji: "🐠", // Tropical fish emoji
  },
  {
    name: "Silver Herring",
    rarity: "rare",
    pointValue: 51,
    probability: 0.12,
    emoji: "🐟", // Generic fish emoji
  },
  {
    name: "Great White Shark",
    rarity: "super rare",
    pointValue: 87,
    probability: 0.06,
    emoji: "🦈", // Shark emoji
  },
  {
    name: "Blue Whale",
    rarity: "epic",
    pointValue: 147,
    probability: 0.04,
    emoji: "🐋", // Whale emoji
  },
  {
    name: "Mythic Sea Dragon",
    rarity: "legendary",
    pointValue: 251,
    probability: 0.02,
    emoji: "🐉", // Dragon emoji
  },
  {
    name: "Celestial Starfish",
    rarity: "mythical",
    pointValue: 426,
    probability: 0.01,
    emoji: "🌟", // Star emoji
  },
];

const populateFish = async () => {
  try {
    await Fish.deleteMany({});
    await Fish.insertMany(fishData);
    console.log("Fish data populated successfully.");
  } catch (error) {
    console.error("Error populating fish data:", error);
  }
};

const populateSpots = async () => {
  try {
    await Spot.deleteMany({});
    const allFish = await Fish.find();

    const baseQuantity = 1000000; // 1M fish per pool

    for (let poolData of poolDistributions) {
      const fishPopulation = [];

      for (let [rarity, probability] of Object.entries(poolData.distribution)) {
        if (rarity !== "empty") {
          const fish = allFish.find((f) => f.rarity.toLowerCase() === rarity);
          if (fish) {
            const quantity = Math.round(baseQuantity * probability);
            fishPopulation.push({
              fish: fish._id,
              quantity: quantity,
            });
          }
        }
      }

      const spot = new Spot({
        spotNumber: poolData.poolNumber,
        fishPopulation: fishPopulation,
      });

      await spot.save();
    }

    console.log("Spots populated successfully");
  } catch (error) {
    console.error("Error populating spots:", error);
  }
};

const populateAll = async () => {
  await populateFish();
  await populateSpots();
  console.log("All data populated successfully");
  mongoose.connection.close();
};

populateAll();
