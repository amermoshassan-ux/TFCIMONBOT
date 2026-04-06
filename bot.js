// ╔══════════════════════════════════════════════════════════════╗
// ║         TFCImon — ULTIMATE EDITION                           ║
// ║  Battles · Arenas · Gambling · Bounties · Quests · Streaks  ║
// ║  Crafting · Raids · Prestige · Clans · Loot Crates · More!  ║
// ╚══════════════════════════════════════════════════════════════╝
require('dotenv').config();
const {
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    REST, Routes
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OP_USER   = 'haxiii7';

// ══════════════════════════════════════════════
// PERSISTENT STORAGE
// ══════════════════════════════════════════════
const DATA_FILE = path.join(__dirname, 'data.json');

let playerData       = new Map();
let auctionListings  = new Map();
let listingCounter   = 1;
let doubleGemsEvent  = false;
let xpBoostEvent     = false;
let opUsers          = [];
let bounties         = new Map();
let bannedUsers      = [];
let frozenUsers      = [];
let clans            = new Map(); // name -> { name, emoji, leader, members[], bank, level, wins }
let activeRaid       = null;      // { name, emoji, hp, maxHp, participants{}, reward, endTime }
let globalEvent      = null;      // { type, name, desc, endTime }
let activeBattles      = new Map();
let activeArenaBattles = new Map();
let tradeOffers        = new Map();
let activeTournament   = { running: false, players: [], bracket: [], prize: 0 };
let tradeCounter = 1;

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return;
        const s = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        playerData      = new Map(Object.entries(s.players      || {}));
        auctionListings = new Map(Object.entries(s.auctionListings || {}).map(([k,v]) => [parseInt(k), v]));
        listingCounter  = s.listingCounter  || 1;
        doubleGemsEvent = s.doubleGemsEvent || false;
        xpBoostEvent    = s.xpBoostEvent    || false;
        opUsers         = s.opUsers         || [];
        bounties        = new Map(Object.entries(s.bounties     || {}));
        bannedUsers     = s.bannedUsers     || [];
        frozenUsers     = s.frozenUsers     || [];
        clans           = new Map(Object.entries(s.clans        || {}));
        activeRaid      = s.activeRaid      || null;
        globalEvent     = s.globalEvent     || null;
        for (const [id, a] of Object.entries(s.arenas || {})) {
            if (ARENAS[id]) { ARENAS[id].holder = a.holder||null; ARENAS[id].holderName = a.holderName||null; }
        }
        for (const [id, c] of Object.entries(s.customCards || {})) CARDS[id] = c;
        console.log(`✅ Loaded ${playerData.size} players | ${opUsers.length} OPs | ${clans.size} clans`);
    } catch(e) { console.error('Load failed:', e.message); }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            players:         Object.fromEntries(playerData),
            arenas:          Object.fromEntries(Object.entries(ARENAS).map(([id,a]) => [id,{holder:a.holder,holderName:a.holderName}])),
            auctionListings: Object.fromEntries(auctionListings),
            listingCounter, doubleGemsEvent, xpBoostEvent,
            customCards:     Object.fromEntries(Object.entries(CARDS).filter(([id]) => id.startsWith('custom_'))),
            opUsers,
            bounties:        Object.fromEntries(bounties),
            bannedUsers, frozenUsers,
            clans:           Object.fromEntries(clans),
            activeRaid, globalEvent,
        }, null, 2));
    } catch(e) { console.error('Save failed:', e); }
}
setInterval(saveData, 60_000);

// ══════════════════════════════════════════════
// CARD DATA
// ══════════════════════════════════════════════
const CARDS = {
    celestia:    { id:'celestia',    name:'Celestia',           hp:200, type:'Dark',    rarity:'Rare',      emoji:'🌑', color:0x2c2c54, description:'Dark warrior with flower-like wings.',    gemCost:300,  moves:[{name:'#Goon',damage:75,cost:2,emoji:'👊'},{name:'Drawing w/ Downfall',damage:150,cost:4,emoji:'🌀'}] },
    flame:       { id:'flame',       name:'Flame',              hp:200, type:'Fire',    rarity:'Rare',      emoji:'🔥', color:0xe84545, description:'Plaid-shirted cat with a sailor cap.',    gemCost:300,  moves:[{name:'Timeout',damage:50,cost:2,emoji:'⏱️'},{name:'Kick',damage:100,cost:3,emoji:'🦵'},{name:'Ban',damage:250,cost:6,emoji:'🔨'}] },
    isy:         { id:'isy',         name:'Isy EX',             hp:150, type:'Normal',  rarity:'EX',        emoji:'🍌', color:0x3498db, description:'Member MECT — EX card!',                  gemCost:500,  moves:[{name:'Banana',damage:50,cost:2,emoji:'🍌'},{name:'Summon-SPK',damage:100,cost:4,emoji:'📢'},{name:'EX POWER',damage:180,cost:6,emoji:'👑',isEx:true}] },
    michael:     { id:'michael',     name:'Michael the Keeper', hp:300, type:'Shadow',  rarity:'LEGENDARY', emoji:'👁️', color:0x1a1a2e, description:'⚠️ The rarest card in existence.',       gemCost:2000, moves:[{name:'Hiding',damage:100,cost:3,emoji:'🌫️'},{name:'Server Hopper',damage:130,cost:4,emoji:'🚀'}] },
    spk_iii:     { id:'spk_iii',     name:'SPK_III',            hp:180, type:'Normal',  rarity:'Uncommon',  emoji:'🔊', color:0xf39c12, description:'Powerful speaker.',                       gemCost:200,  moves:[{name:'Banan',damage:75,cost:2,emoji:'🍌'},{name:'Tuff Stuff',damage:170,cost:5,emoji:'💪'}] },
    shadowfox:   { id:'shadowfox',   name:'Shadow Fox',         hp:220, type:'Shadow',  rarity:'Rare',      emoji:'🦊', color:0x6c3483, description:'Cunning fox that strikes from darkness.', gemCost:350,  moves:[{name:'Phantom Dash',damage:80,cost:2,emoji:'💨'},{name:'Shadow Bite',damage:140,cost:3,emoji:'🦷'},{name:'Eclipse Strike',damage:200,cost:5,emoji:'🌑'}] },
    stormking:   { id:'stormking',   name:'Storm King',         hp:250, type:'Electric',rarity:'Rare',      emoji:'⚡', color:0xf9ca24, description:'Ruler of storms.',                        gemCost:400,  moves:[{name:'Thunder Clap',damage:90,cost:2,emoji:'⚡'},{name:'Static Prison',damage:120,cost:3,emoji:'🔒'},{name:'LIGHTNING THRONE',damage:220,cost:6,emoji:'👑'}] },
    voidwalker:  { id:'voidwalker',  name:'Void Walker',        hp:170, type:'Void',    rarity:'EX',        emoji:'🌀', color:0x130f40, description:'Steps between dimensions.',               gemCost:600,  moves:[{name:'Phase Shift',damage:60,cost:1,emoji:'🌀'},{name:'Dimension Rip',damage:130,cost:3,emoji:'🕳️'},{name:'VOID COLLAPSE',damage:220,cost:6,emoji:'💀',isEx:true}] },
    ironclad:    { id:'ironclad',    name:'Ironclad',           hp:350, type:'Steel',   rarity:'Rare',      emoji:'🛡️', color:0x7f8c8d, description:'Unstoppable wall of metal.',              gemCost:380,  moves:[{name:'Iron Wall',damage:40,cost:1,emoji:'🛡️'},{name:'Steel Crush',damage:110,cost:3,emoji:'⚙️'},{name:'FORTRESS BREAK',damage:190,cost:5,emoji:'💥'}] },
    cosmicqueen: { id:'cosmicqueen', name:'Cosmic Queen',       hp:230, type:'Cosmic',  rarity:'LEGENDARY', emoji:'🌌', color:0x9b59b6, description:'✨ Born from the collapse of a star.',    gemCost:2500, moves:[{name:'Stardust',damage:90,cost:2,emoji:'✨'},{name:'Nebula Burst',damage:160,cost:4,emoji:'🌌'},{name:'BIG BANG',damage:280,cost:7,emoji:'💫',isEx:true}] },
    glacierbear: { id:'glacierbear', name:'Glacier Bear',       hp:280, type:'Ice',     rarity:'Rare',      emoji:'🐻‍❄️',color:0x74b9ff, description:'Bear made of ancient ice.',              gemCost:420,  moves:[{name:'Ice Slam',damage:100,cost:2,emoji:'🧊'},{name:'Blizzard Roar',damage:160,cost:4,emoji:'❄️'},{name:'PERMAFROST',damage:210,cost:5,emoji:'🌨️'}] },
    toxicshroom: { id:'toxicshroom', name:'Toxic Shroom',       hp:190, type:'Poison',  rarity:'Uncommon',  emoji:'🍄', color:0x55efc4, description:'Breathes toxic spores.',                  gemCost:250,  moves:[{name:'Spore Cloud',damage:70,cost:2,emoji:'🍄'},{name:'Poison Bite',damage:130,cost:3,emoji:'☠️'}] },
    dragonlord:  { id:'dragonlord',  name:'Dragon Lord',        hp:320, type:'Dragon',  rarity:'LEGENDARY', emoji:'🐉', color:0xe55039, description:'⚠️ Master of all dragons.',               gemCost:3000, moves:[{name:'Dragon Claw',damage:120,cost:3,emoji:'🐉'},{name:'Fire Breath',damage:180,cost:4,emoji:'🔥'},{name:'DRAGON RAGE',damage:300,cost:7,emoji:'💥',isEx:true}] },
    neonpunk:    { id:'neonpunk',    name:'Neon Punk',          hp:210, type:'Electric',rarity:'Rare',      emoji:'🌃', color:0xfd79a8, description:'Born in the city that never sleeps.',     gemCost:380,  moves:[{name:'Neon Strike',damage:85,cost:2,emoji:'⚡'},{name:'Cyber Slash',damage:145,cost:3,emoji:'🌃'},{name:'BLACKOUT',damage:205,cost:5,emoji:'💀'}] },
    timeghost:   { id:'timeghost',   name:'Time Ghost',         hp:160, type:'Void',    rarity:'EX',        emoji:'👻', color:0x6c5ce7, description:'Exists outside of time itself.',          gemCost:650,  moves:[{name:'Time Skip',damage:65,cost:1,emoji:'⏩'},{name:'Paradox Slam',damage:135,cost:3,emoji:'🌀'},{name:'TIME ERASE',damage:230,cost:6,emoji:'🕰️',isEx:true}] },
};

const PACK_WEIGHTS = {
    celestia:20, flame:20, isy:15, spk_iii:10, michael:1, shadowfox:10,
    stormking:9, voidwalker:6, ironclad:8, cosmicqueen:0.5, energy:7,
    glacierbear:7, toxicshroom:8, dragonlord:0.3, neonpunk:6, timeghost:4,
};
const PACK_GEM_COST  = 150;
const SELL_BACK_RATE = 0.3;

// Crafting recipes: { ingredients: [cardId, cardId], result: cardId }
const CRAFT_RECIPES = [
    { ingredients: ['flame', 'stormking'],   result: 'dragonlord',  name: 'Dragon Lord' },
    { ingredients: ['voidwalker', 'michael'],result: 'timeghost',   name: 'Time Ghost'  },
    { ingredients: ['shadowfox', 'neonpunk'],result: 'neonpunk',    name: 'Neon Punk+'  },
];

// Daily quests pool
const QUEST_POOL = [
    { id:'win3',    desc:'Win 3 PvP battles',         type:'pvp_wins',   target:3,   reward:150 },
    { id:'win5',    desc:'Win 5 PvP battles',         type:'pvp_wins',   target:5,   reward:300 },
    { id:'arena2',  desc:'Conquer 2 arenas',          type:'arena_wins', target:2,   reward:200 },
    { id:'gamble3', desc:'Gamble 3 times',            type:'gambles',    target:3,   reward:100 },
    { id:'open2',   desc:'Open 2 packs',              type:'packs',      target:2,   reward:80  },
    { id:'sell1',   desc:'Sell 1 card on the AH',     type:'ah_sells',   target:1,   reward:120 },
    { id:'gift1',   desc:'Gift a card to someone',    type:'gifts',      target:1,   reward:90  },
    { id:'daily1',  desc:'Claim your daily reward',   type:'dailies',    target:1,   reward:50  },
];

