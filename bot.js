// bot.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { connectDB } = require('./config/db');
const setupEventHandlers = require('./events/setupEventHandlers');
const { loadGuildConfig } = require('./utils/config');

// 1) Instancia o client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 2) Conecta no MongoDB
connectDB();

// 3) Seta os event handlers (comandos, interações etc.)
setupEventHandlers(client);

// 4) Faz login no Discord
client.login(process.env.DISCORD_TOKEN);
