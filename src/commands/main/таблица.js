// деф.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require("discord.js");
const {db2} = require("../../index");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('таблица')
        .setDescription('Рейтинговая таблица'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('W/L Рейтинг игроков:')
            .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')


        db2.all(`SELECT * FROM statistics`, [], (err, rows) => {
            if (err) {
                throw err;
            }
            let description = '';

            rows.forEach((row) => {
                // Calculate total games and win rate
                let totalGames = row.wins + row.loses;
                let winRate = (totalGames > 0) ? ((row.wins / totalGames) * 100).toFixed(2) : 0;

                // Add player info to the string
                description += `<@${row.user_id}>: ${row.wins} W / ${row.loses} L / ${totalGames} Games / ${winRate}% W/R\n`;
            });
            if (description !== '') {
                embed.setDescription(description);
            }
            console.log("here 3")

            // Reply with the embed message, set to ephemeral so only the command user can see it
            interaction.reply({ embeds: [embed], ephemeral: true });
        });
    }
};