// ══════════════════════════════════════════════
// ARENAS
// ══════════════════════════════════════════════
const ARENAS = {
    '100_player_island': { id:'100_player_island', name:'100 Player Island', emoji:'🏝️', color:0x00b894, description:'Only one survives.', holder:null, holderName:null, guardian:{name:'THE LAST ONE',emoji:'💀',hp:350,energy:4,moves:[{name:'Island Wipe',damage:90,cost:2,emoji:'🌊'},{name:'Final Circle',damage:160,cost:4,emoji:'🔴'},{name:'Only Survivor',damage:240,cost:6,emoji:'☠️'}]} },
    mingle:              { id:'mingle',             name:'Mingle',           emoji:'💞', color:0xff6b9d, description:'Friendships destroyed.', holder:null, holderName:null, guardian:{name:'CUPID REAPER',emoji:'💘',hp:280,energy:3,moves:[{name:'Heartbreak',damage:80,cost:2,emoji:'💔'},{name:'Toxic Charm',damage:130,cost:3,emoji:'🩷'},{name:'Lovebomb',damage:200,cost:5,emoji:'💣'}]} },
    rlgl:                { id:'rlgl',               name:'RLGL',             emoji:'🚦', color:0xe74c3c, description:'One wrong move.', holder:null, holderName:null, guardian:{name:'THE DOLL',emoji:'🎎',hp:320,energy:3,moves:[{name:'Red Light',damage:60,cost:1,emoji:'🔴'},{name:'Green Light',damage:120,cost:3,emoji:'🟢'},{name:'Elimination',damage:220,cost:5,emoji:'🎯'}]} },
    jumprope:            { id:'jumprope',           name:'Jumprope',         emoji:'🪢', color:0x6c5ce7, description:'The rope never stops.', holder:null, holderName:null, guardian:{name:'ROPEGOD',emoji:'🌀',hp:260,energy:3,moves:[{name:'Whiplash',damage:70,cost:2,emoji:'💫'},{name:'Double Dutch',damage:140,cost:3,emoji:'🌀'},{name:'Infinite Loop',damage:190,cost:5,emoji:'♾️'}]} },
    spinner:             { id:'spinner',            name:'Spinner',          emoji:'🌪️', color:0xfdcb6e, description:'Spin the wheel.', holder:null, holderName:null, guardian:{name:'VORTEX',emoji:'🌪️',hp:290,energy:3,moves:[{name:'Dizzy Slam',damage:85,cost:2,emoji:'😵'},{name:'Tornado Fist',damage:150,cost:4,emoji:'🌪️'},{name:'Chaos Spin',damage:210,cost:6,emoji:'💥'}]} },
    red_vs_blue:         { id:'red_vs_blue',        name:'Red vs Blue',      emoji:'⚔️', color:0xd63031, description:'No neutral here.', holder:null, holderName:null, guardian:{name:'COMMANDER NULL',emoji:'🎖️',hp:330,energy:4,moves:[{name:'Blue Barrage',damage:95,cost:2,emoji:'🔵'},{name:'Red Rush',damage:145,cost:3,emoji:'🔴'},{name:'Total War',damage:230,cost:6,emoji:'💣'}]} },
    pick_a_side:         { id:'pick_a_side',        name:'Pick a Side',      emoji:'🪙', color:0x2d3436, description:'Every choice matters.', holder:null, holderName:null, guardian:{name:'THE DECIDER',emoji:'⚖️',hp:310,energy:3,moves:[{name:'Coin Flip',damage:75,cost:2,emoji:'🪙'},{name:'Wrong Choice',damage:140,cost:3,emoji:'❌'},{name:'Judgement Day',damage:250,cost:6,emoji:'⚖️'}]} },
};
const ARENA_CHOICES = Object.keys(ARENAS).map(k => ({ name:`${ARENAS[k].emoji} ${ARENAS[k].name}`, value:k }));

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function getPlayer(userId) {
    if (!playerData.has(userId)) {
        playerData.set(userId, {
            deck:[], activeDeck:[], energyCards:0, gems:100, nicknames:{},
            wins:0, losses:0, cardWins:{}, cardLosses:{}, cardLevels:{},
            lastDaily:null, streak:0, lastStreak:null,
            prestige:0, xp:0,
            quests:[], questDate:null,
            achievements:[],
            clan:null,
            inventory:[], // 'lootcrate', 'gemstone', etc.
            title:null,   // cosmetic title string
            totalGambles:0, totalPacksOpened:0,
        });
    }
    const p = playerData.get(userId);
    // Migrate old accounts
    if (!p.streak)          p.streak          = 0;
    if (!p.lastStreak)      p.lastStreak      = null;
    if (!p.prestige)        p.prestige        = 0;
    if (!p.xp)              p.xp              = 0;
    if (!p.quests)          p.quests          = [];
    if (!p.questDate)       p.questDate       = null;
    if (!p.achievements)    p.achievements    = [];
    if (!p.clan)            p.clan            = null;
    if (!p.inventory)       p.inventory       = [];
    if (!p.title)           p.title           = null;
    if (!p.totalGambles)    p.totalGambles    = 0;
    if (!p.totalPacksOpened)p.totalPacksOpened= 0;
    return p;
}

function isOp(i) { return i.user.username === OP_USER || opUsers.includes(i.user.id); }
function isBanned(id) { return bannedUsers.includes(id); }
function isFrozen(id) { return frozenUsers.includes(id); }
function gemMultiplier() { return doubleGemsEvent ? 2 : 1; }
function xpThreshold(player) { return xpBoostEvent ? 2 : 3; }
function getCardLevel(p, id) { return p.cardLevels[id] || 1; }
function getLevelBonus(lv) { return (lv-1)*10; }

function weightedRandom(weights) {
    const total = Object.values(weights).reduce((a,b)=>a+b,0);
    let r = Math.random()*total;
    for (const [id,w] of Object.entries(weights)) { r-=w; if(r<=0) return id; }
    return Object.keys(weights)[0];
}
function openPack(n=3) { return Array.from({length:n},()=>weightedRandom(PACK_WEIGHTS)); }

function hpBar(hp, max) {
    const pct = Math.max(0,Math.min(1,hp/max));
    const f   = Math.round(pct*10);
    const col = pct>.5?'🟩':pct>.25?'🟨':'🟥';
    return col.repeat(f)+'⬛'.repeat(10-f)+` ${hp}/${max}`;
}

function aiPickMove(g, energy) {
    const aff = g.moves.filter(m=>m.cost<=energy);
    if (!aff.length) return g.moves.reduce((a,b)=>a.cost<b.cost?a:b);
    return aff.reduce((best,m)=>m.damage>best.damage?m:best);
}

function getBattleCard(p) {
    if (p.activeDeck?.length) {
        const v = p.activeDeck.filter(id=>p.deck.includes(id)&&CARDS[id]);
        if (v.length) return v[Math.floor(Math.random()*v.length)];
    }
    const v = p.deck.filter(id=>CARDS[id]);
    return v.length ? v[Math.floor(Math.random()*v.length)] : null;
}

function getAllCardChoices() {
    return Object.values(CARDS).map(c=>({name:`${c.emoji} ${c.name} (${c.gemCost}💎) — ${c.rarity}`,value:c.id})).slice(0,25);
}

function getRarityColor(rarity) {
    return {Common:0x95a5a6,Uncommon:0x27ae60,Rare:0x2980b9,EX:0x8e44ad,LEGENDARY:0xf39c12}[rarity]||0x9b59b6;
}

function prestigeTitle(n) {
    return ['','⚔️ Warrior','🌟 Champion','💎 Diamond','👑 Legend','🌌 Cosmic','🔮 Mythic','💀 Eternal'][n]||'🔮 Mythic';
}

// Quest helpers
function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function getOrRefreshQuests(p) {
    const today = getTodayStr();
    if (p.questDate !== today) {
        const pool = [...QUEST_POOL].sort(()=>Math.random()-0.5).slice(0,3);
        p.questDate = today;
        p.quests = pool.map(q=>({ ...q, progress:0, done:false }));
    }
    return p.quests;
}

function progressQuest(p, type, amount=1) {
    getOrRefreshQuests(p);
    for (const q of p.quests) {
        if (!q.done && q.type === type) {
            q.progress = Math.min(q.target, (q.progress||0)+amount);
            if (q.progress >= q.target) {
                q.done = true;
                p.gems += q.reward;
            }
        }
    }
}

// Achievement helper
const ACHIEVEMENTS = [
    { id:'first_win',   name:'First Blood',        emoji:'🩸', desc:'Win your first PvP battle' },
    { id:'win10',       name:'Battle Hardened',    emoji:'⚔️', desc:'Win 10 PvP battles' },
    { id:'win50',       name:'Veteran',            emoji:'🎖️', desc:'Win 50 PvP battles' },
    { id:'legendary',   name:'Got Legendary',      emoji:'🌟', desc:'Pull a LEGENDARY card from a pack' },
    { id:'rich',        name:'Gem Hoarder',        emoji:'💰', desc:'Have 5000 gems at once' },
    { id:'arena_all',   name:'Arena Master',       emoji:'🏟️', desc:'Hold all arenas at once' },
    { id:'clan_found',  name:'Clan Founder',       emoji:'🏴', desc:'Found a clan' },
    { id:'prestige1',   name:'Prestige',           emoji:'✨', desc:'Prestige for the first time' },
    { id:'streak7',     name:'On Fire',            emoji:'🔥', desc:'7-day login streak' },
    { id:'gambler100',  name:'Problem Gambler',    emoji:'🎰', desc:'Gamble 100 times' },
];

function unlockAchievement(p, id) {
    if (!p.achievements.includes(id)) {
        p.achievements.push(id);
        return ACHIEVEMENTS.find(a=>a.id===id);
    }
    return null;
}

function checkAchievements(p) {
    const unlocked = [];
    if (p.wins >= 1)  { const a = unlockAchievement(p,'first_win'); if(a) unlocked.push(a); }
    if (p.wins >= 10) { const a = unlockAchievement(p,'win10');     if(a) unlocked.push(a); }
    if (p.wins >= 50) { const a = unlockAchievement(p,'win50');     if(a) unlocked.push(a); }
    if (p.gems >= 5000){ const a = unlockAchievement(p,'rich');     if(a) unlocked.push(a); }
    if (p.prestige >= 1){const a = unlockAchievement(p,'prestige1');if(a) unlocked.push(a); }
    if (p.streak >= 7) { const a = unlockAchievement(p,'streak7');  if(a) unlocked.push(a); }
    if (p.totalGambles>=100){const a=unlockAchievement(p,'gambler100');if(a)unlocked.push(a);}
    return unlocked;
}

// Slots
const SLOT_SYM = ['🍋','🍒','🔔','⭐','💎','7️⃣'];
const SLOT_PAY = {'💎💎💎':20,'7️⃣7️⃣7️⃣':15,'⭐⭐⭐':10,'🔔🔔🔔':7,'🍒🍒🍒':5,'🍋🍋🍋':4};
function spinSlots() { return [SLOT_SYM[~~(Math.random()*6)],SLOT_SYM[~~(Math.random()*6)],SLOT_SYM[~~(Math.random()*6)]]; }
function evalSlots(r) {
    const key = r.join('');
    if (SLOT_PAY[key]) return SLOT_PAY[key];
    if (r[0]===r[1]||r[1]===r[2]||r[0]===r[2]) return 1.5;
    return 0;
}

// ══════════════════════════════════════════════
// COMMANDS LIST
// ══════════════════════════════════════════════
const OP_CMD_NAMES = ['op','oplist','revoke','givegems','takegems','setgems','givecard','kill',
    'banplayer','unbanplayer','freeze','unfreeze','doublegems','xpboost','broadcast',
    'setbounty','removebounty','resetarena','massgems','makecard','editcard','startraid',
    'endraid','setevent','endevent','tournament','wipeall','clonecard','setarenacholder'];

