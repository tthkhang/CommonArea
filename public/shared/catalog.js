/*
 * Top 1 Server — economy catalog (Xu, crops, flowers, fruit trees, fish, tank decor, upgrades).
 * Shared by the server (require) and the browser (window.VCCatalog). Pure data + tiny helpers.
 * Change numbers here to rebalance the game; no other file needs to change.
 */
(function (root) {
  'use strict';

  // ---- Earning rules (Xu) ----
  const ECON = {
    startXu: 1000,           // new players start with this much (demo: enough to try the shop right away)
    dailyCap: 600,           // max Xu per day from activities (selling items is not capped)
    studyPerMin: 2,          // sitting at a study table
    groupMult: 1.5,          // 2+ people at the same table
    forestMult: 1.25,        // studying inside the forest grove
    pomodoroMin: 25,         // continuous seated minutes for a focus bonus
    pomodoroBonus: 20,
    walkMeters: 50,          // every 50 m walked ...
    walkXu: 1,               // ... gives 1 Xu
    walkDailyCap: 60,
    checkinXu: 5,            // first visit of each landmark per day
    trashPick: 3,            // picking up a piece of trash
    trashDrop: 2,            // per piece put into a bin
    trashMax: 8,             // max trash on the map at once
    trashRespawnMs: 15000,
    carryMax: 5,
    loungePerMin: 1,         // in the lounge while a song/video is playing
    loungeCrowdPerMin: 2,    // ... when 3+ people are in the lounge
    loungeCrowd: 3,
    afkMs: 5 * 60 * 1000,    // no input for 5 minutes = no earnings
    feedCooldownMin: 10,     // each tank fish can be fed once per 10 minutes
    bagMax: 12,              // fish you can carry
    hungryHours: 12,         // tank fish not fed for this long are "hungry": they stop growing and lose beauty
    quizTries: 3,            // Pomodoro reward needs a correct quiz answer (anti auto-clicker), up to 3 questions
    quizTimeoutMin: 5,
    gameWin: 15,             // winning a Game Room game (at most once per gameCooldownSec)
    gameCooldownSec: 45,
    astroXu: 5,              // the first "See my chart" of the day in the Astrology Room
    localChatRadius: 12,     // in the forest, chat is Local: only people this close (or at your table) see it
    // market
    maxListings: 6,          // active listings per player
    npcBuyEverySec: 30,      // a passing customer may buy a fairly priced listing
    npcBuyMaxMult: 1.5,      // ... if unit price <= base value x this
    merchantEveryMin: [3, 5],// travelling merchant shows up on the lobby every 3-5 minutes
    merchantStaySec: 150,
    merchantMult: [1.6, 2.2],
    merchantWants: 5,
  };

  // ---- Garden care: each growing cycle can be watered once and fertilised once ----
  const CARE = { waterCut: 0.15, fertCut: 0.30, cloudSpeed: 0.8, cloudYield: 2 };

  // ---- Vegetables & root crops (ground plots). growMin = real minutes; sell = price per crop.
  //      look = how the plant is drawn (root | tuber | bulb | leafy | bush | stalk | vine | grain); color = produce, leaf = foliage ----
  const CROPS = {
    wheat:       { name: 'Wheat',      icon: '🌾', price: 4,  growMin: 1,   sell: 9,   color: '#f2c94c', leaf: '#c9a227', look: 'grain' },   // also chicken feed
    hay:         { name: 'Alfalfa',    icon: '🍀', price: 5,  growMin: 1.5, sell: 11,  color: '#8bc34a', leaf: '#689f38', look: 'grain' },   // also cow feed
    lettuce:     { name: 'Lettuce',    icon: '🥬', price: 8,  growMin: 1.5, sell: 15,  color: '#9ccc65', leaf: '#7cb342', look: 'leafy' },
    carrot:      { name: 'Carrot',     icon: '🥕', price: 10, growMin: 2,   sell: 20,  color: '#ff8a26', leaf: '#43a047', look: 'root' },
    radish:      { name: 'Radish',  icon: '🔴', price: 12, growMin: 2.5, sell: 25,  color: '#e5395f', leaf: '#558b2f', look: 'root' },
    peanut:      { name: 'Peanut',        icon: '🥜', price: 12, growMin: 3,   sell: 26,  color: '#d7a86e', leaf: '#558b2f', look: 'tuber' },
    cabbage:     { name: 'Purple cabbage', icon: '🟣', price: 14, growMin: 3.5, sell: 31, color: '#8e5bb5', leaf: '#6a4c93', look: 'leafy' },
    potato:      { name: 'Potato',  icon: '🥔', price: 15, growMin: 4,   sell: 34,  color: '#c8a165', leaf: '#689f38', look: 'tuber' },
    corn:        { name: 'Corn',        icon: '🌽', price: 18, growMin: 5,   sell: 42,  color: '#ffd54f', leaf: '#7cb342', look: 'stalk' },
    tomato:      { name: 'Tomato',    icon: '🍅', price: 18, growMin: 5,   sell: 42,  color: '#e53935', leaf: '#43a047', look: 'bush' },
    chili:       { name: 'Chili',         icon: '🌶️', price: 20, growMin: 6,   sell: 48,  color: '#d50000', leaf: '#2e7d32', look: 'bush' },
    onion:       { name: 'Onion',   icon: '🧅', price: 20, growMin: 6,   sell: 48,  color: '#b0675a', leaf: '#66bb6a', look: 'bulb' },
    cucumber:    { name: 'Cucumber',  icon: '🥒', price: 22, growMin: 7,   sell: 55,  color: '#2e7d32', leaf: '#7cb342', look: 'vine' },
    garlic:      { name: 'Garlic',        icon: '🧄', price: 25, growMin: 8,   sell: 62,  color: '#f3eee2', leaf: '#9ccc65', look: 'bulb' },
    eggplant:    { name: 'Eggplant',     icon: '🍆', price: 28, growMin: 9,   sell: 70,  color: '#6a1b9a', leaf: '#558b2f', look: 'bush' },
    strawberry:  { name: 'Strawberry',    icon: '🍓', price: 32, growMin: 10,  sell: 80,  color: '#ff1744', leaf: '#43a047', look: 'bush' },
    sweetpotato: { name: 'Sweet potato', icon: '🍠', price: 35, growMin: 12,  sell: 90,  color: '#a0446b', leaf: '#7cb342', look: 'vine' },
    pumpkin:     { name: 'Pumpkin',     icon: '🎃', price: 45, growMin: 15,  sell: 120, color: '#fb8c00', leaf: '#689f38', look: 'vine' },
    watermelon:  { name: 'Watermelon',    icon: '🍉', price: 60, growMin: 20,  sell: 165, color: '#2e7d32', leaf: '#7cb342', look: 'vine', stripe: '#a5d6a7' },
  };
  // ---- Flowers (cloud garden pots): worth more than crops.
  //      shape = how the bloom is drawn (petals | cup | ball | disc | spike | cluster | star); center = middle colour ----
  const FLOWERS = {
    daisy:     { name: 'Daisy',        icon: '🌼', price: 15, growMin: 3,  sell: 40,  color: '#ffffff', center: '#fdd835', shape: 'petals' },
    marigold:  { name: 'Marigold',        icon: '🧡', price: 18, growMin: 4,  sell: 50,  color: '#ff9800', center: '#e65100', shape: 'ball' },
    tulip:     { name: 'Tulip',      icon: '🌷', price: 20, growMin: 5,  sell: 60,  color: '#ec407a', center: '#ec407a', shape: 'cup' },
    carnation: { name: 'Carnation',     icon: '💐', price: 24, growMin: 6,  sell: 72,  color: '#f06292', center: '#ad1457', shape: 'ball' },
    rose:      { name: 'Rose',       icon: '🌹', price: 30, growMin: 8,  sell: 95,  color: '#e53935', center: '#b71c1c', shape: 'ball' },
    lavender:  { name: 'Lavender',      icon: '💜', price: 32, growMin: 9,  sell: 104, color: '#9575cd', center: '#7e57c2', shape: 'spike' },
    sunflower: { name: 'Sunflower',    icon: '🌻', price: 35, growMin: 10, sell: 115, color: '#fdd835', center: '#5d4037', shape: 'disc' },
    hydrangea: { name: 'Hydrangea',     icon: '💠', price: 40, growMin: 12, sell: 135, color: '#64b5f6', center: '#9fa8da', shape: 'cluster' },
    blossom:   { name: 'Peach blossom',        icon: '🌸', price: 42, growMin: 13, sell: 142, color: '#f8bbd0', center: '#f48fb1', shape: 'cluster' },
    hibiscus:  { name: 'Hibiscus',        icon: '🌺', price: 45, growMin: 14, sell: 150, color: '#ff4f81', center: '#fff176', shape: 'star' },
    orchid:    { name: 'Orchid',    icon: '🏵️', price: 55, growMin: 16, sell: 185, color: '#ce93d8', center: '#fff59d', shape: 'star' },
    peony:     { name: 'Peony',        icon: '💗', price: 70, growMin: 20, sell: 240, color: '#ff80ab', center: '#ffd54f', shape: 'ball' },
  };
  // ---- Fruit trees (orchard): grow once, then bear fruit again every regrowMin. canopy = leaf colour ----
  const FRUITS = {
    lemon:   { name: 'Lemon',  icon: '🍋', price: 60,  growMin: 8,  regrowMin: 3, yield: [4, 6], sell: 10, color: '#f9e04b', canopy: '#43a047' },
    orange:  { name: 'Orange',    icon: '🍊', price: 80,  growMin: 10, regrowMin: 4, yield: [3, 5], sell: 18, color: '#fb8c00', canopy: '#388e3c' },
    pear:    { name: 'Pear',     icon: '🍐', price: 90,  growMin: 11, regrowMin: 4, yield: [3, 5], sell: 20, color: '#cddc39', canopy: '#558b2f' },
    apple:   { name: 'Apple',    icon: '🍎', price: 100, growMin: 12, regrowMin: 5, yield: [3, 5], sell: 22, color: '#e53935', canopy: '#4caf50' },
    peach:   { name: 'Peach',    icon: '🍑', price: 120, growMin: 14, regrowMin: 5, yield: [3, 5], sell: 25, color: '#ffab91', canopy: '#f48fb1' },
    cherry:  { name: 'Cherry', icon: '🍒', price: 130, growMin: 15, regrowMin: 5, yield: [5, 8], sell: 16, color: '#c62828', canopy: '#f8bbd0' },
    mango:   { name: 'Mango',   icon: '🥭', price: 140, growMin: 16, regrowMin: 6, yield: [3, 6], sell: 28, color: '#ffc107', canopy: '#2e7d32' },
    kiwi:    { name: 'Kiwi',   icon: '🥝', price: 150, growMin: 17, regrowMin: 6, yield: [4, 7], sell: 22, color: '#8d6e63', canopy: '#9ccc65' },
    coconut: { name: 'Coconut',    icon: '🥥', price: 180, growMin: 20, regrowMin: 8, yield: [2, 4], sell: 55, color: '#8d6e63', canopy: '#43a047' },
  };
  const FERT = { name: 'Fertiliser', icon: '🧪', price: 15, qty: 3 };   // per plant: −30% of one growing cycle
  const BOOST = { name: 'Super Fertiliser', icon: '⚡', price: 60, minutes: 60, speed: 0.5 }; // whole garden grows 50% faster for 60 min

  // ---- Fish (v5: caught from the fishing chairs in the forest and the Garden Room dock, some sold in the shop). w = catch weight.
  //      Look: shape (oval | slim | round | tall | long), color / belly, pat {t: stripes|bands|spots|line, c}, fin (normal | fan | long), finC, whisk ----
  const FISH = {
    ro:        { name: 'Perch',        rarity: 'Common',    tier: 1, w: 30, size: [10, 18], value: 12,  color: '#8d9a5b', belly: '#cfd59e', shape: 'oval', pat: { t: 'stripes', c: '#5f6b3a' }, finC: '#6b7a3f' },
    chep:      { name: 'Carp',         rarity: 'Common',    tier: 1, w: 26, size: [20, 40], value: 18,  color: '#d4a63a', belly: '#f3dc96', shape: 'oval', finC: '#e07b2a', whisk: 0.25 },
    ronphi:    { name: 'Tilapia',      rarity: 'Common',    tier: 1, w: 20, size: [15, 30], value: 15,  color: '#7d8f9c', belly: '#d7dee3', shape: 'oval', pat: { t: 'stripes', c: '#566573' }, finC: '#c2185b' },
    taitruong: { name: 'Giant gourami', rarity: 'Uncommon', tier: 2, w: 8,  size: [20, 40], value: 35,  color: '#8d9b4a', belly: '#d9dcb0', shape: 'round', finC: '#6d7a35' },
    tre:       { name: 'Catfish',      rarity: 'Uncommon',  tier: 2, w: 14, size: [25, 45], value: 30,  color: '#5d4e3c', belly: '#a89580', shape: 'long', finC: '#4a3d2f', whisk: 0.6 },
    vang:      { name: 'Goldfish',     rarity: 'Uncommon',  tier: 2, w: 10, size: [8, 14],  value: 40,  color: '#ff9a1f', belly: '#ffd180', shape: 'round', fin: 'fan', finC: '#ffb74d', shop: 60 },
    baymau:    { name: 'Guppy',        rarity: 'Uncommon',  tier: 2, w: 9,  size: [3, 6],   value: 32,  color: '#9ccc65', belly: '#e6ee9c', shape: 'slim', fin: 'fan', finC: '#e040fb', shop: 45 },
    neon:      { name: 'Neon tetra',   rarity: 'Uncommon',  tier: 2, w: 8,  size: [2, 4],   value: 30,  color: '#29b6f6', belly: '#e1f5fe', shape: 'slim', pat: { t: 'line', c: '#ff1744' }, finC: '#b3e5fc', shop: 40 },
    he:        { name: 'Clownfish',    rarity: 'Rare',      tier: 3, w: 5,  size: [6, 11],  value: 70,  color: '#ff6d00', belly: '#ff9e40', shape: 'oval', pat: { t: 'bands', c: '#ffffff' }, finC: '#ff8f00', shop: 180 },
    thantien:  { name: 'Angelfish',    rarity: 'Rare',      tier: 3, w: 5,  size: [10, 18], value: 75,  color: '#e0e0e0', belly: '#fafafa', shape: 'tall', pat: { t: 'bands', c: '#263238' }, fin: 'long', finC: '#cfd8dc', shop: 200 },
    betta:     { name: 'Betta',        rarity: 'Rare',      tier: 3, w: 4,  size: [5, 8],   value: 80,  color: '#c62828', belly: '#ef5350', shape: 'slim', fin: 'long', finC: '#3949ab', shop: 220 },
    koi:       { name: 'Koi',          rarity: 'Rare',      tier: 3, w: 5,  size: [30, 60], value: 90,  color: '#ffffff', belly: '#ffffff', shape: 'long', pat: { t: 'spots', c: '#e53935' }, finC: '#ffccbc', spot: '#e53935', shop: 250 },
    hoi:       { name: 'Salmon',       rarity: 'Rare',      tier: 3, w: 4,  size: [40, 80], value: 110, color: '#90a4ae', belly: '#ffab91', shape: 'slim', pat: { t: 'spots', c: '#37474f' }, finC: '#78909c' },
    rong:      { name: 'Jade Arowana', rarity: 'Legendary', tier: 4, w: 1,  size: [50, 90], value: 300, color: '#3fe0c5', belly: '#b2fef7', shape: 'long', pat: { t: 'spots', c: '#ffd54f' }, fin: 'long', finC: '#ffd54f', whisk: 0.5, glow: true },
  };
  // ---- Farm animals (v5, pens on the farm island): fed -> after produceMin a product appears -> walk into the pen to collect -> hungry again ----
  const ANIMALS = {
    chicken: { name: 'Hen',       icon: '🐔', price: 60,  produceMin: 3, product: 'egg',     pen: 'coop', foods: ['feed:chicken', 'crop:wheat', 'crop:corn'] },
    pig:     { name: 'Pig',       icon: '🐖', price: 200, produceMin: 6, product: 'truffle', pen: 'sty',  foods: ['feed:pig', 'crop:potato', 'crop:carrot', 'crop:pumpkin'] },
    cow:     { name: 'Dairy cow', icon: '🐄', price: 300, produceMin: 8, product: 'milk',    pen: 'barn', foods: ['feed:cow', 'crop:hay', 'crop:corn'] },
  };
  const PRODUCTS = {
    egg:     { name: 'Egg',     icon: '🥚', sell: 22 },
    truffle: { name: 'Truffle', icon: '🍄', sell: 85 },
    milk:    { name: 'Milk',    icon: '🥛', sell: 55 },
  };
  const FEEDS = {
    chicken: { name: 'Chicken feed', icon: '🌾', price: 10, qty: 3 },
    pig:     { name: 'Pig feed',     icon: '🥣', price: 14, qty: 3 },
    cow:     { name: 'Hay bale',     icon: '🌿', price: 18, qty: 3 },
  };
  // ---- Flower pots (v5, cloud garden): replaceable; better pots give a chance of an extra flower and grow a bit faster ----
  const POTS = {
    clay:  { name: 'Clay pot',        icon: '🟤', price: 0,   bonus: 0,    speed: 1,    color: '#d8774a', rim: '#c0623a' },
    wood:  { name: 'Wooden pot',      icon: '🟫', price: 60,  bonus: 0.15, speed: 1,    color: '#a1887f', rim: '#6d4c41' },
    white: { name: 'White china pot', icon: '⚪', price: 90,  bonus: 0.2,  speed: 0.95, color: '#f5f5f5', rim: '#90caf9' },
    blue:  { name: 'Blue glazed pot', icon: '🔵', price: 150, bonus: 0.3,  speed: 0.95, color: '#1e88e5', rim: '#ffffff' },
    gold:  { name: 'Golden pot',      icon: '🟡', price: 400, bonus: 0.5,  speed: 0.85, color: '#ffc107', rim: '#ff8f00' },
  };
  // ---- Furniture for the 2-storey farm house (v5; placed on fixed slots, see farm3d.js houseSlots) ----
  const FURNITURE = {
    rug:      { name: 'Rug',          icon: '🧶', price: 70 },
    plant:    { name: 'House plant',  icon: '🌿', price: 50 },
    lamp:     { name: 'Floor lamp',   icon: '💡', price: 60 },
    painting: { name: 'Painting',     icon: '🖼️', price: 90 },
    shelf:    { name: 'Bookshelf',    icon: '📚', price: 110 },
    table:    { name: 'Dining table', icon: '🍽️', price: 120 },
    desk:     { name: 'Study desk',   icon: '📝', price: 140 },
    sofa:     { name: 'Sofa',         icon: '🛋️', price: 160 },
    bed:      { name: 'Bed',          icon: '🛏️', price: 200 },
    wardrobe: { name: 'Wardrobe',     icon: '🚪', price: 220 },
    tv:       { name: 'TV',           icon: '📺', price: 250 },
    fridge:   { name: 'Fridge',       icon: '🧊', price: 300 },
    aquarium: { name: 'Mini aquarium', icon: '🐠', price: 350 },
    piano:    { name: 'Piano',        icon: '🎹', price: 600 },
  };
  const HOUSE = [
    { name: 'Two-storey wooden house', slots: 12, color: '#fff3e0', roof: '#d84315' },
    { name: 'Garden house with balcony', slots: 16, color: '#fffde7', roof: '#1565c0', price: 1500 },
    { name: 'Mini villa',              slots: 20, color: '#f3e5f5', roof: '#6a1b9a', price: 4000 },
  ];
  // ---- Food & drinks (v5: Forest Café, food carts): a "focused" buff = more Xu while studying ----
  const FOODS = {
    icecream: { name: 'Ice-cream cone', icon: '🍦', price: 15, mult: 1.10, min: 10 },
    popcorn:  { name: 'Buttered popcorn', icon: '🍿', price: 15, mult: 1.10, min: 15 },
    juice:    { name: 'Orange juice',   icon: '🍹', price: 18, mult: 1.15, min: 15 },
    skewer:   { name: 'Grilled skewer', icon: '🍢', price: 20, mult: 1.15, min: 15 },
    coffee:   { name: 'Iced milk coffee', icon: '☕', price: 20, mult: 1.20, min: 15 },
    coconut:  { name: 'Coconut water',  icon: '🥥', price: 22, mult: 1.15, min: 20 },
    banhmi:   { name: 'Bánh mì',        icon: '🥖', price: 25, mult: 1.20, min: 20 },
    cake:     { name: 'Slice of cake',  icon: '🍰', price: 30, mult: 1.25, min: 15 },
  };
  const FOOD = { name: 'Fish food', icon: '🍤', price: 10, qty: 5 }; // 10 Xu buys 5 portions
  // ---- Decorations inside the round fish tank ----
  const TANK_DECOR = {
    pebbles: { name: 'Coloured pebbles',     icon: '🔵', price: 20 },
    moss:    { name: 'Moss carpet',    icon: '☘️', price: 25 },
    seaweed: { name: 'Seaweed',   icon: '🌿', price: 30 },
    shell:   { name: 'Seashell',       icon: '🐚', price: 40 },
    coral:   { name: 'Coral',      icon: '🏵️', price: 60 },
    bubbler: { name: 'Bubbler', icon: '💨', price: 80 },
    castle:  { name: 'Little castle', icon: '🏰', price: 120 },
  };
  const TANK_DECOR_MAX = 8;

  // ---- Garden decorations (placed on the island) ----
  const DECOR = {
    flowers:  { name: 'Flower bush',        icon: '💐', price: 30 },
    fence:    { name: 'White fence', icon: '🚧', price: 20 },
    bench:    { name: 'Wooden bench',         icon: '🪑', price: 40 },
    mailbox:  { name: 'Mailbox',        icon: '📮', price: 50 },
    lantern:  { name: 'Lantern',       icon: '🏮', price: 60 },
    mushroom: { name: 'Giant mushroom',   icon: '🍄', price: 80 },
    picnic:   { name: 'Picnic table',     icon: '🧺', price: 120 },
    birdbath: { name: 'Bird bath',   icon: '🐦', price: 150 },
    windmill: { name: 'Windmill',    icon: '🌬️', price: 220 },
    cat:      { name: 'Cat statue',      icon: '🐱', price: 200 },
    sakura:   { name: 'Cherry tree',    icon: '🌸', price: 300 },
    // rare items: only 2 of them are sold each week (see rareOfWeek) — the big Xu sinks
    bonsai:   { name: 'Rose-myrtle bonsai', icon: '🌳', price: 900,  rare: true },
    turtle:   { name: 'Golden turtle',       icon: '🐢', price: 1200, rare: true },
    lizard:   { name: 'Green monitor lizard',     icon: '🦎', price: 1400, rare: true },
    dragon:   { name: 'Dragon statue',     icon: '🐉', price: 2000, rare: true },
    peacock:  { name: 'Peacock',      icon: '🦚', price: 1600, rare: true },
    fountain: { name: 'Mini fountain',  icon: '⛲', price: 1100, rare: true },
  };

  // ---- Upgrades (bought in the shop). Level 0 is what you start with. Prices grow x3 per level ----
  const UPGRADES = {
    land:    [{ size: 4 }, { size: 5, price: 300 }, { size: 6, price: 900 }, { size: 7, price: 2700 }, { size: 8, price: 8100 }],
    pots:    [{ cap: 8, name: 'Cloud Island 1' }, { cap: 16, name: 'Cloud Island 2 (higher)', price: 900 }, { cap: 24, name: 'Cloud Island 3 (highest)', price: 2700 }],
    orchard: [{ cap: 3 }, { cap: 6, price: 500 }],
    pond:    [{ cap: 4 }, { cap: 8, price: 250 }, { cap: 12, price: 750 }, { cap: 16, price: 2250 }],
    coop:    [{ cap: 3 }, { cap: 6, price: 400 }],
    sty:     [{ cap: 2 }, { cap: 4, price: 900 }],
    barn:    [{ cap: 2 }, { cap: 4, price: 1200 }],
    house:   HOUSE.map((h) => ({ cap: h.slots, name: h.name, price: h.price })),
  };
  // ---- Daily upkeep of the garden (charged once per day you play): grows with your upgrades ----
  const UPKEEP = { base: 0, perLevel: 8 }; // Xu per upgrade level owned, per day

  // ---- Social: likes and weekly "most beautiful" boards ----
  const SOCIAL = { likeXu: 2, maxLikesPerDay: 10 }; // each visitor like gives the owner 2 Xu (max 10 likes/day count)

  const REASONS = {
    study: { icon: '📚', name: 'Studying' },
    pomodoro: { icon: '⏱️', name: 'Completed 25 focused minutes' },
    walk: { icon: '👟', name: 'Walking' },
    checkin: { icon: '📍', name: 'Landmark check-in' },
    trash: { icon: '🧹', name: 'Picking up trash' },
    recycle: { icon: '♻️', name: 'Sorting trash into bins' },
    lounge: { icon: '🎬', name: 'Listening / watching together' },
    sell: { icon: '💰', name: 'Selling items' },
    buy: { icon: '🛒', name: 'Buying items' },
    market: { icon: '🏷️', name: 'Market sale' },
    merchant: { icon: '🧳', name: 'Sold to Travelling Merchant' },
    upkeep: { icon: '🧾', name: 'Garden upkeep' },
    like: { icon: '❤️', name: 'Received a like' },
    game: { icon: '🎲', name: 'Won a game' },
    astro: { icon: '🔮', name: 'Astrology reading' },
  };
  const DAY = 86400000, WEEK = 7 * DAY;
  function weekKey(t) { return Math.floor((t + 3 * DAY) / WEEK); } // weeks start on Monday
  function rareOfWeek(t) {
    const ids = Object.keys(DECOR).filter((k) => DECOR[k].rare), w = weekKey(t);
    return [ids[w % ids.length], ids[(w * 3 + 1) % ids.length] === ids[w % ids.length] ? ids[(w + 1) % ids.length] : ids[(w * 3 + 1) % ids.length]];
  }
  function upkeepOf(g) { return UPKEEP.base + UPKEEP.perLevel * ((g.land | 0) + (g.pots | 0) + (g.orchard | 0) + (g.pond | 0) + (g.coop | 0) + (g.sty | 0) + (g.barn | 0) + (g.house | 0)); }
  // Beauty scores for the weekly boards (computed from saved data only — no ticking on the server)
  function gardenBeauty(g) {
    let s = 0;
    for (const d of g.decor || []) s += Math.round(((DECOR[d.item] || {}).price || 0) / 10);
    for (const k in g.flowerPots || {}) s += 6;
    for (const k in g.trees || {}) s += 8;
    for (const k in g.plots || {}) s += 2;
    for (const a of g.animals || []) s += 10;
    for (const k in g.furniture || {}) s += Math.round(((FURNITURE[g.furniture[k]] || {}).price || 0) / 10);
    for (const k in g.potTypes || {}) s += Math.round(((POTS[g.potTypes[k]] || {}).price || 0) / 10);
    return s + 25 * ((g.land | 0) + (g.pots | 0) + (g.orchard | 0) + (g.house | 0) * 2);
  }
  function tankBeauty(g, now) {
    let s = 0;
    for (const k of g.tankDecor || []) s += Math.round(((TANK_DECOR[k] || {}).price || 0) / 5);
    for (const f of g.fish || []) {
      const F = FISH[f.sp] || { tier: 1 };
      const hungry = now - (f.fedAt || 0) > ECON.hungryHours * 3600000;
      s += Math.round((10 * F.tier + f.size / 2) * (hungry ? 0.4 : 1)); // unfed fish lose beauty
    }
    return s;
  }

  // ---- helpers ----
  function plantInfo(id) { return CROPS[id] || FLOWERS[id] || FRUITS[id] || null; }
  function plantKind(id) { return CROPS[id] ? 'crop' : FLOWERS[id] ? 'flower' : FRUITS[id] ? 'fruit' : null; }
  // Any inventory key -> { name, icon, base } (base = fair value used by shops / NPC buyers)
  function itemInfo(key) {
    const [k, id] = String(key).split(':');
    if (k === 'crop') { const p = plantInfo(id); return p && { name: p.name, icon: p.icon, base: p.sell, produce: true }; }
    if (k === 'seed') { const p = CROPS[id] || FLOWERS[id]; return p && { name: p.name + ' seeds', icon: p.icon, base: p.price, seed: true }; }
    if (k === 'sapling') { const p = FRUITS[id]; return p && { name: p.name + ' sapling', icon: '🌱', base: p.price }; }
    if (k === 'decor') { const d = DECOR[id]; return d && { name: d.name, icon: d.icon, base: d.price }; }
    if (k === 'tank') { const d = TANK_DECOR[id]; return d && { name: d.name, icon: d.icon, base: d.price }; }
    if (k === 'prod') { const p = PRODUCTS[id]; return p && { name: p.name, icon: p.icon, base: p.sell, produce: true }; }
    if (k === 'feed') { const f = FEEDS[id]; return f && { name: f.name, icon: f.icon, base: f.price / f.qty }; }
    if (k === 'pot') { const p = POTS[id]; return p && id !== 'clay' && { name: p.name, icon: p.icon, base: p.price }; }
    if (k === 'furn') { const f = FURNITURE[id]; return f && { name: f.name, icon: f.icon, base: f.price }; }
    if (key === 'fert') return { name: FERT.name, icon: FERT.icon, base: FERT.price / FERT.qty };
    if (key === 'boost') return { name: BOOST.name, icon: BOOST.icon, base: BOOST.price };
    if (key === 'food') return { name: FOOD.name, icon: FOOD.icon, base: FOOD.price / FOOD.qty };
    return null;
  }
  // How long the current growing cycle of a plant record takes (ms). where: 'plot' | 'pot' | 'tree'
  function cycleMs(rec, where, potLvl) {
    const p = plantInfo(rec.s); if (!p) return 60000;
    let min = where === 'tree' ? (rec.m ? p.regrowMin : p.growMin) : p.growMin;
    if (where === 'pot' && potLvl >= 2) min *= CARE.cloudSpeed;
    if (where === 'pot' && rec.pt && POTS[rec.pt]) min *= POTS[rec.pt].speed; // the pot type it was planted in
    return min * 60000;
  }
  // Growth is computed from timestamps only (GDD §2): elapsed + care bonus + time spent under a garden boost.
  function progress(rec, where, potLvl, now, boosts) {
    let extra = 0;
    if (boosts) for (const b of boosts) extra += Math.max(0, Math.min(now, b.e) - Math.max(rec.at, b.s)) * BOOST.speed;
    return Math.max(0, Math.min(1, (now - rec.at + (rec.bonus || 0) + extra) / cycleMs(rec, where, potLvl)));
  }
  function fishPrice(sp, size) {
    const f = FISH[sp]; if (!f) return 0;
    return Math.max(1, Math.round(f.value * (0.5 + size / f.size[1])));
  }
  function fishMaxSize(sp) { const f = FISH[sp]; return f ? Math.round(f.size[1] * 1.6) : 0; }

  // Play-testing mode (start-test.bat): lots of Xu, 10x faster plants, fish can eat every minute.
  let testOn = false;
  function enableTestMode() {
    if (testOn) return; testOn = true;
    ECON.startXu = 5000; ECON.feedCooldownMin = 1; ECON.merchantEveryMin = [0.5, 1]; ECON.pomodoroMin = 1; ECON.hungryHours = 0.05;
    [CROPS, FLOWERS, FRUITS].forEach((T) => { for (const k in T) { T[k].growMin /= 10; if (T[k].regrowMin) T[k].regrowMin /= 10; } });
    BOOST.minutes = 6;
    for (const k in ANIMALS) ANIMALS[k].produceMin /= 10;
    Catalog.testMode = true;
  }

  const Catalog = {
    ECON, CARE, CROPS, FLOWERS, FRUITS, FERT, BOOST, FISH, FOOD, TANK_DECOR, TANK_DECOR_MAX, DECOR, UPGRADES, UPKEEP, SOCIAL, REASONS,
    ANIMALS, PRODUCTS, FEEDS, POTS, FURNITURE, HOUSE, FOODS,
    plantInfo, plantKind, itemInfo, cycleMs, progress, fishPrice, fishMaxSize, enableTestMode, testMode: false,
    weekKey, rareOfWeek, upkeepOf, gardenBeauty, tankBeauty,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Catalog;
  else root.VCCatalog = Catalog;
})(typeof self !== 'undefined' ? self : this);
