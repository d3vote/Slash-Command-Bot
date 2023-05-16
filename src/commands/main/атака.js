// деф.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ButtonStyle, EmbedBuilder, ButtonBuilder, ActionRowBuilder} = require("discord.js");
const { mainChannel_id } = require('../../config.json');
const buildButtonRow = require('../../buttonRow.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('атака')
        .setDescription('Плюсы на атаку')
        .addStringOption(option =>
            option.setName('противник')
                .setDescription('Противник')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('время')
                .setDescription('Время (например 00:00)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('количество')
                .setDescription('Количество (например 10)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('текст')
                .setDescription('Коментарий (например "ОЧЕНЬ ВАЖНЫЙ ФАЙТ")')
                .setRequired(false)),

    async execute(interaction) {
        const enemy = interaction.options.getString('противник');
        const time = interaction.options.getString('время');
        const quantity = interaction.options.getString('количество');
        const comment = interaction.options.getString('текст');

        let description = ' ';

        const embed = new EmbedBuilder()
            .setTitle('ПЛЮСЫ НА АТАКУ')
            .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')

        if (enemy !== null) {
            embed.addFields({
                name: 'Противник', value: enemy, inline: true
            });
        }

        if (time !== null) {
            embed.addFields({
                name: 'Время', value: time, inline: true
            });
        }

        if (quantity !== null) {
            embed.addFields({
                name: 'Количество', value: quantity, inline: true
            });
        }

        if (comment !== null) {
            embed.addFields({
                name: 'Комментарий', value: comment
            });
        }

        const mainChannel = interaction.guild.channels.cache.find((x) => x.id === mainChannel_id);

        mainChannel.send({ content: '@everyone', embeds: [embed], components: [buildButtonRow()] });
        interaction.reply({ content: "Готово!",  ephemeral: true });
    }
};