const commands = [
    // ── OP ──
    new SlashCommandBuilder().setName('op').setDescription('[OP] Grant OP').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('oplist').setDescription('[OP] List OPs'),
    new SlashCommandBuilder().setName('revoke').setDescription('[OP] Revoke OP').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('givegems').setDescription('[OP] Give gems').addUserOption(o=>o.setName('user').setRequired(true)).addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('takegems').setDescription('[OP] Take gems').addUserOption(o=>o.setName('user').setRequired(true)).addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('setgems').setDescription('[OP] Set gems').addUserOption(o=>o.setName('user').setRequired(true)).addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(0)),
    new SlashCommandBuilder().setName('givecard').setDescription('[OP] Give card').addUserOption(o=>o.setName('user').setRequired(true)).addStringOption(o=>o.setName('card').setDescription('Card ID').setRequired(true)),
    new SlashCommandBuilder().setName('kill').setDescription('[OP] Wipe deck').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('banplayer').setDescription('[OP] Ban player').addUserOption(o=>o.setName('user').setRequired(true)).addStringOption(o=>o.setName('reason')),
    new SlashCommandBuilder().setName('unbanplayer').setDescription('[OP] Unban player').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('freeze').setDescription('[OP] Freeze player').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('unfreeze').setDescription('[OP] Unfreeze player').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('doublegems').setDescription('[OP] Toggle double gems'),
    new SlashCommandBuilder().setName('xpboost').setDescription('[OP] Toggle XP boost'),
    new SlashCommandBuilder().setName('broadcast').setDescription('[OP] Announcement').addStringOption(o=>o.setName('title').setRequired(true)).addStringOption(o=>o.setName('message').setRequired(true)).addStringOption(o=>o.setName('color').setDescription('Hex color (e.g. ff0000)')),
    new SlashCommandBuilder().setName('setbounty').setDescription('[OP] Place bounty').addUserOption(o=>o.setName('user').setRequired(true)).addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(50)),
    new SlashCommandBuilder().setName('removebounty').setDescription('[OP] Remove bounty').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('resetarena').setDescription('[OP] Reset arena').addStringOption(o=>o.setName('arena').setRequired(true).addChoices(...ARENA_CHOICES)),
    new SlashCommandBuilder().setName('setarenacholder').setDescription('[OP] Set arena holder').addStringOption(o=>o.setName('arena').setRequired(true).addChoices(...ARENA_CHOICES)).addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('massgems').setDescription('[OP] Give gems to all').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('wipeall').setDescription('[OP] ⚠️ Wipe ALL player data'),
    new SlashCommandBuilder().setName('clonecard').setDescription('[OP] Clone card to user').addStringOption(o=>o.setName('card').setDescription('Card ID').setRequired(true)).addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('makecard').setDescription('[OP] Create custom card')
        .addStringOption(o=>o.setName('name').setRequired(true))
        .addIntegerOption(o=>o.setName('hp').setRequired(true).setMinValue(1))
        .addStringOption(o=>o.setName('type').setRequired(true))
        .addStringOption(o=>o.setName('rarity').setRequired(true))
        .addStringOption(o=>o.setName('emoji').setRequired(true))
        .addStringOption(o=>o.setName('move1name').setRequired(true))
        .addIntegerOption(o=>o.setName('move1dmg').setRequired(true))
        .addStringOption(o=>o.setName('move2name').setRequired(true))
        .addIntegerOption(o=>o.setName('move2dmg').setRequired(true))
        .addIntegerOption(o=>o.setName('gemcost'))
        .addUserOption(o=>o.setName('giveto')),
    new SlashCommandBuilder().setName('editcard').setDescription('[OP] Edit card stat')
        .addStringOption(o=>o.setName('cardid').setDescription('Card ID').setRequired(true))
        .addStringOption(o=>o.setName('field').setRequired(true).addChoices({name:'hp',value:'hp'},{name:'name',value:'name'},{name:'rarity',value:'rarity'},{name:'gemcost',value:'gemcost'}))
        .addStringOption(o=>o.setName('value').setRequired(true)),
    new SlashCommandBuilder().setName('startraid').setDescription('[OP] Start a raid boss')
        .addStringOption(o=>o.setName('name').setRequired(true))
        .addStringOption(o=>o.setName('emoji').setRequired(true))
        .addIntegerOption(o=>o.setName('hp').setRequired(true).setMinValue(100))
        .addIntegerOption(o=>o.setName('reward').setDescription('Gems per participant').setRequired(true)),
    new SlashCommandBuilder().setName('endraid').setDescription('[OP] End the current raid'),
    new SlashCommandBuilder().setName('setevent').setDescription('[OP] Start global event')
        .addStringOption(o=>o.setName('name').setRequired(true))
        .addStringOption(o=>o.setName('description').setRequired(true)),
    new SlashCommandBuilder().setName('endevent').setDescription('[OP] End global event'),
    new SlashCommandBuilder().setName('tournament').setDescription('[OP] Open/start tournament').addIntegerOption(o=>o.setName('prize').setDescription('Prize gems')),

    // ── CORE ──
    new SlashCommandBuilder().setName('openpack').setDescription('Open a pack — 3 random cards!'),
    new SlashCommandBuilder().setName('buypack').setDescription(`Buy a pack for ${PACK_GEM_COST}💎`),
    new SlashCommandBuilder().setName('deck').setDescription('View your deck'),
    new SlashCommandBuilder().setName('inspect').setDescription("View another player's deck").addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('cardinfo').setDescription('View a card\'s details').addStringOption(o=>o.setName('card').setRequired(true).addChoices(...getAllCardChoices())),
    new SlashCommandBuilder().setName('gems').setDescription('Check your gems'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('View the leaderboard'),
    new SlashCommandBuilder().setName('stats').setDescription('View your stats'),
    new SlashCommandBuilder().setName('arenas').setDescription('View all arenas'),
    new SlashCommandBuilder().setName('builddeck').setDescription('Set your active battle deck'),
    new SlashCommandBuilder().setName('cleardeck').setDescription('Clear active battle deck'),
    new SlashCommandBuilder().setName('sell').setDescription('Sell a card').addStringOption(o=>o.setName('card').setRequired(true).addChoices(...getAllCardChoices())),
    new SlashCommandBuilder().setName('battle').setDescription('Battle another player').addUserOption(o=>o.setName('opponent').setRequired(true)),
    new SlashCommandBuilder().setName('challenge').setDescription('Challenge an arena guardian').addStringOption(o=>o.setName('arena').setRequired(true).addChoices(...ARENA_CHOICES)),
    new SlashCommandBuilder().setName('gift').setDescription('Gift a card to someone').addUserOption(o=>o.setName('user').setRequired(true)).addStringOption(o=>o.setName('card').setRequired(true).addChoices(...getAllCardChoices())),
    new SlashCommandBuilder().setName('trade').setDescription('Offer a card trade').addUserOption(o=>o.setName('user').setRequired(true)).addStringOption(o=>o.setName('give').setDescription('Card you give (ID)').setRequired(true)).addStringOption(o=>o.setName('get').setDescription('Card you want (ID)').setRequired(true)),
    new SlashCommandBuilder().setName('rename').setDescription('Give a card a nickname').addStringOption(o=>o.setName('card').setRequired(true).addChoices(...getAllCardChoices())).addStringOption(o=>o.setName('nickname').setRequired(true).setMaxLength(30)),

    // ── GAMBLING ──
    new SlashCommandBuilder().setName('gamble').setDescription('Bet gems — 45% win, 45% lose, 10% push').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(10)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Double or nothing coin flip').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(5)).addStringOption(o=>o.setName('call').setRequired(true).addChoices({name:'🪙 Heads',value:'heads'},{name:'🔵 Tails',value:'tails'})),
    new SlashCommandBuilder().setName('slots').setDescription('Spin the slot machine').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(10)),
    new SlashCommandBuilder().setName('dice').setDescription('Roll dice vs. the house').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(10)).addStringOption(o=>o.setName('mode').setRequired(true).addChoices({name:'Classic (d6)',value:'classic'},{name:'High Stakes (2d6, beat 7)',value:'highstakes'},{name:'Lucky 21 (d20+d6, hit 21)',value:'lucky21'})),
    new SlashCommandBuilder().setName('blackjack').setDescription('Play blackjack vs. the house').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(10)),
    new SlashCommandBuilder().setName('roulette').setDescription('Bet on a roulette number or colour').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(5)).addStringOption(o=>o.setName('bet').setRequired(true).addChoices({name:'🔴 Red',value:'red'},{name:'⚫ Black',value:'black'},{name:'🟢 Green (0)',value:'green'},{name:'🔢 Odd',value:'odd'},{name:'🔢 Even',value:'even'})),

    // ── SOCIAL / ECONOMY ──
    new SlashCommandBuilder().setName('ah').setDescription('Browse the auction house'),
    new SlashCommandBuilder().setName('ah-sell').setDescription('List a card on the AH').addStringOption(o=>o.setName('card').setRequired(true).addChoices(...getAllCardChoices())).addIntegerOption(o=>o.setName('price').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('ah-cancel').setDescription('Cancel your AH listing').addIntegerOption(o=>o.setName('id').setDescription('Listing #').setRequired(true)),
    new SlashCommandBuilder().setName('bounties').setDescription('View active bounties'),

    // ── PROGRESSION ──
    new SlashCommandBuilder().setName('quests').setDescription('View your daily quests'),
    new SlashCommandBuilder().setName('achievements').setDescription('View your achievements'),
    new SlashCommandBuilder().setName('prestige').setDescription('Prestige — reset for a permanent bonus'),
    new SlashCommandBuilder().setName('profile').setDescription('View your full profile').addUserOption(o=>o.setName('user')),

    // ── CRAFTING ──
    new SlashCommandBuilder().setName('craft').setDescription('View crafting recipes'),
    new SlashCommandBuilder().setName('craftcard').setDescription('Craft a card from two ingredients').addStringOption(o=>o.setName('card1').setDescription('First card ID').setRequired(true)).addStringOption(o=>o.setName('card2').setDescription('Second card ID').setRequired(true)),

    // ── CLANS ──
    new SlashCommandBuilder().setName('clancreate').setDescription('Create a clan').addStringOption(o=>o.setName('name').setRequired(true).setMaxLength(20)).addStringOption(o=>o.setName('emoji').setRequired(true)),
    new SlashCommandBuilder().setName('claninvite').setDescription('Invite to your clan').addUserOption(o=>o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('clanleave').setDescription('Leave your clan'),
    new SlashCommandBuilder().setName('claninfo').setDescription('View clan info').addStringOption(o=>o.setName('name').setDescription('Clan name (or your clan)')),
    new SlashCommandBuilder().setName('clandeposit').setDescription('Donate gems to clan bank').addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(1)),

    // ── RAID ──
    new SlashCommandBuilder().setName('raid').setDescription('View the current raid boss'),
    new SlashCommandBuilder().setName('raidattack').setDescription('Attack the raid boss'),

    // ── MISC ──
    new SlashCommandBuilder().setName('event').setDescription('View the current global event'),
    new SlashCommandBuilder().setName('jointournament').setDescription('Join the open tournament'),
    new SlashCommandBuilder().setName('inventory').setDescription('View your inventory'),
    new SlashCommandBuilder().setName('openbox').setDescription('Open a loot crate from your inventory'),
];

