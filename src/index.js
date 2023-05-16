const fs = require('fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle} = require('discord.js');
const { token, mainChannel_id, secondChannel_id, guildId } = require('./config.json');
const Datastore = require('nedb');
const buildButtonRow = require("./buttonRow");

let playersDb = new Datastore({ filename: './players.db', autoload: true });
let statisticsDb = new Datastore({ filename: './statistics.db', autoload: true });

module.exports.statisticsDb = statisticsDb;

playersDb.ensureIndex({ fieldName: 'message_id' }, function (err) {
    if (err) console.log('Error creating index', err);
});

statisticsDb.ensureIndex({ fieldName: 'user_id' }, function (err) {
    if (err) console.log('Error creating index', err);
});


const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

client.once(Events.ClientReady, () => {
    console.log('Ready!');
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});


client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'willPlay') {
        // Check if user is already in the database
        playersDb.find({ message_id: interaction.message.id, user_id: interaction.user.id }, function (err, docs) {
            if (err) {
                console.log(err);
                interaction.deferUpdate();
                return;
            }

            if (docs.length > 0) {
                // User is already in the database
                console.log(`User ${interaction.user.tag} is already in the player list.`);
                interaction.deferUpdate();
                return;
            }

            // User is not in the database, insert a new row
            console.log(`User ${interaction.user.tag} wants to play.`);
            playersDb.insert({ message_id: interaction.message.id, user_id: interaction.user.id }, function (err, newDoc) {
                if (err) {
                    console.log(err);
                    return;
                }
                console.log(`A document has been inserted with _id ${newDoc._id}`);
            });

            // Fetch the updated list of players from the database
            updatePlayerList(interaction.message, interaction);
            interaction.deferUpdate();
        });
    } else if (interaction.customId === 'wontPlay') {
        // Check if user is in the database
        playersDb.findOne({ message_id: interaction.message.id, user_id: interaction.user.id }, function(err, doc) {
            if (err) {
                console.log(err);
                return;
            }

            if (!doc) {
                // User is not in the database
                console.log(`User ${interaction.user.tag} is not in the player list.`);
                interaction.deferUpdate();
                return;
            }

            // User is in the database, remove the document
            playersDb.remove({ message_id: interaction.message.id, user_id: interaction.user.id }, {}, function(err, numRemoved) {
                if (err) {
                    console.log(err);
                    return;
                }
                console.log(`A document has been deleted: ${numRemoved} document(s) removed.`);
            });

            // Fetch the updated list of players from the database
            updatePlayerList(interaction.message, interaction);
            interaction.deferUpdate();
        });
    }
    const resultsChannel = interaction.guild.channels.cache.find((x) => x.id === secondChannel_id);
    const mainChannel = interaction.guild.channels.cache.find((x) => x.id === mainChannel_id);

    if (interaction.customId === 'win' || interaction.customId === 'lose') {
        const embedColor = interaction.customId === 'win' ? '#00ff05' : '#ff0000';
        const embedTitle = interaction.customId === 'win' ? 'WIN' : 'LOSE';

        const existingEmbed = interaction.message.embeds[0];
        let existingFields = existingEmbed.fields;
        const mainMessageId = existingEmbed.footer.text; // Assuming the footer contains the ID
        const mainMessage = await mainChannel.messages.fetch(mainMessageId);
        const newComponents = mainMessage.components.map((actionRow) => {
            const newButtons = actionRow.components.map((button) => {
                if (button.type === 2) {
                    return new ButtonBuilder()
                        .setCustomId(button.customId)
                        .setLabel(button.label)
                        .setStyle(button.style)
                        .setDisabled(true);
                } else {
                    return button;
                }
            });

            return new ActionRowBuilder()
                .addComponents(newButtons);
        });

        await mainMessage.edit({components: newComponents});
        const newEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(existingEmbed.description)
            .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
            .setFields(existingFields)
            .setFooter({ text: mainMessageId });

        await interaction.message.edit({embeds: [existingEmbed], rows: []});

        const changeResult = new ButtonBuilder()
            .setCustomId('change')
            .setLabel('Change Result')
            .setStyle(ButtonStyle.Secondary);

        const returnButton = new ButtonBuilder()
            .setCustomId('return')
            .setLabel('Return')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder()
            .addComponents(changeResult, returnButton);

        await (async () => {
            try {
                playersDb.find({ message_id: interaction.message.id }, function (err, rows) {
                    if (err) {
                        console.log(err);
                        return;
                    }

                    if (!rows || rows.length === 0) {
                        console.log('No rows found in the database.');
                        return;
                    }

                    for (const row of rows) {
                        const userId = row.user_id;
                        let updateQuery = {};
                        if (interaction.customId === 'win') {
                            updateQuery = { $inc: { wins: 1 } };
                        } else if (interaction.customId === 'lose') {
                            updateQuery = { $inc: { loses: 1 } };
                        }

                        // Add the upsert option to the update function
                        statisticsDb.update({ user_id: userId }, updateQuery, { upsert: true }, function (err, numAffected, affectedDocuments, upsert) {
                            if (err) {
                                console.log(err);
                                return;
                            }
                            if (upsert) {
                                console.log(`New document created for user with ID ${userId}`);
                            } else {
                                console.log(`Statistics updated for user with ID ${userId}`);
                            }
                        });
                    }
                });
                } catch (err) {
                console.error(err);
            }
        })();
        resultsChannel.send({ embeds: [newEmbed], components: [row] });
        interaction.deferUpdate();
    }

    if (interaction.customId === 'return') {
        const mainMessageId = interaction.message.embeds[0].footer.text;
        const mainMessage = await mainChannel.messages.fetch(mainMessageId);
        const newComponents = mainMessage.components.map((actionRow) => {
            const newButtons = actionRow.components.map((button) => {
                if (button.type === 2) {  // '2' corresponds to BUTTON
                    return new ButtonBuilder()
                        .setCustomId(button.customId)
                        .setLabel(button.label)
                        .setStyle(button.style)
                        .setDisabled(false);  // Enable the buttons
                } else {
                    return button;
                }
            });

            const newRow = new ActionRowBuilder()
                .addComponents(newButtons);

            return newRow;
        });

        await mainMessage.edit({components: newComponents});

        let updateQuery = {};
        if (interaction.message.embeds[0].title === 'WIN') {
            updateQuery = { $inc: { wins: -1 } };
        } else {
            updateQuery = { $inc: { loses: -1 } };
        }

        statisticsDb.update({ user_id: interaction.user.id }, updateQuery, {}, function (err, numAffected) {
            if (err) {
                console.log(err);
                return;
            }
            console.log(`Statistics updated for user with ID ${interaction.user.id}`);
        });

        await interaction.message.delete();
    }
    if (interaction.customId === 'change') {
        const existingEmbed = interaction.message.embeds[0];
        let newTitle, newColor;

        // Toggle the title and color
        if (existingEmbed.title === 'WIN') {
            newTitle = 'LOSE';
            newColor = '#ff0000';
        } else {
            newTitle = 'WIN';
            newColor = '#00ff05';
        }

        let updateQuery = {};
        if (existingEmbed.title === 'WIN') {
            updateQuery = { $inc: { wins: -1, loses: 1 } };
        } else {
            updateQuery = { $inc: { wins: 1, loses: -1 } };
        }

        statisticsDb.update({ user_id: interaction.user.id }, updateQuery, {}, function (err, numAffected) {
            if (err) {
                console.log(err);
                return;
            }
            console.log(`Statistics updated for user with ID ${interaction.user.id}`);
        });

        const newEmbed = new EmbedBuilder()
            .setColor(newColor)
            .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
            .setTitle(newTitle)
            .setDescription(existingEmbed.description)
            .setFooter({ text: existingEmbed.footer.text });

        await interaction.message.edit({embeds: [newEmbed]});
        interaction.deferUpdate();
    }
    if (interaction.customId === 'editList') {
        // Fetch all players for the current message from the database
        playersDb.find({ message_id: interaction.message.id }, async function(err, docs) {
            if (err) {
                console.log(err);
                interaction.deferUpdate();
                return;
            }

            let playerButtons = [];
            for (let doc of docs) {
                // Fetch the username for the current user ID
                let username = await fetchUsername(doc.user_id);
                if (!username) {
                    console.error(`Could not fetch username for user ID ${doc.user_id}`);
                    continue; // Skip this iteration and move to the next one
                }

                let button = new ButtonBuilder()
                    .setCustomId(`removePlayer-${doc.user_id}`) // Custom ID contains the user ID
                    .setLabel(username) // Button label is the username
                    .setStyle(ButtonStyle.Secondary);

                console.log(button); // Log the button
                playerButtons.push(button);
            }

            const closeButton = new ButtonBuilder()
                .setCustomId('closeEditList')
                .setLabel('Close')
                .setStyle(ButtonStyle.Danger);
            playerButtons.push(closeButton);

            const row = new ActionRowBuilder()
                .addComponents(playerButtons);

            await interaction.message.edit({ components: [row] });

            interaction.deferUpdate();
        });
    } else if (interaction.customId.startsWith('removePlayer-')) {
        // A player button was clicked, remove the player from the database
        const userId = interaction.customId.split('-')[1]; // User ID is the second part of the custom ID
        playersDb.remove({ message_id: interaction.message.id, user_id: userId }, {}, function(err, numRemoved) {
            if (err) {
                console.log(err);
                return;
            }
            console.log(`A document has been deleted: ${numRemoved} document(s) removed.`);

            // Fetch the updated list of players from the database
            updatePlayerList(interaction.message, interaction);
            interaction.deferUpdate();
        });
    } else if (interaction.customId === 'closeEditList') {
        await interaction.message.edit({ components: [buildButtonRow()] });
        interaction.deferUpdate();
    }
});

