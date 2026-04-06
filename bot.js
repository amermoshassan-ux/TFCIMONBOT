// TFCImon Discord Bot — MEGA UPDATE + PERSISTENT STORAGE
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// FIX: Make sure these are read correctly from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OP_USER = 'haxiii7';

// FIX: Add validation to ensure token and client ID exist
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is not set in environment variables!');
    process.exit(1);
}
if (!CLIENT_ID) {
    console.error('❌ CLIENT_ID is not set in environment variables!');
    process.exit(1);
}

console.log(`✅ Bot token loaded: ${BOT_TOKEN.substring(0, 20)}...`);
console.log(`✅ Client ID loaded: ${CLIENT_ID}`);

// ─── PERSISTENT STORAGE ───────────────────────────────────────────────────────

const DATA_FILE = path.join(__dirname, 'data.json');

// FIX: Initialize these first before loadData tries to use them
let playerData = new Map();
let auctionListings = new Map();
let listingCounter = 1;
let doubleGemsEvent = false;
let xpBoostEvent = false;
let opUsers = [];
let bounties = new Map();
let bannedUsers = [];
let frozenUsers = [];

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const savedData = JSON.parse(raw);
            
            // Restore data
            playerData = new Map(Object.entries(savedData.players || {}));
            
            // Restore arenas
            for (const [arenaId, arenaState] of Object.entries(savedData.arenas || {})) {
                if (ARENAS[arenaId]) {
                    ARENAS[arenaId].holder = arenaState.holder || null;
                    ARENAS[arenaId].holderName = arenaState.holderName || null;
                }
            }
            
            // Restore auction listings
            auctionListings = new Map(Object.entries(savedData.auctionListings || {}).map(([k, v]) => [parseInt(k), v]));
            listingCounter = savedData.listingCounter || 1;
            doubleGemsEvent = savedData.doubleGemsEvent || false;
            xpBoostEvent = savedData.xpBoostEvent || false;
            opUsers = savedData.opUsers || [];
            bounties = new Map(Object.entries(savedData.bounties || {}));
            bannedUsers = savedData.bannedUsers || [];
            frozenUsers = savedData.frozenUsers || [];
            
            // Restore custom cards
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

function getAllCardChoices() {
    return Object.values(CARDS).map(c => ({ name: `${c.emoji} ${c.name} (${c.gemCost}💎) — ${c.rarity}`, value: c.id })).slice(0, 25);
}

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

// ─── LOAD DATA ────────────────────────────────────────────────────────────────

loadData();

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getPlayer(userId) {
    if (!playerData.has(userId)) {
        playerData.set(userId, { deck: [], activeDeck: [], energyCards: 0, gems: 100, nicknames: {}, wins: 0, losses: 0, cardWins: {}, cardLosses: {}, cardLevels: {}, lastDaily: null, totalBattles: 0, banned: false });
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
    if (p.banned === undefined) p.banned = false;
    return p;
}

function isBanned(userId) {
    return bannedUsers.includes(userId);
}

function isFrozen(userId) {
    return frozenUsers.includes(userId);
}

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
    if (affordable.length === 0) return guardian.moves.reduce((a, b) => a.cost < b.cost ? a : b);
    return affordable.reduce((best, m) => m.damage > best.damage ? m : best);
}

function isOp(interaction) {
    return interaction.user.username === OP_USER || opUsers.includes(interaction.user.id);
}

function gemMultiplier() { return doubleGemsEvent ? 2 : 1; }

function xpThreshold() { return xpBoostEvent ? 2 : 3; }

