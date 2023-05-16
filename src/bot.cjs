const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { GatewayIntentBits, GatewayDispatchEvents, InteractionType, MessageFlags, Client } = require('@discordjs/core');
const { WebSocketManager } = require('@discordjs/ws');


const attackCommand = require('./commands/main/атака.js');
const defCommand = require('./commands/main/деф.js');
const {InteractionCreate} = require("events");

const token = 'ODYzNTA4MjA4MDE0MTk2NzM2.G1yuKj.JUcjGMOn4x6HeP-OqVdJa5F8kudt1KiBKT9sdM';

// Create REST and WebSocket managers directly
const rest = new REST({ version: '10' }).setToken(token);

const gateway = new WebSocketManager({
    token,
    intents: GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
    rest,
});

// Create a client to emit relevant events
const client = new Client({ rest, gateway });

// The data for our commands
const commands = [attackCommand.data, defCommand.data];

const start = async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands('863508208014196736', '705214400142901381'),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }

    // Listen for the ready event
    client.once(GatewayDispatchEvents.Ready, () => console.log('Ready!'));

    // Start the WebSocket connection
    gateway.connect();
};

module.exports = { start };
