const mongoose = require("mongoose");
const { Fish, Spot } = require("./schemas");

mongoose.connect(
  "mongodb+srv://sunil07t:K8lClGgNA4YJZk88@cluster0.hs60tch.mongodb.net/",
  {
    dbName: "FishingGame",
  }
);

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
  } catch (error) {
    console.error("Error populating fish data:", error);
  }
};

const populateSpots = async () => {
  try {
    await Spot.deleteMany({});
    const allFish = await Fish.find();

    const baseQuantity = 1000000; // You can adjust this number as needed

    for (let i = 1; i <= 6; i++) {
      const fishPopulation = allFish.map((fish) => {
        const quantity = Math.round(baseQuantity * fish.probability);
        return {
          fish: fish._id,
          quantity: quantity,
        };
      });

      const spot = new Spot({
        spotNumber: i,
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