async function fetchUsername(userId, interaction) {
    try {
        const user = await client.users.fetch(userId);
        return user.username;
    } catch (error) {
        console.error(`Error fetching username for user ID ${userId}: ${error}`);
        return null;
    }
}

function updatePlayerList(message, interaction) {
    playersDb.find({ message_id: message.id }, function (err, docs) {
        if (err) {
            console.log(err);
            return;
        }

        let players = '';
        if (docs.length > 0) {
            docs.forEach(doc => {
                players += `<@${doc.user_id}>\n`;
            });
        }

        let existingEmbed = message.embeds[0];
        let existingFields = existingEmbed.fields;
        let newDescriptionLines = []

        if (players.length > 0) {
            newDescriptionLines.push('\n**ПЛЮСЫ:**');
            newDescriptionLines = newDescriptionLines.concat(players);
        }

        if (newDescriptionLines.length > 0) {
            const newEmbed = new EmbedBuilder()
                .setTitle(existingEmbed.title)
                .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
                .setDescription(newDescriptionLines.join('\n'))
                .addFields(existingFields)
                .setFooter({ text: interaction.message.id });
            message.edit({ embeds: [newEmbed] });
        } else {
            const newEmbed = new EmbedBuilder()
                .setTitle(existingEmbed.title)
                .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
                .setFooter({ text: interaction.message.id })
                .addFields(existingFields);
            message.edit({ embeds: [newEmbed] });
        }
    });
}



client.login(token);