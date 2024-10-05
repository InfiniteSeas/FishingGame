const fetchPolyfill = require("./polyfills");
const { EmbedBuilder } = require("discord.js");
const levels = require("./levels");
const { EMOJIS } = require("./constants");
fetchPolyfill().then(() => {
  require("dotenv").config();
  const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    Routes,
  } = require("discord.js");
  const { REST } = require("@discordjs/rest");
  const mongoose = require("mongoose");
  const { User, Fish, Guild, Spot, SubmittedFish } = require("./schemas"); // Import the User, Fish, Guild, and Spot models

  const TOKEN = process.env.DISCORD_BOT_TOKEN;
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  // MongoDB connection
  mongoose.connect(process.env.MONGODB_URI, {
    dbName: "FishingGame",
  });

  const db = mongoose.connection;
  db.on("error", console.error.bind(console, "MongoDB connection error:"));
  db.once("open", () => {
    console.log("Connected to MongoDB");
  });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });

  const commands = [
    new SlashCommandBuilder()
      .setName("connect")
      .setDescription("Connect to the Infinite Seas game"),
    new SlashCommandBuilder()
      .setName("findspot")
      .setDescription("Find a unique fishing spot"),
    new SlashCommandBuilder()
      .setName("fishing")
      .setDescription("Cast your line without bait"),
    new SlashCommandBuilder()
      .setName("fishingwbait")
      .setDescription(
        "Fish using specific rarities of fish as bait for a higher chance"
      )
      .addIntegerOption((option) =>
        option
          .setName("num")
          .setDescription("The number of baits to use (1-3)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(3)
      )
      .addStringOption((option) =>
        option
          .setName("bait1")
          .setDescription("The rarity of the first bait fish")
          .setRequired(true)
          .addChoices(
            { name: "Common", value: "common" },
            { name: "Uncommon", value: "uncommon" },
            { name: "Rare", value: "rare" },
            { name: "Super Rare", value: "super rare" },
            { name: "Epic", value: "epic" },
            { name: "Legendary", value: "legendary" },
            { name: "Mythical", value: "mythical" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("bait2")
          .setDescription("The rarity of the second bait fish")
          .setRequired(false)
          .addChoices(
            { name: "Common", value: "common" },
            { name: "Uncommon", value: "uncommon" },
            { name: "Rare", value: "rare" },
            { name: "Super Rare", value: "super rare" },
            { name: "Epic", value: "epic" },
            { name: "Legendary", value: "legendary" },
            { name: "Mythical", value: "mythical" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("bait3")
          .setDescription("The rarity of the third bait fish")
          .setRequired(false)
          .addChoices(
            { name: "Common", value: "common" },
            { name: "Uncommon", value: "uncommon" },
            { name: "Rare", value: "rare" },
            { name: "Super Rare", value: "super rare" },
            { name: "Epic", value: "epic" },
            { name: "Legendary", value: "legendary" },
            { name: "Mythical", value: "mythical" }
          )
      ),
    new SlashCommandBuilder()
      .setName("catch")
      .setDescription("Reveal the fish you caught"),
    new SlashCommandBuilder()
      .setName("inventory")
      .setDescription("Display your current fish inventory and XP"),
    new SlashCommandBuilder()
      .setName("exp")
      .setDescription("Check your current experience points (XP)"),
    new SlashCommandBuilder()
      .setName("story")
      .setDescription("Placeholder for future story creation feature"),
    new SlashCommandBuilder()
      .setName("invite")
      .setDescription("Create a guild at your current fishing spot")
      .addStringOption((option) =>
        option
          .setName("guildname")
          .setDescription("The name of your new guild")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("join")
      .setDescription("Join a guild using an invite code")
      .addStringOption((option) =>
        option
          .setName("code")
          .setDescription("The invite code for the guild")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Displays individual and spot-based leaderboards"),
    new SlashCommandBuilder()
      .setName("guildmember")
      .setDescription(
        "Check who is in your guild and how many members are present"
      ),
    new SlashCommandBuilder()
      .setName("quitguild")
      .setDescription("Leave your current guild"),
    new SlashCommandBuilder()
      .setName("whattime")
      .setDescription("Check the countdown time left for this round"),
    new SlashCommandBuilder()
      .setName("fishercount")
      .setDescription("Check how many fishers are at each spot"),
    new SlashCommandBuilder()
      .setName("createfish")
      .setDescription("Customize your most recently caught rare or higher fish")
      .addStringOption((option) =>
        option
          .setName("rarity")
          .setDescription("The rarity of the fish you want to customize")
          .setRequired(true)
          .addChoices(
            { name: "Rare", value: "rare" },
            { name: "Super Rare", value: "super rare" },
            { name: "Epic", value: "epic" },
            { name: "Legendary", value: "legendary" },
            { name: "Mythical", value: "mythical" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("The new name for your fish")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("image")
          .setDescription("The new image URL for your fish")
          .setRequired(true)
      ),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  (async () => {
    try {
      console.log("Started refreshing application (/) commands.");

      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });

      console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
      console.error(error);
    }
  })();

  client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
  });

  const FISHING_COOLDOWN = 1 * 10 * 1000; // 2 minutes in milliseconds

  const baitInfluence = {
    "no bait": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    common: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
    uncommon: [0.9, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
    rare: [0.8, 0.9, 1.2, 1.3, 1.4, 1.5, 1.6],
    "super rare": [0.7, 0.8, 0.9, 1.3, 1.4, 1.5, 1.6],
    epic: [0.6, 0.7, 0.8, 0.9, 1.4, 1.5, 1.6],
    legendary: [0.5, 0.6, 0.7, 0.8, 0.9, 1.5, 1.6],
    mythical: [0.5, 0.5, 0.6, 0.7, 0.8, 0.9, 1.6],
  };

  const DIMINISHING_FACTOR = 0.2;

  function calculateFishProbabilities(baitRarities, spotFishPopulation) {
    const rarityOrder = [
      "common",
      "uncommon",
      "rare",
      "super rare",
      "epic",
      "legendary",
      "mythical",
    ];

    console.log("Bait rarities:", baitRarities);

    // Base weights for each fish rarity
    const baseWeights = [500, 250, 120, 60, 40, 20, 10];

    // Initialize total multipliers to 1 for each rarity
    let totalMultipliers = [1, 1, 1, 1, 1, 1, 1];

    // Apply bait influences with diminishing returns
    baitRarities.forEach((bait, index) => {
      const multipliers = baitInfluence[bait];
      const diminishingFactor = 1 - DIMINISHING_FACTOR * index;

      for (let i = 0; i < multipliers.length; i++) {
        // Calculate additional multiplier beyond 1
        const additionalMultiplier = (multipliers[i] - 1) * diminishingFactor;
        // Add to the total multiplier
        totalMultipliers[i] += additionalMultiplier;
      }
    });

    console.log("Total Multipliers:", totalMultipliers);

    // Calculate adjusted weights
    const adjustedWeights = baseWeights.map(
      (weight, index) => weight * totalMultipliers[index]
    );

    console.log("Adjusted Weights:", adjustedWeights);

    // Sum adjusted weights
    const totalAdjustedWeight = adjustedWeights.reduce((a, b) => a + b, 0);

    // Calculate final probabilities
    const finalProbabilities = adjustedWeights.map(
      (w) => w / totalAdjustedWeight
    );

    console.log("Final Probabilities:", finalProbabilities);

    // Map fishInSpot to probabilities
    const result = spotFishPopulation.map((fishInSpot) => {
      const fish = fishInSpot.fish;
      const fishRarityIndex = rarityOrder.indexOf(fish.rarity.toLowerCase());

      if (fishRarityIndex === -1) {
        console.error(`Unknown rarity: ${fish.rarity} for fish: ${fish.name}`);
        return { fish, probability: 0 };
      }

      // Get the final probability for the fish rarity
      let baseProbability = finalProbabilities[fishRarityIndex];

      // Adjust probability based on the quantity of fish in the spot
      // Using square root to soften the effect of quantity
      let adjustedProbability =
        baseProbability * Math.sqrt(fishInSpot.quantity);

      console.log(
        `Probability for ${fish.name} (${fish.rarity}): ${adjustedProbability}`
      );

      return { fish, probability: adjustedProbability };
    });

    // Normalize probabilities
    const totalProbability = result.reduce(
      (sum, fish) => sum + fish.probability,
      0
    );
    const normalizedResult = result.map((fish) => ({
      ...fish,
      probability:
        totalProbability > 0 ? fish.probability / totalProbability : 0,
    }));

    console.log("Final probabilities:", normalizedResult);

    return normalizedResult;
  }

  async function fishAtSpot(user, baitRarities, spot) {
    console.log("Bait rarities:", baitRarities);
    console.log("Spot:", spot);

    if (!spot || !spot.fishPopulation || !Array.isArray(spot.fishPopulation)) {
      console.error("Invalid spot or fish population");
      return {
        success: false,
        message: "An error occurred while fishing. Please try again.",
      };
    }

    const fishProbabilities = calculateFishProbabilities(
      baitRarities,
      spot.fishPopulation
    );

    console.log("Fish probabilities:", fishProbabilities);

    if (fishProbabilities.every((fish) => fish.probability === 0)) {
      console.error(
        "All fish probabilities are zero. Check probability calculations."
      );
      return {
        success: false,
        message: "An error occurred while fishing. Please try again.",
      };
    }

    let randomNumber = Math.random();
    console.log("Random number:", randomNumber);

    let cumulativeProbability = 0;
    let caughtFish = null;

    for (let fish of fishProbabilities) {
      cumulativeProbability += fish.probability;
      console.log(
        `Cumulative probability for ${fish.fish.name}: ${cumulativeProbability}`
      );
      if (randomNumber <= cumulativeProbability) {
        caughtFish = fish.fish;
        console.log(`Caught fish: ${caughtFish.name}`);
        break;
      }
    }

    if (!caughtFish) {
      console.log("No fish caught");
      return {
        success: false,
        message: "You didn't catch anything this time.",
      };
    }

    console.log("Returning caught fish ID:", caughtFish._id.toString());
    return { success: true, fishId: caughtFish._id.toString() };
  }

  function checkFishingCooldown(user) {
    const now = new Date();
    if (user.lastFishingTime) {
      const timeSinceFishing = now - new Date(user.lastFishingTime);
      if (timeSinceFishing < FISHING_COOLDOWN) {
        const timeLeft = FISHING_COOLDOWN - timeSinceFishing;
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
        return {
          canFish: false,
          message: `You need to wait ${minutesLeft} minute${
            minutesLeft !== 1 ? "s" : ""
          } and ${secondsLeft} second${
            secondsLeft !== 1 ? "s" : ""
          } before using \`/catch\`.`,
        };
      }
    }
    return { canFish: true, message: null };
  }

  function getSpotDescription(spotNumber) {
    const descriptions = [
      `${EMOJIS.SPOTS[1]} A calm bay with crystal clear waters.`,
      `${EMOJIS.SPOTS[2]} A rocky shoreline with crashing waves.`,
      `${EMOJIS.SPOTS[3]} A secluded cove surrounded by lush vegetation.`,
      `${EMOJIS.SPOTS[4]} A deep sea area known for its large fish.`,
      `${EMOJIS.SPOTS[5]} A tropical reef teeming with colorful marine life.`,
      `${EMOJIS.SPOTS[6]} A mysterious underwater cave system.`,
    ];

    // Ensure the spotNumber is within the valid range
    const index = (spotNumber - 1) % descriptions.length;
    return descriptions[index];
  }

  function generateProgressBar(current, max, size = 20) {
    const percentage = current / max;
    const filled = Math.round(size * percentage);
    const empty = size - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  }

  function getAvailablePools(level) {
    if (level >= 20) return [1, 2, 3, 4, 5, 6];
    if (level >= 15) return [1, 2, 3, 4, 5];
    if (level >= 10) return [1, 2, 3, 4];
    if (level >= 5) return [1, 2, 3];
    return [1, 2];
  }

  function getMaxJoinablePool(level) {
    if (level >= 20) return 6;
    if (level >= 15) return 5;
    if (level >= 10) return 5;
    if (level >= 5) return 4;
    return 3;
  }

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      let handled = false;

      switch (commandName) {
        case "connect":
          handled = await handleConnect(interaction);
          break;
        case "findspot":
          handled = await handleFindSpot(interaction);
          break;
        case "fishing":
          handled = await handleFishing(interaction, false);
          break;
        case "fishingwbait":
          handled = await handleFishing(interaction, true);
          break;
        case "catch":
          handled = await handleCatch(interaction);
          break;
        case "whattime":
          handled = await handleWhatTime(interaction);
          break;
        case "inventory":
          handled = await handleInventory(interaction);
          break;
        case "exp":
          handled = await handleExp(interaction);
          break;
        case "story":
          handled = await handleStory(interaction);
          break;
        case "invite":
          handled = await handleInvite(interaction);
          break;
        case "join":
          handled = await handleJoin(interaction);
          break;
        case "fishercount":
          handled = await handleFisherCount(interaction);
          break;
        case "leaderboard":
          handled = await handleLeaderboard(interaction);
          break;
        case "guildmember":
          handled = await handleGuildMember(interaction);
          break;
        case "quitguild":
          handled = await handleQuitGuild(interaction);
          break;
        case "createfish":
          handled = await handleCreateFish(interaction);
          break;
        default:
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "Unknown command",
              ephemeral: true,
            });
          }
          handled = true;
      }

      if (!handled && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Command processed, but no response was sent.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
    }
  });

  async function handleConnect(interaction) {
    try {
      let user = await User.findOne({ discordId: interaction.user.id });

      if (user) {
        await interaction.reply({
          content: "You're already connected to the Infinite Seas!",
          ephemeral: true,
        });
        return true;
      }

      user = new User({
        discordId: interaction.user.id,
        xp: 0,
        inventory: [],
      });

      await user.save();

      await interaction.reply({
        content: `Welcome to the Infinite Seas ${EMOJIS.MISC.SEA} - You're now ready to start your fishing adventure. Use  \`/findspot\` to locate your first fishing spot!`,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleConnect:", error);
      return false;
    }
  }

  const REROLL_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

  async function handleFindSpot(interaction) {
    try {
      let user = await User.findOne({ discordId: interaction.user.id });
      console.log("User found for findspot:", user ? "Yes" : "No");

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      // Check if enough time has passed since the last spot change
      if (
        user.lastRerollTime &&
        Date.now() - user.lastRerollTime < REROLL_COOLDOWN
      ) {
        const timeLeft = REROLL_COOLDOWN - (Date.now() - user.lastRerollTime);
        const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutesLeft = Math.floor(
          (timeLeft % (60 * 60 * 1000)) / (60 * 1000)
        );

        let currentSpotDescription = getSpotDescription(user.currentSpot);
        let currentFisherCount = await User.countDocuments({
          currentSpot: user.currentSpot,
        });

        await interaction.reply({
          content: `You can't change your spot for another ${hoursLeft} hours and ${minutesLeft} minutes. 
  
  You're currently at Fishing Spot #${user.currentSpot}: ${currentSpotDescription} 
  There are ${currentFisherCount} fishers here (including you).
  
Your options:
• ${EMOJIS.ACTIONS.FISHING} \`/fishing\` to cast your line without bait
��� ${EMOJIS.ACTIONS.BAIT} \`/fishingwbait\` to fish using one of your fish as bait for a higher chance
• ${EMOJIS.ACTIONS.INVITE} \`/invite\` to create a guild at this spot
• ${EMOJIS.ACTIONS.GUILD} \`/join\` to move to another fisher's spot (if invited)
• ${EMOJIS.STATS.FISHERCOUNT} \`/fishercount\` to check how many fishers are at each spot`,
          ephemeral: true,
        });
        return true;
      }

      // Determine available pools based on user's level
      const availablePools = getAvailablePools(user.level);

      // Generate a new random spot from available pools
      const newSpot =
        availablePools[Math.floor(Math.random() * availablePools.length)];
      user.previousSpot = user.currentSpot;
      user.currentSpot = newSpot;
      user.lastSpotChangeTime = Date.now();
      await user.save();

      const spotDescription = getSpotDescription(newSpot);

      const { ACTIONS, MISC, STATS } = EMOJIS;
      const responseMessage = `You have arrived at Fishing Spot #${newSpot}: ${spotDescription}

Your options:
• ${ACTIONS.FISHING} \`/fishing\` to cast your line without bait
• ${ACTIONS.BAIT} \`/fishingwbait\` to fish using bait for better chances
• ${ACTIONS.GUILD} \`/invite\` to create a guild at this spot
• ${STATS.LEVEL} \`/fishercount\` to check how many fishers are at each spot

${MISC.TIME} Remember, you can find a new spot again in 12 hours.`;

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleFindSpot:", error);
      return false;
    }
  }

  async function handleFishing(interaction, useBait = false) {
    try {
      let user = await User.findOne({
        discordId: interaction.user.id,
      }).populate("inventory.fishId");
      console.log("User found for fishing:", user ? "Yes" : "No");

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      if (!user.currentSpot) {
        await interaction.reply({
          content:
            "You need to find a fishing spot first! Use `/findspot` to locate a spot.",
          ephemeral: true,
        });
        return true;
      }

      // Check if the user is already fishing
      if (user.pendingCatch && user.pendingCatch.fishId) {
        await interaction.reply({
          content:
            "You're already fishing! Use `/catch` to reel in your current catch before fishing again.",
          ephemeral: true,
        });
        return true;
      }

      let baitRarities = [];
      if (useBait) {
        const numBaits = interaction.options.getInteger("num");

        for (let i = 1; i <= numBaits; i++) {
          const bait = interaction.options.getString(`bait${i}`);
          if (bait) {
            baitRarities.push(bait);
          }
        }

        if (baitRarities.length !== numBaits) {
          await interaction.reply({
            content: `You specified ${numBaits} baits, but only provided ${baitRarities.length}. Please provide the correct number of baits.`,
            ephemeral: true,
          });
          return true;
        }

        for (let bait of baitRarities) {
          const baitFishIndex = user.inventory.findIndex(
            (item) =>
              item.fishId &&
              item.fishId.rarity &&
              item.fishId.rarity.toLowerCase() === bait &&
              item.quantity > 0
          );

          if (baitFishIndex === -1) {
            await interaction.reply({
              content: `You don't have any ${bait} fish to use as bait!`,
              ephemeral: true,
            });
            return true;
          }

          // Remove one fish of the bait rarity from the user's inventory
          user.inventory[baitFishIndex].quantity -= 1;
          if (user.inventory[baitFishIndex].quantity === 0) {
            user.inventory.splice(baitFishIndex, 1);
          }
        }
        await user.save();
        console.log(
          `Removed ${baitRarities.length} fish from user's inventory for bait`
        );
      }

      const spot = await Spot.findOne({
        spotNumber: user.currentSpot,
      }).populate("fishPopulation.fish");
      console.log("Spot found:", spot ? "Yes" : "No");

      if (!spot || spot.fishPopulation.length === 0) {
        await interaction.reply({
          content: "No fish available at this spot.",
          ephemeral: true,
        });
        return true;
      }

      // Use fishAtSpot function with multiple baits
      const fishingResult = await fishAtSpot(user, baitRarities, spot);
      console.log("Fishing result:", fishingResult);

      if (!fishingResult.success) {
        await interaction.reply({
          content: fishingResult.message,
          ephemeral: true,
        });
        return true;
      }

      // Update user's fishing time and pending catch
      const now = Date.now();
      user.lastFishingTime = now;
      user.pendingCatch = {
        time: now,
        fishId: fishingResult.fishId,
        baitUsed: useBait ? baitRarities : null,
      };
      await user.save();
      console.log("Updated user pendingCatch:", user.pendingCatch);

      const cooldownCheck = checkFishingCooldown(user);

      const { ACTIONS, MISC } = EMOJIS;
      let fishingMessage = useBait
        ? `${ACTIONS.FISHING} ${ACTIONS.BAIT} You cast your line with bait and feel a strong tug! `
        : `${ACTIONS.FISHING} You cast your line and feel something bite! `;
      fishingMessage += `${MISC.INFO} The fish will remain hidden until you use \`/catch\` to reel it in. `;
      fishingMessage += `${MISC.TIME} ${cooldownCheck.message}`;

      await interaction.reply({
        content: fishingMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error while fishing:", error);
      await interaction.reply({
        content:
          "An unexpected error occurred while fishing. Please try again.",
        ephemeral: true,
      });
      return false;
    }
  }

  async function handleCatch(interaction) {
    try {
      let user = await User.findOne({
        discordId: interaction.user.id,
      }).populate("guild");
      console.log("User found:", user ? "Yes" : "No");

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      console.log("User current spot:", user.currentSpot);
      if (!user.currentSpot) {
        await interaction.reply({
          content:
            "You need to find a fishing spot first! Use `/findspot` to locate a spot.",
          ephemeral: true,
        });
        return true;
      }

      console.log("User pending catch:", user.pendingCatch);
      if (!user.pendingCatch || !user.pendingCatch.fishId) {
        await interaction.reply({
          content:
            "You don't have any fish on the line. Use `/fishing` to start fishing.",
          ephemeral: true,
        });
        return true;
      }

      const cooldownCheck = checkFishingCooldown(user);
      console.log("Cooldown check:", cooldownCheck);
      if (!cooldownCheck.canFish) {
        await interaction.reply({
          content: cooldownCheck.message,
          ephemeral: true,
        });
        return true;
      }

      console.log("Attempting to find fish with ID:", user.pendingCatch.fishId);
      const caughtFish = await Fish.findById(user.pendingCatch.fishId);
      console.log("Found fish:", caughtFish);

      if (!caughtFish) {
        console.error(
          `Failed to retrieve fish with ID: ${user.pendingCatch.fishId}`
        );
        user.pendingCatch = null;
        await user.save();
        await interaction.reply({
          content:
            "An error occurred while retrieving the fish. Please try fishing again.",
          ephemeral: true,
        });
        return true;
      }

      // Add the caught fish to the user's inventory
      const inventoryItem = user.inventory.find((item) =>
        item.fishId.equals(caughtFish._id)
      );
      if (inventoryItem) {
        inventoryItem.quantity += 1;
      } else {
        user.inventory.push({ fishId: caughtFish._id, quantity: 1 });
      }

      // Calculate XP for the caught fish
      let xpGained = caughtFish.pointValue;

      // Check if user is in a full guild and add bonus XP if so
      if (user.guild && user.guild.members.length === 5) {
        const bonusXP = {
          common: 8,
          uncommon: 15,
          rare: 26,
          "super rare": 43,
          epic: 74,
          legendary: 125,
          mythical: 213,
        };
        xpGained += bonusXP[caughtFish.rarity.toLowerCase()] || 0;
      }

      // Add XP to user
      const oldXP = user.xp;
      user.xp += xpGained;

      // Calculate new level
      let newLevel = user.level;
      while (newLevel < levels.length && user.xp >= levels[newLevel].xp) {
        newLevel++;
      }

      // Check if user leveled up
      let levelUpMessage = "";
      if (newLevel > user.level) {
        levelUpMessage = `Congratulations! You've leveled up to level ${newLevel}!`;
        user.level = newLevel;
      }

      // Calculate XP needed for next level
      const currentLevelXP = levels[user.level - 1].xp;
      const nextLevelXP =
        user.level < levels.length
          ? levels[user.level].xp
          : levels[levels.length - 1].xp;
      const xpForNextLevel = nextLevelXP - user.xp;

      // Calculate progress bar
      const progressBar = generateProgressBar(
        user.xp - currentLevelXP,
        nextLevelXP - currentLevelXP
      );

      // Calculate points needed for next pool
      const nextPoolLevel = Math.ceil(user.level / 5) * 5;
      const xpForNextPool =
        nextPoolLevel <= levels.length
          ? levels[nextPoolLevel - 1].xp - user.xp
          : 0;

      // Clear the pending catch
      user.pendingCatch = null;
      await user.save();
      console.log("User saved after catching fish and updating XP/level");

      // Decrease the fish population in the spot
      const spot = await Spot.findOne({ spotNumber: user.currentSpot });
      console.log("Spot found:", spot ? "Yes" : "No");
      if (spot) {
        const fishIndex = spot.fishPopulation.findIndex((f) =>
          f.fish.equals(caughtFish._id)
        );
        if (fishIndex !== -1) {
          spot.fishPopulation[fishIndex].quantity -= 1;
          if (spot.fishPopulation[fishIndex].quantity <= 0) {
            spot.fishPopulation.splice(fishIndex, 1);
          }
          await spot.save();
          console.log("Spot saved after updating fish population");
        }
      }

      const { FISH, STATS, MISC, ACTIONS } = EMOJIS;
      const emoji = FISH[caughtFish.rarity.toLowerCase()] || "";
      let replyMessage = `${MISC.SUCCESS} Congratulations! You caught a ${emoji} ${caughtFish.name} (${caughtFish.rarity})! It has been added to your inventory. ${STATS.XP} You gained ${xpGained} XP!`;

      if (user.guild && user.guild.members.length === 5) {
        replyMessage += ` ${MISC.INFO} (Includes guild bonus XP!)`;
      }

      if (levelUpMessage) {
        replyMessage += `\n${ACTIONS.LEVEL_UP} ${levelUpMessage}`;
      }

      replyMessage += `\n\n${STATS.LEVEL} Current Level: ${user.level}`;
      replyMessage += `\n${MISC.PROGRESS} Progress: ${progressBar} (${
        user.xp - currentLevelXP
      }/${nextLevelXP - currentLevelXP})`;
      replyMessage += `\n${
        MISC.TIME
      } You are ${xpForNextLevel} XP away from level ${user.level + 1}.`;

      if (xpForNextPool > 0) {
        replyMessage += `\n${ACTIONS.SPOT} You are ${xpForNextPool} XP away from unlocking the next pool at level ${nextPoolLevel}.`;
      } else {
        replyMessage += `\n${MISC.SUCCESS} You have unlocked all available pools!`;
      }

      await interaction.reply({
        content: replyMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleCatch:", error);
      await interaction.reply({
        content: "An unexpected error occurred. Please try again later.",
        ephemeral: true,
      });
      return false;
    }
  }

  async function handleWhatTime(interaction) {
    try {
      const user = await User.findOne({ discordId: interaction.user.id });

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      if (!user.pendingCatch || !user.pendingCatch.fishId) {
        await interaction.reply({
          content:
            "You haven't started fishing yet! Use `/fishing` or `/fishingwbait` to start your adventure.",
          ephemeral: true,
        });
        return true;
      }

      const cooldownCheck = checkFishingCooldown(user);
      console.log("Cooldown check:", cooldownCheck);

      let responseMessage = "";

      if (cooldownCheck.canFish) {
        responseMessage =
          "You can catch your fish now! Use `/catch` to reel it in.";
      } else {
        responseMessage = cooldownCheck.message;
      }

      responseMessage +=
        "\n\nYour line is in the water. Don't forget to use `/catch` when the time comes!";

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleWhatTime:", error);
      await interaction.reply({
        content: "An error occurred while checking the time. Please try again.",
        ephemeral: true,
      });
      return false;
    }
  }

  async function handleInventory(interaction) {
    try {
      const user = await User.findOne({
        discordId: interaction.user.id,
      }).populate("inventory.fishId");

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      if (user.inventory.length === 0) {
        await interaction.reply({
          content: "Your inventory is empty. Go fishing to catch some fish!",
          ephemeral: true,
        });
        return true;
      }

      const { FISH, ACTIONS, STATS } = EMOJIS;
      const inventoryList = user.inventory
        .map((item, index) => {
          const emoji = FISH[item.fishId.rarity.toLowerCase()] || "";
          return `${index + 1}. ${emoji} ${item.fishId.rarity} ${
            item.fishId.name
          } (x${item.quantity})`;
        })
        .join("\n");

      const inventoryMessage = `${ACTIONS.INVENTORY} Your Inventory:
${inventoryList}

${STATS.XP} Total XP: ${user.xp}
${STATS.LEVEL} Current Level: ${user.level}`;

      await interaction.reply({
        content: inventoryMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleInventory:", error);
      await interaction.reply({
        content: "An error occurred while fetching your inventory.",
        ephemeral: true,
      });
      return false;
    }
  }

  async function handleExp(interaction) {
    try {
      const user = await User.findOne({ discordId: interaction.user.id });

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      await interaction.reply({
        content: `${EMOJIS.STATS.XP} Your current XP: ${user.xp}`,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleExp:", error);
      return false;
    }
  }

  async function handleStory(interaction) {
    try {
      const user = await User.findOne({ discordId: interaction.user.id });

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      let storyMessage = `Welcome to the Infinite Seas ${EMOJIS.MISC.SEA} - a vast and mysterious ocean teeming with countless fish species waiting to be discovered. As an adventurous fisher, your journey begins in the calm waters of Pool 1, where you'll hone your skills and learn the basics of fishing.

As you gain experience and level up, you'll unlock access to new, more challenging pools:
• Pools 1 & 2: Available from Level 1
• Pool 3: Unlocks at Level 5
• Pool 4: Unlocks at Level 10
• Pool 5: Unlocks at Level 15
• Pool 6: Unlocks at Level 20

Each pool offers unique fish species and increased chances of rare catches. Remember, you can always return to previous pools or join guilds in pools slightly above your level for added challenge and rewards.

Your current level: ${user.level}
`;

      if (user.level >= 25) {
        storyMessage += `\nCongratulations on reaching Level 25! You've now unlocked the ability to create your own pools. Use the /createpool command to start shaping the Infinite Seas and leave your mark on this vast ocean. (Feature coming soon)`;
      } else {
        storyMessage += `\nAt Level 25, you'll unlock the ability to create your own pools, allowing you to shape the Infinite Seas and leave your mark on this vast ocean. Keep fishing and leveling up!`;
      }

      storyMessage += `\n\nAs you progress, you'll discover rare fish, form powerful guilds, and uncover the secrets hidden beneath the waves. Will you become a legendary fisher, known throughout the Infinite Seas? The adventure awaits!`;

      await interaction.reply({
        content: storyMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleStory:", error);
      return false;
    }
  }

  function generateInviteCode() {
    // Generate a random 6-character alphanumeric code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function handleInvite(interaction) {
    try {
      const user = await User.findOne({
        discordId: interaction.user.id,
      }).populate("guild");

      if (!user) {
        await interaction.reply({
          content: `${EMOJIS.MISC.FAIL} You need to connect first. Use the \`/connect\` command to join the Infinite Seas.`,
          ephemeral: true,
        });
        return true;
      }

      let responseMessage = "";

      if (!user.currentSpot) {
        await interaction.reply({
          content: `${EMOJIS.MISC.WARNING} You need to select a fishing spot before creating a guild. Use the \`/findspot\` command to find a fishing spot.`,
          ephemeral: true,
        });
        return true;
      }

      if (user.guild) {
        // User is already in a guild
        // Fetch all guild members
        const guildMembers = await User.find({ guild: user.guild._id });
        const memberList = guildMembers
          .map(
            (member, index) =>
              `${index + 1}. <@${member.discordId}>${
                member._id.equals(user.guild.host) ? " (Host)" : ""
              }`
          )
          .join("\n");

        const { ACTIONS, MISC, STATS } = EMOJIS;
        responseMessage = `${MISC.INFO} You're already in a guild named "${user.guild.name}".

${ACTIONS.GUILD} Guild Information:
• Members (${guildMembers.length}/${user.guild.maxMembers}):
${memberList}
• ${ACTIONS.SPOT} Fishing Spot: #${user.guild.spot}
• ${ACTIONS.INVITE} Invite Code: ${user.guild.inviteCode}

${MISC.INFO} Share this invite code with others to invite them to your guild!

Your options are:
• ${ACTIONS.GUILD} \`/guildmember\` to check the current guild members
• ${ACTIONS.LEADERBOARD} \`/leaderboard\` to view the standings
• ${ACTIONS.FISHING} \`/fishing\` or \`/fishingwbait\` to continue your adventure
• ${STATS.FISHERCOUNT} \`/fishercount\` to check how many fishers are at each spot`;
      } else {
        // Create a new guild
        const guildName = interaction.options.getString("guildname");
        const inviteCode = generateInviteCode();

        const newGuild = new Guild({
          name: guildName,
          host: user._id,
          members: [user._id],
          spot: user.currentSpot,
          maxMembers: 5,
          inviteCode: inviteCode,
        });

        await newGuild.save();

        user.guild = newGuild._id;
        await user.save();

        const { ACTIONS, MISC, STATS } = EMOJIS;
        responseMessage = `${MISC.SUCCESS} You've established a guild "${guildName}" at ${ACTIONS.SPOT} Fishing Spot #${user.currentSpot}!

${ACTIONS.GUILD} Guild Information:
• Members (1/${newGuild.maxMembers}):
1. <@${user.discordId}> (Host)
• ${ACTIONS.SPOT} Fishing Spot: #${newGuild.spot}
• ${ACTIONS.INVITE} Invite Code: ${inviteCode}

${MISC.INFO} Share this invite code with others to invite them to your guild! Remember, if your guild has more members, your chances of catching better fish will increase!

Your options now are:
• ${ACTIONS.GUILD} \`/guildmember\` to check the current guild members
• ${ACTIONS.LEADERBOARD} \`/leaderboard\` to view the standings
• ${ACTIONS.FISHING} \`/fishing\` or \`/fishingwbait\` to continue your adventure
• ${STATS.FISHERCOUNT} \`/fishercount\` to check how many fishers are at each spot`;
      }

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleInvite:", error);
      await interaction.reply({
        content: `${EMOJIS.MISC.FAIL} An error occurred while processing your request. Please try again later.`,
        ephemeral: true,
      });
      return false;
    }
  }

  async function handleJoin(interaction) {
    try {
      let user = await User.findOne({ discordId: interaction.user.id });

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      const inviteCode = interaction.options.getString("code");
      if (!inviteCode) {
        await interaction.reply({
          content: "Please provide an invite code to join a guild.",
          ephemeral: true,
        });
        return true;
      }

      const guild = await Guild.findOne({ inviteCode: inviteCode });
      if (!guild || !guild.isActive) {
        await interaction.reply({
          content: "Invalid invite code. Please check the code and try again.",
          ephemeral: true,
        });
        return true;
      }

      if (user.guild) {
        await interaction.reply({
          content:
            "You are already in a guild. You must leave your current guild before joining a new one.",
          ephemeral: true,
        });
        return true;
      }

      if (guild.members.length >= guild.maxMembers) {
        await interaction.reply({
          content: "This guild is already full. You cannot join at this time.",
          ephemeral: true,
        });
        return true;
      }

      // Check if the user's level allows them to join this pool
      const maxJoinablePool = getMaxJoinablePool(user.level);
      if (guild.spot > maxJoinablePool) {
        await interaction.reply({
          content: `Your current level (${user.level}) does not allow you to join this pool. You can only join pools up to Pool ${maxJoinablePool}.`,
          ephemeral: true,
        });
        return true;
      }

      // Store the current spot as previous spot before updating
      user.previousSpot = user.currentSpot || null;
      user.guild = guild._id;
      user.currentSpot = guild.spot;
      await user.save();

      guild.members.push(user._id);
      await guild.save();

      const fisherCount = await User.countDocuments({
        currentSpot: guild.spot,
      });

      const { ACTIONS, MISC, STATS } = EMOJIS;
      const responseMessage = `${MISC.SUCCESS} You've joined the guild "${
        guild.name
      }" at ${ACTIONS.SPOT} Fishing Spot #${guild.spot} with ${
        fisherCount - 1
      } other adventurers. Your fishing spot has been updated to match the guild's spot. If you leave the guild, you'll return to ${
        user.previousSpot ? `Spot #${user.previousSpot}` : "no specific spot"
      }. ${
        MISC.INFO
      } Remember, the more guild members you have, the higher your chances of catching better fish!

Your options:
• ${ACTIONS.FISHING} \`/fishing\` to start fishing without bait
• ${ACTIONS.BAIT} \`/fishingwbait\` to fish using bait for a higher chance
• ${ACTIONS.GUILD} \`/guildmember\` to check your guild members
• ${
        STATS.FISHERCOUNT
      } \`/fishercount\` to check how many fishers are at each spot`;

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleJoin:", error);
      return false;
    }
  }

  function getSpotDescription(spotNumber) {
    const descriptions = [
      `A calm bay with crystal clear waters.`,
      `A rocky shoreline with crashing waves.`,
      `A secluded cove surrounded by lush vegetation.`,
      `A deep sea area known for its large fish.`,
      `A tropical reef teeming with colorful marine life.`,
      `A mysterious underwater cave system.`,
    ];

    const index = (spotNumber - 1) % descriptions.length;
    return (
      descriptions[index] || `${EMOJIS.ACTIONS.SPOT} Unknown fishing spot.`
    );
  }

  async function handleFisherCount(interaction) {
    try {
      const user = await User.findOne({ discordId: interaction.user.id });

      if (!user) {
        await interaction.reply({
          content: `${EMOJIS.MISC.FAIL} You need to connect first. Use the \`/connect\` command to join the Infinite Seas.`,
          ephemeral: true,
        });
        return true;
      }

      const fisherCounts = await User.aggregate([
        { $group: { _id: "$currentSpot", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const { ACTIONS, MISC, STATS } = EMOJIS;
      let responseMessage = `${STATS.FISHERCOUNT} Here's the current status of each fishing spot:\n\n`;

      fisherCounts.forEach((spot) => {
        const spotEmoji = EMOJIS.SPOTS[spot._id] || EMOJIS.ACTIONS.SPOT;
        const spotDescription = getSpotDescription(spot._id);
        console.log(`Spot #${spot._id} description:`, spotDescription); // Add this line for debugging

        // Remove the split and use the full description
        responseMessage += `${spotEmoji} Spot #${spot._id} - ${spotDescription}\n`;
        responseMessage += `   ${STATS.FISHERCOUNT} Fishers: ${spot.count}\n\n`;
      });

      responseMessage += `\n${MISC.INFO} Remember, the more fishers at a spot, the lower the probability of catching rare fish!`;

      responseMessage += `\n\nYour options:
• ${ACTIONS.SPOT} \`/findspot\` to move to a new fishing spot
• ${ACTIONS.FISHING} \`/fishing\` or \`/fishingwbait\` to start fishing
• ${ACTIONS.GUILD} \`/invite\` to create or manage your guild
• ${ACTIONS.INVENTORY} \`/inventory\` to check your catches`;

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleFisherCount:", error);
      await interaction.reply({
        content: `${EMOJIS.MISC.FAIL} An error occurred while fetching fisher counts. Please try again later.`,
        ephemeral: true,
      });
      return false;
    }
  }

  async function handleLeaderboard(interaction) {
    try {
      const user = await User.findOne({ discordId: interaction.user.id });

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      // Fetch top 100 users by XP
      const topUsers = await User.find().sort({ xp: -1 }).limit(100);

      // Fetch top 100 spots
      const topSpots = await User.aggregate([
        { $group: { _id: "$currentSpot", totalXP: { $sum: "$xp" } } },
        { $sort: { totalXP: -1 } },
        { $limit: 100 },
      ]);

      // Create embeds for leaderboards
      const individualLeaderboard = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Individual Leaderboard")
        .setDescription(
          topUsers
            .map(
              (user, index) =>
                `${index + 1}. <@${user.discordId}>: ${user.xp} XP`
            )
            .join("\n")
        );

      const spotLeaderboard = new EmbedBuilder()
        .setColor("#00ff99")
        .setTitle("Spot Leaderboard")
        .setDescription(
          topSpots
            .map(
              (spot, index) =>
                `${index + 1}. Spot #${spot._id}: ${spot.totalXP} XP`
            )
            .join("\n")
        );

      const embeds = [individualLeaderboard, spotLeaderboard];

      // If user is in a guild, add guild leaderboard
      if (user.guild) {
        const guild = await Guild.findById(user.guild).populate("members");
        if (guild) {
          const guildMembers = guild.members.sort((a, b) => b.xp - a.xp);
          const guildLeaderboard = new EmbedBuilder()
            .setColor("#ff9900")
            .setTitle(`Guild Leaderboard: ${guild.name}`)
            .setDescription(
              guildMembers
                .map(
                  (member, index) =>
                    `${index + 1}. <@${member.discordId}>: ${member.xp} XP`
                )
                .join("\n")
            );
          embeds.push(guildLeaderboard);
        }
      }

      await interaction.reply({ embeds: embeds, ephemeral: true });
      return true;
    } catch (error) {
      console.error("Error in handleLeaderboard:", error);
      return false;
    }
  }

  async function handleGuildMember(interaction) {
    try {
      const user = await User.findOne({
        discordId: interaction.user.id,
      }).populate("guild");

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      if (!user.guild) {
        await interaction.reply({
          content: "You are not a member of any guild.",
          ephemeral: true,
        });
        return true;
      }

      // Fetch all guild members
      const guildMembers = await User.find({ guild: user.guild._id });
      const memberList = guildMembers
        .map(
          (member, index) =>
            `${index + 1}. <@${member.discordId}>${
              member._id.equals(user.guild.host) ? " (Host)" : ""
            }`
        )
        .join("\n");

      const responseMessage = `Your guild "${user.guild.name}":

${EMOJIS.ACTIONS.GUILD} Guild Information:
• Members (${guildMembers.length}/${user.guild.maxMembers}):
${memberList}
• Fishing Spot: #${user.guild.spot}
• Invite Code: ${user.guild.inviteCode}

Share this invite code with others to invite them to your guild!

Your options:
• ${EMOJIS.ACTIONS.LEADERBOARD} \`/leaderboard\` to view the standings
• ${EMOJIS.ACTIONS.FISHING} \`/fishing\` or \`/fishingwbait\` to continue your adventure
• ${EMOJIS.STATS.FISHERCOUNT} \`/fishercount\` to check how many fishers are at each spot
• ${EMOJIS.ACTIONS.QUIT} \`/quitguild\` to leave the guild`;

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleGuildMember:", error);
      return false;
    }
  }

  async function handleQuitGuild(interaction) {
    try {
      const user = await User.findOne({
        discordId: interaction.user.id,
      }).populate("guild");

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      if (!user.guild) {
        await interaction.reply({
          content: "You are not a member of any guild.",
          ephemeral: true,
        });
        return true;
      }

      const guildName = user.guild.name;
      const guildSpot = user.guild.spot;

      // Remove user from the guild
      await Guild.updateOne(
        { _id: user.guild._id },
        { $pull: { members: user._id } }
      );

      // Update user document
      user.guild = null;
      if (user.previousSpot) {
        user.currentSpot = user.previousSpot;
        user.previousSpot = null;
      }
      // If previousSpot is null, keep the user at their current spot
      await user.save();

      const { ACTIONS, MISC } = EMOJIS;
      let responseMessage = `${MISC.SUCCESS} You have successfully left the guild "${guildName}". `;
      responseMessage += `${ACTIONS.SPOT} You are now at Fishing Spot #${user.currentSpot}.`;

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleQuitGuild:", error);
      return false;
    }
  }

  async function handleCreateFish(interaction) {
    try {
      const user = await User.findOne({
        discordId: interaction.user.id,
      }).populate("inventory.fishId");

      if (!user) {
        await interaction.reply({
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      const selectedRarity = interaction.options.getString("rarity");
      const newName = interaction.options.getString("name");
      const newImage = interaction.options.getString("image");

      // Find the first non-customized fish of the selected rarity
      const selectedFish = user.inventory.find(
        (item) =>
          item.fishId.rarity.toLowerCase() === selectedRarity &&
          !item.fishId.customized
      );

      if (!selectedFish) {
        await interaction.reply({
          content: `You don't have any non-customized ${selectedRarity} fish in your inventory to customize.`,
          ephemeral: true,
        });
        return true;
      }

      const fish = selectedFish.fishId;

      // Create a new submitted fish entry
      const submittedFish = new SubmittedFish({
        userId: user._id,
        originalFishId: fish._id,
        name: newName,
        image: newImage,
        rarity: fish.rarity,
      });

      await submittedFish.save();

      // Mark the original fish as customized
      fish.customized = true;
      await fish.save();

      await interaction.reply({
        content: `${EMOJIS.MISC.SUCCESS} The ancient magics of the sea heed your call! 
${emoji} Your ${fish.rarity} ${fish.name} has been transformed into a creature of legend!
${EMOJIS.ACTIONS.CUSTOMIZE} It shall henceforth be known as "${newName}"
${EMOJIS.MISC.INFO} The Council of Tides will review your creation before it takes its place in the annals of the Infinite Seas.

Use \`/inventory\` to view your customized fish.`,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleCreateFish:", error);
      await interaction.reply({
        content:
          "An error occurred while customizing your fish. Please try again later.",
        ephemeral: true,
      });
      return false;
    }
  }

  client.login(TOKEN);
});
