// деф.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ButtonStyle, EmbedBuilder, ButtonBuilder, ActionRowBuilder} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('деф')
        .setDescription('Плюсы на деф')
        .addStringOption(option =>
            option.setName('противник')
                .setDescription('Противник')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('время')
                .setDescription('Время (например 00:00)')
                .setRequired(false))
        .addIntegerOption(option =>
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
        const quantity = interaction.options.getInteger('количество');
        const comment = interaction.options.getString('текст');

        let description = ' ';

        if (enemy !== null) {
            description += 'Противник: **' + enemy + '**\n';
        }

        if (time !== null) {
            description += 'Время: **' + time + '**\n';
        }

        if (quantity !== null) {
            description += 'Количество: **' + quantity + 'x' + quantity + '**\n';
        }

        if (comment !== null) {
            description += comment + '**\n';
        }

        const embed = new EmbedBuilder()
            .setTitle('ПЛЮСЫ НА ДЕФ')
            .setThumbnail('https://cdn.discordapp.com/icons/1096872981453615155/d88dc367ddd3acf66f1ad4dd267fed14.webp')
            .setDescription(description)

        const willPlay = new ButtonBuilder()
            .setCustomId('willPlay')
            .setLabel('✅')
            .setStyle(ButtonStyle.Secondary);

        const wontPlay = new ButtonBuilder()
            .setCustomId('wontPlay')
            .setLabel('❌')
            .setStyle(ButtonStyle.Secondary);

        const winButton = new ButtonBuilder()
            .setCustomId('win')
            .setLabel('Win')
            .setStyle(ButtonStyle.Success);

        const loseButton = new ButtonBuilder()
            .setCustomId('lose')
            .setLabel('Lose')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
            .addComponents(willPlay, wontPlay, winButton, loseButton);

        const mainChannel = interaction.guild.channels.cache.find((x) => x.id === '1096887708284096653');

        mainChannel.send({ content: '@everyone', embeds: [embed], components: [row] });
        interaction.reply({ content: "Готово!",  ephemeral: true });
    }
};