// ══════════════════════════════════════════════
// CLIENT
// ══════════════════════════════════════════════
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} online!`);
    client.user.setActivity('TFCImon ⚔️ | /openpack');
    const rest = new REST({version:'10'}).setToken(BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(c=>c.toJSON()) });
        console.log(`✅ Registered ${commands.length} commands`);
    } catch(e) { console.error('Registration failed:', e); }
});

// ══════════════════════════════════════════════
// INTERACTION HANDLER
// ══════════════════════════════════════════════
client.on('interactionCreate', async interaction => {
    // ── BUTTONS ──
    if (interaction.isButton()) return handleButton(interaction);
    // ── SELECT ──
    if (interaction.isStringSelectMenu()) return handleSelect(interaction);
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const userId = interaction.user.id;
    const player = getPlayer(userId);

    // Guard: ban
    if (isBanned(userId) && !OP_CMD_NAMES.includes(commandName))
        return interaction.reply({ content:'🚫 You are banned from TFCImon.', ephemeral:true });
    // Guard: freeze
    if (isFrozen(userId) && ['battle','challenge','gamble','coinflip','slots','dice','blackjack','roulette'].includes(commandName))
        return interaction.reply({ content:'🧊 You are frozen and cannot do that.', ephemeral:true });

    // ════════ OP ════════
    if (commandName === 'op') {
        if (interaction.user.username !== OP_USER)
            return interaction.reply({ content:`❌ Only **${OP_USER}** can use this!`, ephemeral:true });
        const t = interaction.options.getUser('user');
        if (opUsers.includes(t.id)) return interaction.reply({ content:`❌ Already OP.`, ephemeral:true });
        opUsers.push(t.id); saveData();
        return interaction.reply({ content:`✅ **${t.username}** is now OP!`, ephemeral:true });
    }
    if (commandName === 'oplist') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const list = [`👑 **${OP_USER}** (Owner)`];
        for (const id of opUsers) {
            try { const u = await client.users.fetch(id); list.push(`🔑 **${u.username}**`); }
            catch { list.push(`🔑 <@${id}>`); }
        }
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('👑 OP Users').setDescription(list.join('\n')).setColor(0xf1c40f)], ephemeral:true });
    }
    if (commandName === 'revoke') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user');
        if (t.username === OP_USER) return interaction.reply({ content:'❌ Cannot revoke owner.', ephemeral:true });
        opUsers = opUsers.filter(id=>id!==t.id); saveData();
        return interaction.reply({ content:`✅ Revoked OP from **${t.username}**` });
    }
    if (commandName === 'givegems') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user'); const a = interaction.options.getInteger('amount');
        const tp = getPlayer(t.id); tp.gems += a; saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('💎 Gems Given').setDescription(`+**${a}💎** → **${t.displayName}**\nNew balance: **${tp.gems}💎**`).setColor(0x00b894)] });
    }
    if (commandName === 'takegems') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user'); const a = interaction.options.getInteger('amount');
        const tp = getPlayer(t.id); tp.gems = Math.max(0,tp.gems-a); saveData();
        return interaction.reply({ content:`✅ Took ${a}💎 from **${t.displayName}**. Now: ${tp.gems}💎` });
    }
    if (commandName === 'setgems') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user'); const a = interaction.options.getInteger('amount');
        getPlayer(t.id).gems = a; saveData();
        return interaction.reply({ content:`✅ Set **${t.displayName}**'s gems to **${a}💎**` });
    }
    if (commandName === 'givecard') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user'); const cid = interaction.options.getString('card');
        const tp = getPlayer(t.id); tp.deck.push(cid); saveData();
        const c = CARDS[cid];
        return interaction.reply({ content:`✅ Gave ${c?.emoji||'🃏'} **${c?.name||cid}** to **${t.displayName}**` });
    }
    if (commandName === 'kill') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user'); const tp = getPlayer(t.id);
        tp.deck=[]; tp.energyCards=0; tp.activeDeck=[]; saveData();
        return interaction.reply({ content:`💀 Wiped **${t.displayName}**'s deck!` });
    }
    if (commandName === 'banplayer') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user'); const r = interaction.options.getString('reason')||'No reason';
        if (bannedUsers.includes(t.id)) return interaction.reply({ content:`❌ Already banned.`, ephemeral:true });
        bannedUsers.push(t.id); saveData();
        return interaction.reply({ content:`🔨 Banned **${t.displayName}** — *${r}*` });
    }
    if (commandName === 'unbanplayer') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user');
        bannedUsers = bannedUsers.filter(id=>id!==t.id); saveData();
        return interaction.reply({ content:`✅ Unbanned **${t.displayName}**` });
    }
    if (commandName === 'freeze') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user');
        if (!frozenUsers.includes(t.id)) frozenUsers.push(t.id); saveData();
        return interaction.reply({ content:`🧊 Froze **${t.displayName}**` });
    }
    if (commandName === 'unfreeze') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user');
        frozenUsers = frozenUsers.filter(id=>id!==t.id); saveData();
        return interaction.reply({ content:`✅ Unfroze **${t.displayName}**` });
    }
    if (commandName === 'doublegems') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        doubleGemsEvent = !doubleGemsEvent; saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(doubleGemsEvent?'🎉 Double Gems ON!':'⏹️ Double Gems OFF').setColor(doubleGemsEvent?0xf1c40f:0x636e72)] });
    }
    if (commandName === 'xpboost') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        xpBoostEvent = !xpBoostEvent; saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(xpBoostEvent?'⚡ XP Boost ON!':'⏹️ XP Boost OFF').setColor(xpBoostEvent?0xfdcb6e:0x636e72)] });
    }
    if (commandName === 'broadcast') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const title = interaction.options.getString('title');
        const msg   = interaction.options.getString('message');
        const clr   = parseInt(interaction.options.getString('color')||'fdcb6e',16);
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`📢 ${title}`).setDescription(msg).setColor(clr).setFooter({text:`From: ${interaction.user.displayName}`}).setTimestamp()] });
    }
    if (commandName === 'setbounty') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user'); const a = interaction.options.getInteger('amount');
        bounties.set(t.id,{amount:a,setBy:userId,setByName:interaction.user.displayName,targetName:t.displayName}); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🎯 Bounty Placed!').setDescription(`**${a}💎** bounty on **${t.displayName}**!\nFirst to defeat them in PvP collects it!`).setColor(0xe17055)] });
    }
    if (commandName === 'removebounty') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const t = interaction.options.getUser('user');
        bounties.delete(t.id); saveData();
        return interaction.reply({ content:`✅ Removed bounty on **${t.displayName}**` });
    }
    if (commandName === 'resetarena') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const a = ARENAS[interaction.options.getString('arena')];
        a.holder=null; a.holderName=null; saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🏟️ Arena Reset').setDescription(`${a.emoji} **${a.name}** is unclaimed!`).setColor(a.color)] });
    }
    if (commandName === 'setarenacholder') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const arena = ARENAS[interaction.options.getString('arena')]; const t = interaction.options.getUser('user');
        arena.holder=t.id; arena.holderName=t.displayName; saveData();
        return interaction.reply({ content:`✅ Set ${t.displayName} as holder of **${arena.name}**` });
    }
    if (commandName === 'massgems') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const a = interaction.options.getInteger('amount'); let n=0;
        for (const [,p] of playerData) { p.gems+=a; n++; }
        saveData();
        return interaction.reply({ content:`✅ Gave **${a}💎** to **${n}** players!` });
    }
    if (commandName === 'wipeall') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('wipeall_confirm').setLabel('⚠️ CONFIRM WIPE ALL').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('wipeall_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ content:'⚠️ This will delete **ALL** player data. Are you sure?', components:[row], ephemeral:true });
    }
    if (commandName === 'clonecard') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const cid = interaction.options.getString('card'); const t = interaction.options.getUser('user');
        const c = CARDS[cid]; if(!c) return interaction.reply({ content:`❌ Card not found.`, ephemeral:true });
        getPlayer(t.id).deck.push(cid); saveData();
        return interaction.reply({ content:`✅ Cloned ${c.emoji} **${c.name}** → **${t.displayName}**` });
    }
    if (commandName === 'makecard') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const name  = interaction.options.getString('name');
        const hp    = interaction.options.getInteger('hp');
        const type  = interaction.options.getString('type');
        const rarity= interaction.options.getString('rarity');
        const emoji = interaction.options.getString('emoji');
        const m1n   = interaction.options.getString('move1name');
        const m1d   = interaction.options.getInteger('move1dmg');
        const m2n   = interaction.options.getString('move2name');
        const m2d   = interaction.options.getInteger('move2dmg');
        const cost  = interaction.options.getInteger('gemcost')||500;
        const gto   = interaction.options.getUser('giveto');
        const id    = `custom_${Date.now()}`;
        CARDS[id]   = { id, name, hp, type, rarity, emoji, color:0x6c5ce7, description:`Custom card by ${interaction.user.displayName}`, gemCost:cost,
            moves:[{name:m1n,damage:m1d,cost:2,emoji:'⚔️'},{name:m2n,damage:m2d,cost:4,emoji:'💥'}] };
        if (gto) getPlayer(gto.id).deck.push(id);
        saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`${emoji} Card Created: ${name}`)
            .setDescription(`**${hp}HP | ${type} | ${rarity}**\n⚔️ ${m1n}: ${m1d}dmg\n💥 ${m2n}: ${m2d}dmg${gto?`\n\n✅ Gave to **${gto.displayName}**`:''}\nCard ID: \`${id}\``)
            .setColor(0x6c5ce7)] });
    }
    if (commandName === 'editcard') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const cid   = interaction.options.getString('cardid');
        const field = interaction.options.getString('field');
        const val   = interaction.options.getString('value');
        const c     = CARDS[cid];
        if (!c) return interaction.reply({ content:`❌ Card \`${cid}\` not found.`, ephemeral:true });
        if (field==='hp') c.hp=parseInt(val);
        else if (field==='name') c.name=val;
        else if (field==='rarity') c.rarity=val;
        else if (field==='gemcost') c.gemCost=parseInt(val);
        saveData();
        return interaction.reply({ content:`✅ Updated ${c.emoji} **${c.name}** — ${field}: **${val}**` });
    }
    if (commandName === 'startraid') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const name   = interaction.options.getString('name');
        const emoji  = interaction.options.getString('emoji');
        const hp     = interaction.options.getInteger('hp');
        const reward = interaction.options.getInteger('reward');
        activeRaid = { name, emoji, hp, maxHp:hp, participants:{}, reward };
        saveData();
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle(`${emoji} RAID BOSS SPAWNED: ${name}!`)
            .setDescription(`HP: **${hp}**\nReward: **${reward}💎** per participant!\nUse \`/raidattack\` to deal damage!`)
            .setColor(0xe74c3c)] });
    }
    if (commandName === 'endraid') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        activeRaid = null; saveData();
        return interaction.reply({ content:`✅ Raid ended.` });
    }
    if (commandName === 'setevent') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const name = interaction.options.getString('name'); const desc = interaction.options.getString('description');
        globalEvent = { name, desc }; saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`🌍 Global Event: ${name}`).setDescription(desc).setColor(0xfdcb6e)] });
    }
    if (commandName === 'endevent') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        globalEvent = null; saveData();
        return interaction.reply({ content:`✅ Event ended.` });
    }
    if (commandName === 'tournament') {
        if (!isOp(interaction)) return interaction.reply({ content:'❌ No permission.', ephemeral:true });
        const prize = interaction.options.getInteger('prize')||500;
        if (!activeTournament.running) {
            activeTournament = { running:true, players:[], bracket:[], prize };
            return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🏆 Tournament Open!').setDescription(`Prize: **${prize}💎**\nUse \`/jointournament\` to enter!\nRun this command again to start the bracket.`).setColor(0xf1c40f)] });
        }
        if (activeTournament.players.length < 2) { activeTournament.running=false; return interaction.reply({ content:'❌ Cancelled — not enough players.' }); }
        const sh = [...activeTournament.players].sort(()=>Math.random()-.5);
        activeTournament.bracket = sh;
        const matchups = [];
        for (let i=0;i<sh.length-1;i+=2) matchups.push(`⚔️ **${sh[i].name}** vs **${sh[i+1]?.name||'BYE'}**`);
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🏆 Tournament Bracket!').setDescription(matchups.join('\n')+'\n\nUse `/battle` to fight your opponent! Winner gets the prize!').setColor(0xf1c40f)] });
    }

    // ════════ USER COMMANDS ════════
    if (commandName === 'openpack') {
        await interaction.deferReply();
        const pulled = openPack(3);
        let legendaryPulled = false;
        for (const id of pulled) {
            if (id==='energy') player.energyCards++;
            else {
                player.deck.push(id);
                if (CARDS[id]?.rarity==='LEGENDARY') legendaryPulled=true;
            }
        }
        const earned = 10 * gemMultiplier();
        player.gems += earned;
        player.totalPacksOpened++;
        progressQuest(player,'packs');
        if (legendaryPulled) unlockAchievement(player,'legendary');
        const newAch = checkAchievements(player);
        saveData();

        const embed = new EmbedBuilder()
            .setTitle('📦 Pack Opened!')
            .setDescription(`+${earned}💎${doubleGemsEvent?' (DOUBLE!)':''}`)
            .setColor(0xf39c12)
            .addFields({
                name:'🎴 You got:',
                value: pulled.map((id,i)=>{
                    if (id==='energy') return `**${i+1}:** ⚡ Energy Card`;
                    const c=CARDS[id];
                    const tag = c.rarity==='LEGENDARY'?' 🌟**LEGENDARY!!**':c.rarity==='EX'?' ✨EX!':'';
                    return `**${i+1}:** ${c.emoji} **${c.name}**${tag}`;
                }).join('\n')
            })
            .setFooter({ text:`Deck: ${player.deck.length} cards | ${player.gems}💎` });
        if (newAch.length) embed.addFields({ name:'🏅 Achievement Unlocked!', value: newAch.map(a=>`${a.emoji} **${a.name}** — ${a.desc}`).join('\n') });
        return interaction.editReply({ embeds:[embed] });
    }

    if (commandName === 'buypack') {
        if (player.gems < PACK_GEM_COST) return interaction.reply({ content:`❌ Need ${PACK_GEM_COST}💎, you have ${player.gems}💎.`, ephemeral:true });
        player.gems -= PACK_GEM_COST;
        const pulled = openPack(3);
        for (const id of pulled) id==='energy' ? player.energyCards++ : player.deck.push(id);
        player.totalPacksOpened++; progressQuest(player,'packs'); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('🛒 Pack Purchased!')
            .setDescription(pulled.map((id,i)=>id==='energy'?`**${i+1}:** ⚡ Energy Card`:`**${i+1}:** ${CARDS[id].emoji} **${CARDS[id].name}**`).join('\n'))
            .setColor(0x00b894)
            .setFooter({text:`Remaining: ${player.gems}💎`})] });
    }

    if (commandName === 'deck') {
        const counts = {};
        for (const id of player.deck) counts[id]=(counts[id]||0)+1;
        const lines = Object.entries(counts).map(([id,cnt])=>{
            const c=CARDS[id]; if(!c) return null;
            const lv=getCardLevel(player,id);
            const nick=player.nicknames?.[id]?` *"${player.nicknames[id]}"*`:'';
            const active=player.activeDeck?.includes(id)?' 🎯':'';
            const wins=player.cardWins?.[id]||0;
            return `${c.emoji}${active} **${c.name}**${nick} Lv${lv} ×${cnt} — ${c.rarity} | ${wins}W`;
        }).filter(Boolean);
        const embed = new EmbedBuilder()
            .setTitle(`📦 ${interaction.user.displayName}'s Deck`)
            .setColor(0x9b59b6)
            .setDescription(lines.length ? lines.join('\n') : 'Empty! Use `/openpack`')
            .setFooter({text:`${player.deck.length} cards | ${player.gems}💎 | ${player.wins}W ${player.losses}L | Prestige ${player.prestige}`});
        if (player.activeDeck?.length) embed.addFields({ name:'🎯 Active Deck', value:player.activeDeck.map(id=>CARDS[id]?.name||id).join(', ') });
        if (bounties.has(userId)) embed.addFields({ name:'🎯 BOUNTY', value:`**${bounties.get(userId).amount}💎** on this player!` });
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'inspect') {
        const t = interaction.options.getUser('user'); const tp = getPlayer(t.id);
        const counts = {};
        for (const id of tp.deck) counts[id]=(counts[id]||0)+1;
        const lines = Object.entries(counts).map(([id,cnt])=>{ const c=CARDS[id]; return c?`${c.emoji} **${c.name}** Lv${getCardLevel(tp,id)} ×${cnt} — ${c.rarity}`:null; }).filter(Boolean);
        const embed = new EmbedBuilder()
            .setTitle(`📦 ${t.displayName}'s Deck`)
            .setColor(0x9b59b6)
            .setDescription(lines.length?lines.join('\n'):'Empty!')
            .setFooter({text:`${tp.deck.length} cards | ${tp.gems}💎 | ${tp.wins}W ${tp.losses}L`});
        if (bounties.has(t.id)) embed.addFields({ name:'🎯 BOUNTY', value:`**${bounties.get(t.id).amount}💎**` });
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'cardinfo') {
        const c = CARDS[interaction.options.getString('card')];
        if (!c) return interaction.reply({ content:'❌ Not found.', ephemeral:true });
        const embed = new EmbedBuilder()
            .setTitle(`${c.emoji} ${c.name}`)
            .setColor(c.color||getRarityColor(c.rarity))
            .setDescription(c.description)
            .addFields(
                {name:'❤️ HP',value:`${c.hp}`,inline:true},{name:'⚡ Type',value:c.type,inline:true},{name:'⭐ Rarity',value:c.rarity,inline:true},
                {name:'💎 Price',value:`${c.gemCost}💎`,inline:true},{name:'💰 Sell',value:`${Math.round(c.gemCost*SELL_BACK_RATE)}💎`,inline:true},
                {name:'⚔️ Moves',value:c.moves.map(m=>`${m.emoji} **${m.name}** — ${m.damage}dmg | ${m.cost}⚡${m.isEx?' ✨EX':''}`).join('\n')}
            );
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'gems') {
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('💎 Your Gems')
            .setDescription(`You have **${player.gems}💎**${doubleGemsEvent?'\n\n🎉 **DOUBLE GEMS event active!**':''}`)
            .addFields(
                {name:'Ways to earn',value:'• Open/buy packs: +10💎\n• Win PvP: +25💎\n• Conquer arena: +50💎\n• Daily reward: 50–200💎\n• Gambling 🎰\n• Quests 📋\n• Raid boss 💀',inline:true}
            )
            .setColor(0xf1c40f)] });
    }

    if (commandName === 'daily') {
        const now = Date.now(); const cd = 86_400_000;
        const today = getTodayStr();
        if (player.lastDaily && now-player.lastDaily < cd) {
            const h = Math.floor((cd-(now-player.lastDaily))/3600000);
            const m = Math.floor(((cd-(now-player.lastDaily))%3600000)/60000);
            return interaction.reply({ content:`⏰ Come back in **${h}h ${m}m**`, ephemeral:true });
        }
        // Streak
        const yesterday = new Date(Date.now()-86_400_000).toISOString().split('T')[0];
        if (player.lastStreak === yesterday) player.streak = (player.streak||0)+1;
        else if (player.lastStreak !== today) player.streak = 1;
        player.lastStreak = today;

        const base    = Math.floor(Math.random()*151)+50;
        const streakB = Math.min(player.streak*10, 100);
        const total   = (base+streakB) * gemMultiplier();
        player.gems  += total;
        player.lastDaily = now;
        progressQuest(player,'dailies');
        const newAch = checkAchievements(player);
        saveData();

        const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reward!')
            .setDescription(`+**${total}💎**${doubleGemsEvent?' (×2!)':''}\n🔥 Streak: **${player.streak} day${player.streak!==1?'s':''}** (+${streakB}💎 bonus)\nBalance: **${player.gems}💎**`)
            .setColor(0x00b894);
        if (newAch.length) embed.addFields({ name:'🏅 Achievement!', value:newAch.map(a=>`${a.emoji} **${a.name}**`).join('\n') });
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'leaderboard') {
        const all = [...playerData.entries()].map(([id,p])=>({id,gems:p.gems||0,wins:p.wins||0,prestige:p.prestige||0}));
        const byWins  = [...all].sort((a,b)=>b.wins-a.wins).slice(0,5);
        const byGems  = [...all].sort((a,b)=>b.gems-a.gems).slice(0,5);
        const medals  = ['🥇','🥈','🥉','4️⃣','5️⃣'];
        const embed   = new EmbedBuilder().setTitle('🏆 TFCImon Leaderboard').setColor(0xf1c40f)
            .addFields(
                {name:'⚔️ Top Battlers', value:byWins.map((p,i)=>`${medals[i]} <@${p.id}> — **${p.wins}W**${p.prestige?` | ✨P${p.prestige}`:''}`).join('\n')||'No data'},
                {name:'💎 Top Gem Holders', value:byGems.map((p,i)=>`${medals[i]} <@${p.id}> — **${p.gems}💎**`).join('\n')||'No data'},
            );
        const holders = Object.values(ARENAS).filter(a=>a.holder).map(a=>`${a.emoji} **${a.name}** → ${a.holderName}`).join('\n');
        if (holders) embed.addFields({name:'🏟️ Arena Holders',value:holders});
        if (bounties.size) embed.addFields({name:'🎯 Active Bounties',value:[...bounties.values()].map(b=>`🎯 **${b.targetName}** — ${b.amount}💎`).join('\n')});
        if (clans.size) {
            const topClans = [...clans.values()].sort((a,b)=>(b.wins||0)-(a.wins||0)).slice(0,3);
            embed.addFields({name:'🏴 Top Clans',value:topClans.map((c,i)=>`${medals[i]} ${c.emoji} **${c.name}** — ${c.wins||0}W | ${c.members.length} members`).join('\n')});
        }
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'stats') {
        const winRate = player.wins+player.losses > 0 ? Math.round(player.wins/(player.wins+player.losses)*100) : 0;
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${interaction.user.displayName}'s Stats`)
            .setColor(0x3498db)
            .addFields(
                {name:'⚔️ Battles',    value:`${player.wins}W / ${player.losses}L (${winRate}%)`,inline:true},
                {name:'💎 Gems',       value:`${player.gems}`,inline:true},
                {name:'🃏 Cards',      value:`${player.deck.length}`,inline:true},
                {name:'⚡ Energy',     value:`${player.energyCards}`,inline:true},
                {name:'🔥 Streak',     value:`${player.streak||0} days`,inline:true},
                {name:'✨ Prestige',   value:`${player.prestige||0}`,inline:true},
                {name:'📦 Packs Opened',value:`${player.totalPacksOpened||0}`,inline:true},
                {name:'🎰 Gambles',    value:`${player.totalGambles||0}`,inline:true},
            );
        if (player.clan) embed.addFields({name:'🏴 Clan',value:player.clan,inline:true});
        if (player.title) embed.addFields({name:'🎖️ Title',value:player.title,inline:true});
        if (Object.keys(player.cardWins||{}).length) {
            const best = Object.entries(player.cardWins).sort((a,b)=>b[1]-a[1])[0];
            const bc   = CARDS[best[0]];
            if (bc) embed.addFields({name:'🌟 Best Card',value:`${bc.emoji} **${bc.name}** (${best[1]}W, Lv${getCardLevel(player,best[0])})`});
        }
        if (bounties.has(userId)) embed.addFields({name:'🎯 Bounty on You',value:`**${bounties.get(userId).amount}💎**`});
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'profile') {
        const t   = interaction.options.getUser('user') || interaction.user;
        const tp  = getPlayer(t.id);
        const ach = tp.achievements.map(id=>ACHIEVEMENTS.find(a=>a.id===id)).filter(Boolean);
        const embed = new EmbedBuilder()
            .setTitle(`${tp.title||''}${tp.title?' ':''}${t.displayName}'s Profile`)
            .setThumbnail(t.displayAvatarURL())
            .setColor(0x6c5ce7)
            .addFields(
                {name:'✨ Prestige',   value:`${prestigeTitle(tp.prestige||0)}`,inline:true},
                {name:'⚔️ Record',    value:`${tp.wins||0}W / ${tp.losses||0}L`,inline:true},
                {name:'💎 Gems',      value:`${tp.gems}`,inline:true},
                {name:'🃏 Cards',     value:`${tp.deck.length}`,inline:true},
                {name:'🔥 Streak',    value:`${tp.streak||0} days`,inline:true},
                {name:'🏅 Achievements',value:`${tp.achievements.length}/${ACHIEVEMENTS.length}`,inline:true},
            );
        if (ach.length) embed.addFields({name:'🏅 Earned',value:ach.map(a=>`${a.emoji} ${a.name}`).join(' | ')||'None yet'});
        if (tp.clan) embed.addFields({name:'🏴 Clan',value:tp.clan});
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'arenas') {
        const embed = new EmbedBuilder().setTitle('🏟️ TFCImon Arenas').setDescription('Challenge a guardian with `/challenge`!').setColor(0x00cec9);
        for (const a of Object.values(ARENAS)) {
            const h = a.holder ? `👑 **${a.holderName}**` : '🔓 *Unclaimed!*';
            embed.addFields({name:`${a.emoji} ${a.name}`,value:`${a.description}\n${h} | 🛡️ ${a.guardian.name} (${a.guardian.hp}HP)`});
        }
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'builddeck') {
        if (!player.deck.length) return interaction.reply({ content:'❌ No cards!', ephemeral:true });
        const unique = [...new Set(player.deck)].filter(id=>CARDS[id]);
        const opts   = unique.slice(0,25).map(id=>{
            const c=CARDS[id]; const lv=getCardLevel(player,id);
            return {label:`${c.name} Lv${lv}`,description:`${c.hp}HP | ${c.rarity}`,value:id,emoji:c.emoji};
        });
        const sel = new StringSelectMenuBuilder()
            .setCustomId(`builddeck_${userId}`)
            .setPlaceholder('Pick up to 3 cards for your battle deck')
            .setMinValues(1).setMaxValues(Math.min(3,opts.length))
            .addOptions(opts);
        return interaction.reply({ content:'🎯 **Build your active deck** — these cards will be used in battles:', components:[new ActionRowBuilder().addComponents(sel)] });
    }

    if (commandName === 'cleardeck') {
        player.activeDeck = []; saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🗑️ Deck Cleared').setDescription('Random cards from your full deck will be used in battles.').setColor(0x636e72)] });
    }

    if (commandName === 'sell') {
        const cid = interaction.options.getString('card'); const c = CARDS[cid];
        if (!c) return interaction.reply({ content:'❌ Card not found.', ephemeral:true });
        if (!player.deck.includes(cid)) return interaction.reply({ content:`❌ You don't have **${c.name}**.`, ephemeral:true });
        const val = Math.round(c.gemCost*SELL_BACK_RATE);
        player.deck.splice(player.deck.indexOf(cid),1);
        player.gems += val; saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('💰 Card Sold!').setDescription(`${c.emoji} **${c.name}** sold for **${val}💎**\nBalance: **${player.gems}💎**`).setColor(0x00b894)] });
    }

    if (commandName === 'rename') {
        const cid  = interaction.options.getString('card'); const nick = interaction.options.getString('nickname');
        const c    = CARDS[cid];
        if (!player.deck.includes(cid)) return interaction.reply({ content:`❌ You don't have **${c?.name}**.`, ephemeral:true });
        if (!player.nicknames) player.nicknames={};
        player.nicknames[cid]=nick; saveData();
        return interaction.reply({ content:`✏️ ${c.emoji} **${c.name}** is now called *"${nick}"*!` });
    }

    if (commandName === 'battle') {
        const opp = interaction.options.getUser('opponent');
        if (opp.id===userId) return interaction.reply({ content:'❌ You can\'t battle yourself!', ephemeral:true });
        if (opp.bot)          return interaction.reply({ content:'❌ Can\'t battle bots.', ephemeral:true });
        if (isBanned(opp.id)) return interaction.reply({ content:'❌ That player is banned.', ephemeral:true });
        const cp = getPlayer(userId); const op = getPlayer(opp.id);
        if (!cp.deck.length) return interaction.reply({ content:'❌ You have no cards!', ephemeral:true });
        if (!op.deck.length) return interaction.reply({ content:`❌ ${opp.displayName} has no cards!`, ephemeral:true });
        const cid = getBattleCard(cp); const oid = getBattleCard(op);
        const cc  = CARDS[cid]; const oc = CARDS[oid];
        const ceb = cp.energyCards>0?(cp.energyCards--,2):0;
        const oeb = op.energyCards>0?(op.energyCards--,2):0;
        const clv = getCardLevel(cp,cid); const olv = getCardLevel(op,oid);
        const bid = `pvp_${userId}_${opp.id}_${Date.now()}`;
        activeBattles.set(bid, {
            bid,
            challenger:{id:userId, name:interaction.user.displayName, cardId:cid, hp:cc.hp, energy:3+ceb, level:clv},
            opponent:  {id:opp.id,name:opp.displayName,             cardId:oid, hp:oc.hp, energy:3+oeb, level:olv},
            turn:userId, accepted:false,
        });
        const embed = new EmbedBuilder()
            .setTitle('⚔️ Battle Challenge!')
            .setDescription(`${interaction.user.displayName} challenges ${opp} to a TFCImon battle!`)
            .setColor(0xe74c3c)
            .addFields(
                {name:`${cc.emoji} ${interaction.user.displayName}`,value:`**${cc.name}** Lv${clv} — ${cc.hp}HP${ceb?' ⚡+2':''}`,inline:true},
                {name:'VS',value:'───',inline:true},
                {name:`${oc.emoji} ${opp.displayName}`,value:`**${oc.name}** Lv${olv} — ${oc.hp}HP${oeb?' ⚡+2':''}`,inline:true},
            )
            .setFooter({text:`${opp.displayName}, do you accept?`});
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pvp_accept_${bid}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`pvp_decline_${bid}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger),
        );
        return interaction.reply({ embeds:[embed], components:[row] });
    }

    if (commandName === 'challenge') {
        const arena = ARENAS[interaction.options.getString('arena')];
        if (!player.deck.length) return interaction.reply({ content:'❌ No cards!', ephemeral:true });
        const cid = getBattleCard(player);
        if (!cid) return interaction.reply({ content:'❌ No valid cards.', ephemeral:true });
        const c   = CARDS[cid]; const lv = getCardLevel(player,cid);
        const eb  = player.energyCards>0?(player.energyCards--,2):0;
        const bid = `arena_${arena.id}_${userId}_${Date.now()}`;
        activeArenaBattles.set(bid, {
            bid, arenaId:arena.id, userId, userName:interaction.user.displayName,
            cardId:cid, playerHp:c.hp, playerEnergy:3+eb,
            guardianHp:arena.guardian.hp, guardianEnergy:arena.guardian.energy, cardLevel:lv,
        });
        const embed = new EmbedBuilder()
            .setTitle(`${arena.emoji} Arena: ${arena.name}`)
            .setDescription(`**${interaction.user.displayName}** enters the arena!\n${arena.guardian.emoji} **${arena.guardian.name}** stands in the way!${eb?'\n⚡ Energy card! +2 energy!':''}${lv>1?`\n⬆️ ${c.name} Lv${lv}!`:''}`)
            .setColor(arena.color)
            .addFields(
                {name:`${c.emoji} You`,value:`**${c.name}** Lv${lv} — ${c.hp}HP`,inline:true},
                {name:'VS',value:'───',inline:true},
                {name:`${arena.guardian.emoji} Guardian`,value:`**${arena.guardian.name}** — ${arena.guardian.hp}HP`,inline:true},
            )
            .setFooter({text:'Your turn!'});
        await interaction.reply({ embeds:[embed] });
        return sendArenaBattle(interaction.channel, bid);
    }

    if (commandName === 'gift') {
        const t = interaction.options.getUser('user'); const cid = interaction.options.getString('card'); const c = CARDS[cid];
        if (t.id===userId) return interaction.reply({ content:'❌ Cannot gift yourself.', ephemeral:true });
        if (!player.deck.includes(cid)) return interaction.reply({ content:`❌ You don't have **${c?.name}**.`, ephemeral:true });
        player.deck.splice(player.deck.indexOf(cid),1);
        getPlayer(t.id).deck.push(cid);
        progressQuest(player,'gifts'); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🎁 Card Gifted!').setDescription(`${c.emoji} **${c.name}** gifted to **${t.displayName}**!`).setColor(0x00b894)] });
    }

    if (commandName === 'trade') {
        const t   = interaction.options.getUser('user');
        const gid = interaction.options.getString('give'); const wid = interaction.options.getString('get');
        const gc  = CARDS[gid]; const wc = CARDS[wid];
        if (!gc||!wc) return interaction.reply({ content:'❌ Invalid card ID(s). Use card IDs (e.g. `flame`, `michael`).', ephemeral:true });
        if (!player.deck.includes(gid)) return interaction.reply({ content:`❌ You don't have **${gc.name}**.`, ephemeral:true });
        if (t.id===userId) return interaction.reply({ content:'❌ Can\'t trade with yourself.', ephemeral:true });
        const tid = tradeCounter++;
        tradeOffers.set(tid, { tid, fromId:userId, fromName:interaction.user.displayName, toId:t.id, toName:t.displayName, giveId:gid, wantId:wid });
        const embed = new EmbedBuilder()
            .setTitle('🔄 Trade Offer!')
            .setDescription(`**${interaction.user.displayName}** → **${t.displayName}**`)
            .setColor(0x6c5ce7)
            .addFields(
                {name:'📤 They give',value:`${gc.emoji} **${gc.name}**`,inline:true},
                {name:'📥 They want',value:`${wc.emoji} **${wc.name}**`,inline:true},
            )
            .setFooter({text:`Trade #${tid} — ${t.displayName}, accept?`});
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`trade_accept_${tid}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`trade_decline_${tid}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger),
        );
        return interaction.reply({ embeds:[embed], components:[row] });
    }

    // ── GAMBLING ──
    if (commandName === 'gamble') {
        const amount = interaction.options.getInteger('amount');
        if (player.gems<amount) return interaction.reply({ content:`❌ You only have ${player.gems}💎.`, ephemeral:true });
        const roll = Math.random(); let desc;
        if (roll<0.45)      { player.gems+=amount; desc=`✅ **WIN!** +${amount}💎`; }
        else if (roll<0.55) { const l=Math.floor(amount/2); player.gems-=l; desc=`🤝 **PUSH!** -${l}💎`; }
        else                { player.gems-=amount; desc=`❌ **LOSE!** -${amount}💎`; }
        player.totalGambles++; progressQuest(player,'gambles');
        const newAch = checkAchievements(player); saveData();
        const e = new EmbedBuilder().setTitle('🎰 Gamble').setDescription(`Bet: **${amount}💎**\n${desc}\nBalance: **${player.gems}💎**`).setColor(roll<0.45?0x00b894:roll<0.55?0xf39c12:0xe74c3c);
        if (newAch.length) e.addFields({name:'🏅 Achievement!',value:newAch.map(a=>`${a.emoji} **${a.name}**`).join('\n')});
        return interaction.reply({ embeds:[e] });
    }

    if (commandName === 'coinflip') {
        const amount = interaction.options.getInteger('amount'); const call = interaction.options.getString('call');
        if (player.gems<amount) return interaction.reply({ content:`❌ Need ${amount}💎.`, ephemeral:true });
        const result = Math.random()<0.5?'heads':'tails'; const won = result===call;
        if(won) player.gems+=amount; else player.gems-=amount;
        player.totalGambles++; progressQuest(player,'gambles'); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('🪙 Coin Flip!')
            .setDescription(`You called **${call}** → landed **${result}**\n${won?`✅ WIN! +${amount}💎`:`❌ LOSE! -${amount}💎`}\nBalance: **${player.gems}💎**`)
            .setColor(won?0x00b894:0xe74c3c)] });
    }

    if (commandName === 'slots') {
        const amount = interaction.options.getInteger('amount');
        if (player.gems<amount) return interaction.reply({ content:`❌ Need ${amount}💎.`, ephemeral:true });
        const reels = spinSlots(); const mult = evalSlots(reels);
        let desc;
        if (mult===0)  { player.gems-=amount; desc=`❌ LOSE! -${amount}💎`; }
        else           { const w=Math.floor(amount*mult)-amount; player.gems+=w; desc=`✅ **${mult}x!** +${w}💎`; }
        player.totalGambles++; progressQuest(player,'gambles'); saveData();
        const payouts = Object.entries(SLOT_PAY).map(([k,v])=>`${k}=${v}x`).join(' | ');
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('🎰 Slot Machine!')
            .setDescription(`\`[ ${reels.join(' | ')} ]\`\n${desc}\nBalance: **${player.gems}💎**`)
            .addFields({name:'Payouts',value:payouts+' | Any pair=1.5x'})
            .setColor(mult>0?0xf1c40f:0xe74c3c)] });
    }

    if (commandName === 'dice') {
        const amount = interaction.options.getInteger('amount'); const mode = interaction.options.getString('mode');
        if (player.gems<amount) return interaction.reply({ content:`❌ Need ${amount}💎.`, ephemeral:true });
        let desc; let won=false;
        if (mode==='classic') {
            const p1=~~(Math.random()*6)+1; const p2=~~(Math.random()*6)+1;
            const tie=p1===p2;
            won=p1>p2;
            if(tie) desc=`🎲 You: **${p1}** | House: **${p2}** — 🤝 **TIE!** (bet returned)`;
            else { if(won) player.gems+=amount; else player.gems-=amount; desc=`🎲 You: **${p1}** | House: **${p2}** — ${won?`✅ WIN! +${amount}💎`:`❌ LOSE! -${amount}💎`}`; }
        } else if (mode==='highstakes') {
            const d1=~~(Math.random()*6)+1; const d2=~~(Math.random()*6)+1; const tot=d1+d2;
            won=tot>7; const tie=tot===7;
            if(tie) desc=`🎲 **${d1}+${d2}=${tot}** — 🤝 **EXACTLY 7! TIE!**`;
            else {
                const mult=won?(tot>=11?3:2):1; const chg=Math.floor(amount*(mult-1));
                if(won) player.gems+=chg; else player.gems-=amount;
                desc=`🎲🎲 **${d1}+${d2}=${tot}** (need >7) — ${won?`✅ WIN! +${chg}💎 (${mult}x)`:`❌ LOSE! -${amount}💎`}`;
            }
        } else {
            const d20=~~(Math.random()*20)+1; const d6=~~(Math.random()*6)+1; const tot=d20+d6;
            if(tot===21) { player.gems+=amount*5; won=true; desc=`🎲 d20:**${d20}** + d6:**${d6}** = **21** 🎉 **JACKPOT! +${amount*5}💎 (5x)**`; }
            else if(tot>21) { player.gems-=amount; desc=`🎲 d20:**${d20}** + d6:**${d6}** = **${tot}** 💥 BUST! -${amount}💎`; }
            else { player.gems-=Math.floor(amount/2); desc=`🎲 d20:**${d20}** + d6:**${d6}** = **${tot}** 😬 No 21… -${Math.floor(amount/2)}💎`; }
        }
        player.totalGambles++; progressQuest(player,'gambles'); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`🎲 Dice — ${mode}`).setDescription(desc+`\nBalance: **${player.gems}💎**`).setColor(won?0x00b894:0xe74c3c)] });
    }

    if (commandName === 'blackjack') {
        const amount = interaction.options.getInteger('amount');
        if (player.gems<amount) return interaction.reply({ content:`❌ Need ${amount}💎.`, ephemeral:true });
        const deal = ()=>Math.min(~~(Math.random()*13)+1,10);
        let ph=[deal(),deal()]; let dh=[deal(),deal()];
        const sum = h=>h.reduce((a,b)=>a+b,0);
        const pSum=sum(ph); const dSum=sum(dh);
        let result;
        if (pSum===21)      { player.gems+=Math.floor(amount*1.5); result=`🃏 **BLACKJACK!** +${Math.floor(amount*1.5)}💎`; }
        else if (dSum===21) { player.gems-=amount; result=`🃏 Dealer has **Blackjack**! -${amount}💎`; }
        else if (dSum>21)   { player.gems+=amount; result=`🃏 Dealer **bust** (${dSum})! +${amount}💎`; }
        else if (pSum>21)   { player.gems-=amount; result=`🃏 You **bust** (${pSum})! -${amount}💎`; }
        else if (pSum>dSum) { player.gems+=amount; result=`🃏 You win **${pSum}** vs ${dSum}! +${amount}💎`; }
        else if (pSum<dSum) { player.gems-=amount; result=`🃏 Dealer wins **${dSum}** vs ${pSum}! -${amount}💎`; }
        else                { result=`🃏 **Push!** ${pSum} vs ${dSum} (bet returned)`; }
        player.totalGambles++; progressQuest(player,'gambles'); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('🃏 Blackjack!')
            .setDescription(`Your hand: **[${ph.join(', ')}]** = **${pSum}**\nDealer hand: **[${dh.join(', ')}]** = **${dSum}**\n\n${result}\nBalance: **${player.gems}💎**`)
            .setColor(pSum<=21&&(pSum>dSum||dSum>21)?0x00b894:0xe74c3c)] });
    }

    if (commandName === 'roulette') {
        const amount = interaction.options.getInteger('amount'); const bet = interaction.options.getString('bet');
        if (player.gems<amount) return interaction.reply({ content:`❌ Need ${amount}💎.`, ephemeral:true });
        const spin = ~~(Math.random()*37); // 0-36
        const spinColor = spin===0?'green':spin%2===0?'black':'red';
        let won=false; let mult=1;
        if (bet==='green')  { won=spin===0; mult=14; }
        else if (bet==='red')   { won=spinColor==='red'; mult=2; }
        else if (bet==='black') { won=spinColor==='black'; mult=2; }
        else if (bet==='odd')   { won=spin!==0&&spin%2!==0; mult=2; }
        else if (bet==='even')  { won=spin!==0&&spin%2===0; mult=2; }
        const spinEmoji = spinColor==='red'?'🔴':spinColor==='black'?'⚫':'🟢';
        if(won) player.gems+=amount*(mult-1); else player.gems-=amount;
        player.totalGambles++; progressQuest(player,'gambles'); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('🎡 Roulette!')
            .setDescription(`The wheel spins...\n${spinEmoji} **${spin}** (${spinColor})\n\nYou bet **${bet}** — ${won?`✅ **WIN! +${amount*(mult-1)}💎** (${mult}x)`:` ❌ **LOSE! -${amount}💎**`}\nBalance: **${player.gems}💎**`)
            .setColor(won?0x00b894:0xe74c3c)] });
    }

    // ── AUCTION HOUSE ──
    if (commandName === 'ah') {
        const all = [...auctionListings.values()];
        if (!all.length) return interaction.reply({ content:'🏪 Auction house is empty! Use `/ah-sell`.' });
        const embed = new EmbedBuilder().setTitle('🏪 Auction House').setColor(0xe17055);
        for (const l of all.slice(0,10)) {
            const c = CARDS[l.cardId];
            embed.addFields({name:`#${l.id} ${c?.emoji} ${c?.name}`,value:`💰 **${l.price}💎** | Seller: ${l.sellerName}`});
        }
        const row = new ActionRowBuilder();
        for (const l of all.slice(0,4)) {
            row.addComponents(new ButtonBuilder().setCustomId(`ah_buy_${l.id}`).setLabel(`Buy #${l.id}`).setStyle(ButtonStyle.Success));
        }
        return interaction.reply({ embeds:[embed], components:[row] });
    }

    if (commandName === 'ah-sell') {
        const cid = interaction.options.getString('card'); const price = interaction.options.getInteger('price');
        if (!player.deck.includes(cid)) return interaction.reply({ content:`❌ You don't have that card.`, ephemeral:true });
        player.deck.splice(player.deck.indexOf(cid),1);
        const id = listingCounter++;
        auctionListings.set(id,{id,sellerId:userId,sellerName:interaction.user.displayName,cardId:cid,price});
        progressQuest(player,'ah_sells'); saveData();
        return interaction.reply({ content:`✅ Listed **${CARDS[cid]?.name}** as #${id} for **${price}💎**!` });
    }

    if (commandName === 'ah-cancel') {
        const lid = interaction.options.getInteger('id'); const l = auctionListings.get(lid);
        if (!l) return interaction.reply({ content:'❌ Listing not found.', ephemeral:true });
        if (l.sellerId!==userId && !isOp(interaction)) return interaction.reply({ content:'❌ Not your listing.', ephemeral:true });
        player.deck.push(l.cardId);
        auctionListings.delete(lid); saveData();
        return interaction.reply({ content:`✅ Cancelled listing #${lid} — **${CARDS[l.cardId]?.name}** returned to your deck.` });
    }

    if (commandName === 'bounties') {
        if (!bounties.size) return interaction.reply({ content:'🎯 No active bounties.' });
        const embed = new EmbedBuilder().setTitle('🎯 Active Bounties').setDescription('Defeat them in PvP to collect!').setColor(0xe17055);
        for (const [,b] of bounties) embed.addFields({name:b.targetName,value:`💰 **${b.amount}💎** — set by ${b.setByName}`});
        return interaction.reply({ embeds:[embed] });
    }

    // ── QUESTS ──
    if (commandName === 'quests') {
        getOrRefreshQuests(player);
        const embed = new EmbedBuilder().setTitle('📋 Daily Quests').setDescription('Resets every day at midnight.').setColor(0xfdcb6e);
        for (const q of player.quests) {
            const bar = `${q.done?'✅':'⏳'} **${q.desc}** — ${q.done?'DONE':`${q.progress||0}/${q.target}`} | **${q.reward}💎**`;
            embed.addFields({name:bar,value:'\u200b'});
        }
        return interaction.reply({ embeds:[embed] });
    }

    // ── ACHIEVEMENTS ──
    if (commandName === 'achievements') {
        const embed = new EmbedBuilder().setTitle('🏅 Achievements').setColor(0xf1c40f);
        for (const a of ACHIEVEMENTS) {
            const earned = player.achievements.includes(a.id);
            embed.addFields({name:`${earned?a.emoji:'⬜'} ${a.name}`,value:`${a.desc}${earned?' ✅':''}`,inline:true});
        }
        embed.setFooter({text:`${player.achievements.length}/${ACHIEVEMENTS.length} unlocked`});
        return interaction.reply({ embeds:[embed] });
    }

    // ── PRESTIGE ──
    if (commandName === 'prestige') {
        if (player.wins<50) return interaction.reply({ content:`❌ Need **50 wins** to prestige. You have **${player.wins}**.`, ephemeral:true });
        if (player.gems<1000) return interaction.reply({ content:`❌ Need **1000💎** to prestige. You have **${player.gems}💎**.`, ephemeral:true });
        player.prestige=(player.prestige||0)+1;
        player.wins=0; player.losses=0; player.deck=[]; player.activeDeck=[];
        player.gems-=1000; player.cardWins={}; player.cardLosses={}; player.cardLevels={};
        // Prestige reward: loot crate + permanent gem bonus is tracked via prestige value
        if (!player.inventory) player.inventory=[];
        player.inventory.push('lootcrate','lootcrate');
        unlockAchievement(player,'prestige1');
        saveData();
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('✨ PRESTIGE!')
            .setDescription(`You have ascended to **${prestigeTitle(player.prestige)}**!\nYour deck and stats were reset, but your gems (minus 1000) and prestige perks remain.\n\n**Bonus:** +${player.prestige*5}% gem gain permanently!\n🎁 You received **2 Loot Crates**!`)
            .setColor(0xf1c40f)] });
    }

    // ── CRAFTING ──
    if (commandName === 'craft') {
        const embed = new EmbedBuilder().setTitle('⚒️ Crafting Recipes').setDescription('Combine two cards to craft something powerful!').setColor(0x6c5ce7);
        for (const r of CRAFT_RECIPES) {
            const [a,b] = r.ingredients; const res = CARDS[r.result];
            embed.addFields({name:`${CARDS[a]?.emoji} ${CARDS[a]?.name} + ${CARDS[b]?.emoji} ${CARDS[b]?.name}`,value:`→ ${res?.emoji} **${res?.name||r.name}** | Use: \`/craftcard ${a} ${b}\``});
        }
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'craftcard') {
        const c1 = interaction.options.getString('card1'); const c2 = interaction.options.getString('card2');
        const recipe = CRAFT_RECIPES.find(r=>(r.ingredients[0]===c1&&r.ingredients[1]===c2)||(r.ingredients[0]===c2&&r.ingredients[1]===c1));
        if (!recipe) return interaction.reply({ content:'❌ No recipe found for those two cards. Check `/craft` for recipes.', ephemeral:true });
        if (!player.deck.includes(c1)) return interaction.reply({ content:`❌ You don't have **${CARDS[c1]?.name||c1}**.`, ephemeral:true });
        if (!player.deck.includes(c2)) return interaction.reply({ content:`❌ You don't have **${CARDS[c2]?.name||c2}**.`, ephemeral:true });
        player.deck.splice(player.deck.indexOf(c1),1);
        player.deck.splice(player.deck.indexOf(c2),1);
        player.deck.push(recipe.result);
        saveData();
        const result = CARDS[recipe.result];
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle('⚒️ Craft Successful!')
            .setDescription(`${CARDS[c1].emoji} **${CARDS[c1].name}** + ${CARDS[c2].emoji} **${CARDS[c2].name}**\n→ ${result.emoji} **${result.name}** (${result.rarity})!`)
            .setColor(0x6c5ce7)] });
    }

    // ── CLANS ──
    if (commandName === 'clancreate') {
        const name  = interaction.options.getString('name'); const emoji = interaction.options.getString('emoji');
        if (player.clan) return interaction.reply({ content:`❌ You're already in clan **${player.clan}**.`, ephemeral:true });
        if (clans.has(name)) return interaction.reply({ content:`❌ Clan **${name}** already exists.`, ephemeral:true });
        clans.set(name,{name,emoji,leader:userId,leaderName:interaction.user.displayName,members:[userId],bank:0,level:1,wins:0});
        player.clan=name; unlockAchievement(player,'clan_found'); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`${emoji} Clan Created: ${name}!`).setDescription(`You are the leader of **${name}**!\nInvite others with \`/claninvite\`.`).setColor(0x00b894)] });
    }

    if (commandName === 'claninvite') {
        const t = interaction.options.getUser('user'); const tp = getPlayer(t.id);
        if (!player.clan) return interaction.reply({ content:'❌ You\'re not in a clan.', ephemeral:true });
        const clan = clans.get(player.clan);
        if (clan.leader!==userId) return interaction.reply({ content:'❌ Only the clan leader can invite.', ephemeral:true });
        if (tp.clan) return interaction.reply({ content:`❌ **${t.displayName}** is already in a clan.`, ephemeral:true });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`clan_join_${player.clan}_${t.id}`).setLabel(`✅ Join ${clan.emoji} ${clan.name}`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`clan_decline_${t.id}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger),
        );
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`${clan.emoji} Clan Invite!`).setDescription(`${interaction.user.displayName} invited **${t.displayName}** to join **${clan.name}**!`).setColor(0x00b894)], components:[row] });
    }

    if (commandName === 'clanleave') {
        if (!player.clan) return interaction.reply({ content:'❌ You\'re not in a clan.', ephemeral:true });
        const clan = clans.get(player.clan);
        if (clan.leader===userId) return interaction.reply({ content:'❌ Leaders cannot leave. Transfer leadership or disband first.', ephemeral:true });
        clan.members = clan.members.filter(id=>id!==userId);
        player.clan=null; saveData();
        return interaction.reply({ content:`✅ You left **${clan.emoji} ${clan.name}**.` });
    }

    if (commandName === 'claninfo') {
        const name = interaction.options.getString('name') || player.clan;
        if (!name) return interaction.reply({ content:'❌ You\'re not in a clan. Specify a name.', ephemeral:true });
        const clan = clans.get(name);
        if (!clan) return interaction.reply({ content:`❌ Clan **${name}** not found.`, ephemeral:true });
        const embed = new EmbedBuilder()
            .setTitle(`${clan.emoji} ${clan.name}`)
            .setColor(0x6c5ce7)
            .addFields(
                {name:'👑 Leader',value:clan.leaderName,inline:true},
                {name:'👥 Members',value:`${clan.members.length}`,inline:true},
                {name:'💎 Bank',value:`${clan.bank}💎`,inline:true},
                {name:'🏆 Clan Wins',value:`${clan.wins||0}`,inline:true},
            )
            .setDescription(`Members: ${clan.members.map(id=>`<@${id}>`).join(', ')}`);
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'clandeposit') {
        const amount = interaction.options.getInteger('amount');
        if (!player.clan) return interaction.reply({ content:'❌ Not in a clan.', ephemeral:true });
        if (player.gems<amount) return interaction.reply({ content:`❌ Need ${amount}💎.`, ephemeral:true });
        const clan = clans.get(player.clan);
        player.gems-=amount; clan.bank=(clan.bank||0)+amount; saveData();
        return interaction.reply({ content:`✅ Deposited **${amount}💎** into **${clan.emoji} ${clan.name}**'s bank (${clan.bank}💎 total)!` });
    }

    // ── RAID ──
    if (commandName === 'raid') {
        if (!activeRaid) return interaction.reply({ content:'💀 No raid boss active right now.' });
        const contrib = Object.values(activeRaid.participants).reduce((a,b)=>a+b,0);
        const embed = new EmbedBuilder()
            .setTitle(`${activeRaid.emoji} RAID BOSS: ${activeRaid.name}`)
            .setDescription(hpBar(activeRaid.hp,activeRaid.maxHp))
            .setColor(0xe74c3c)
            .addFields(
                {name:'❤️ HP',value:`${activeRaid.hp}/${activeRaid.maxHp}`,inline:true},
                {name:'⚔️ Damage dealt',value:`${contrib}`,inline:true},
                {name:'🎁 Reward',value:`${activeRaid.reward}💎 per participant`,inline:true},
                {name:'👥 Participants',value:`${Object.keys(activeRaid.participants).length}`,inline:true},
            );
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'raidattack') {
        if (!activeRaid) return interaction.reply({ content:'💀 No raid boss active.', ephemeral:true });
        if (!player.deck.length) return interaction.reply({ content:'❌ No cards to attack with!', ephemeral:true });
        const cid  = getBattleCard(player); const c = CARDS[cid];
        const dmg  = c.moves.reduce((max,m)=>m.damage>max?m.damage:max,0) + getLevelBonus(getCardLevel(player,cid));
        const jitter = ~~(Math.random()*30)-10;
        const dealt  = Math.max(10,dmg+jitter);
        activeRaid.hp = Math.max(0,activeRaid.hp-dealt);
        activeRaid.participants[userId] = (activeRaid.participants[userId]||0)+dealt;
        let extra='';
        if (activeRaid.hp<=0) {
            // Raid defeated!
            const reward = activeRaid.reward;
            for (const pid of Object.keys(activeRaid.participants)) {
                const pp = getPlayer(pid); pp.gems+=reward;
                if (!pp.inventory) pp.inventory=[];
                pp.inventory.push('lootcrate'); // bonus loot crate
            }
            extra=`\n\n🎉 **RAID BOSS DEFEATED!** All ${Object.keys(activeRaid.participants).length} participants earned **${reward}💎** + a 🎁 Loot Crate!`;
            activeRaid=null;
        }
        saveData();
        return interaction.reply({ embeds:[new EmbedBuilder()
            .setTitle(`⚔️ Raid Attack!`)
            .setDescription(`${c.emoji} **${c.name}** dealt **${dealt}** damage to the raid boss!${activeRaid?`\n${hpBar(activeRaid.hp,activeRaid.maxHp)}`:''}${extra}`)
            .setColor(0xe74c3c)] });
    }

    // ── EVENT ──
    if (commandName === 'event') {
        if (!globalEvent) return interaction.reply({ content:'🌍 No global event active right now.' });
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`🌍 Global Event: ${globalEvent.name}`).setDescription(globalEvent.desc).setColor(0xfdcb6e)] });
    }

    // ── TOURNAMENT ──
    if (commandName === 'jointournament') {
        if (!activeTournament.running) return interaction.reply({ content:'❌ No tournament open.', ephemeral:true });
        if (activeTournament.bracket.length) return interaction.reply({ content:'❌ Tournament already started.', ephemeral:true });
        if (activeTournament.players.find(p=>p.id===userId)) return interaction.reply({ content:'❌ Already joined!', ephemeral:true });
        if (!player.deck.length) return interaction.reply({ content:'❌ You need cards to join!', ephemeral:true });
        activeTournament.players.push({id:userId,name:interaction.user.displayName}); saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🏆 Joined Tournament!').setDescription(`**${interaction.user.displayName}** joined! (${activeTournament.players.length} players)\nPrize pool: **${activeTournament.prize}💎**`).setColor(0xf1c40f)] });
    }

    // ── INVENTORY / LOOT CRATES ──
    if (commandName === 'inventory') {
        if (!player.inventory?.length) return interaction.reply({ content:'🎒 Your inventory is empty.', ephemeral:true });
        const counts = {};
        for (const item of player.inventory) counts[item]=(counts[item]||0)+1;
        const itemEmojis = {lootcrate:'🎁',gemstone:'💎'};
        const embed = new EmbedBuilder().setTitle('🎒 Your Inventory').setColor(0x6c5ce7)
            .setDescription(Object.entries(counts).map(([item,cnt])=>`${itemEmojis[item]||'📦'} **${item}** ×${cnt}`).join('\n'));
        return interaction.reply({ embeds:[embed] });
    }

    if (commandName === 'openbox') {
        if (!player.inventory?.includes('lootcrate')) return interaction.reply({ content:'❌ No loot crates in your inventory!', ephemeral:true });
        player.inventory.splice(player.inventory.indexOf('lootcrate'),1);
        const roll = Math.random();
        let reward, desc;
        if (roll<0.05) {
            // LEGENDARY card
            const legs = Object.values(CARDS).filter(c=>c.rarity==='LEGENDARY');
            const c = legs[~~(Math.random()*legs.length)];
            player.deck.push(c.id);
            desc = `🌟 **LEGENDARY!** ${c.emoji} **${c.name}**!!`;
        } else if (roll<0.20) {
            const gems = 200+~~(Math.random()*300);
            player.gems+=gems;
            desc = `💎 **${gems} gems**!`;
        } else if (roll<0.50) {
            const pulled = openPack(3);
            for (const id of pulled) id==='energy'?player.energyCards++:player.deck.push(id);
            desc = `📦 **3 random cards!** ${pulled.map(id=>id==='energy'?'⚡':CARDS[id]?.emoji).join(' ')}`;
        } else {
            const gems = 50+~~(Math.random()*100);
            player.gems+=gems;
            desc = `💰 **${gems} gems**`;
        }
        saveData();
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🎁 Loot Crate Opened!').setDescription(desc+`\nBalance: **${player.gems}💎**`).setColor(0xf1c40f)] });
    }
});

