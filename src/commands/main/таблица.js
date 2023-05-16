// деф.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require("discord.js");
const { statisticsDb } = require("../../index");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('таблица')
        .setDescription('Рейтинговая таблица'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('W/L Рейтинг игроков:')
            .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')


        statisticsDb.find({}, function(err, rows) {
            if (err) {
                console.log(err);
                return;
            }
            let description = '';

            rows.forEach((row) => {
                // Check if wins and loses are undefined, and default them to 0 if they are
                let wins = row.wins || 0;
                let loses = row.loses || 0;

                // Calculate total games and win rate
                let totalGames = wins + loses;
                let winRate = (totalGames > 0) ? ((wins / totalGames) * 100).toFixed(2) : 0;

                // Add player info to the string
                description += `<@${row.user_id}>: ${wins} W / ${loses} L / ${totalGames} Games / ${winRate}% W/R\n`;
            });
            if (description !== '') {
                embed.setDescription(description);
            }

            // Reply with the embed message, set to ephemeral so only the command user can see it
            interaction.reply({ embeds: [embed], ephemeral: true });
        });
    }
};
