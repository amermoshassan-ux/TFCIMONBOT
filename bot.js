// TFCImon Discord Bot — COMPLETE WORKING VERSION WITH 24/7 KEEP-ALIVE
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OP_USER = 'haxiii7';

// Validate environment variables
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is not set in environment variables!');
    process.exit(1);
}
if (!CLIENT_ID) {
    console.error('❌ CLIENT_ID is not set in environment variables!');
    process.exit(1);
}

console.log(`✅ Bot token loaded successfully`);
console.log(`✅ Client ID loaded: ${CLIENT_ID}`);

// ─── PERSISTENT STORAGE ───────────────────────────────────────────────────────
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
let buildDeckSessions = new Map();
let tradeCounter = 1;

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const savedData = JSON.parse(raw);
            
            playerData = new Map(Object.entries(savedData.players || {}));
            
            for (const [arenaId, arenaState] of Object.entries(savedData.arenas || {})) {
                if (ARENAS[arenaId]) {
                    ARENAS[arenaId].holder = arenaState.holder || null;
                    ARENAS[arenaId].holderName = arenaState.holderName || null;
                }
            }
            
            auctionListings = new Map(Object.entries(savedData.auctionListings || {}).map(([k, v]) => [parseInt(k), v]));
            listingCounter = savedData.listingCounter || 1;
            doubleGemsEvent = savedData.doubleGemsEvent || false;
            xpBoostEvent = savedData.xpBoostEvent || false;
            opUsers = savedData.opUsers || [];
            bounties = new Map(Object.entries(savedData.bounties || {}));
            bannedUsers = savedData.bannedUsers || [];
            frozenUsers = savedData.frozenUsers || [];
            
            for (const [id, card] of Object.entries(savedData.customCards || {})) {
                CARDS[id] = card;
            }
            
            console.log(`✅ Loaded ${playerData.size} players, ${auctionListings.size} AH listings, ${bounties.size} bounties`);
            return;
        }
    } catch (e) {
        console.error('Failed to load data.json:', e.message);
    }
    console.log('📁 No existing data found, starting fresh.');
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
        console.log('💾 Data saved successfully');
    } catch (e) {
        console.error('Failed to save data.json:', e.message);
    }
}

setInterval(saveData, 60000);

// ─── CARD DATA ────────────────────────────────────────────────────────────────
const CARDS = {
    celestia: {
        id: 'celestia', name: 'Celestia', hp: 200, type: 'Dark', rarity: 'Rare', emoji: '🌑', color: 0x2c2c54,
        description: 'A dark warrior with flower-like wings and heavy armor.', gemCost: 300,
        moves: [
            { name: '#Goon', damage: 75, cost: 2, emoji: '👊' },
            { name: 'Drawing w/ Downfall', damage: 150, cost: 4, emoji: '🌀' },
        ],
    },
    flame: {
        id: 'flame', name: 'Flame', hp: 200, type: 'Fire', rarity: 'Rare', emoji: '🔥', color: 0xe84545,
        description: 'Type: Fire | #1 CEO | A plaid-shirted cat with a sailor cap.', gemCost: 300,
        moves: [
            { name: 'Timeout', damage: 50, cost: 2, emoji: '⏱️' },
            { name: 'Kick', damage: 100, cost: 3, emoji: '🦵' },
            { name: 'Ban', damage: 250, cost: 6, emoji: '🔨' },
        ],
    },
    isy: {
        id: 'isy', name: 'Isy EX', hp: 150, type: 'Normal', rarity: 'EX', emoji: '🍌', color: 0x3498db,
        description: 'Type: Normal | T★2 | Member MECT — EX card!', gemCost: 500,
        moves: [
            { name: 'Banana', damage: 50, cost: 2, emoji: '🍌' },
            { name: 'Summon-SPK', damage: 100, cost: 4, emoji: '📢' },
            { name: 'EX POWER: Summon Banana Kingdom', damage: 180, cost: 6, emoji: '👑', isEx: true },
        ],
    },
    michael: {
        id: 'michael', name: 'Michael the Keeper', hp: 300, type: 'Shadow', rarity: 'LEGENDARY', emoji: '👁️', color: 0x1a1a2e,
        description: '⚠️ LEGENDARY — The rarest card in existence.', gemCost: 2000,
        moves: [
            { name: 'Hiding in Not Plain Sight', damage: 100, cost: 3, emoji: '🌫️' },
            { name: 'Server Hopper 3000', damage: 130, cost: 4, emoji: '🚀' },
        ],
    },
    spk_iii: {
        id: 'spk_iii', name: 'SPK_III', hp: 180, type: 'Normal', rarity: 'Uncommon', emoji: '🔊', color: 0xf39c12,
        description: 'A powerful speaker with banana energy and tough resolve.', gemCost: 200,
        moves: [
            { name: 'Banan', damage: 75, cost: 2, emoji: '🍌' },
            { name: 'Tuff Stuff', damage: 170, cost: 5, emoji: '💪' },
        ],
    },
    shadowfox: {
        id: 'shadowfox', name: 'Shadow Fox', hp: 220, type: 'Shadow', rarity: 'Rare', emoji: '🦊', color: 0x6c3483,
        description: 'A cunning fox that strikes from the darkness.', gemCost: 350,
        moves: [
            { name: 'Phantom Dash', damage: 80, cost: 2, emoji: '💨' },
            { name: 'Shadow Bite', damage: 140, cost: 3, emoji: '🦷' },
            { name: 'Eclipse Strike', damage: 200, cost: 5, emoji: '🌑' },
        ],
    },
    stormking: {
        id: 'stormking', name: 'Storm King', hp: 250, type: 'Electric', rarity: 'Rare', emoji: '⚡', color: 0xf9ca24,
        description: 'The ruler of storms. His wrath is lightning itself.', gemCost: 400,
        moves: [
            { name: 'Thunder Clap', damage: 90, cost: 2, emoji: '⚡' },
            { name: 'Static Prison', damage: 120, cost: 3, emoji: '🔒' },
            { name: 'LIGHTNING THRONE', damage: 220, cost: 6, emoji: '👑' },
        ],
    },
    voidwalker: {
        id: 'voidwalker', name: 'Void Walker', hp: 170, type: 'Void', rarity: 'EX', emoji: '🌀', color: 0x130f40,
        description: 'Steps between dimensions. Cannot be predicted.', gemCost: 600,
        moves: [
            { name: 'Phase Shift', damage: 60, cost: 1, emoji: '🌀' },
            { name: 'Dimension Rip', damage: 130, cost: 3, emoji: '🕳️' },
            { name: 'EX: VOID COLLAPSE', damage: 220, cost: 6, emoji: '💀', isEx: true },
        ],
    },
    ironclad: {
        id: 'ironclad', name: 'Ironclad', hp: 350, type: 'Steel', rarity: 'Rare', emoji: '🛡️', color: 0x7f8c8d,
        description: 'An unstoppable wall of metal. Slow but devastating.', gemCost: 380,
        moves: [
            { name: 'Iron Wall', damage: 40, cost: 1, emoji: '🛡️' },
            { name: 'Steel Crush', damage: 110, cost: 3, emoji: '⚙️' },
            { name: 'FORTRESS BREAK', damage: 190, cost: 5, emoji: '💥' },
        ],
    },
    cosmicqueen: {
        id: 'cosmicqueen', name: 'Cosmic Queen', hp: 230, type: 'Cosmic', rarity: 'LEGENDARY', emoji: '🌌', color: 0x9b59b6,
        description: '✨ LEGENDARY — Born from the collapse of a star.', gemCost: 2500,
        moves: [
            { name: 'Stardust', damage: 90, cost: 2, emoji: '✨' },
            { name: 'Nebula Burst', damage: 160, cost: 4, emoji: '🌌' },
            { name: 'BIG BANG', damage: 280, cost: 7, emoji: '💫', isEx: true },
        ],
    },
};