function getBattleCard(player) {
    if (player.activeDeck && player.activeDeck.length > 0) {
        const valid = player.activeDeck.filter(id => player.deck.includes(id) && CARDS[id]);
        if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    }
    const valid = player.deck.filter(id => CARDS[id]);
    return valid[Math.floor(Math.random() * valid.length)];
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

function buildCardInfoEmbed(card) {
    const embed = new EmbedBuilder()
        .setTitle(`${card.emoji} ${card.name}`)
        .setColor(card.color || 0x9b59b6)
        .setDescription(card.description || '')
        .addFields(
            { name: '❤️ HP', value: `${card.hp}`, inline: true },
            { name: '⚡ Type', value: card.type, inline: true },
            { name: '⭐ Rarity', value: card.rarity, inline: true },
            { name: '💎 Shop Price', value: `${card.gemCost}💎`, inline: true },
            { name: '💰 Sell Value', value: `${Math.round(card.gemCost * SELL_BACK_RATE)}💎`, inline: true },
        );
    if (card.lore) embed.addFields({ name: '📖 Lore', value: card.lore });
    const movesText = card.moves.map(m => `${m.emoji} **${m.name}** — ${m.damage} dmg | Cost: ${m.cost}⚡${m.isEx ? ' ✨EX' : ''}`).join('\n');
    embed.addFields({ name: '⚔️ Moves', value: movesText });
    return embed;
}

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

// ─── ARENA CHOICES ────────────────────────────────────────────────────────────

const ARENA_CHOICES = [
    { name: '🏝️ 100 Player Island', value: '100_player_island' },
    { name: '💞 Mingle', value: 'mingle' },
    { name: '🚦 RLGL', value: 'rlgl' },
    { name: '🪢 Jumprope', value: 'jumprope' },
    { name: '🌪️ Spinner', value: 'spinner' },
    { name: '⚔️ Red vs Blue Island', value: 'red_vs_blue' },
    { name: '🪙 Pick a Side', value: 'pick_a_side' },
];

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

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
    new SlashCommandBuilder()
        .setName('order')
        .setDescription('Sort your deck cards')
        .addStringOption(opt => opt.setName('by').setDescription('How to sort').setRequired(true)
            .addChoices(
                { name: '⭐ Rarity', value: 'rarity' },
                { name: '❤️ HP (highest first)', value: 'hp' },
                { name: '🔤 Name (A-Z)', value: 'name' },
                { name: '🏆 Most wins', value: 'wins' },
                { name: '⬆️ Level', value: 'level' },
            )
        ).toJSON(),
    new SlashCommandBuilder().setName('sell').setDescription(`Sell a card back for ${Math.round(SELL_BACK_RATE * 100)}% of its gem cost`).addStringOption(opt => opt.setName('card').setDescription('Card to sell').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('buypack').setDescription(`Buy a pack for ${PACK_GEM_COST} gems`).toJSON(),
    new SlashCommandBuilder().setName('battle').setDescription('Challenge another member to a TFCImon battle!').addUserOption(opt => opt.setName('opponent').setDescription('The member to battle').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('name').setDescription('Give a nickname to a card in your deck')
        .addStringOption(opt => opt.setName('card').setDescription('Card to rename').setRequired(true).addChoices(...getAllCardChoices()))
        .addStringOption(opt => opt.setName('nickname').setDescription('The nickname').setRequired(true).setMaxLength(32)).toJSON(),
    new SlashCommandBuilder().setName('challenge').setDescription('Challenge an arena guardian!').addStringOption(opt => opt.setName('arena').setDescription('Which arena').setRequired(true).addChoices(...ARENA_CHOICES)).toJSON(),
    new SlashCommandBuilder().setName('gamble').setDescription('Gamble gems (45% win, 10% push, 45% lose)').addIntegerOption(opt => opt.setName('amount').setDescription('Amount to gamble').setRequired(true).setMinValue(10)).toJSON(),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin — call it right and double your bet!')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(5))
        .addStringOption(opt => opt.setName('call').setDescription('Heads or tails?').setRequired(true).addChoices({ name: '🪙 Heads', value: 'heads' }, { name: '🔵 Tails', value: 'tails' })).toJSON(),
    new SlashCommandBuilder().setName('slots').setDescription('Spin the slot machine! Match symbols to multiply your bet.')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(10)).toJSON(),
    new SlashCommandBuilder().setName('dice').setDescription('Roll dice against the house — roll higher to win!')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(10))
        .addStringOption(opt => opt.setName('mode').setDescription('Game mode').setRequired(true).addChoices(
            { name: '🎲 Classic (1d6 vs house)', value: 'classic' },
            { name: '🎲🎲 High Stakes (2d6, must beat 7)', value: 'highstakes' },
            { name: '🃏 Lucky 21 (d20 + d6, must hit 21)', value: 'lucky21' },
        )).toJSON(),
    new SlashCommandBuilder().setName('bounties').setDescription('View all active bounties').toJSON(),
    new SlashCommandBuilder().setName('gift').setDescription('Gift a card to another player').addUserOption(opt => opt.setName('user').setDescription('Who to gift to').setRequired(true)).addStringOption(opt => opt.setName('card').setDescription('Card to gift').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('trade').setDescription('Offer a card trade to another player')
        .addUserOption(opt => opt.setName('user').setDescription('Who to trade with').setRequired(true))
        .addStringOption(opt => opt.setName('yougive').setDescription('Card you give').setRequired(true).addChoices(...getAllCardChoices()))
        .addStringOption(opt => opt.setName('youget').setDescription('Card you want').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('ah').setDescription('Browse the auction house').toJSON(),
    new SlashCommandBuilder().setName('ah-sell').setDescription('List a card on the auction house')
        .addStringOption(opt => opt.setName('card').setDescription('Card to sell').setRequired(true).addChoices(...getAllCardChoices()))
        .addIntegerOption(opt => opt.setName('price').setDescription('Instant buy price in gems').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('bidstart').setDescription('Starting bid (optional)').setMinValue(1)).toJSON(),
    new SlashCommandBuilder().setName('ah-search').setDescription('Search the auction house').addStringOption(opt => opt.setName('card').setDescription('Card to search').setRequired(true).addChoices(...getAllCardChoices())).toJSON(),
    new SlashCommandBuilder().setName('jointournament').setDescription('Join the upcoming tournament!').toJSON(),
    new SlashCommandBuilder().setName('op').setDescription('[OP] Grant another user OP permissions').addUserOption(opt => opt.setName('user').setDescription('User to grant OP').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('makecard').setDescription('[OP] Create a custom card')
        .addStringOption(opt => opt.setName('name').setDescription('Card name').setRequired(true))
        .addIntegerOption(opt => opt.setName('hp').setDescription('HP').setRequired(true).setMinValue(1).setMaxValue(9999))
        .addStringOption(opt => opt.setName('type').set
// ─── ERROR HANDLING FOR 24/7 OPERATION ───────────────────────────────────────

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Don't crash, just log and continue
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// Auto-reconnect on disconnect
client.on('disconnect', (event) => {
    console.log(`⚠️ Disconnected! Code: ${event.code}. Attempting to reconnect...`);
});

client.on('reconnecting', () => {
    console.log('🔄 Reconnecting to Discord...');
});

client.on('error', (error) => {
    console.error('❌ Client error:', error);
});

// Heartbeat check to ensure bot is alive
let lastHeartbeat = Date.now();
client.on('ready', () => {
    setInterval(() => {
        if (Date.now() - lastHeartbeat > 60000) {
            console.log('⚠️ Heartbeat timeout? Restarting...');
            process.exit(1); // Railway will restart
        }
    }, 30000);
});

client.on('heartbeat', () => {
    lastHeartbeat = Date.now();
});