// ══════════════════════════════════════════════
// BUTTON HANDLER
// ══════════════════════════════════════════════
async function handleButton(interaction) {
    const { customId } = interaction; const userId = interaction.user.id;
    const player = getPlayer(userId);

    // Wipe all
    if (customId==='wipeall_confirm') {
        if (!opUsers.includes(userId)&&interaction.user.username!==OP_USER) return interaction.reply({content:'❌',ephemeral:true});
        playerData.clear(); saveData();
        return interaction.update({ content:'💀 **All player data wiped.**', components:[] });
    }
    if (customId==='wipeall_cancel') return interaction.update({ content:'✅ Cancelled.', components:[] });

    // AH buy
    if (customId.startsWith('ah_buy_')) {
        const lid = parseInt(customId.replace('ah_buy_','')); const l = auctionListings.get(lid);
        if (!l) return interaction.reply({content:'❌ Listing gone.',ephemeral:true});
        if (l.sellerId===userId) return interaction.reply({content:"❌ Can't buy your own listing.",ephemeral:true});
        if (player.gems<l.price) return interaction.reply({content:`❌ Need ${l.price}💎.`,ephemeral:true});
        player.gems-=l.price; player.deck.push(l.cardId);
        getPlayer(l.sellerId).gems+=l.price;
        auctionListings.delete(lid); saveData();
        const c=CARDS[l.cardId];
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🏪 Purchased!').setDescription(`${c?.emoji} **${c?.name}** bought for **${l.price}💎**!`).setColor(0x00b894)] });
    }

    // Trade accept/decline
    if (customId.startsWith('trade_accept_')||customId.startsWith('trade_decline_')) {
        const tid = parseInt(customId.replace('trade_accept_','').replace('trade_decline_',''));
        const t   = tradeOffers.get(tid);
        if (!t) return interaction.reply({content:'❌ Trade expired.',ephemeral:true});
        if (userId!==t.toId) return interaction.reply({content:'❌ Not for you.',ephemeral:true});
        if (customId.startsWith('trade_decline_')) { tradeOffers.delete(tid); return interaction.update({content:'❌ Trade declined.',embeds:[],components:[]}); }
        const fp=getPlayer(t.fromId); const tp=getPlayer(t.toId);
        if (!fp.deck.includes(t.giveId)) { tradeOffers.delete(tid); return interaction.update({content:'❌ Trader no longer has that card!',embeds:[],components:[]}); }
        if (!tp.deck.includes(t.wantId)) { tradeOffers.delete(tid); return interaction.update({content:"❌ You no longer have that card!",embeds:[],components:[]}); }
        fp.deck.splice(fp.deck.indexOf(t.giveId),1); fp.deck.push(t.wantId);
        tp.deck.splice(tp.deck.indexOf(t.wantId),1); tp.deck.push(t.giveId);
        tradeOffers.delete(tid); saveData();
        const gc=CARDS[t.giveId]; const wc=CARDS[t.wantId];
        return interaction.update({ embeds:[new EmbedBuilder().setTitle('🔄 Trade Complete!').setDescription(`**${t.fromName}** got ${wc.emoji} **${wc.name}**\n**${t.toName}** got ${gc.emoji} **${gc.name}**`).setColor(0x00b894)], components:[] });
    }

    // Clan join/decline
    if (customId.startsWith('clan_join_')) {
        const parts = customId.split('_'); const clanName = parts[2]; const targetId = parts[3];
        if (userId!==targetId) return interaction.reply({content:'❌ Not for you.',ephemeral:true});
        const clan = clans.get(clanName); const tp = getPlayer(userId);
        if (tp.clan) return interaction.reply({content:'❌ Already in a clan.',ephemeral:true});
        clan.members.push(userId); tp.clan=clanName; saveData();
        return interaction.update({ content:`✅ **${interaction.user.displayName}** joined **${clan.emoji} ${clanName}**!`, components:[] });
    }
    if (customId.startsWith('clan_decline_')) {
        return interaction.update({ content:'❌ Clan invite declined.', components:[] });
    }

    // PvP accept/decline
    if (customId.startsWith('pvp_accept_')||customId.startsWith('pvp_decline_')) {
        const bid = customId.replace('pvp_accept_','').replace('pvp_decline_','');
        const b   = activeBattles.get(bid);
        if (!b) return interaction.reply({content:'❌ Battle expired.',ephemeral:true});
        if (userId!==b.opponent.id) return interaction.reply({content:'❌ Not for you.',ephemeral:true});
        if (customId.startsWith('pvp_decline_')) { activeBattles.delete(bid); return interaction.update({content:`❌ ${b.opponent.name} declined.`,embeds:[],components:[]}); }
        b.accepted=true;
        await interaction.update({ components:[] });
        return sendPvPState(interaction.channel, bid);
    }

    // PvP move
    if (customId.startsWith('pvpmove_')) {
        const parts = customId.split('_'); const mi = parseInt(parts[parts.length-1]);
        const bid   = parts.slice(1,parts.length-1).join('_');
        const b     = activeBattles.get(bid);
        if (!b) return interaction.reply({content:'❌ Battle not found.',ephemeral:true});
        if (userId!==b.turn) return interaction.reply({content:"❌ Not your turn!",ephemeral:true});
        const isC   = userId===b.challenger.id;
        const atk   = isC?b.challenger:b.opponent; const def = isC?b.opponent:b.challenger;
        const ac    = CARDS[atk.cardId]; const move = ac.moves[mi];
        if (!move) return interaction.reply({content:'❌ Invalid move.',ephemeral:true});
        if (atk.energy<move.cost) return interaction.reply({content:`❌ Need ${move.cost}⚡.`,ephemeral:true});
        const bonus = getLevelBonus(atk.level||1); const dmg = move.damage+bonus;
        atk.energy-=move.cost; def.hp=Math.max(0,def.hp-dmg);
        atk.energy=Math.min(atk.energy+1,6); def.energy=Math.min(def.energy+1,6);
        b.turn=def.id;
        await interaction.update({components:[]});
        if (def.hp<=0) {
            activeBattles.delete(bid);
            const ap=getPlayer(atk.id); const dp=getPlayer(def.id);
            const baseGems = 25*gemMultiplier();
            const prestigeBonus = Math.floor(baseGems*(ap.prestige||0)*0.05);
            const total = baseGems+prestigeBonus;
            ap.wins++; ap.gems+=total;
            ap.cardWins[atk.cardId]=(ap.cardWins[atk.cardId]||0)+1;
            dp.losses++; dp.cardLosses[def.cardId]=(dp.cardLosses[def.cardId]||0)+1;
            const cw=ap.cardWins[atk.cardId];
            if (cw%xpThreshold(ap)===0) ap.cardLevels[atk.cardId]=(ap.cardLevels[atk.cardId]||1)+1;
            progressQuest(ap,'pvp_wins');
            if (ap.clan) { const clan=clans.get(ap.clan); if(clan) clan.wins=(clan.wins||0)+1; }
            // Bounty
            let bountyMsg='';
            if (bounties.has(def.id)) {
                const bnt=bounties.get(def.id); ap.gems+=bnt.amount;
                bountyMsg=`\n🎯 **BOUNTY COLLECTED!** +${bnt.amount}💎 for defeating ${def.name}!`;
                bounties.delete(def.id);
            }
            const newAch=checkAchievements(ap); saveData();
            const lvlUp=cw%xpThreshold(ap)===0?`\n⬆️ **${ac.name}** leveled up to Lv${ap.cardLevels[atk.cardId]}!`:'';
            const embed=new EmbedBuilder().setTitle('🏆 Battle Over!').setDescription(`**${atk.name}** wins! +${total}💎${prestigeBonus?` (+${prestigeBonus} prestige bonus)`:''}${lvlUp}${bountyMsg}\n${move.emoji} **${move.name}** dealt **${dmg}** — finishing blow!`).setColor(0xf1c40f);
            if (newAch.length) embed.addFields({name:'🏅 Achievement!',value:newAch.map(a=>`${a.emoji} **${a.name}**`).join('\n')});
            return interaction.channel.send({ embeds:[embed] });
        }
        return sendPvPState(interaction.channel, bid, `${move.emoji} **${atk.name}** used **${move.name}** → **${dmg}** dmg!${bonus>0?` *(+${bonus} level bonus)*`:''}`);
    }

    // Arena move
    if (customId.startsWith('arenamove_')) {
        const parts = customId.split('_'); const mi = parseInt(parts[parts.length-1]);
        const bid   = parts.slice(1,parts.length-1).join('_');
        const ab    = activeArenaBattles.get(bid);
        if (!ab) return interaction.reply({content:'❌ Battle not found.',ephemeral:true});
        if (userId!==ab.userId) return interaction.reply({content:'❌ Not your battle!',ephemeral:true});
        const c=CARDS[ab.cardId]; const arena=ARENAS[ab.arenaId]; const move=c.moves[mi];
        if (!move) return interaction.reply({content:'❌ Invalid move.',ephemeral:true});
        if (ab.playerEnergy<move.cost) return interaction.reply({content:`❌ Need ${move.cost}⚡.`,ephemeral:true});
        const bonus=getLevelBonus(ab.cardLevel||1); const dmg=move.damage+bonus;
        ab.playerEnergy-=move.cost; ab.guardianHp=Math.max(0,ab.guardianHp-dmg);
        ab.playerEnergy=Math.min(ab.playerEnergy+1,6); ab.guardianEnergy=Math.min(ab.guardianEnergy+1,6);
        await interaction.update({components:[]});
        const pLog=`${move.emoji} **${ab.userName}** used **${move.name}** → **${dmg}** dmg!${bonus>0?` *(+${bonus})*`:''}`;
        if (ab.guardianHp<=0) {
            activeArenaBattles.delete(bid);
            const prev=arena.holderName; arena.holder=ab.userId; arena.holderName=ab.userName;
            const baseGems=50*gemMultiplier();
            const wp=getPlayer(ab.userId);
            const prestigeBonus=Math.floor(baseGems*(wp.prestige||0)*0.05);
            const total=baseGems+prestigeBonus;
            wp.gems+=total; wp.wins++;
            wp.cardWins[ab.cardId]=(wp.cardWins[ab.cardId]||0)+1;
            progressQuest(wp,'arena_wins');
            const cw=wp.cardWins[ab.cardId];
            if (cw%xpThreshold(wp)===0) wp.cardLevels[ab.cardId]=(wp.cardLevels[ab.cardId]||1)+1;
            if (wp.clan) { const clan=clans.get(wp.clan); if(clan) clan.wins=(clan.wins||0)+1; }
            // Check all arenas held
            if (Object.values(ARENAS).every(a=>a.holder===ab.userId)) unlockAchievement(wp,'arena_all');
            const newAch=checkAchievements(wp); saveData();
            const embed=new EmbedBuilder().setTitle(`${arena.emoji} Arena Conquered!`).setDescription(`👑 **${ab.userName}** defeated **${arena.guardian.name}** and claimed **${arena.name}**! +${total}💎${prev?`\n*${prev} lost the arena.*`:'\n*First claim!*'}`).setColor(0xf1c40f);
            if (newAch.length) embed.addFields({name:'🏅 Achievement!',value:newAch.map(a=>`${a.emoji} **${a.name}**`).join('\n')});
            return interaction.channel.send({ embeds:[embed] });
        }
        const gm=aiPickMove(arena.guardian,ab.guardianEnergy);
        ab.guardianEnergy-=gm.cost; ab.playerHp=Math.max(0,ab.playerHp-gm.damage);
        ab.guardianEnergy=Math.min(ab.guardianEnergy+1,6); ab.playerEnergy=Math.min(ab.playerEnergy+1,6);
        const gLog=`${gm.emoji} **${arena.guardian.name}** used **${gm.name}** → **${gm.damage}** dmg!`;
        if (ab.playerHp<=0) {
            activeArenaBattles.delete(bid);
            const lp=getPlayer(ab.userId); lp.losses++; saveData();
            return interaction.channel.send({ embeds:[new EmbedBuilder().setTitle(`${arena.emoji} Defeated!`).setDescription(`💀 **${ab.userName}** was defeated by **${arena.guardian.name}**!`).setColor(0xe74c3c)] });
        }
        return sendArenaBattle(interaction.channel, bid, `${pLog}\n${gLog}`);
    }
}