const PACK_WEIGHTS = {
    celestia: 20, flame: 20, isy: 15, spk_iii: 10, michael: 1,
    shadowfox: 10, stormking: 9, voidwalker: 6, ironclad: 8, cosmicqueen: 0.5,
    energy: 7,
};

const PACK_GEM_COST = 150;
const SELL_BACK_RATE = 0.3;

// ─── ARENA DATA ───────────────────────────────────────────────────────────────
const ARENAS = {
    '100_player_island': {
        id: '100_player_island', name: '100 Player Island', emoji: '🏝️', color: 0x00b894,
        description: 'Only one survives.', holder: null, holderName: null,
        guardian: { name: 'THE LAST ONE', emoji: '💀', hp: 350, energy: 4, moves: [
            { name: 'Island Wipe', damage: 90, cost: 2, emoji: '🌊' },
            { name: 'Final Circle', damage: 160, cost: 4, emoji: '🔴' },
            { name: 'Only Survivor', damage: 240, cost: 6, emoji: '☠️' },
        ]},
    },
    mingle: {
        id: 'mingle', name: 'Mingle', emoji: '💞', color: 0xff6b9d,
        description: 'Friendships made and destroyed.', holder: null, holderName: null,
        guardian: { name: 'CUPID REAPER', emoji: '💘', hp: 280, energy: 3, moves: [
            { name: 'Heartbreak Strike', damage: 80, cost: 2, emoji: '💔' },
            { name: 'Toxic Charm', damage: 130, cost: 3, emoji: '🩷' },
            { name: 'Lovebomb', damage: 200, cost: 5, emoji: '💣' },
        ]},
    },
    rlgl: {
        id: 'rlgl', name: 'RLGL', emoji: '🚦', color: 0xe74c3c,
        description: "One wrong move and you're gone.", holder: null, holderName: null,
        guardian: { name: 'THE DOLL', emoji: '🎎', hp: 320, energy: 3, moves: [
            { name: 'Red Light', damage: 60, cost: 1, emoji: '🔴' },
            { name: 'Green Light Rush', damage: 120, cost: 3, emoji: '🟢' },
            { name: 'Elimination', damage: 220, cost: 5, emoji: '🎯' },
        ]},
    },
    jumprope: {
        id: 'jumprope', name: 'Jumprope', emoji: '🪢', color: 0x6c5ce7,
        description: 'The rope never stops.', holder: null, holderName: null,
        guardian: { name: 'ROPEGOD', emoji: '🌀', hp: 260, energy: 3, moves: [
            { name: 'Whiplash', damage: 70, cost: 2, emoji: '💫' },
            { name: 'Double Dutch', damage: 140, cost: 3, emoji: '🌀' },
            { name: 'Infinite Loop', damage: 190, cost: 5, emoji: '♾️' },
        ]},
    },
    spinner: {
        id: 'spinner', name: 'Spinner', emoji: '🌪️', color: 0xfdcb6e,
        description: 'Spin the wheel. Face what it lands on.', holder: null, holderName: null,
        guardian: { name: 'VORTEX', emoji: '🌪️', hp: 290, energy: 3, moves: [
            { name: 'Dizzy Slam', damage: 85, cost: 2, emoji: '😵' },
            { name: 'Tornado Fist', damage: 150, cost: 4, emoji: '🌪️' },
            { name: 'Chaos Spin', damage: 210, cost: 6, emoji: '💥' },
        ]},
    },
    red_vs_blue: {
        id: 'red_vs_blue', name: 'Red vs Blue Island', emoji: '⚔️', color: 0xd63031,
        description: 'There is no neutral here.', holder: null, holderName: null,
        guardian: { name: 'COMMANDER NULL', emoji: '🎖️', hp: 330, energy: 4, moves: [
            { name: 'Blue Barrage', damage: 95, cost: 2, emoji: '🔵' },
            { name: 'Red Rush', damage: 145, cost: 3, emoji: '🔴' },
            { name: 'Total War', damage: 230, cost: 6, emoji: '💣' },
        ]},
    },
    pick_a_side: {
        id: 'pick_a_side', name: 'Pick a Side', emoji: '🪙', color: 0x2d3436,
        description: 'Every choice has a consequence.', holder: null, holderName: null,
        guardian: { name: 'THE DECIDER', emoji: '⚖️', hp: 310, energy: 3, moves: [
            { name: 'Coin Flip Crush', damage: 75, cost: 2, emoji: '🪙' },
            { name: 'Wrong Choice', damage: 140, cost: 3, emoji: '❌' },
            { name: 'Judgement Day', damage: 250, cost: 6, emoji: '⚖️' },
        ]},
    },
};

