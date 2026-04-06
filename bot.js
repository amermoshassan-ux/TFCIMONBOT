// TFCImon Discord Bot — COMPLETE WITH WORKING /op COMMAND
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OP_USER = 'haxiii7';

// ========== DATA STORAGE ==========
const DATA_FILE = path.join(__dirname, 'data.json');

let playerData = new Map();
let auctionListings = new Map();
let listingCounter = 1;
let doubleGemsEvent = false;
let xpBoostEvent = false;
let opUsers = [];
let bounties = new Map();
let bannedUsers = [];
let frozenUsers = [];
let activeBattles = new Map();
let activeArenaBattles = new Map();
let tradeOffers = new Map();
let activeTournament = { running: false, players: [], bracket: [] };
let tradeCounter = 1;

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const savedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            playerData = new Map(Object.entries(savedData.players || {}));
            auctionListings = new Map(Object.entries(savedData.auctionListings || {}).map(([k, v]) => [parseInt(k), v]));
            listingCounter = savedData.listingCounter || 1;
            doubleGemsEvent = savedData.doubleGemsEvent || false;
            xpBoostEvent = savedData.xpBoostEvent || false;
            opUsers = savedData.opUsers || [];
            bounties = new Map(Object.entries(savedData.bounties || {}));
            bannedUsers = savedData.bannedUsers || [];
            frozenUsers = savedData.frozenUsers || [];
            
            for (const [arenaId, arenaState] of Object.entries(savedData.arenas || {})) {
                if (ARENAS[arenaId]) {
                    ARENAS[arenaId].holder = arenaState.holder || null;
                    ARENAS[arenaId].holderName = arenaState.holderName || null;
                }
            }
            
            for (const [id, card] of Object.entries(savedData.customCards || {})) {
                CARDS[id] = card;
            }
            
            console.log(`✅ Loaded ${playerData.size} players, ${opUsers.length} OP users`);
        }
    } catch (e) { console.log('No existing data found'); }
}

