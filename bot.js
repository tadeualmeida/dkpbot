require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { connectDB } = require('./config/db');
const setupEventHandlers = require('./events/setupEventHandlers');

// Conectar ao banco de dados
connectDB();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Configurar os event handlers para os comandos
setupEventHandlers(client);

client.login(process.env.DISCORD_TOKEN);