// ══════════════════════════════════════════════
// SELECT HANDLER
// ══════════════════════════════════════════════
async function handleSelect(interaction) {
    const { customId } = interaction; const userId = interaction.user.id;
    if (customId.startsWith('builddeck_')) {
        const player = getPlayer(userId);
        player.activeDeck = interaction.values; saveData();
        const names = interaction.values.map(id=>CARDS[id]?`${CARDS[id].emoji} **${CARDS[id].name}**`:id).join(', ');
        return interaction.reply({ embeds:[new EmbedBuilder().setTitle('🎯 Active Deck Set!').setDescription(`Your battle deck: ${names}\nUse \`/cleardeck\` to reset.`).setColor(0x00b894)] });
    }
}

// ══════════════════════════════════════════════
// BATTLE STATE SENDERS
// ══════════════════════════════════════════════
async function sendPvPState(channel, bid, lastAction=null) {
    const b = activeBattles.get(bid); if(!b) return;
    const cur   = b.turn===b.challenger.id?b.challenger:b.opponent;
    const curC  = CARDS[cur.cardId];
    const cCard = CARDS[b.challenger.cardId]; const oCard = CARDS[b.opponent.cardId];
    const bonus = getLevelBonus(cur.level||1);
    const embed = new EmbedBuilder()
        .setTitle('⚔️ TFCImon Battle!')
        .setColor(0x2ecc71)
        .addFields(
            {name:`${cCard.emoji} ${b.challenger.name} — ${cCard.name} Lv${b.challenger.level||1}`,value:`❤️ ${hpBar(b.challenger.hp,cCard.hp)}\n⚡ ${b.challenger.energy}`},
            {name:`${oCard.emoji} ${b.opponent.name} — ${oCard.name} Lv${b.opponent.level||1}`,value:`❤️ ${hpBar(b.opponent.hp,oCard.hp)}\n⚡ ${b.opponent.energy}`},
        )
        .setFooter({text:`🎮 ${cur.name}'s turn!`});
    if (lastAction) embed.setDescription(lastAction);
    const row = new ActionRowBuilder();
    for (let i=0;i<curC.moves.length;i++) {
        const m=curC.moves[i]; const d=m.damage+bonus;
        row.addComponents(new ButtonBuilder().setCustomId(`pvpmove_${bid}_${i}`).setLabel(`${m.emoji} ${m.name} (${m.cost}⚡, ${d}dmg)`).setStyle(m.isEx?ButtonStyle.Danger:ButtonStyle.Primary).setDisabled(cur.energy<m.cost));
    }
    return channel.send({ embeds:[embed], components:[row] });
}

