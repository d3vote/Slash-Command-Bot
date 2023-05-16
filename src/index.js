const fs = require('fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle} = require('discord.js');
const { token } = require('./config.json');
const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('./players.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

let db2 = new sqlite3.Database('./statistics.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

module.exports.db2 = db2;

db.run(`CREATE TABLE IF NOT EXISTS players (
    message_id TEXT,
    user_id TEXT
)`, (err) => {
    if (err) {
        console.log('Error creating table', err);
    }
});

db2.run(`CREATE TABLE IF NOT EXISTS statistics (
    user_id TEXT,
    wins INTEGER DEFAULT 0,
    loses INTEGER DEFAULT 0
)`, (err) => {
    if (err) {
        console.log('Error creating table', err);
    }
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
        let stmt1 = db.prepare(`SELECT * FROM players WHERE message_id = ? AND user_id = ?`);
        stmt1.get(interaction.message.id, interaction.user.id, function(err, row) {
            if (err) {
                console.log(err.message);
                return;
            }

            if (row) {
                // User is already in the database
                console.log(`User ${interaction.user.tag} is already in the player list.`);
                stmt1.finalize();
                interaction.deferUpdate();
                return;
            }

            // User is not in the database, insert a new row
            console.log(`User ${interaction.user.tag} wants to play.`);

            let stmt2 = db.prepare(`INSERT INTO players VALUES (?, ?)`);
            stmt2.run(interaction.message.id, interaction.user.id, function(err) {
                if (err) {
                    console.log(err.message);
                    return;
                }
                console.log(`A row has been inserted with rowid ${this.lastID}`);
            });
            stmt2.finalize();

            // Fetch the updated list of players from the database
            updatePlayerList(interaction.message, interaction);
            interaction.deferUpdate();
        });
    } else if (interaction.customId === 'wontPlay') {
        // Check if user is in the database
        let stmt3 = db.prepare(`SELECT * FROM players WHERE message_id = ? AND user_id = ?`);
        stmt3.get(interaction.message.id, interaction.user.id, function(err, row) {
            if (err) {
                console.log(err.message);
                return;
            }

            if (!row) {
                // User is not in the database
                console.log(`User ${interaction.user.tag} is not in the player list.`);
                stmt3.finalize();
                interaction.deferUpdate();
                return;
            }

            // User is in the database, remove the row
            let stmt4 = db.prepare(`DELETE FROM players WHERE message_id = ? AND user_id = ?`);
            stmt4.run(interaction.message.id, interaction.user.id, function(err) {
                if (err) {
                    console.log(err.message);
                    return;
                }
                console.log(`A row has been deleted with rowid ${this.lastID}`);
            });
            stmt4.finalize();

            // Fetch the updated list of players from the database
            updatePlayerList(interaction.message, interaction);
            interaction.deferUpdate();
        });
    }

    const resultsChannel = interaction.guild.channels.cache.find((x) => x.id === '1096887586720583700');
    const mainChannel = interaction.guild.channels.cache.find((x) => x.id === '1096887708284096653');

    if (interaction.customId === 'win' || interaction.customId === 'lose') {
        const embedColor = interaction.customId === 'win' ? '#00ff05' : '#ff0000';
        const embedTitle = interaction.customId === 'win' ? 'WIN' : 'LOSE';

        const existingEmbed = interaction.message.embeds[0];
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
                    console.log('false button')
                    return button;
                }
            });

            const newRow = new ActionRowBuilder()
                .addComponents(newButtons);

            return newRow;
        });

        await mainMessage.edit({components: newComponents});
        const newEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(existingEmbed.description)
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
                const rows = await new Promise((resolve, reject) => {
                    db.all('SELECT user_id FROM players WHERE message_id = ?', [interaction.message.id], (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    });
                });

                if (!rows) {
                    console.log('No rows found in the database.');
                    return;
                }

                for (const row of rows) {
                    const userId = row.user_id;
                    const stmt6 = db2.prepare(
                        interaction.customId === 'win'
                            ? 'UPDATE statistics SET wins = wins + 1 WHERE user_id = ?'
                            : 'UPDATE statistics SET loses = loses + 1 WHERE user_id = ?'
                    );
                    await new Promise((resolve, reject) => {
                        stmt6.run(userId, function (err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                    console.log(`Statistics updated for user with ID ${userId}`);
                }

                // Check if the user ID is in the statistics table
                const stmt7 = db2.prepare('SELECT * FROM statistics WHERE user_id = ?');
                stmt7.get(interaction.user.id, function (err, row) {
                    if (err) {
                        console.log(err.message);
                        return;
                    }

                    if (!row) {
                        // User is not in the statistics table, insert a new row
                        const stmt8 = db2.prepare('INSERT INTO statistics (user_id, wins, loses) VALUES (?, ?, ?)');
                        stmt8.run(interaction.user.id, interaction.customId ? 1 : 0, // Set wins to 1 if it's a win, otherwise set it to 0
                            interaction.customId === 'lose' ? 1 : 0 // Set loses to 1 if it's a lose, otherwise set it to 0
                        );
                        stmt8.finalize();
                        console.log(`A row has been inserted into statistics for user with ID ${interaction.user.id}`);
                    }
                });
                stmt7.finalize();

                const statisticsRows = await new Promise((resolve, reject) => {
                    db2.all('SELECT * FROM statistics', (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    });
                });

                console.log('Statistics:');
                console.log(statisticsRows);
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

        await interaction.message.edit({components: newComponents});

        const stmt = db2.prepare(
            interaction.message.embeds[0].title === 'WIN'
                ? 'UPDATE statistics SET wins = wins - 1 WHERE user_id = ?'
                : 'UPDATE statistics SET loses = loses - 1 WHERE user_id = ?'
        );
        stmt.run(interaction.user.id);

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

        const stmt = db2.prepare(
            existingEmbed.title === 'WIN'
                ? 'UPDATE statistics SET wins = wins - 1, loses = loses + 1 WHERE user_id = ?'
                : 'UPDATE statistics SET wins = wins + 1, loses = loses - 1 WHERE user_id = ?'
        );
        stmt.run(interaction.user.id);

        const newEmbed = new EmbedBuilder()
            .setColor(newColor)
            .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
            .setTitle(newTitle)
            .setDescription(existingEmbed.description)
            .setFooter({ text: existingEmbed.footer.text });

        await interaction.message.edit({embeds: [newEmbed]});
        interaction.deferUpdate();
    }
});

function updatePlayerList(message, interaction) {
    let stmt = db.prepare(`SELECT user_id FROM players WHERE message_id = ?`);
    stmt.all(message.id, (err, rows) => {
        if (err) {
            console.log(err);
            return;
        }

        let players = '';
        if (rows.length > 0) {
            rows.forEach(row => {
                players += `<@${row.user_id}> - ` + interaction.user.username + ` \n`;
            });
        }

        let existingEmbed = message.embeds[0];
        let existingDescriptionLines = existingEmbed.description ? existingEmbed.description.split('\n') : [];
        let playersIndex = existingDescriptionLines.indexOf('**ПЛЮСЫ:**');
        let newDescriptionLines = playersIndex !== -1 ? existingDescriptionLines.slice(0, playersIndex) : existingDescriptionLines;

        if (players.length > 0) {
            if (playersIndex === -1) {
                newDescriptionLines.push('\n**ПЛЮСЫ:**');
            }
            newDescriptionLines = newDescriptionLines.concat(players);
        }

        console.log(newDescriptionLines)
        console.log(newDescriptionLines.length)

        if (newDescriptionLines.length > 0) {
            const newEmbed = new EmbedBuilder()
                .setTitle(existingEmbed.title)
                .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
                .setDescription(newDescriptionLines.join('\n'))
                .setFooter({ text: interaction.message.id });
            message.edit({ embeds: [newEmbed] });
        } else {
            const newEmbed = new EmbedBuilder()
                .setTitle(existingEmbed.title)
                .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
                .setFooter({ text: interaction.message.id });
            message.edit({ embeds: [newEmbed] });
        }
    });
    stmt.finalize();
}


client.login(token);