const ARENA_CHOICES = [
    { name: '🏝️ 100 Player Island', value: '100_player_island' },
    { name: '💞 Mingle', value: 'mingle' },
    { name: '🚦 RLGL', value: 'rlgl' },
    { name: '🪢 Jumprope', value: 'jumprope' },
    { name: '🌪️ Spinner', value: 'spinner' },
    { name: '⚔️ Red vs Blue Island', value: 'red_vs_blue' },
    { name: '🪙 Pick a Side', value: 'pick_a_side' },
];

// ─── SLOT MACHINE ─────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ['🍋', '🍒', '🔔', '⭐', '💎', '7️⃣'];
const SLOT_PAYOUTS = {
    '💎💎💎': 20,
    '7️⃣7️⃣7️⃣': 15,
    '⭐⭐⭐': 10,
    '🔔🔔🔔': 7,
    '🍒🍒🍒': 5,
    '🍋🍋🍋': 4,
    'pair': 1.5,
};

// ─── LOAD DATA ────────────────────────────────────────────────────────────────
loadData();

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
function getPlayer(userId) {
    if (!playerData.has(userId)) {
        playerData.set(userId, { deck: [], activeDeck: [], energyCards: 0, gems: 100, nicknames: {}, wins: 0, losses: 0, cardWins: {}, cardLosses: {}, cardLevels: {}, lastDaily: null, totalBattles: 0 });
    }
    const p = playerData.get(userId);
    if (!p.wins) p.wins = 0;
    if (!p.losses) p.losses = 0;
    if (!p.cardWins) p.cardWins = {};
    if (!p.cardLosses) p.cardLosses = {};
    if (!p.cardLevels) p.cardLevels = {};
    if (!p.lastDaily) p.lastDaily = null;
    if (!p.totalBattles) p.totalBattles = 0;
    if (!p.nicknames) p.nicknames = {};
    if (!p.activeDeck) p.activeDeck = [];
    return p;
}

function isBanned(userId) { return bannedUsers.includes(userId); }
function isFrozen(userId) { return frozenUsers.includes(userId); }
function getCardLevel(player, cardId) { return player.cardLevels[cardId] || 1; }
function getLevelBonus(level) { return (level - 1) * 10; }
function gemMultiplier() { return doubleGemsEvent ? 2 : 1; }
function xpThreshold() { return xpBoostEvent ? 2 : 3; }
function isOp(interaction) { return interaction.user.username === OP_USER || opUsers.includes(interaction.user.id); }

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
    if (affordable.length === 0) return guardian.moves.reduce((a, b) => a.cost < b.cost ? a : b);
    return affordable.reduce((best, m) => m.damage > best.damage ? m : best);
}

function getBattleCard(player) {
    if (player.activeDeck && player.activeDeck.length > 0) {
        const valid = player.activeDeck.filter(id => player.deck.includes(id) && CARDS[id]);
        if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    }
    const valid = player.deck.filter(id => CARDS[id]);
    return valid[Math.floor(Math.random() * valid.length)];
}

function spinSlots() {
    return [
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];
}

function evalSlots(reels) {
    const key = reels.join('');
    if (SLOT_PAYOUTS[key]) return SLOT_PAYOUTS[key];
    if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) return SLOT_PAYOUTS['pair'];
    return 0;
}

function getAllCardChoices() {
    return Object.values(CARDS).map(c => ({ name: `${c.emoji} ${c.name} (${c.gemCost}💎) — ${c.rarity}`, value: c.id })).slice(0, 25);
}

function buildDeckEmbed(userId, player, displayName) {
    const embed = new EmbedBuilder()
        .setTitle(`📦 ${displayName}'s TFCImon Deck`)
        .setColor(0x9b59b6)
        .setFooter({ text: `💎 ${player.gems} gems | ⚡ ${player.energyCards} energy cards | ⚔️ ${player.wins}W ${player.losses}L` });

    if (player.deck.length === 0) {
        embed.setDescription('Deck is empty! Use `/openpack` to get cards.');
        return embed;
    }

    const counts = {};
    for (const id of player.deck) counts[id] = (counts[id] || 0) + 1;

    const lines = Object.entries(counts).map(([id, count]) => {
        const card = CARDS[id];
        if (!card) return null;
        const nickname = player.nicknames[id] ? ` *"${player.nicknames[id]}"*` : '';
        const level = getCardLevel(player, id);
        const lvlStr = level > 1 ? ` ⬆️Lv${level}` : '';
        const wins = player.cardWins[id] || 0;
        const inActive = player.activeDeck && player.activeDeck.includes(id) ? ' 🎯' : '';
        return `${card.emoji} **${card.name}**${nickname}${lvlStr}${inActive} ×${count} — ${card.hp}HP | ${card.rarity} | ${wins}W`;
    }).filter(Boolean);

    embed.setDescription(lines.join('\n'));
    if (player.activeDeck && player.activeDeck.length > 0) {
        const activeNames = player.activeDeck.map(id => CARDS[id]?.name || id).join(', ');
        embed.addFields({ name: '🎯 Active Battle Deck', value: activeNames });
    }

    if (bounties.has(userId)) {
        const b = bounties.get(userId);
        embed.addFields({ name: '🎯 BOUNTY', value: `**${b.amount}💎** — set by ${b.setByName}` });
    }

    if (isFrozen(userId)) {
        embed.addFields({ name: '🧊 FROZEN', value: 'This player cannot battle or gamble.' });
    }

    embed.addFields({ name: '🃏 Total Cards', value: `${player.deck.length}`, inline: true });
    return embed;
}