async function sendArenaBattle(channel, bid, lastAction=null) {
    const ab = activeArenaBattles.get(bid); if(!ab) return;
    const c=CARDS[ab.cardId]; const arena=ARENAS[ab.arenaId];
    const lv=ab.cardLevel||1; const bonus=getLevelBonus(lv);
    const embed = new EmbedBuilder()
        .setTitle(`${arena.emoji} ${arena.name} — Arena Battle!`)
        .setColor(arena.color)
        .addFields(
            {name:`${c.emoji} ${ab.userName} — ${c.name} Lv${lv}`,value:`❤️ ${hpBar(ab.playerHp,c.hp)}\n⚡ ${ab.playerEnergy}`},
            {name:`${arena.guardian.emoji} ${arena.guardian.name}`,value:`❤️ ${hpBar(ab.guardianHp,arena.guardian.hp)}\n⚡ ${ab.guardianEnergy}`},
        )
        .setFooter({text:`Your turn, ${ab.userName}!`});
    if (lastAction) embed.setDescription(lastAction);
    const row = new ActionRowBuilder();
    for (let i=0;i<c.moves.length;i++) {
        const m=c.moves[i]; const d=m.damage+bonus;
        row.addComponents(new ButtonBuilder().setCustomId(`arenamove_${bid}_${i}`).setLabel(`${m.emoji} ${m.name} (${m.cost}⚡, ${d}dmg)`).setStyle(m.isEx?ButtonStyle.Danger:ButtonStyle.Primary).setDisabled(ab.playerEnergy<m.cost));
    }
    return channel.send({ embeds:[embed], components:[row] });
}

// ══════════════════════════════════════════════
// KEEP ALIVE
// ══════════════════════════════════════════════
const server = http.createServer((_,res)=>res.end('OK'));
server.listen(process.env.PORT||8080);
setInterval(()=>http.get(`http://localhost:${process.env.PORT||8080}`,()=>{}),240_000);

// ══════════════════════════════════════════════
// START
// ══════════════════════════════════════════════
loadData();
client.login(BOT_TOKEN);
process.on('SIGINT', ()=>{ saveData(); process.exit(); });
process.on('SIGTERM',()=>{ saveData(); process.exit(); });
