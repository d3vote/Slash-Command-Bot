const { ButtonStyle, ButtonBuilder, ActionRowBuilder} = require("discord.js");

function buildButtonRow() {
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

    const editList = new ButtonBuilder()
        .setCustomId('editList')
        .setLabel('Редактировать')
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder()
        .addComponents(willPlay, wontPlay, winButton, loseButton, editList);
}

module.exports = buildButtonRow;