function saveData() {
    try {
        const data = {
            players: Object.fromEntries(playerData),
            arenas: Object.fromEntries(Object.entries(ARENAS).map(([id, a]) => [id, { holder: a.holder, holderName: a.holderName }])),
            auctionListings: Object.fromEntries(auctionListings),
            listingCounter,
            doubleGemsEvent,
            xpBoostEvent,
            customCards: Object.fromEntries(Object.entries(CARDS).filter(([id]) => id.startsWith('custom_'))),
            opUsers,
            bounties: Object.fromEntries(bounties),
            bannedUsers,
            frozenUsers,
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('Save failed:', e); }
}

setInterval(saveData, 60000);

// ========== CARD DATA ==========
const CARDS = {
    celestia: { id: 'celestia', name: 'Celestia', hp: 200, type: 'Dark', rarity: 'Rare', emoji: '🌑', color: 0x2c2c54, description: 'A dark warrior with flower-like wings.', gemCost: 300, moves: [{ name: '#Goon', damage: 75, cost: 2, emoji: '👊' }, { name: 'Drawing w/ Downfall', damage: 150, cost: 4, emoji: '🌀' }] },
    flame: { id: 'flame', name: 'Flame', hp: 200, type: 'Fire', rarity: 'Rare', emoji: '🔥', color: 0xe84545, description: 'A plaid-shirted cat with a sailor cap.', gemCost: 300, moves: [{ name: 'Timeout', damage: 50, cost: 2, emoji: '⏱️' }, { name: 'Kick', damage: 100, cost: 3, emoji: '🦵' }, { name: 'Ban', damage: 250, cost: 6, emoji: '🔨' }] },
    isy: { id: 'isy', name: 'Isy EX', hp: 150, type: 'Normal', rarity: 'EX', emoji: '🍌', color: 0x3498db, description: 'Member MECT — EX card!', gemCost: 500, moves: [{ name: 'Banana', damage: 50, cost: 2, emoji: '🍌' }, { name: 'Summon-SPK', damage: 100, cost: 4, emoji: '📢' }, { name: 'EX POWER', damage: 180, cost: 6, emoji: '👑', isEx: true }] },
    michael: { id: 'michael', name: 'Michael the Keeper', hp: 300, type: 'Shadow', rarity: 'LEGENDARY', emoji: '👁️', color: 0x1a1a2e, description: '⚠️ LEGENDARY', gemCost: 2000, moves: [{ name: 'Hiding', damage: 100, cost: 3, emoji: '🌫️' }, { name: 'Server Hopper', damage: 130, cost: 4, emoji: '🚀' }] },
    spk_iii: { id: 'spk_iii', name: 'SPK_III', hp: 180, type: 'Normal', rarity: 'Uncommon', emoji: '🔊', color: 0xf39c12, description: 'Powerful speaker.', gemCost: 200, moves: [{ name: 'Banan', damage: 75, cost: 2, emoji: '🍌' }, { name: 'Tuff Stuff', damage: 170, cost: 5, emoji: '💪' }] },
    shadowfox: { id: 'shadowfox', name: 'Shadow Fox', hp: 220, type: 'Shadow', rarity: 'Rare', emoji: '🦊', color: 0x6c3483, description: 'Cunning fox.', gemCost: 350, moves: [{ name: 'Phantom Dash', damage: 80, cost: 2, emoji: '💨' }, { name: 'Shadow Bite', damage: 140, cost: 3, emoji: '🦷' }, { name: 'Eclipse Strike', damage: 200, cost: 5, emoji: '🌑' }] },
    stormking: { id: 'stormking', name: 'Storm King', hp: 250, type: 'Electric', rarity: 'Rare', emoji: '⚡', color: 0xf9ca24, description: 'Ruler of storms.', gemCost: 400, moves: [{ name: 'Thunder Clap', damage: 90, cost: 2, emoji: '⚡' }, { name: 'Static Prison', damage: 120, cost: 3, emoji: '🔒' }, { name: 'LIGHTNING THRONE', damage: 220, cost: 6, emoji: '👑' }] },
    voidwalker: { id: 'voidwalker', name: 'Void Walker', hp: 170, type: 'Void', rarity: 'EX', emoji: '🌀', color: 0x130f40, description: 'Steps between dimensions.', gemCost: 600, moves: [{ name: 'Phase Shift', damage: 60, cost: 1, emoji: '🌀' }, { name: 'Dimension Rip', damage: 130, cost: 3, emoji: '🕳️' }, { name: 'VOID COLLAPSE', damage: 220, cost: 6, emoji: '💀', isEx: true }] },
    ironclad: { id: 'ironclad', name: 'Ironclad', hp: 350, type: 'Steel', rarity: 'Rare', emoji: '🛡️', color: 0x7f8c8d, description: 'Unstoppable wall.', gemCost: 380, moves: [{ name: 'Iron Wall', damage: 40, cost: 1, emoji: '🛡️' }, { name: 'Steel Crush', damage: 110, cost: 3, emoji: '⚙️' }, { name: 'FORTRESS BREAK', damage: 190, cost: 5, emoji: '💥' }] },
    cosmicqueen: { id: 'cosmicqueen', name: 'Cosmic Queen', hp: 230, type: 'Cosmic', rarity: 'LEGENDARY', emoji: '🌌', color: 0x9b59b6, description: '✨ LEGENDARY', gemCost: 2500, moves: [{ name: 'Stardust', damage: 90, cost: 2, emoji: '✨' }, { name: 'Nebula Burst', damage: 160, cost: 4, emoji: '🌌' }, { name: 'BIG BANG', damage: 280, cost: 7, emoji: '💫', isEx: true }] },
};

const PACK_WEIGHTS = { celestia: 20, flame: 20, isy: 15, spk_iii: 10, michael: 1, shadowfox: 10, stormking: 9, voidwalker: 6, ironclad: 8, cosmicqueen: 0.5, energy: 7 };
const PACK_GEM_COST = 150;
const SELL_BACK_RATE = 0.3;

// ========== ARENAS ==========
const ARENAS = {
    '100_player_island': { id: '100_player_island', name: '100 Player Island', emoji: '🏝️', color: 0x00b894, description: 'Only one survives.', holder: null, holderName: null, guardian: { name: 'THE LAST ONE', emoji: '💀', hp: 350, energy: 4, moves: [{ name: 'Island Wipe', damage: 90, cost: 2, emoji: '🌊' }, { name: 'Final Circle', damage: 160, cost: 4, emoji: '🔴' }, { name: 'Only Survivor', damage: 240, cost: 6, emoji: '☠️' }] } },
    mingle: { id: 'mingle', name: 'Mingle', emoji: '💞', color: 0xff6b9d, description: 'Friendships destroyed.', holder: null, holderName: null, guardian: { name: 'CUPID REAPER', emoji: '💘', hp: 280, energy: 3, moves: [{ name: 'Heartbreak', damage: 80, cost: 2, emoji: '💔' }, { name: 'Toxic Charm', damage: 130, cost: 3, emoji: '🩷' }, { name: 'Lovebomb', damage: 200, cost: 5, emoji: '💣' }] } },
    rlgl: { id: 'rlgl', name: 'RLGL', emoji: '🚦', color: 0xe74c3c, description: "One wrong move.", holder: null, holderName: null, guardian: { name: 'THE DOLL', emoji: '🎎', hp: 320, energy: 3, moves: [{ name: 'Red Light', damage: 60, cost: 1, emoji: '🔴' }, { name: 'Green Light', damage: 120, cost: 3, emoji: '🟢' }, { name: 'Elimination', damage: 220, cost: 5, emoji: '🎯' }] } },
    jumprope: { id: 'jumprope', name: 'Jumprope', emoji: '🪢', color: 0x6c5ce7, description: 'The rope never stops.', holder: null, holderName: null, guardian: { name: 'ROPEGOD', emoji: '🌀', hp: 260, energy: 3, moves: [{ name: 'Whiplash', damage: 70, cost: 2, emoji: '💫' }, { name: 'Double Dutch', damage: 140, cost: 3, emoji: '🌀' }, { name: 'Infinite Loop', damage: 190, cost: 5, emoji: '♾️' }] } },
    spinner: { id: 'spinner', name: 'Spinner', emoji: '🌪️', color: 0xfdcb6e, description: 'Spin the wheel.', holder: null, holderName: null, guardian: { name: 'VORTEX', emoji: '🌪️', hp: 290, energy: 3, moves: [{ name: 'Dizzy Slam', damage: 85, cost: 2, emoji: '😵' }, { name: 'Tornado Fist', damage: 150, cost: 4, emoji: '🌪️' }, { name: 'Chaos Spin', damage: 210, cost: 6, emoji: '💥' }] } },
    red_vs_blue: { id: 'red_vs_blue', name: 'Red vs Blue', emoji: '⚔️', color: 0xd63031, description: 'No neutral here.', holder: null, holderName: null, guardian: { name: 'COMMANDER NULL', emoji: '🎖️', hp: 330, energy: 4, moves: [{ name: 'Blue Barrage', damage: 95, cost: 2, emoji: '🔵' }, { name: 'Red Rush', damage: 145, cost: 3, emoji: '🔴' }, { name: 'Total War', damage: 230, cost: 6, emoji: '💣' }] } },
    pick_a_side: { id: 'pick_a_side', name: 'Pick a Side', emoji: '🪙', color: 0x2d3436, description: 'Every choice has a consequence.', holder: null, holderName: null, guardian: { name: 'THE DECIDER', emoji: '⚖️', hp: 310, energy: 3, moves: [{ name: 'Coin Flip', damage: 75, cost: 2, emoji: '🪙' }, { name: 'Wrong Choice', damage: 140, cost: 3, emoji: '❌' }, { name: 'Judgement Day', damage: 250, cost: 6, emoji: '⚖️' }] } },
};

const ARENA_CHOICES = Object.keys(ARENAS).map(k => ({ name: `${ARENAS[k].emoji} ${ARENAS[k].name}`, value: k }));

// ========== HELPERS ==========
function getPlayer(userId) {
    if (!playerData.has(userId)) {
        playerData.set(userId, { deck: [], activeDeck: [], energyCards: 0, gems: 100, nicknames: {}, wins: 0, losses: 0, cardWins: {}, cardLosses: {}, cardLevels: {}, lastDaily: null });
    }
    return playerData.get(userId);
}

function isOp(interaction) {
    return interaction.user.username === OP_USER || opUsers.includes(interaction.user.id);
}

function isBanned(userId) { return bannedUsers.includes(userId); }
function isFrozen(userId) { return frozenUsers.includes(userId); }
function gemMultiplier() { return doubleGemsEvent ? 2 : 1; }
function xpThreshold() { return xpBoostEvent ? 2 : 3; }
function getCardLevel(player, cardId) { return player.cardLevels[cardId] || 1; }
function getLevelBonus(level) { return (level - 1) * 10; }

function weightedRandom(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (const [id, weight] of Object.entries(weights)) { rand -= weight; if (rand <= 0) return id; }
    return Object.keys(weights)[0];
}

function openPack(count = 3) {
    const pulled = [];
    for (let i = 0; i < count; i++) pulled.push(weightedRandom(PACK_WEIGHTS));
    return pulled;
}

function hpBar(hp, maxHp) {
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    const filled = Math.round(pct * 10);
    const color = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
    return color.repeat(filled) + '⬛'.repeat(10 - filled) + ` ${hp}/${maxHp}`;
}

function aiPickMove(guardian, energy) {
    const affordable = guardian.moves.filter(m => m.cost <= energy);
    if (affordable.length === 0) return guardian.moves[0];
    return affordable.reduce((best, m) => m.damage > best.damage ? m : best);
}

function getBattleCard(player) {
    if (player.activeDeck?.length > 0) {
        const valid = player.activeDeck.filter(id => player.deck.includes(id) && CARDS[id]);
        if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    }
    const valid = player.deck.filter(id => CARDS[id]);
    return valid.length ? valid[Math.floor(Math.random() * valid.length)] : null;
}

function getAllCardChoices() {
    return Object.values(CARDS).map(c => ({ name: `${c.emoji} ${c.name} (${c.gemCost}💎)`, value: c.id })).slice(0, 25);
}

// ========== SLOTS ==========
const SLOT_SYMBOLS = ['🍋', '🍒', '🔔', '⭐', '💎', '7️⃣'];
const SLOT_PAYOUTS = { '💎💎💎': 20, '7️⃣7️⃣7️⃣': 15, '⭐⭐⭐': 10, '🔔🔔🔔': 7, '🍒🍒🍒': 5, '🍋🍋🍋': 4, 'pair': 1.5 };
function spinSlots() { return [SLOT_SYMBOLS[Math.floor(Math.random() * 6)], SLOT_SYMBOLS[Math.floor(Math.random() * 6)], SLOT_SYMBOLS[Math.floor(Math.random() * 6)]]; }
function evalSlots(reels) { const key = reels.join(''); if (SLOT_PAYOUTS[key]) return SLOT_PAYOUTS[key]; if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) return 1.5; return 0; }