// ─── COMMAND REGISTRATION ─────────────────────────────────────────────────────
const commands = [
    new SlashCommandBuilder().setName('openpack').setDescription('Open a TFCImon pack and get 3 cards!').toJSON(),
    new SlashCommandBuilder().setName('deck').setDescription('View your TFCImon card deck').toJSON(),
    new SlashCommandBuilder().setName('inspect').setDescription("View another player's deck").addUserOption(opt => opt.setName('user').setDescription('Player to inspect').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('cardinfo').setDescription('View detailed info about any card').addStringOption(opt => opt.setName('card').setDescription('Card to inspect').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('gems').setDescription('Check your gem balance').toJSON(),
    new SlashCommandBuilder().setName('shop').setDescription('View the gem shop').toJSON(),
    new SlashCommandBuilder().setName('daily').setDescription('Claim your daily gem reward!').toJSON(),
    new SlashCommandBuilder().setName('leaderboard').setDescription('View the TFCImon leaderboard').toJSON(),
    new SlashCommandBuilder().setName('top').setDescription('Shortcut: View leaderboard').toJSON(),
    new SlashCommandBuilder().setName('stats').setDescription('View your battle stats').toJSON(),
    new SlashCommandBuilder().setName('arenas').setDescription('View all arenas and holders').toJSON(),
    new SlashCommandBuilder().setName('builddeck').setDescription('Choose up to 3 cards as your active battle deck').toJSON(),
    new SlashCommandBuilder().setName('cleardeck').setDescription('Clear your active deck and go back to random card selection').toJSON(),
    new SlashCommandBuilder().setName('order').setDescription('Sort your deck cards').addStringOption(opt => opt.setName('by').setDescription('How to sort').setRequired(true).addChoices({ name: '⭐ Rarity', value: 'rarity' }, { name: '❤️ HP', value: 'hp' }, { name: '🔤 Name', value: 'name' }, { name: '🏆 Wins', value: 'wins' }, { name: '⬆️ Level', value: 'level' })).toJSON(),
    new SlashCommandBuilder().setName('sell').setDescription(`Sell a card`).addStringOption(opt => opt.setName('card').setDescription('Card to sell').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('buypack').setDescription(`Buy a pack for ${PACK_GEM_COST} gems`).toJSON(),
    new SlashCommandBuilder().setName('battle').setDescription('Challenge another member!').addUserOption(opt => opt.setName('opponent').setDescription('The member to battle').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('name').setDescription('Give a nickname to a card').addStringOption(opt => opt.setName('card').setDescription('Card to rename').setRequired(true).addChoices(...getAllCardChoices())).addStringOption(opt => opt.setName('nickname').setDescription('The nickname').setRequired(true).setMaxLength(32)).toJSON(),
    new SlashCommandBuilder().setName('challenge').setDescription('Challenge an arena guardian!').addStringOption(opt => opt.setName('arena').setDescription('Which arena').setRequired(true).addChoices(...ARENA_CHOICES)).toJSON(),
    new SlashCommandBuilder().setName('gamble').setDescription('Gamble gems').addIntegerOption(opt => opt.setName('amount').setDescription('Amount to gamble').setRequired(true).setMinValue(10)).toJSON(),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin!').addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(5)).addStringOption(opt => opt.setName('call').setDescription('Heads or tails?').setRequired(true).addChoices({ name: '🪙 Heads', value: 'heads' }, { name: '🔵 Tails', value: 'tails' })).toJSON(),
    new SlashCommandBuilder().setName('slots').setDescription('Spin the slot machine!').addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(10)).toJSON(),
    new SlashCommandBuilder().setName('dice').setDescription('Roll dice!').addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(10)).addStringOption(opt => opt.setName('mode').setDescription('Game mode').setRequired(true).addChoices({ name: '🎲 Classic', value: 'classic' }, { name: '🎲🎲 High Stakes', value: 'highstakes' }, { name: '🃏 Lucky 21', value: 'lucky21' })).toJSON(),
    new SlashCommandBuilder().setName('bounties').setDescription('View all active bounties').toJSON(),
    new SlashCommandBuilder().setName('gift').setDescription('Gift a card').addUserOption(opt => opt.setName('user').setDescription('Who to gift to').setRequired(true)).addStringOption(opt => opt.setName('card').setDescription('Card to gift').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('trade').setDescription('Trade cards').addUserOption(opt => opt.setName('user').setDescription('Who to trade with').setRequired(true)).addStringOption(opt => opt.setName('yougive').setDescription('Card you give').setRequired(true).addChoices(...getAllCardChoices())).addStringOption(opt => opt.setName('youget').setDescription('Card you want').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('ah').setDescription('Browse auction house').toJSON(),
    new SlashCommandBuilder().setName('ah-sell').setDescription('List a card').addStringOption(opt => opt.setName('card').setDescription('Card to sell').setRequired(true).addChoices(...getAllCardChoices())).addIntegerOption(opt => opt.setName('price').setDescription('Buy price').setRequired(true).setMinValue(1)).toJSON(),
    new SlashCommandBuilder().setName('jointournament').setDescription('Join tournament!').toJSON(),
    new SlashCommandBuilder().setName('op').setDescription('[OP] Grant OP').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).toJSON(),
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash commands registered!');
    } catch (err) { console.error('Failed to register commands:', err); }
}

// ─── DISCORD CLIENT ──────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`✅ TFCImon bot online as ${client.user.tag}!`);
    client.user.setActivity('TFCImon — /openpack to start!');
});

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    const userId = interaction.user.id;
    
    if (isBanned(userId) && commandName !== 'op') {
        return interaction.reply({ content: '🚫 You are banned from TFCImon.', ephemeral: true });
    }
    
    const freezeBlocked = ['battle', 'challenge', 'gamble', 'coinflip', 'slots', 'dice'];
    if (isFrozen(userId) && freezeBlocked.includes(commandName)) {
        return interaction.reply({ content: '🧊 You are frozen and cannot battle or gamble.', ephemeral: true });
    }
    
    const player = getPlayer(userId);
    
    // ─── OPENPACK ────────────────────────────────────────────────────────────────
    if (commandName === 'openpack') {
        await interaction.deferReply();
        const pulled = openPack(3);
        for (const id of pulled) id === 'energy' ? player.energyCards++ : player.deck.push(id);
        const earned = 10 * gemMultiplier();
        player.gems += earned;
        saveData();
        
        const embed = new EmbedBuilder()
            .setTitle('📦 Pack Opened!')
            .setDescription(`${interaction.user.displayName} tore open a pack!\n+${earned}💎${doubleGemsEvent ? ' 🎉 DOUBLE GEMS!' : ''}`)
            .setColor(0xf39c12)
            .addFields({ name: '🎴 You got:', value: pulled.map((id, i) => {
                if (id === 'energy') return `**${i+1}:** ⚡ Energy Card`;
                const c = CARDS[id];
                return `**${i+1}:** ${c.emoji} **${c.name}** — ${c.hp}HP`;
            }).join('\n') });
        await interaction.editReply({ embeds: [embed] });
    }
    
    // ─── DECK ───────────────────────────────────────────────────────────────────
    else if (commandName === 'deck') {
        await interaction.reply({ embeds: [buildDeckEmbed(userId, player, interaction.user.displayName)] });
    }
    
    // ─── INSPECT ────────────────────────────────────────────────────────────────
    else if (commandName === 'inspect') {
        const target = interaction.options.getUser('user');
        const tp = getPlayer(target.id);
        await interaction.reply({ embeds: [buildDeckEmbed(target.id, tp, target.displayName)] });
    }
    
    // ─── GEMS ───────────────────────────────────────────────────────────────────
    else if (commandName === 'gems') {
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('💎 Your Gems')
            .setDescription(`You have **${player.gems} gems**!\n\n• Open packs: +${10 * gemMultiplier()}💎\n• Win PvP: +${25 * gemMultiplier()}💎\n• Conquer arena: +${50 * gemMultiplier()}💎\n• Daily reward: up to 200💎\n• Gambling 🎰\n• Selling cards 💰`)
            .setColor(0xf1c40f)
        ] });
    }
    
    // ─── DAILY ──────────────────────────────────────────────────────────────────
    else if (commandName === 'daily') {
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;
        if (player.lastDaily && now - player.lastDaily < cooldown) {
            const remaining = cooldown - (now - player.lastDaily);
            const h = Math.floor(remaining / 3600000);
            const m = Math.floor((remaining % 3600000) / 60000);
            return interaction.reply({ content: `⏰ Come back in **${h}h ${m}m**.`, ephemeral: true });
        }
        const reward = Math.floor(Math.random() * 151) + 50;
        const total = reward * gemMultiplier();
        player.gems += total;
        player.lastDaily = now;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🎁 Daily Reward!')
            .setDescription(`+**${total}💎 gems**${doubleGemsEvent ? ' (×2!)' : ''}\nTotal: **${player.gems}💎**`)
            .setColor(0x00b894)
        ] });
    }
    
    // ─── LEADERBOARD ───────────────────────────────────────────────────────────
    else if (commandName === 'leaderboard' || commandName === 'top') {
        const players = [...playerData.entries()].map(([id, p]) => ({ id, ...p }));
        const byWins = [...players].sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 5);
        const byGems = [...players].sort((a, b) => (b.gems || 0) - (a.gems || 0)).slice(0, 5);
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const embed = new EmbedBuilder().setTitle('🏆 TFCImon Leaderboard').setColor(0xf1c40f);
        embed.addFields(
            { name: '⚔️ Top Battlers', value: byWins.map((p, i) => `${medals[i]} <@${p.id}> — **${p.wins || 0}W**`).join('\n') || 'No battles yet!' },
            { name: '💎 Top Gem Holders', value: byGems.map((p, i) => `${medals[i]} <@${p.id}> — **${p.gems || 0}💎**`).join('\n') || 'No data!' }
        );
        const holders = Object.values(ARENAS).filter(a => a.holder).map(a => `${a.emoji} **${a.name}** → ${a.holderName}`).join('\n');
        if (holders) embed.addFields({ name: '🏟️ Arena Holders', value: holders });
        await interaction.reply({ embeds: [embed] });
    }
    
    // ─── STATS ──────────────────────────────────────────────────────────────────
    else if (commandName === 'stats') {
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${interaction.user.displayName}'s Stats`)
            .setColor(0x3498db)
            .addFields(
                { name: '⚔️ Battles', value: `${player.wins}W / ${player.losses}L`, inline: true },
                { name: '💎 Gems', value: `${player.gems}`, inline: true },
                { name: '🃏 Cards', value: `${player.deck.length}`, inline: true },
                { name: '⚡ Energy Cards', value: `${player.energyCards}`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
    }
    
    // ─── SHOP ───────────────────────────────────────────────────────────────────
    else if (commandName === 'shop') {
        const embed = new EmbedBuilder()
            .setTitle('🛒 TFCImon Gem Shop')
            .setDescription(`Balance: **${player.gems}💎**\nSell cards for ${Math.round(SELL_BACK_RATE * 100)}% back.`)
            .setColor(0xf1c40f)
            .addFields({ name: '📦 Pack (150💎)', value: '3 random cards — `/buypack`' });
        for (const c of Object.values(CARDS).slice(0, 5)) {
            embed.addFields({ name: `${c.emoji} ${c.name} (${c.gemCost}💎)`, value: `${c.rarity} | ${c.hp}HP`, inline: true });
        }
        await interaction.reply({ embeds: [embed] });
    }
    
    // ─── BUYPACK ────────────────────────────────────────────────────────────────
    else if (commandName === 'buypack') {
        if (player.gems < PACK_GEM_COST) {
            return interaction.reply({ content: `❌ Need ${PACK_GEM_COST}💎, have ${player.gems}💎.`, ephemeral: true });
        }
        player.gems -= PACK_GEM_COST;
        const pulled = openPack(3);
        for (const id of pulled) id === 'energy' ? player.energyCards++ : player.deck.push(id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🛒 Pack Purchased!')
            .setDescription(`You got: ${pulled.map(id => id === 'energy' ? '⚡ Energy Card' : CARDS[id]?.name).join(', ')}`)
            .setColor(0xf39c12)
            .setFooter({ text: `Remaining: ${player.gems}💎` })
        ] });
    }
    
    // ─── SELL ───────────────────────────────────────────────────────────────────
    else if (commandName === 'sell') {
        const cardId = interaction.options.getString('card');
        const card = CARDS[cardId];
        if (!player.deck.includes(cardId)) {
            return interaction.reply({ content: `❌ You don't have **${card?.name}**!`, ephemeral: true });
        }
        const val = Math.round(card.gemCost * SELL_BACK_RATE);
        player.deck.splice(player.deck.indexOf(cardId), 1);
        player.gems += val;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('💰 Card Sold!')
            .setDescription(`Sold ${card.emoji} **${card.name}** for **${val}💎**!\nBalance: **${player.gems}💎**`)
            .setColor(0x00b894)
        ] });
    }
    
    // ─── GAMBLE ─────────────────────────────────────────────────────────────────
    else if (commandName === 'gamble') {
        const amount = interaction.options.getInteger('amount');
        if (player.gems < amount) {
            return interaction.reply({ content: `❌ You only have ${player.gems}💎!`, ephemeral: true });
        }
        const roll = Math.random();
        let result;
        if (roll < 0.45) {
            player.gems += amount;
            result = `🎰 **YOU WIN!** +${amount}💎`;
        } else if (roll < 0.55) {
            const lost = Math.floor(amount / 2);
            player.gems -= lost;
            result = `🎰 **PUSH!** -${lost}💎`;
        } else {
            player.gems -= amount;
            result = `🎰 **YOU LOSE!** -${amount}💎`;
        }
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🎰 Gem Gamble!')
            .setDescription(`You bet **${amount}💎**\n\n${result}\nBalance: **${player.gems}💎**`)
            .setColor(roll < 0.45 ? 0x00b894 : roll < 0.55 ? 0xf39c12 : 0xe74c3c)
        ] });
    }
    
    // ─── COINFLIP ───────────────────────────────────────────────────────────────
    else if (commandName === 'coinflip') {
        const amount = interaction.options.getInteger('amount');
        const call = interaction.options.getString('call');
        if (player.gems < amount) {
            return interaction.reply({ content: `❌ You only have ${player.gems}💎!`, ephemeral: true });
        }
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = result === call;
        if (won) player.gems += amount;
        else player.gems -= amount;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`🪙 Coin Flip!`)
            .setDescription(`You called **${call}** — landed on **${result}**!\n\n${won ? `✅ **YOU WIN! +${amount}💎**` : `❌ **YOU LOSE! -${amount}💎**`}\nBalance: **${player.gems}💎**`)
            .setColor(won ? 0x00b894 : 0xe74c3c)
        ] });
    }
    
    // ─── SLOTS ──────────────────────────────────────────────────────────────────
    else if (commandName === 'slots') {
        const amount = interaction.options.getInteger('amount');
        if (player.gems < amount) {
            return interaction.reply({ content: `❌ You only have ${player.gems}💎!`, ephemeral: true });
        }
        const reels = spinSlots();
        const multiplier = evalSlots(reels);
        let resultText;
        if (multiplier === 0) {
            player.gems -= amount;
            resultText = `❌ No match! **-${amount}💎**`;
        } else {
            const winnings = Math.floor(amount * multiplier) - amount;
            player.gems += winnings;
            resultText = `✅ **${multiplier}x multiplier!** +${winnings}💎`;
        }
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🎰 Slot Machine!')
            .setDescription(`\`\`\`\n[ ${reels.join(' | ')} ]\n\`\`\`\n${resultText}\nBalance: **${player.gems}💎**`)
            .setColor(multiplier > 0 ? 0xf1c40f : 0xe74c3c)
        ] });
    }


        // ─── COMPLETE INTERACTION HANDLER WITH ALL OP COMMANDS ─────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    const userId = interaction.user.id;
    
    // Check ban (OP commands still work for banned users)
    const opCommandsList = ['op', 'makecard', 'editcard', 'setrarity', 'setgems', 'givegems', 'takegems', 'givecard', 'kill', 'wipeall', 'clonecard', 'banplayer', 'unbanplayer', 'setarenacholder', 'broadcast', 'resetarena', 'announce', 'doublegems', 'tournament', 'listcards', 'setbounty', 'removebounty', 'addmove', 'removemove', 'masspacks', 'massgems', 'setbio', 'freeze', 'unfreeze', 'ahdelist', 'xpboost', 'oplist', 'revoke'];
    
    if (isBanned(userId) && !opCommandsList.includes(commandName)) {
        return interaction.reply({ content: '🚫 You are banned from TFCImon.', ephemeral: true });
    }
    
    const freezeBlocked = ['battle', 'challenge', 'gamble', 'coinflip', 'slots', 'dice'];
    if (isFrozen(userId) && freezeBlocked.includes(commandName)) {
        return interaction.reply({ content: '🧊 You are frozen and cannot battle or gamble.', ephemeral: true });
    }
    
    const player = getPlayer(userId);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // OP COMMANDS - Full Implementation
    // ═══════════════════════════════════════════════════════════════════════════
    
    // /op - Grant OP permissions
    if (commandName === 'op') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (opUsers.includes(target.id)) return interaction.reply({ content: `❌ **${target.displayName}** is already OP!`, ephemeral: true });
        opUsers.push(target.id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('👑 OP Granted!')
            .setDescription(`**${target.displayName}** has been granted OP permissions by **${interaction.user.displayName}**!`)
            .setColor(0xf1c40f)
        ] });
    }
    
    // /revoke - Remove OP permissions
    else if (commandName === 'revoke') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (target.username === OP_USER) return interaction.reply({ content: `❌ Cannot revoke the original OP user!`, ephemeral: true });
        if (!opUsers.includes(target.id)) return interaction.reply({ content: `❌ **${target.displayName}** does not have OP.`, ephemeral: true });
        opUsers = opUsers.filter(id => id !== target.id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🔒 OP Revoked')
            .setDescription(`**${target.displayName}**'s OP permissions have been revoked.`)
            .setColor(0xe74c3c)
        ] });
    }
    
    // /oplist - List all OP users
    else if (commandName === 'oplist') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const lines = [`👑 **${OP_USER}** (original OP — permanent)`];
        for (const id of opUsers) lines.push(`🔑 <@${id}>`);
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('👑 TFCImon OP Users')
            .setDescription(lines.join('\n'))
            .setColor(0xf1c40f)
        ], ephemeral: true });
    }
    
    // /givegems - Give gems to a player
    else if (commandName === 'givegems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const tp = getPlayer(target.id);
        tp.gems += amount;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('💎 Gems Given!')
            .setDescription(`Gave **${amount}💎** to **${target.displayName}**!\nThey now have **${tp.gems}💎**.`)
            .setColor(0xf1c40f)
        ] });
    }
    
    // /setgems - Set exact gem amount
    else if (commandName === 'setgems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const tp = getPlayer(target.id);
        tp.gems = amount;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('💎 Gems Set!')
            .setDescription(`**${target.displayName}**'s gems set to **${amount}💎**.`)
            .setColor(0xf1c40f)
        ] });
    }
    
    // /takegems - Take gems from a player
    else if (commandName === 'takegems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const tp = getPlayer(target.id);
        tp.gems = Math.max(0, tp.gems - amount);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('💎 Gems Taken!')
            .setDescription(`Took **${amount}💎** from **${target.displayName}**!\nThey now have **${tp.gems}💎**.`)
            .setColor(0xe74c3c)
        ] });
    }
    
    // /givecard - Give a card to a player
    else if (commandName === 'givecard') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const cardId = interaction.options.getString('card');
        const tp = getPlayer(target.id);
        tp.deck.push(cardId);
        saveData();
        const card = CARDS[cardId];
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🎴 Card Given!')
            .setDescription(`Gave ${card?.emoji} **${card?.name}** to **${target.displayName}**!`)
            .setColor(card?.color || 0x9b59b6)
        ] });
    }
    
    // /kill - Wipe a player's deck
    else if (commandName === 'kill') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const tp = getPlayer(target.id);
        tp.deck = [];
        tp.energyCards = 0;
        tp.activeDeck = [];
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('💀 Player Wiped!')
            .setDescription(`**${target.displayName}**'s deck has been wiped. 💀`)
            .setColor(0xe74c3c)
        ] });
    }
    
    // /doublegems - Toggle double gems event
    else if (commandName === 'doublegems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        doubleGemsEvent = !doubleGemsEvent;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(doubleGemsEvent ? '🎉 Double Gems STARTED!' : '⏹️ Double Gems ENDED!')
            .setDescription(doubleGemsEvent ? 'All gem rewards are now doubled!' : 'Back to normal gem rates.')
            .setColor(doubleGemsEvent ? 0xf1c40f : 0x636e72)
        ] });
    }
    
    // /xpboost - Toggle XP boost event
    else if (commandName === 'xpboost') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        xpBoostEvent = !xpBoostEvent;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(xpBoostEvent ? '⚡ XP Boost STARTED!' : '⏹️ XP Boost ENDED!')
            .setDescription(xpBoostEvent ? 'Cards now level up every 2 wins instead of 3!' : 'Back to normal — 3 wins per level up.')
            .setColor(xpBoostEvent ? 0xfdcb6e : 0x636e72)
        ] });
    }
    
    // /banplayer - Ban a player
    else if (commandName === 'banplayer') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason given.';
        if (bannedUsers.includes(target.id)) return interaction.reply({ content: `❌ **${target.displayName}** is already banned.`, ephemeral: true });
        bannedUsers.push(target.id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🔨 Player Banned!')
            .setDescription(`**${target.displayName}** has been banned from TFCImon.\n**Reason:** ${reason}`)
            .setColor(0xe74c3c)
        ] });
    }
    
    // /unbanplayer - Unban a player
    else if (commandName === 'unbanplayer') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (!bannedUsers.includes(target.id)) return interaction.reply({ content: `❌ **${target.displayName}** is not banned.`, ephemeral: true });
        bannedUsers = bannedUsers.filter(id => id !== target.id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('✅ Player Unbanned!')
            .setDescription(`**${target.displayName}** can now use TFCImon again.`)
            .setColor(0x00b894)
        ] });
    }
    
    // /freeze - Freeze a player
    else if (commandName === 'freeze') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason given.';
        if (frozenUsers.includes(target.id)) return interaction.reply({ content: `❌ **${target.displayName}** is already frozen.`, ephemeral: true });
        frozenUsers.push(target.id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🧊 Player Frozen!')
            .setDescription(`**${target.displayName}** has been frozen.\n**Reason:** ${reason}`)
            .setColor(0x74b9ff)
        ] });
    }
    
    // /unfreeze - Unfreeze a player
    else if (commandName === 'unfreeze') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (!frozenUsers.includes(target.id)) return interaction.reply({ content: `❌ **${target.displayName}** is not frozen.`, ephemeral: true });
        frozenUsers = frozenUsers.filter(id => id !== target.id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🌡️ Player Unfrozen!')
            .setDescription(`**${target.displayName}** can battle and gamble again.`)
            .setColor(0x00b894)
        ] });
    }
    
    // /broadcast - Send announcement
    else if (commandName === 'broadcast') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const title = interaction.options.getString('title');
        const message = interaction.options.getString('message');
        const colorStr = interaction.options.getString('color');
        const color = colorStr ? parseInt(colorStr, 16) : 0xfdcb6e;
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`📢 ${title}`)
            .setDescription(message)
            .setColor(color)
            .setFooter({ text: `TFCImon • Broadcast by ${interaction.user.displayName}` })
            .setTimestamp()
        ] });
    }
    
    // /setbounty - Place bounty on player
    else if (commandName === 'setbounty') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        if (target.id === userId) return interaction.reply({ content: '❌ Cannot bounty yourself!', ephemeral: true });
        bounties.set(target.id, { amount, setBy: userId, setByName: interaction.user.displayName, targetName: target.displayName });
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🎯 Bounty Placed!')
            .setDescription(`A **${amount}💎** bounty has been placed on **${target.displayName}**!`)
            .setColor(0xe17055)
        ] });
    }
    
    // /removebounty - Remove bounty
    else if (commandName === 'removebounty') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const target = interaction.options.getUser('user');
        if (!bounties.has(target.id)) return interaction.reply({ content: `❌ No bounty on **${target.displayName}**.`, ephemeral: true });
        bounties.delete(target.id);
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🎯 Bounty Removed')
            .setDescription(`Bounty on **${target.displayName}** has been removed.`)
            .setColor(0x636e72)
        ] });
    }
    
    // /massgems - Give gems to all players
    else if (commandName === 'massgems') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const amount = interaction.options.getInteger('amount');
        let count = 0;
        for (const [, p] of playerData) {
            p.gems += amount;
            count++;
        }
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('💎 Mass Gem Drop!')
            .setDescription(`**${interaction.user.displayName}** dropped **${amount}💎** to everyone!\n\n✅ **${count} players** received **${amount}💎** each.`)
            .setColor(0xf1c40f)
        ] });
    }
    
    // /announce - Simple announcement
    else if (commandName === 'announce') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const message = interaction.options.getString('message');
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('📢 TFCImon Announcement')
            .setDescription(message)
            .setColor(0xfdcb6e)
            .setFooter({ text: `From: ${interaction.user.displayName}` })
        ] });
    }
    
    // /listcards - List all cards
    else if (commandName === 'listcards') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const allCards = Object.values(CARDS);
        const base = allCards.filter(c => !c.id.startsWith('custom_'));
        const custom = allCards.filter(c => c.id.startsWith('custom_'));
        let desc = `**Base Cards (${base.length}):**\n${base.map(c => `${c.emoji} ${c.name} — \`${c.id}\``).join('\n')}`;
        if (custom.length) desc += `\n\n**Custom Cards (${custom.length}):**\n${custom.map(c => `${c.emoji} ${c.name} — \`${c.id}\``).join('\n')}`;
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('📋 All TFCImon Cards')
            .setDescription(desc)
            .setColor(0x6c5ce7)
        ], ephemeral: true });
    }
    
    // /resetarena - Reset arena holder
    else if (commandName === 'resetarena') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const arenaId = interaction.options.getString('arena');
        const arena = ARENAS[arenaId];
        arena.holder = null;
        arena.holderName = null;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('🏟️ Arena Reset!')
            .setDescription(`**${arena.name}** is unclaimed again!`)
            .setColor(arena.color)
        ] });
    }
    
    // /setarenacholder - Set arena holder
    else if (commandName === 'setarenacholder') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const arenaId = interaction.options.getString('arena');
        const target = interaction.options.getUser('user');
        const arena = ARENAS[arenaId];
        arena.holder = target.id;
        arena.holderName = target.displayName;
        saveData();
        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('👑 Arena Holder Set!')
            .setDescription(`**${target.displayName}** is now the holder of **${arena.emoji} ${arena.name}**!`)
            .setColor(arena.color)
        ] });
    }
    
    // /wipeall - Wipe all data (requires confirmation button)
    else if (commandName === 'wipeall') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('wipeall_confirm').setLabel('⚠️ CONFIRM WIPE ALL').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('wipeall_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: '⚠️ **WARNING:** This will wipe ALL player data. Are you sure?', components: [row], ephemeral: true });
    }
    
    // ─── NORMAL USER COMMANDS (sample) ─────────────────────────────────────────
    else if (commandName === 'openpack') {
        // ... (keep your existing openpack code)
        await interaction.reply({ content: 'Opening pack... (implement this)', ephemeral: true });
    }
    
    else if (commandName === 'deck') {
        await interaction.reply({ embeds: [buildDeckEmbed(userId, player, interaction.user.displayName)] });
    }
    
    else {
        await interaction.reply({ content: `Command \`/${commandName}\` is being set up!`, ephemeral: true });
    }
});

