const fetchPolyfill = require("./polyfills");
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
  const { User, Fish } = require("./schemas"); // Import the User and Fish models
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
      .setDescription("Connect your wallet address")
      .addStringOption((option) =>
        option
          .setName("wallet")
          .setDescription("Your wallet address")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("roll")
      .setDescription("Get assigned to a random fishing spot"),
    new SlashCommandBuilder()
      .setName("fish")
      .setDescription("Fish at your assigned spot and receive a random fish"),
    new SlashCommandBuilder()
      .setName("bait")
      .setDescription("Use a fish as bait to catch a higher-ranked fish")
      .addStringOption((option) =>
        option
          .setName("fish")
          .setDescription("The name of the fish to use as bait")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("inventory")
      .setDescription("Display your current fish inventory, points, and XP"),
    new SlashCommandBuilder()
      .setName("exp")
      .setDescription("Display your current XP"),
    new SlashCommandBuilder()
      .setName("story")
      .setDescription("Placeholder for future story creation feature"),
    new SlashCommandBuilder()
      .setName("guild")
      .setDescription("Generate a unique invite code to share with friends"),
    new SlashCommandBuilder()
      .setName("join")
      .setDescription("Join a spot using an invite code")
      .addStringOption((option) =>
        option
          .setName("code")
          .setDescription("The invite code")
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

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === "connect") {
      const walletAddress = interaction.options.getString("wallet");

      // Validate wallet address
      if (!walletAddress.startsWith("0x")) {
        await interaction.reply({
          content: "Invalid wallet address. Must start with 0x.",
          ephemeral: true,
        });
        return;
      }

      const addressWithoutPrefix = walletAddress.slice(2);
      if (
        addressWithoutPrefix.length !== 40 ||
        !/^[0-9a-fA-F]+$/.test(addressWithoutPrefix)
      ) {
        await interaction.reply({
          content:
            "Invalid wallet address. Must be a valid 20-byte hex string.",
          ephemeral: true,
        });
        return;
      }

      try {
        // Check if user already exists
        let user = await User.findOne({ discordId: interaction.user.id });

        if (user) {
          // Update existing user
          user.walletAddress = walletAddress;
          await user.save();
          await interaction.reply({
            content: "Your wallet address has been updated.",
            ephemeral: true,
          });
        } else {
          // Create new user
          user = new User({
            discordId: interaction.user.id,
            walletAddress: walletAddress,
          });
          await user.save();
          await interaction.reply({
            content:
              "Your wallet address has been connected and your account has been created.",
            ephemeral: true,
          });
        }
      } catch (error) {
        console.error("Error saving user:", error);
        await interaction.reply({
          content: "There was an error connecting your wallet.",
          ephemeral: true,
        });
      }
    } else if (commandName === "roll") {
      try {
        // Check if the user exists in the database
        let user = await User.findOne({ discordId: interaction.user.id });

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Generate a random spot (1-6)
        const newSpot = Math.floor(Math.random() * 6) + 1;

        // Update the user's current spot
        user.currentSpot = newSpot;
        await user.save();

        // Respond with the new spot info
        const spotDescriptions = [
          "Sunny Beach",
          "Rocky Cliffs",
          "Calm Lake",
          "Rushing River",
          "Deep Sea",
          "Mystical Pond",
        ];

        await interaction.reply({
          content: `You've been assigned to Fishing Spot #${newSpot}: ${
            spotDescriptions[newSpot - 1]
          }! Good luck fishing!`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error assigning fishing spot:", error);
        await interaction.reply({
          content:
            "There was an error assigning you to a fishing spot. Please try again later.",
          ephemeral: true,
        });
      }
    } else if (commandName === "fish") {
      try {
        // Check if the user exists in the database
        let user = await User.findOne({ discordId: interaction.user.id });

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Check if the user has a current spot assigned
        if (!user.currentSpot) {
          await interaction.reply({
            content:
              "You need to roll for a fishing spot first using the /roll command.",
            ephemeral: true,
          });
          return;
        }

        // Check the cooldown (1 hour)
        const now = new Date();
        if (user.lastFishTime && now - user.lastFishTime < 3600000) {
          // 1 hour in milliseconds
          const timeLeft = 3600000 - (now - user.lastFishTime);
          const minutesLeft = Math.floor(timeLeft / 60000);
          const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
          await interaction.reply({
            content: `You need to wait ${minutesLeft} minutes and ${secondsLeft} seconds before fishing again.`,
            ephemeral: true,
          });
          return;
        }

        // Randomly select a fish based on probabilities
        const fishList = await Fish.find();
        const randomFish = selectRandomFish(fishList);

        // Update the user's inventory, points, and XP
        const inventoryItem = user.inventory.find((item) =>
          item.fishId.equals(randomFish._id)
        );
        if (inventoryItem) {
          inventoryItem.quantity += 1;
        } else {
          user.inventory.push({ fishId: randomFish._id, quantity: 1 });
        }
        user.points += randomFish.pointValue;
        user.xp += randomFish.pointValue; // Assuming XP is equal to point value for simplicity
        user.lastFishTime = now;
        await user.save();

        await interaction.reply({
          content: `You caught a ${randomFish.name}! You earned ${randomFish.pointValue} points and XP.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error during fishing:", error);
        await interaction.reply({
          content: "There was an error while fishing. Please try again later.",
          ephemeral: true,
        });
      }
    } else if (commandName === "bait") {
      const baitFishName = interaction.options.getString("fish");

      try {
        // Check if the user exists in the database
        let user = await User.findOne({ discordId: interaction.user.id });

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Check if the user has the specified fish in their inventory
        const baitFish = await Fish.findOne({ name: baitFishName });
        if (!baitFish) {
          await interaction.reply({
            content: `The fish "${baitFishName}" does not exist.`,
            ephemeral: true,
          });
          return;
        }

        const inventoryItem = user.inventory.find((item) =>
          item.fishId.equals(baitFish._id)
        );
        if (!inventoryItem || inventoryItem.quantity < 1) {
          await interaction.reply({
            content: `You do not have any "${baitFishName}" in your inventory.`,
            ephemeral: true,
          });
          return;
        }

        // Remove the bait fish from the inventory
        inventoryItem.quantity -= 1;
        if (inventoryItem.quantity === 0) {
          user.inventory = user.inventory.filter(
            (item) => !item.fishId.equals(baitFish._id)
          );
        }

        // Randomly select a higher-ranked fish
        const higherRankedFish = await Fish.find({
          pointValue: { $gt: baitFish.pointValue },
        });
        if (higherRankedFish.length === 0) {
          await interaction.reply({
            content: `There are no higher-ranked fish available.`,
            ephemeral: true,
          });
          return;
        }

        const randomFish = selectRandomFish(higherRankedFish);

        // Update the user's inventory, points, and XP
        const newInventoryItem = user.inventory.find((item) =>
          item.fishId.equals(randomFish._id)
        );
        if (newInventoryItem) {
          newInventoryItem.quantity += 1;
        } else {
          user.inventory.push({ fishId: randomFish._id, quantity: 1 });
        }
        user.points += randomFish.pointValue;
        user.xp += randomFish.pointValue; // Assuming XP is equal to point value for simplicity
        await user.save();

        await interaction.reply({
          content: `You used a ${baitFish.name} as bait and caught a ${randomFish.name}! You earned ${randomFish.pointValue} points and XP.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error using bait:", error);
        await interaction.reply({
          content: "There was an error using the bait. Please try again later.",
          ephemeral: true,
        });
      }
    } else if (commandName === "inventory") {
      try {
        // Check if the user exists in the database
        let user = await User.findOne({
          discordId: interaction.user.id,
        }).populate("inventory.fishId");

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Format the inventory
        const inventory = user.inventory
          .map((item) => {
            return `${item.fishId.name} (x${item.quantity})`;
          })
          .join("\n");

        // Respond with the user's inventory, points, and XP
        await interaction.reply({
          content: `**Your Inventory:**\n${inventory}\n\n**Points:** ${user.points}\n**XP:** ${user.xp}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error retrieving inventory:", error);
        await interaction.reply({
          content:
            "There was an error retrieving your inventory. Please try again later.",
          ephemeral: true,
        });
      }
    } else if (commandName === "exp") {
      try {
        // Check if the user exists in the database
        let user = await User.findOne({ discordId: interaction.user.id });

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Respond with the user's XP
        await interaction.reply({
          content: `**Your XP:** ${user.xp}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error retrieving XP:", error);
        await interaction.reply({
          content:
            "There was an error retrieving your XP. Please try again later.",
          ephemeral: true,
        });
      }
    } else if (commandName === "story") {
      try {
        // Check if the user exists in the database
        let user = await User.findOne({ discordId: interaction.user.id });

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Check if the user has 20,000 XP
        if (user.xp < 20000) {
          await interaction.reply({
            content: `You need 20,000 XP to unlock the story creation feature. You currently have ${user.xp} XP.`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content:
              "Congratulations! You have unlocked the story creation feature. This feature will be available in a future update.",
            ephemeral: true,
          });
        }
      } catch (error) {
        console.error("Error checking XP for story feature:", error);
        await interaction.reply({
          content:
            "There was an error checking your XP. Please try again later.",
          ephemeral: true,
        });
      }
    } else if (commandName === "guild") {
      try {
        // Check if the user exists in the database
        let user = await User.findOne({ discordId: interaction.user.id });

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Check if the user has already generated 5 invites
        if (user.invites >= 5) {
          await interaction.reply({
            content:
              "You have already generated the maximum number of invites (5).",
            ephemeral: true,
          });
          return;
        }

        // Generate a unique invite code
        const inviteCode = uuidv4();

        // Add the invite code to the user's inviteCodes array
        user.inviteCodes.push({ code: inviteCode });
        user.invites += 1;
        await user.save();

        // Respond with the generated invite code
        await interaction.reply({
          content: `Here is your unique invite code: ${inviteCode}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error generating invite code:", error);
        await interaction.reply({
          content:
            "There was an error generating your invite code. Please try again later.",
          ephemeral: true,
        });
      }
    } else if (commandName === "join") {
      const inviteCode = interaction.options.getString("code");

      try {
        // Check if the invite code exists and is not used
        let userWithInvite = await User.findOne({
          "inviteCodes.code": inviteCode,
          "inviteCodes.used": false,
        });

        if (!userWithInvite) {
          await interaction.reply({
            content: "Invalid or already used invite code.",
            ephemeral: true,
          });
          return;
        }

        // Check if the user exists in the database
        let user = await User.findOne({ discordId: interaction.user.id });

        if (!user) {
          await interaction.reply({
            content:
              "You need to connect your wallet first using the /connect command.",
            ephemeral: true,
          });
          return;
        }

        // Assign the user to the same spot as the inviter
        user.currentSpot = userWithInvite.currentSpot;
        await user.save();

        // Mark the invite code as used
        userWithInvite.inviteCodes = userWithInvite.inviteCodes.map(
          (invite) => {
            if (invite.code === inviteCode) {
              invite.used = true;
            }
            return invite;
          }
        );

        // Award points to the inviter
        userWithInvite.points += 100;
        await userWithInvite.save();

        // Respond with a success message
        await interaction.reply({
          content: `You have successfully joined the spot using the invite code. You are now at spot #${user.currentSpot}.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error joining with invite code:", error);
        await interaction.reply({
          content:
            "There was an error joining with the invite code. Please try again later.",
          ephemeral: true,
        });
      }
    }
  });

  client.login(TOKEN);
});

// Function to select a random fish based on probabilities
function selectRandomFish(fishList) {
  const totalProbability = fishList.reduce(
    (sum, fish) => sum + fish.probability,
    0
  );
  const random = Math.random() * totalProbability;
  let cumulativeProbability = 0;

  for (const fish of fishList) {
    cumulativeProbability += fish.probability;
    if (random <= cumulativeProbability) {
      return fish;
    }
  }
}