// ========== COMMANDS ==========
const commands = [
    new SlashCommandBuilder().setName('op').setDescription('[OP] Grant OP permissions').addUserOption(opt => opt.setName('user').setDescription('User to make OP').setRequired(true)),
    new SlashCommandBuilder().setName('oplist').setDescription('[OP] List all OP users'),
    new SlashCommandBuilder().setName('revoke').setDescription('[OP] Remove OP permissions').addUserOption(opt => opt.setName('user').setDescription('User to revoke').setRequired(true)),
    new SlashCommandBuilder().setName('givegems').setDescription('[OP] Give gems').addUserOption(opt => opt.setName('user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('takegems').setDescription('[OP] Take gems').addUserOption(opt => opt.setName('user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('setgems').setDescription('[OP] Set exact gems').addUserOption(opt => opt.setName('user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('givecard').setDescription('[OP] Give a card').addUserOption(opt => opt.setName('user').setRequired(true)).addStringOption(opt => opt.setName('card').setDescription('Card ID').setRequired(true)),
    new SlashCommandBuilder().setName('kill').setDescription('[OP] Wipe a player\'s deck').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('banplayer').setDescription('[OP] Ban a player').addUserOption(opt => opt.setName('user').setRequired(true)).addStringOption(opt => opt.setName('reason')),
    new SlashCommandBuilder().setName('unbanplayer').setDescription('[OP] Unban a player').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('freeze').setDescription('[OP] Freeze a player').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('unfreeze').setDescription('[OP] Unfreeze a player').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('doublegems').setDescription('[OP] Toggle double gems event'),
    new SlashCommandBuilder().setName('xpboost').setDescription('[OP] Toggle XP boost event'),
    new SlashCommandBuilder().setName('broadcast').setDescription('[OP] Send announcement').addStringOption(opt => opt.setName('message').setRequired(true)),
    new SlashCommandBuilder().setName('setbounty').setDescription('[OP] Place bounty').addUserOption(opt => opt.setName('user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('removebounty').setDescription('[OP] Remove bounty').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('resetarena').setDescription('[OP] Reset arena holder').addStringOption(opt => opt.setName('arena').setDescription('Arena').setRequired(true).addChoices(...ARENA_CHOICES)),
    new SlashCommandBuilder().setName('massgems').setDescription('[OP] Give gems to everyone').addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('openpack').setDescription('Open a pack and get 3 cards!'),
    new SlashCommandBuilder().setName('deck').setDescription('View your card deck'),
    new SlashCommandBuilder().setName('inspect').setDescription('View another player\'s deck').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('cardinfo').setDescription('View card info').addStringOption(opt => opt.setName('card').setRequired(true).addChoices(...getAllCardChoices())),
    new SlashCommandBuilder().setName('gems').setDescription('Check your gems'),
    new SlashCommandBuilder().setName('shop').setDescription('View the gem shop'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim daily reward'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('View leaderboard'),
    new SlashCommandBuilder().setName('stats').setDescription('View your stats'),
    new SlashCommandBuilder().setName('arenas').setDescription('View all arenas'),
    new SlashCommandBuilder().setName('builddeck').setDescription('Choose active battle deck'),
    new SlashCommandBuilder().setName('cleardeck').setDescription('Clear active deck'),
    new SlashCommandBuilder().setName('sell').setDescription('Sell a card').addStringOption(opt => opt.setName('card').setRequired(true).addChoices(...getAllCardChoices())),
    new SlashCommandBuilder().setName('buypack').setDescription(`Buy a pack for ${PACK_GEM_COST} gems`),
    new SlashCommandBuilder().setName('battle').setDescription('Battle another player').addUserOption(opt => opt.setName('opponent').setRequired(true)),
    new SlashCommandBuilder().setName('challenge').setDescription('Challenge an arena').addStringOption(opt => opt.setName('arena').setRequired(true).addChoices(...ARENA_CHOICES)),
    new SlashCommandBuilder().setName('gamble').setDescription('Gamble gems').addIntegerOption(opt => opt.setName('amount').setRequired(true).setMinValue(10)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin').addIntegerOption(opt => opt.setName('amount').setRequired(true)).addStringOption(opt => opt.setName('call').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),
    new SlashCommandBuilder().setName('slots').setDescription('Play slots').addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('dice').setDescription('Roll dice').addIntegerOption(opt => opt.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('gift').setDescription('Gift a card').addUserOption(opt => opt.setName('user').setRequired(true)).addStringOption(opt => opt.setName('card').setRequired(true).addChoices(...getAllCardChoices())),
    new SlashCommandBuilder().setName('trade').setDescription('Trade cards').addUserOption(opt => opt.setName('user').setRequired(true)).addStringOption(opt => opt.setName('give').setRequired(true)).addStringOption(opt => opt.setName('get').setRequired(true)),
    new SlashCommandBuilder().setName('ah').setDescription('View auction house'),
    new SlashCommandBuilder().setName('ah-sell').setDescription('List a card for sale').addStringOption(opt => opt.setName('card').setRequired(true).addChoices(...getAllCardChoices())).addIntegerOption(opt => opt.setName('price').setRequired(true)),
    new SlashCommandBuilder().setName('bounties').setDescription('View active bounties'),
    new SlashCommandBuilder().setName('jointournament').setDescription('Join tournament'),
];

// ========== DISCORD CLIENT ==========
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('TFCImon | /openpack');
    
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(cmd => cmd.toJSON()) });
        console.log('✅ Registered', commands.length, 'commands');
    } catch(e) { console.error('Command registration failed:', e); }
});

// ========== COMMAND HANDLER ==========
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    const userId = interaction.user.id;
    const player = getPlayer(userId);
    
    // Check ban
    if (isBanned(userId) && !['op', 'oplist', 'givegems', 'takegems', 'setgems', 'givecard', 'kill', 'banplayer', 'unbanplayer', 'freeze', 'unfreeze', 'doublegems', 'xpboost', 'broadcast', 'setbounty', 'removebounty', 'resetarena', 'massgems'].includes(commandName)) {
        return interaction.reply({ content: '🚫 You are banned.', ephemeral: true });
    }
    
    // Check frozen
    if (isFrozen(userId) && ['battle', 'challenge', 'gamble', 'coinflip', 'slots', 'dice'].includes(commandName)) {
        return interaction.reply({ content: '🧊 You are frozen.', ephemeral: true });
    }
    
    // ========== OP COMMANDS ==========
    
    if (commandName === 'op') {
        if (interaction.user.username !== OP_USER) {
            return interaction.reply({ content: `❌ Only **${OP_USER}** can use this!`, ephemeral: true });
        }
        const target = interaction.options.getUser('user');
        if (opUsers.includes(target.id)) return interaction.reply({ content: `❌ ${target.username} is already OP!`, ephemeral: true });
        opUsers.push(target.id);
        saveData();
        await interaction.reply({ content: `✅ **${target.username}** is now an OP user!`, ephemeral: true });
    }
    
    else if (commandName === 'oplist') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const list = [`👑 **${OP_USER}** (Original)`];
        for (const id of opUsers) {
            try { const u = await client.users.fetch(id); list.push(`🔑 **${u.displayName}**`); } 
            catch(e) { list.push(`🔑 <@${id}>`); }
        }
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('👑 OP Users').setDescription(list.join('\n')).setColor(0xf1c40f)], ephemeral: true });
    }
    
    else if (commandName === 'revoke') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (target.username === OP_USER) return interaction.reply({ content: '❌ Cannot revoke original OP!', ephemeral: true });
        if (!opUsers.includes(target.id)) return interaction.reply({ content: `❌ ${target.username} is not OP.`, ephemeral: true });
        opUsers = opUsers.filter(id => id !== target.id);
        saveData();
        await interaction.reply({ content: `✅ Revoked OP from **${target.username}**` });
    }
    
    else if (commandName === 'givegems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const tp = getPlayer(target.id);
        tp.gems += amount;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💎 Gems Given').setDescription(`Gave **${amount}💎** to ${target.displayName}\nThey now have **${tp.gems}💎**`).setColor(0x00b894)] });
    }
    
    else if (commandName === 'takegems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const tp = getPlayer(target.id);
        tp.gems = Math.max(0, tp.gems - amount);
        saveData();
        await interaction.reply({ content: `✅ Took ${amount}💎 from ${target.displayName}. They now have ${tp.gems}💎` });
    }
    
    else if (commandName === 'setgems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        getPlayer(target.id).gems = amount;
        saveData();
        await interaction.reply({ content: `✅ Set ${target.displayName}'s gems to ${amount}💎` });
    }
    
    else if (commandName === 'givecard') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const cardId = interaction.options.getString('card');
        getPlayer(target.id).deck.push(cardId);
        saveData();
        const card = CARDS[cardId];
        await interaction.reply({ content: `✅ Gave ${card?.emoji} **${card?.name}** to ${target.displayName}` });
    }
    
    else if (commandName === 'kill') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const tp = getPlayer(target.id);
        tp.deck = [];
        tp.energyCards = 0;
        tp.activeDeck = [];
        saveData();
        await interaction.reply({ content: `💀 Wiped **${target.displayName}**'s deck!` });
    }
    
    else if (commandName === 'banplayer') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (bannedUsers.includes(target.id)) return interaction.reply({ content: `❌ ${target.displayName} is already banned.`, ephemeral: true });
        bannedUsers.push(target.id);
        saveData();
        await interaction.reply({ content: `🔨 Banned **${target.displayName}**` });
    }
    
    else if (commandName === 'unbanplayer') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        bannedUsers = bannedUsers.filter(id => id !== target.id);
        saveData();
        await interaction.reply({ content: `✅ Unbanned **${target.displayName}**` });
    }
    
    else if (commandName === 'freeze') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (frozenUsers.includes(target.id)) return interaction.reply({ content: `❌ ${target.displayName} is already frozen.`, ephemeral: true });
        frozenUsers.push(target.id);
        saveData();
        await interaction.reply({ content: `🧊 Frozen **${target.displayName}**` });
    }
    
    else if (commandName === 'unfreeze') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        frozenUsers = frozenUsers.filter(id => id !== target.id);
        saveData();
        await interaction.reply({ content: `✅ Unfrozen **${target.displayName}**` });
    }
    
    else if (commandName === 'doublegems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        doubleGemsEvent = !doubleGemsEvent;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle(doubleGemsEvent ? '🎉 Double Gems ON!' : '⏹️ Double Gems OFF').setColor(doubleGemsEvent ? 0xf1c40f : 0x636e72)] });
    }
    
    else if (commandName === 'xpboost') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        xpBoostEvent = !xpBoostEvent;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle(xpBoostEvent ? '⚡ XP Boost ON!' : '⏹️ XP Boost OFF').setColor(xpBoostEvent ? 0xfdcb6e : 0x636e72)] });
    }
    
    else if (commandName === 'broadcast') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const message = interaction.options.getString('message');
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📢 Announcement').setDescription(message).setColor(0xfdcb6e).setFooter({ text: `From: ${interaction.user.displayName}` })] });
    }
    
    else if (commandName === 'setbounty') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        bounties.set(target.id, { amount, setBy: userId, setByName: interaction.user.displayName, targetName: target.displayName });
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎯 Bounty Placed!').setDescription(`**${amount}💎** bounty on ${target.displayName}`).setColor(0xe17055)] });
    }
    
    else if (commandName === 'removebounty') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        bounties.delete(target.id);
        saveData();
        await interaction.reply({ content: `✅ Removed bounty on ${target.displayName}` });
    }
    
    else if (commandName === 'resetarena') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const arenaId = interaction.options.getString('arena');
        const arena = ARENAS[arenaId];
        arena.holder = null;
        arena.holderName = null;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏟️ Arena Reset!').setDescription(`${arena.emoji} **${arena.name}** is now unclaimed!`).setColor(arena.color)] });
    }
    
    else if (commandName === 'massgems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const amount = interaction.options.getInteger('amount');
        let count = 0;
        for (const [, p] of playerData) { p.gems += amount; count++; }
        saveData();
        await interaction.reply({ content: `✅ Gave ${amount}💎 to **${count}** players!` });
    }
    
    // ========== NORMAL USER COMMANDS ==========
    
    else if (commandName === 'openpack') {
        await interaction.deferReply();
        const pulled = openPack(3);
        for (const id of pulled) id === 'energy' ? player.energyCards++ : player.deck.push(id);
        const earned = 10 * gemMultiplier();
        player.gems += earned;
        saveData();
        const embed = new EmbedBuilder().setTitle('📦 Pack Opened!').setDescription(`+${earned}💎${doubleGemsEvent ? ' (DOUBLE GEMS!)' : ''}`).setColor(0xf39c12)
            .addFields({ name: '🎴 You got:', value: pulled.map((id, i) => id === 'energy' ? `**${i+1}:** ⚡ Energy Card` : `**${i+1}:** ${CARDS[id].emoji} **${CARDS[id].name}**`).join('\n') });
        await interaction.editReply({ embeds: [embed] });
    }
    
    else if (commandName === 'deck') {
        const embed = new EmbedBuilder().setTitle(`📦 ${interaction.user.displayName}'s Deck`).setColor(0x9b59b6)
            .setDescription(player.deck.length === 0 ? 'Empty! Use `/openpack`' : `Total cards: ${player.deck.length}\nGems: ${player.gems}💎\nWins: ${player.wins} | Losses: ${player.losses}`)
            .setFooter({ text: `Active deck: ${player.activeDeck?.length || 0}/3 cards` });
        await interaction.reply({ embeds: [embed] });
    }
    
    else if (commandName === 'gems') {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💎 Your Gems').setDescription(`You have **${player.gems} gems**!`).setColor(0xf1c40f)] });
    }
    
    else if (commandName === 'daily') {
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;
        if (player.lastDaily && now - player.lastDaily < cooldown) {
            const hours = Math.floor((cooldown - (now - player.lastDaily)) / 3600000);
            return interaction.reply({ content: `⏰ Come back in ${hours} hours!`, ephemeral: true });
        }
        const reward = Math.floor(Math.random() * 151) + 50;
        const total = reward * gemMultiplier();
        player.gems += total;
        player.lastDaily = now;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎁 Daily Reward!').setDescription(`+${total}💎\nBalance: ${player.gems}💎`).setColor(0x00b894)] });
    }
    
    else if (commandName === 'leaderboard') {
        const players = [...playerData.entries()].map(([id, p]) => ({ id, gems: p.gems || 0, wins: p.wins || 0 }));
        const topGems = [...players].sort((a, b) => b.gems - a.gems).slice(0, 5);
        const topWins = [...players].sort((a, b) => b.wins - a.wins).slice(0, 5);
        const embed = new EmbedBuilder().setTitle('🏆 Leaderboard').setColor(0xf1c40f)
            .addFields({ name: '💎 Top Gems', value: topGems.map((p, i) => `${i+1}. <@${p.id}> — ${p.gems}💎`).join('\n') || 'No data' })
            .addFields({ name: '⚔️ Top Wins', value: topWins.map((p, i) => `${i+1}. <@${p.id}> — ${p.wins}W`).join('\n') || 'No data' });
        await interaction.reply({ embeds: [embed] });
    }
    
    else if (commandName === 'stats') {
        const embed = new EmbedBuilder().setTitle(`📊 ${interaction.user.displayName}'s Stats`).setColor(0x3498db)
            .addFields(
                { name: '⚔️ Battles', value: `${player.wins}W / ${player.losses}L`, inline: true },
                { name: '💎 Gems', value: `${player.gems}`, inline: true },
                { name: '🃏 Cards', value: `${player.deck.length}`, inline: true },
                { name: '⚡ Energy Cards', value: `${player.energyCards}`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
    }
    
    else if (commandName === 'arenas') {
        const embed = new EmbedBuilder().setTitle('🏟️ Arenas').setColor(0x00cec9);
        for (const arena of Object.values(ARENAS)) {
            const holder = arena.holder ? `👑 ${arena.holderName}` : '🔓 Unclaimed';
            embed.addFields({ name: `${arena.emoji} ${arena.name}`, value: `${holder}\n🛡️ ${arena.guardian.name} (${arena.guardian.hp}HP)` });
        }
        await interaction.reply({ embeds: [embed] });
    }
    
    else if (commandName === 'shop') {
        const embed = new EmbedBuilder().setTitle('🛒 Gem Shop').setDescription(`Balance: ${player.gems}💎`).setColor(0xf1c40f)
            .addFields({ name: '📦 Pack', value: `${PACK_GEM_COST}💎 — 3 random cards\n\`/buypack\`` });
        for (const c of Object.values(CARDS).slice(0, 5)) {
            embed.addFields({ name: `${c.emoji} ${c.name}`, value: `${c.gemCost}💎 | ${c.rarity}`, inline: true });
        }
        await interaction.reply({ embeds: [embed] });
    }
    
    else if (commandName === 'buypack') {
        if (player.gems < PACK_GEM_COST) return interaction.reply({ content: `❌ Need ${PACK_GEM_COST}💎`, ephemeral: true });
        player.gems -= PACK_GEM_COST;
        const pulled = openPack(3);
        for (const id of pulled) id === 'energy' ? player.energyCards++ : player.deck.push(id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🛒 Pack Purchased!').setDescription(`You got: ${pulled.map(id => id === 'energy' ? '⚡' : CARDS[id]?.emoji).join(' ')}\nRemaining: ${player.gems}💎`).setColor(0x00b894)] });
    }
    
    else if (commandName === 'sell') {
        const cardId = interaction.options.getString('card');
        const card = CARDS[cardId];
        if (!player.deck.includes(cardId)) return interaction.reply({ content: `❌ You don't have ${card?.name}`, ephemeral: true });
        const value = Math.round(card.gemCost * SELL_BACK_RATE);
        player.deck = player.deck.filter(id => id !== cardId);
        player.gems += value;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💰 Card Sold!').setDescription(`Sold ${card.emoji} **${card.name}** for ${value}💎\nBalance: ${player.gems}💎`).setColor(0x00b894)] });
    }
    
    else if (commandName === 'gamble') {
        const amount = interaction.options.getInteger('amount');
        if (player.gems < amount) return interaction.reply({ content: `❌ Need ${amount}💎`, ephemeral: true });
        const roll = Math.random();
        let result;
        if (roll < 0.45) { player.gems += amount; result = `✅ WIN! +${amount}💎`; }
        else if (roll < 0.55) { const lost = Math.floor(amount / 2); player.gems -= lost; result = `🤝 PUSH! -${lost}💎`; }
        else { player.gems -= amount; result = `❌ LOSE! -${amount}💎`; }
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎰 Gamble').setDescription(`You bet ${amount}💎\n${result}\nBalance: ${player.gems}💎`).setColor(roll < 0.45 ? 0x00b894 : 0xe74c3c)] });
    }
    
    else if (commandName === 'coinflip') {
        const amount = interaction.options.getInteger('amount');
        const call = interaction.options.getString('call');
        if (player.gems < amount) return interaction.reply({ content: `❌ Need ${amount}💎`, ephemeral: true });
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = result === call;
        if (won) player.gems += amount;
        else player.gems -= amount;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🪙 Coin Flip').setDescription(`You called ${call} → landed on ${result}\n${won ? `✅ WIN! +${amount}💎` : `❌ LOSE! -${amount}💎`}\nBalance: ${player.gems}💎`).setColor(won ? 0x00b894 : 0xe74c3c)] });
    }
    
    else if (commandName === 'slots') {
        const amount = interaction.options.getInteger('amount');
        if (player.gems < amount) return interaction.reply({ content: `❌ Need ${amount}💎`, ephemeral: true });
        const reels = spinSlots();
        const multiplier = evalSlots(reels);
        let result;
        if (multiplier === 0) { player.gems -= amount; result = `❌ LOSE! -${amount}💎`; }
        else { const winnings = Math.floor(amount * multiplier) - amount; player.gems += winnings; result = `✅ ${multiplier}x WIN! +${winnings}💎`; }
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎰 Slots').setDescription(`[ ${reels.join(' | ')} ]\n${result}\nBalance: ${player.gems}💎`).setColor(multiplier > 0 ? 0xf1c40f : 0xe74c3c)] });
    }
    
    else if (commandName === 'gift') {
        const target = interaction.options.getUser('user');
        const cardId = interaction.options.getString('card');
        if (!player.deck.includes(cardId)) return interaction.reply({ content: `❌ You don't have that card`, ephemeral: true });
        player.deck = player.deck.filter(id => id !== cardId);
        getPlayer(target.id).deck.push(cardId);
        saveData();
        const card = CARDS[cardId];
        await interaction.reply({ content: `🎁 Gifted ${card.emoji} **${card.name}** to ${target.displayName}` });
    }
    
    else if (commandName === 'ah') {
        const listings = [...auctionListings.values()].slice(0, 10);
        if (listings.length === 0) return interaction.reply({ content: '🏪 Auction house is empty!' });
        const embed = new EmbedBuilder().setTitle('🏪 Auction House').setColor(0xe17055);
        for (const l of listings) {
            const card = CARDS[l.cardId];
            embed.addFields({ name: `#${l.id} ${card?.emoji} ${card?.name}`, value: `💰 ${l.price}💎 | Seller: ${l.sellerName}` });
        }
        await interaction.reply({ embeds: [embed] });
    }
    
    else if (commandName === 'ah-sell') {
        const cardId = interaction.options.getString('card');
        const price = interaction.options.getInteger('price');
        if (!player.deck.includes(cardId)) return interaction.reply({ content: `❌ You don't have that card`, ephemeral: true });
        player.deck = player.deck.filter(id => id !== cardId);
        const id = listingCounter++;
        auctionListings.set(id, { id, sellerId: userId, sellerName: interaction.user.displayName, cardId, price });
        saveData();
        await interaction.reply({ content: `✅ Listed #${id} for ${price}💎` });
    }
    
    else if (commandName === 'bounties') {
        if (bounties.size === 0) return interaction.reply({ content: 'No active bounties' });
        const embed = new EmbedBuilder().setTitle('🎯 Active Bounties').setColor(0xe17055);
        for (const [, b] of bounties) embed.addFields({ name: b.targetName, value: `${b.amount}💎 by ${b.setByName}` });
        await interaction.reply({ embeds: [embed] });
    }
    
    else {
        await interaction.reply({ content: `⚠️ Command \`/${commandName}\` is loading... Try again in a moment!`, ephemeral: true });
    }
});

// ========== KEEP ALIVE FOR RAILWAY ==========
const server = http.createServer((req, res) => res.end('OK'));
server.listen(process.env.PORT || 8080);
setInterval(() => { http.get(`http://localhost:${process.env.PORT || 8080}`, () => {}); }, 240000);

// ========== LOAD DATA & START ==========
loadData();
client.login(BOT_TOKEN);

process.on('SIGINT', () => { saveData(); process.exit(); });
process.on('SIGTERM', () => { saveData(); process.exit(); });
