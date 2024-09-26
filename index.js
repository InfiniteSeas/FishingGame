const fetchPolyfill = require("./polyfills");
const { EmbedBuilder } = require("discord.js");
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
  const { User, Fish, Guild, Spot } = require("./schemas"); // Import the User, Fish, Guild, and Spot models
  const { v4: uuidv4 } = require("uuid"); // Import UUID for generating invite codes

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
        "Fish using a specific rarity of fish as bait for a higher chance"
      )
      .addStringOption((option) =>
        option
          .setName("bait")
          .setDescription("The rarity of fish to use as bait")
          .setRequired(true)
          .addChoices(
            { name: "Common", value: "Common" },
            { name: "Uncommon", value: "Uncommon" },
            { name: "Rare", value: "Rare" },
            { name: "Super Rare", value: "Super Rare" },
            { name: "Epic", value: "Epic" },
            { name: "Legendary", value: "Legendary" },
            { name: "Mythical", value: "Mythical" }
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

  const fishProbabilities = {
    "no bait": [0.5, 0.25, 0.12, 0.06, 0.04, 0.02, 0.01],
    common: [0.5, 0.25, 0.12, 0.06, 0.04, 0.02, 0.01],
    uncommon: [0.4, 0.3, 0.15, 0.08, 0.04, 0.02, 0.01],
    rare: [0.3, 0.3, 0.18, 0.1, 0.06, 0.04, 0.02],
    "super rare": [0.2, 0.28, 0.2, 0.12, 0.08, 0.06, 0.04],
    epic: [0.15, 0.25, 0.22, 0.14, 0.1, 0.08, 0.04],
    legendary: [0.1, 0.2, 0.24, 0.15, 0.12, 0.1, 0.04],
    mythical: [0.05, 0.15, 0.2, 0.18, 0.15, 0.12, 0.1],
  };

  function adjustProbabilitiesForGuildSize(probabilities, guildSize) {
    const baseAdjustment = 0.05; // 5% base adjustment per guild member
    const maxGuildSize = 5;
    const effectiveGuildSize = Math.min(guildSize, maxGuildSize) - 1;

    return probabilities.map((prob, index) => {
      const rarityFactor =
        (probabilities.length - index) / probabilities.length;
      const adjustment = baseAdjustment * effectiveGuildSize * rarityFactor;

      if (index === 0) {
        return Math.max(0.1, prob - adjustment); // Ensure Common doesn't go below 10%
      } else {
        return prob + adjustment / (probabilities.length - 1);
      }
    });
  }

  function calculateFishProbabilities(
    baitRarity,
    spotFishPopulation,
    guildSize = 1
  ) {
    const rarityOrder = [
      "common",
      "uncommon",
      "rare",
      "super rare",
      "epic",
      "legendary",
      "mythical",
    ];

    const baitType = baitRarity ? baitRarity.toLowerCase() : "no bait";
    console.log("Bait type:", baitType);

    const baitProbabilities =
      fishProbabilities[baitType] || fishProbabilities["no bait"];
    console.log("Bait probabilities:", baitProbabilities);

    // Adjust probabilities based on guild size
    const adjustedBaitProbabilities = adjustProbabilitiesForGuildSize(
      baitProbabilities,
      guildSize
    );
    console.log("Adjusted bait probabilities:", adjustedBaitProbabilities);

    const result = spotFishPopulation.map((fishInSpot) => {
      const fish = fishInSpot.fish;
      const fishRarityIndex = rarityOrder.indexOf(fish.rarity.toLowerCase());

      if (fishRarityIndex === -1) {
        console.error(`Unknown rarity: ${fish.rarity} for fish: ${fish.name}`);
        return { fish, probability: 0 };
      }

      // Get the base probability from the bait probabilities
      let baseProbability = adjustedBaitProbabilities[fishRarityIndex];

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

  async function fishAtSpot(user, baitRarity, spot, guildSize) {
    console.log("Bait rarity:", baitRarity);
    console.log("Spot:", spot);
    console.log("Guild size:", guildSize);

    if (!spot || !spot.fishPopulation || !Array.isArray(spot.fishPopulation)) {
      console.error("Invalid spot or fish population");
      return {
        success: false,
        message: "An error occurred while fishing. Please try again.",
      };
    }

    const fishProbabilities = calculateFishProbabilities(
      baitRarity,
      spot.fishPopulation,
      guildSize
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

  function getXPForFish(rarity) {
    switch (rarity.toLowerCase()) {
      case "common":
        return 10;
      case "uncommon":
        return 25;
      case "rare":
        return 50;
      case "super rare":
        return 100;
      case "epic":
        return 200;
      case "legendary":
        return 500;
      case "mythical":
        return 1000;
      default:
        return 10;
    }
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
          } before using /catch.`,
        };
      }
    }
    return { canFish: true, message: null };
  }

  function getSpotDescription(spotNumber) {
    const descriptions = [
      "A calm bay with crystal clear waters.",
      "A rocky shoreline with crashing waves.",
      "A secluded cove surrounded by lush vegetation.",
      "A deep sea area known for its large fish.",
      "A tropical reef teeming with colorful marine life.",
      "A mysterious underwater cave system.",
    ];

    // Ensure the spotNumber is within the valid range
    const index = (spotNumber - 1) % descriptions.length;
    return descriptions[index];
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
        content:
          "Welcome to the Infinite Seas! You're now ready to start your fishing adventure. Use `/findspot` to locate your first fishing spot!",
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleConnect:", error);
      return false;
    }
  }

  async function handleFindSpot(interaction) {
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

      const findNew = interaction.options.getBoolean("new") || false;

      // If user is in a spot and doesn't want a new one, just inform them of their current spot
      if (user.currentSpot && !findNew) {
        const spotDescription = getSpotDescription(user.currentSpot);
        const fisherCount = await User.countDocuments({
          currentSpot: user.currentSpot,
        });

        await interaction.reply({
          content: `You're at Fishing Spot #${user.currentSpot}: ${spotDescription} There are currently ${fisherCount} fishers here (including you). 

Your options:
• /fishing to cast your line without bait
• /fishingwbait to fish using one of your fish as bait for a higher chance
• /invite to create a guild at this spot
• /join to move to another fisher's spot
• /fishercount to check how many fishers are at each spot

If you want to find a new spot, use /findspot new:true`,
          ephemeral: true,
        });
        return true;
      }

      // Generate a new random spot (1-6)
      const newSpot = Math.floor(Math.random() * 6) + 1;

      // Update user's spot
      user.currentSpot = newSpot;
      await user.save();

      const spotDescription = getSpotDescription(newSpot);
      const fisherCount = await User.countDocuments({ currentSpot: newSpot });

      const responseMessage = `You have arrived at Fishing Spot #${newSpot}: ${spotDescription} There are currently ${fisherCount} fishers here (including you). The more people at a spot, the lower your chances of catching rare fish!

Your options:
• /fishing to cast your line without bait
• /fishingwbait to fish using one of your fish as bait for a higher chance
• /invite to create a guild at this spot
• /join to move to another fisher's spot
• /fishercount to check how many fishers are at each spot`;

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

      let baitRarity = null;
      if (useBait) {
        baitRarity = interaction.options.getString("bait");
        console.log("Selected bait rarity:", baitRarity);

        // Check if the user has a fish of the selected rarity
        const baitFishIndex = user.inventory.findIndex(
          (item) =>
            item.fishId &&
            item.fishId.rarity &&
            item.fishId.rarity.toLowerCase() === baitRarity.toLowerCase() &&
            item.quantity > 0
        );

        if (baitFishIndex === -1) {
          await interaction.reply({
            content: `You don't have any ${baitRarity} fish to use as bait!`,
            ephemeral: true,
          });
          return true;
        }

        // Remove one fish of the bait rarity from the user's inventory
        user.inventory[baitFishIndex].quantity -= 1;
        if (user.inventory[baitFishIndex].quantity === 0) {
          user.inventory.splice(baitFishIndex, 1);
        }
        await user.save();
        console.log(
          `Removed one ${baitRarity} fish from user's inventory for bait`
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

      const guild = await Guild.findOne({ _id: user.guild });
      const guildSize = guild ? guild.members.length : 1;

      console.log("Guild size:", guildSize);

      // Use fishAtSpot function
      const fishingResult = await fishAtSpot(user, baitRarity, spot, guildSize);
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
        baitUsed: useBait ? baitRarity : null,
      };
      await user.save();
      console.log("Updated user pendingCatch:", user.pendingCatch);

      const cooldownCheck = checkFishingCooldown(user);

      let fishingMessage = useBait
        ? "🎣 You cast your line with bait and feel a strong tug! "
        : "🎣 You cast your line and feel something bite! ";
      fishingMessage += `The fish will remain hidden until you use \`/catch\` to reel it in. `;
      fishingMessage += cooldownCheck.message;

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
      let user = await User.findOne({ discordId: interaction.user.id });
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

      // Add XP for the caught fish
      const xpGained = getXPForFish(caughtFish.rarity);
      user.xp += xpGained;

      // Clear the pending catch
      user.pendingCatch = null;
      await user.save();
      console.log("User saved after catching fish");

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

      await interaction.reply({
        content: `Congratulations! You caught a ${caughtFish.name} (${caughtFish.rarity})! It has been added to your inventory. You gained ${xpGained} XP!`,
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

      const inventoryItems = await Promise.all(
        user.inventory.map(async (item) => {
          const fish = item.fishId;
          if (!fish) {
            console.error(`Fish not found for inventory item: ${item}`);
            return `Unknown Fish: ${item.quantity}`;
          }
          return `${fish.name} (${fish.rarity}): ${item.quantity}`;
        })
      );

      const totalXP = user.xp;

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${interaction.user.username}'s Inventory`)
        .setDescription(inventoryItems.join("\n"))
        .addFields({
          name: "Total XP",
          value: totalXP.toString(),
          inline: true,
        });

      await interaction.reply({ embeds: [embed], ephemeral: true });
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
        content: `Your current XP: ${user.xp}`,
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

      const storyContent = `In the vast expanse of the Infinite Seas, legends speak of ancient underwater civilizations and mythical creatures that dwell in its depths. As you cast your line into these mysterious waters, you're not just fishing – you're unraveling the secrets of a world beneath the waves.

Some say the fish here are descendants of long-lost magical beings, each scale telling a story of ages past. Others whisper of hidden treasures and sunken cities waiting to be discovered by those brave enough to explore the deepest trenches.

Your journey as a fisher is more than just a quest for the biggest catch. It's an adventure that will test your skills, forge new friendships in guilds, and perhaps even shape the future of these endless waters.

What mysteries will you uncover? What legendary creatures will you encounter? The Infinite Seas await your exploration, brave fisher!`;

      const responseMessage = `Here's a glimpse into the Infinite Seas:

${storyContent}

As you continue your journey, more will be revealed!`;

      await interaction.reply({
        content: responseMessage,
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
          content:
            "You need to connect first. Use the `/connect` command to join the Infinite Seas.",
          ephemeral: true,
        });
        return true;
      }

      let responseMessage = "";

      if (!user.currentSpot) {
        await interaction.reply({
          content:
            "You need to select a fishing spot before creating a guild. Use the `/findspot` command to find a fishing spot.",
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

        responseMessage = `You're already in a guild named "${user.guild.name}".

Guild Information:
• Members (${guildMembers.length}/${user.guild.maxMembers}):
${memberList}
• Fishing Spot: #${user.guild.spot}
• Invite Code: ${user.guild.inviteCode}

Share this invite code with others to invite them to your guild!

Your options are:
• /guildmember to check the current guild members
• /leaderboard to view the standings
• /fishing or /fishingwbait to continue your adventure
• /fishercount to check how many fishers are at each spot`;
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

        responseMessage = `You've established a guild "${guildName}" at Fishing Spot #${user.currentSpot}!

Guild Information:
• Members (1/${newGuild.maxMembers}):
1. <@${user.discordId}> (Host)
• Fishing Spot: #${newGuild.spot}
• Invite Code: ${inviteCode}

Share this invite code with others to invite them to your guild! Remember, if your guild has more members, your chances of catching better fish will increase!

Your options now are:
• /guildmember to check the current guild members
• /leaderboard to view the standings
• /fishing or /fishingwbait to continue your adventure
• /fishercount to check how many fishers are at each spot`;
      }

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleInvite:", error);
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

      const responseMessage = `You've joined the guild "${
        guild.name
      }" at Fishing Spot #${guild.spot} with ${
        fisherCount - 1
      } other adventurers. Your fishing spot has been updated to match the guild's spot. If you leave the guild, you'll return to ${
        user.previousSpot ? `Spot #${user.previousSpot}` : "no specific spot"
      }. Remember, the more guild members you have, the higher your chances of catching better fish!

Your options:
• /fishing to start fishing without bait
• /fishingwbait to fish using bait for a higher chance
• /guildmember to check your guild members
• /fishercount to check how many fishers are at each spot`;

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

  async function handleFisherCount(interaction) {
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

      const fisherCounts = await User.aggregate([
        { $group: { _id: "$currentSpot", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      let responseMessage = "Here's the current status of each fishing spot:\n";
      fisherCounts.forEach((spot) => {
        responseMessage += `    Spot #${spot._id}: ${spot.count} fisher${
          spot.count !== 1 ? "s" : ""
        }\n`;
      });

      responseMessage +=
        "\nRemember, the more fishers at a spot, the lower the probability of catching rare fish!";

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });
      return true;
    } catch (error) {
      console.error("Error in handleFisherCount:", error);
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

Guild Information:
• Members (${guildMembers.length}/${user.guild.maxMembers}):
${memberList}
• Fishing Spot: #${user.guild.spot}
• Invite Code: ${user.guild.inviteCode}

Share this invite code with others to invite them to your guild!

Your options:
• /leaderboard to view the standings
• /fishing or /fishingwbait to continue your adventure
• /fishercount to check how many fishers are at each spot
• /quitguild to leave the guild`;

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

      const guild = user.guild;
      const isHost = guild.host.equals(user._id);

      if (isHost) {
        // If the user is the host, disable the guild and remove all members
        const guildMembers = await User.find({ guild: guild._id });

        // Update all guild members
        for (const member of guildMembers) {
          member.guild = null;
          member.currentSpot = member.previousSpot || null;
          member.previousSpot = null;
          await member.save();
        }

        // Disable the guild
        guild.isActive = false;
        guild.disbandedAt = new Date();
        guild.members = [];
        await guild.save();

        await interaction.reply({
          content: `As the host, you have disbanded the guild "${guild.name}". All members have been returned to their previous fishing spots.`,
          ephemeral: true,
        });
        return true;
      }

      const guildName = user.guild.name;
      await Guild.updateOne(
        { _id: user.guild._id },
        { $pull: { members: user._id } }
      );

      user.currentSpot = user.previousSpot;
      user.previousSpot = null;
      user.guild = null;
      await user.save();

      let responseMessage = `You have successfully left the guild "${guildName}". `;
      if (user.currentSpot) {
        responseMessage += `You have returned to Fishing Spot #${user.currentSpot}.`;
      } else {
        responseMessage += `You are not at any specific fishing spot. Use /findspot to find a new spot.`;
      }

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

  client.login(TOKEN);
});