// ─── BUTTON HANDLER FOR WIPE CONFIRMATION ─────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'wipeall_confirm') {
        if (!isOp(interaction)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        playerData.clear();
        saveData();
        await interaction.update({ content: '💀 **All player data wiped.**', components: [] });
    } else if (interaction.customId === 'wipeall_cancel') {
        await interaction.update({ content: '✅ Wipe cancelled.', components: [] });
    }
});
    
    // ─── DEFAULT RESPONSE ───────────────────────────────────────────────────────
    else {
        await interaction.reply({ content: `⚠️ Command \`/${commandName}\` is being set up. Try again in a few seconds!`, ephemeral: true });
    }
});

// ─── 24/7 KEEP-ALIVE SYSTEM ───────────────────────────────────────────────────
const keepAliveServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'alive', uptime: process.uptime(), timestamp: new Date().toISOString() }));
    } else {
        res.writeHead(200);
        res.end('TFCImon Bot is running!');
    }
});

const PORT = process.env.PORT || 8080;
keepAliveServer.listen(PORT, () => {
    console.log(`✅ Health check server running on port ${PORT}`);
});

// Self-ping every 4 minutes to prevent Railway from sleeping
function selfPing() {
    const url = `http://localhost:${PORT}/health`;
    const req = http.get(url, (res) => {
        console.log(`💓 Self-ping at ${new Date().toTimeString()} - Status: ${res.statusCode}`);
    });
    req.on('error', () => {});
}

setInterval(selfPing, 240000); // Every 4 minutes
console.log('🔄 Keep-alive system active - pinging every 4 minutes');

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('SIGINT', () => { saveData(); console.log('💾 Saved!'); process.exit(0); });
process.on('SIGTERM', () => { saveData(); console.log('💾 Saved!'); process.exit(0); });

// ─── START BOT ─────────────────────────────────────────────────────────────────
(async () => {
    await registerCommands();
    await client.login(BOT_TOKEN);
    console.log('🎮 TFCImon Bot is fully online and will stay alive 24/7!');
})();
