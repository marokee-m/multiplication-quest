/**
 * Roblox Multiplication Quest - app.js
 * Core game engine, Web Audio synthesis, 3D WebGL Arena, Shop & dressing system.
 */

// ==========================================================================
// 1. App State & Local Storage Setup
// ==========================================================================
const DEFAULT_STATE = {
  username: "GuestPlayer",
  robux: 100,
  unlockedItems: ["hat_cap"],
  equippedItems: {
    hat: "hat_cap",
    glasses: null,
    back: null,
    pet: null,
    shirt: null,
    pants: null
  },
  completedTables: [],
  highScores: {},
  gender: "male",
  avatarColors: {
    skin: "#ffd8a8",
    torso: "#1e63e6",
    legs: "#555555"
  }
};

let gameState = { ...DEFAULT_STATE };

// Load state from localStorage
function loadGameState() {
  const saved = localStorage.getItem("roblox_mult_quest_state");
  if (saved) {
    try {
      gameState = { ...DEFAULT_STATE, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Error parsing game state, resetting to default.", e);
      gameState = { ...DEFAULT_STATE };
    }
  }
  syncUIWithState();
}

// Save state to localStorage
function saveGameState() {
  localStorage.setItem("roblox_mult_quest_state", JSON.stringify(gameState));
  syncUIWithState();
}

function syncUIWithState() {
  // Update Header
  document.getElementById("player-username").value = gameState.username;
  document.getElementById("robux-balance").innerText = gameState.robux;
  document.getElementById("shop-balance-val").innerText = gameState.robux;

  // Sync gender buttons
  const mBtn = document.getElementById("gender-male-btn");
  const fBtn = document.getElementById("gender-female-btn");
  if (mBtn && fBtn) {
    mBtn.classList.toggle("active", gameState.gender !== "female");
    fBtn.classList.toggle("active", gameState.gender === "female");
  }
  // Refresh sidebar 3D avatar to reflect new colors/equipment
  refreshSidebarAvatar();
}

// ==========================================================================
// 1b. Pentatonic Melody Synthesizer (royalty-free procedural music)
// ==========================================================================
// C-major pentatonic: C4 D4 E4 G4 A4 C5 D5 E5 G5 A5
const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
// Upbeat pattern: catchy 8-step melody
const MELODY_PATTERNS = {
  hiphop: [4,2,0,4,6,4,2,4],
  edm:    [0,4,6,4,8,6,4,2],
  drum:   [2,4,6,8,6,4,2,0]
};
let melodyInterval = null;
let melodyStep = 0;

function startMelodySequencer(beatStyle) {
  stopMelodySequencer();
  if (!soundEnabled) return;
  initAudio();
  melodyStep = 0;
  const pattern = MELODY_PATTERNS[beatStyle] || MELODY_PATTERNS.hiphop;
  const beatMs = 60000 / currentBpm;

  melodyInterval = setInterval(() => {
    if (!soundEnabled || !audioCtx) return;
    const freq = PENTA[pattern[melodyStep % pattern.length]];
    const t = audioCtx.currentTime;
    // Bright synth lead
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.3);
    // Harmonics
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, t);
    gain2.gain.setValueAtTime(0.07, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc2.connect(gain2); gain2.connect(audioCtx.destination);
    osc2.start(t); osc2.stop(t + 0.22);
    melodyStep++;
  }, beatMs * 0.75);
}

function stopMelodySequencer() {
  if (melodyInterval) { clearInterval(melodyInterval); melodyInterval = null; }
}

// ==========================================================================
// 2. Audio Engine (Web Audio API Synthesizer)
// ==========================================================================
let audioCtx = null;
let soundEnabled = true;
let djSequencerTimer = null;
let currentBpm = 125;
let sequencerStep = 0;
let activeBeatStyle = "hiphop";
let beatIsPlaying = false;

function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { return; }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// iOS Safari audio unlock — must happen inside a user gesture
function unlockIOSAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        // Play a 1-sample silent buffer to fully unlock iOS
        try {
          const buf = audioCtx.createBuffer(1, 1, 22050);
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioCtx.destination);
          src.start(0);
        } catch(e) {}
      }).catch(() => {});
    }
    return;
  }
  // First touch — create context
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  } catch(e) {}
}

// Helper to synthesize a simple sound
function playSynthSound(freq, duration, type = "sine", gainVal = 0.5) {
  if (!soundEnabled) return;
  initAudio();
  try {
    const time = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + duration);
  } catch (err) {
    console.error("Audio error", err);
  }
}

// Roblox sound effects
const sounds = {
  click: () => {
    unlockIOSAudio(); // unlock iOS audio on every click
    playSynthSound(600, 0.08, "triangle", 0.4);
  },
  coin: () => {
    if (!soundEnabled) return;
    initAudio();
    playSynthSound(987.77, 0.12, "sine", 0.3);
    setTimeout(() => {
      playSynthSound(1318.51, 0.25, "sine", 0.3);
    }, 80);
  },
  oof: () => {
    if (!soundEnabled) return;
    initAudio();
    const time = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.linearRampToValueAtTime(110, time + 0.15);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.18);
  },
  win: () => {
    if (!soundEnabled) return;
    initAudio();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C major arpeggio
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        playSynthSound(freq, 0.3, "sawtooth", 0.15);
      }, idx * 100);
    });
  },
  hit: () => {
    playSynthSound(150, 0.15, "triangle", 0.6);
  },
  shoot: () => {
    playSynthSound(800, 0.1, "sine", 0.25);
  }
};

// Drum synthesizers for Sequencer
function synthKick(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);
  gain.gain.setValueAtTime(0.6, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  osc.start(time);
  osc.stop(time + 0.2);
}

function synthSnare(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(240, time);
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  osc.start(time);
  osc.stop(time + 0.15);

  const oscNoise = audioCtx.createOscillator();
  const gainNoise = audioCtx.createGain();
  oscNoise.type = "sawtooth";
  oscNoise.frequency.setValueAtTime(1000, time);
  oscNoise.connect(gainNoise);
  gainNoise.connect(audioCtx.destination);
  gainNoise.gain.setValueAtTime(0.05, time);
  gainNoise.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  oscNoise.start(time);
  oscNoise.stop(time + 0.1);
}

function synthHihat(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(9000, time);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.start(time);
  osc.stop(time + 0.05);
}

function synthMelodyNote(freq, time, type = "sine") {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.12, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
  osc.start(time);
  osc.stop(time + 0.25);
}

// Play note chord for DJ Pad press
function playDJPitch(factor1, factor2, result) {
  initAudio();
  const time = audioCtx.currentTime;
  const baseFreq = 220 + (factor1 * 10);
  const secondFreq = baseFreq * (1 + (factor2 / 12));
  const thirdFreq = 110 + (result * 2);

  synthMelodyNote(thirdFreq, time, "sawtooth");
  synthMelodyNote(secondFreq, time + 0.05, "triangle");
  synthMelodyNote(baseFreq, time + 0.1, "sine");
}

// DJ Rhythm Loop Scheduler
function runSequencerTick() {
  if (!beatIsPlaying || !soundEnabled) return;
  const time = audioCtx.currentTime;

  const waveBars = document.querySelectorAll(".wave-bar");
  waveBars.forEach((bar) => {
    const val = Math.floor(Math.random() * 30) + 5;
    bar.style.height = `${val}px`;
  });

  const speakers = document.querySelectorAll(".dj-speaker");
  speakers.forEach(sp => {
    sp.classList.add("dj-speaker-active");
    setTimeout(() => sp.classList.remove("dj-speaker-active"), 100);
  });

  if (activeBeatStyle === "hiphop") {
    if (sequencerStep === 0 || sequencerStep === 4) synthKick(time);
    if (sequencerStep === 2 || sequencerStep === 6) synthSnare(time);
    if (sequencerStep % 2 === 0) synthHihat(time);
  } else if (activeBeatStyle === "edm") {
    if (sequencerStep % 2 === 0) {
      synthKick(time);
      synthHihat(time);
    } else {
      synthHihat(time + 0.05);
    }
    if (sequencerStep === 2 || sequencerStep === 6) synthSnare(time);
  } else if (activeBeatStyle === "drum") {
    if (sequencerStep === 0 || sequencerStep === 3) synthKick(time);
    if (sequencerStep === 4) synthSnare(time);
    synthHihat(time);
  }

  sequencerStep = (sequencerStep + 1) % 8;
}

function startBeatSequencer() {
  initAudio();
  if (djSequencerTimer) clearInterval(djSequencerTimer);
  beatIsPlaying = true;
  sequencerStep = 0;
  djSequencerTimer = setInterval(runSequencerTick, 60000 / currentBpm / 2);
}

function stopBeatSequencer() {
  beatIsPlaying = false;
  if (djSequencerTimer) {
    clearInterval(djSequencerTimer);
    djSequencerTimer = null;
  }
  const waveBars = document.querySelectorAll(".wave-bar");
  waveBars.forEach(b => b.style.height = "4px");
}

// ==========================================================================
// 3. Multiplication Memory Stories Database & Fallback
// ==========================================================================
const NUMBER_CHARACTERS = {
  1: { char: "แชมเปี้ยนถ้วยรางวัล", emoji: "🏆" },
  2: { char: "เป็ดน้อยก้าบก้าบ", emoji: "🦆" },
  3: { char: "ผีเสื้อขนาดยักษ์", emoji: "🦋" },
  4: { char: "เรือใบผจญภัย", emoji: "⛵" },
  5: { char: "แอปเปิ้ลวิเศษไฟ", emoji: "🍎" },
  6: { char: "เชอร์รี่จอมกวน", emoji: "🍒" },
  7: { char: "ขวานจอบขุดทอง", emoji: "⛏️" },
  8: { char: "สโนว์แมนน้ำแข็ง", emoji: "☃️" },
  9: { char: "ลูกโป่งยักษ์สวรรค์", emoji: "🎈" },
  10: { char: "ปูยักษ์สิบขา", emoji: "🦀" },
  11: { char: "กระต่ายหูคู่", emoji: "🐰" },
  12: { char: "นาฬิกาสามมิติ", emoji: "⏰" },
  13: { char: "เอเลี่ยนแมวส้ม", emoji: "🐈" },
  14: { char: "ไดโนเสาร์ทีเร็กซ์", emoji: "🦖" },
  15: { char: "เค้กยักษ์ก้อนโต", emoji: "🍰" },
  16: { char: "มนุษย์ต่างดาวสีเขียว", emoji: "👽" },
  17: { char: "จานบินยูเอฟโอ", emoji: "🛸" },
  18: { char: "สิงโตราชาเจ้าป่า", emoji: "🦁" },
  19: { char: "รถซิ่งสปอร์ตไฟแรง", emoji: "🚗" },
  20: { char: "ฉลามปากกว้าง", emoji: "🦈" },
  21: { char: "พ่อมดขี่ไม้กวาด", emoji: "🧙‍♂️" },
  22: { char: "หงส์วิเศษคอขด", emoji: "🦢" },
  23: { char: "คริสตัลอัญมณีสีน้ำเงิน", emoji: "💎" },
  24: { char: "กล่องของขวัญปริศนา", emoji: "🎁" }
};

const CUSTOM_STORIES = {
  "2x2": { story: "เป็ด 2 ตัว เล่นสไลเดอร์มาเจอกัน ได้สกินบล็อกทองคำ 4 บล็อก!", emoji: "🦆🦆🧱🧱" },
  "2x3": { story: "เป็ดน้อย 2 ตัว ชวนผีเสื้อ 3 ตัว บินจับเชอร์รี่หวานฉ่ำ 6 ลูก!", emoji: "🦆🦋🍒" },
  "2x4": { story: "เป็ดน้อย 2 ตัว ล่องเรือใบ 4 ลำ ไปพบเพื่อนสโนว์แมน 8 ตน!", emoji: "🦆⛵☃️" },
  "5x5": { story: "แอปเปิ้ลวิเศษ 5 ผล ใส่ในกล่องสุ่ม 5 กล่อง แตกตัวได้ Robux สะสม 25 R$!", emoji: "🍎🎁💎" },
  "5x6": { story: "แอปเปิ้ลวิเศษ 5 ผล ชนตึกเชอร์รี่ 6 ชั้น มีผึ้งแตกรังออกมา 30 ตัว!", emoji: "🍎🍒🐝" },
  "9x9": { story: "ลูกโป่งยักษ์ 9 ใบ ปลิวชนภูเขาลูกโป่งอีก 9 ใบ เกิดพลังงานเพชรระเบิด 81 ก้อน!", emoji: "🎈🎈💎" }
};

function getStoryForEquation(A, B) {
  const result = A * B;
  const key = `${A}x${B}`;
  
  if (CUSTOM_STORIES[key]) {
    return CUSTOM_STORIES[key];
  }

  const charA = NUMBER_CHARACTERS[A] || { char: `เหล่านักรบ ${A} คน`, emoji: "👥" };
  const charB = NUMBER_CHARACTERS[B] || { char: `อุปกรณ์เสริม ${B} ชิ้น`, emoji: "⚙️" };
  
  let emojiResult = "✨";
  if (result <= 24 && NUMBER_CHARACTERS[result]) {
    emojiResult = NUMBER_CHARACTERS[result].emoji;
  } else {
    emojiResult = "⭐💎";
  }

  return {
    story: `เมื่อ ${charA.char} ${charA.emoji} มารวมพลังกับ ${charB.char} ${charB.emoji} ได้ถล่มบอสจนร่วงและรับรางวัลปลดล็อกไอเทม "${result}" ${emojiResult} ชิ้นทันที!`,
    emoji: `${charA.emoji} ✖️ ${charB.emoji} ➔ ${emojiResult}`
  };
}

// ==========================================================================
// 4. Custom 2D SVG Item Definitions (Shop Products - 25 items)
// ==========================================================================
const SHOP_ITEMS = [
  {
    id: "hat_cap",
    name: "หมวกแก๊ปสตาร์เกอร์",
    cat: "hat",
    rarity: "common",
    price: 30,
    icon: "🧢",
    svg: `<svg viewBox="0 0 100 100"><path d="M15 55 C 15 25, 75 25, 85 55 Z" fill="#d82626"/><rect x="40" y="55" width="55" height="10" rx="5" fill="#111"/><ellipse cx="50" cy="30" rx="8" ry="4" fill="#fff"/></svg>`
  },
  {
    id: "hat_bunny",
    name: "หูกระต่ายบันนี่น้อย",
    cat: "hat",
    rarity: "common",
    price: 50,
    icon: "🐰",
    svg: `<svg viewBox="0 0 100 100"><path d="M25 50 C 15 10, 40 10, 35 50" fill="#fff" stroke="#ccc" stroke-width="2"/><path d="M28 45 C 20 20, 35 20, 32 45" fill="#ffccd5"/><path d="M65 50 C 55 10, 80 10, 75 50" fill="#fff" stroke="#ccc" stroke-width="2"/><path d="M68 45 C 60 20, 75 20, 72 45" fill="#ffccd5"/></svg>`
  },
  {
    id: "hat_chef",
    name: "หมวกเชฟกะทะเหล็ก",
    cat: "hat",
    rarity: "rare",
    price: 100,
    icon: "👨‍🍳",
    svg: `<svg viewBox="0 0 100 100"><path d="M30 60 C 20 40, 25 20, 50 20 C 75 20, 80 40, 70 60 Z" fill="#fff" stroke="#ddd" stroke-width="3"/><rect x="32" y="55" width="36" height="15" fill="#eee" rx="3"/></svg>`
  },
  {
    id: "hat_pirate",
    name: "หมวกโจรสลัดวิญญาณ",
    cat: "hat",
    rarity: "rare",
    price: 150,
    icon: "🏴‍☠️",
    svg: `<svg viewBox="0 0 100 100"><path d="M10 55 C 20 25, 80 25, 90 55 C 50 65, 50 65, 10 55 Z" fill="#1a1a1a"/><circle cx="50" cy="42" r="7" fill="#fff"/><rect x="48" y="38" width="4" height="8" fill="#000"/><rect x="46" y="40" width="8" height="2" fill="#000"/></svg>`
  },
  {
    id: "hat_knight",
    name: "หมวกอัศวินศักดิ์สิทธิ์",
    cat: "hat",
    rarity: "legendary",
    price: 350,
    icon: "⚔️",
    svg: `<svg viewBox="0 0 100 100"><path d="M25 60 C 25 25, 75 25, 75 60 Z" fill="#90a4ae"/><path d="M25 50 H 75 V 62 H 25 Z" fill="#78909c"/><rect x="35" y="45" width="30" height="6" fill="#f79f1f" rx="3"/><path d="M50 25 C 50 10, 65 5, 70 0" stroke="#d82626" stroke-width="6" fill="none"/></svg>`
  },
  {
    id: "hat_crown",
    name: "มงกุฎราชาเรืองแสง",
    cat: "hat",
    rarity: "legendary",
    price: 500,
    icon: "👑",
    svg: `<svg viewBox="0 0 100 100"><polygon points="15,60 25,25 40,45 50,15 60,45 75,25 85,60" fill="#ffd700" stroke="#f79f1f" stroke-width="3"/><rect x="15" y="55" width="70" height="10" fill="#f79f1f" rx="2"/><circle cx="25" cy="25" r="4" fill="#d82626"/><circle cx="50" cy="15" r="4" fill="#1e63e6"/><circle cx="75" cy="25" r="4" fill="#00b06f"/></svg>`
  },
  {
    id: "glasses_cool",
    name: "แว่นพิกเซลเท่ระเบิด",
    cat: "glasses",
    rarity: "common",
    price: 40,
    icon: "🕶️",
    svg: `<svg viewBox="0 0 100 100"><rect x="15" y="40" width="30" height="12" fill="#111"/><rect x="55" y="40" width="30" height="12" fill="#111"/><rect x="45" y="42" width="10" height="4" fill="#111"/><rect x="20" y="48" width="6" height="4" fill="#fff"/><rect x="60" y="48" width="6" height="4" fill="#fff"/></svg>`
  },
  {
    id: "glasses_nerd",
    name: "แว่นกลมเนิร์ดอัจฉริยะ",
    cat: "glasses",
    rarity: "common",
    price: 60,
    icon: "🤓",
    svg: `<svg viewBox="0 0 100 100"><circle cx="30" cy="45" r="14" fill="none" stroke="#222" stroke-width="4"/><circle cx="70" cy="45" r="14" fill="none" stroke="#222" stroke-width="4"/><line x1="44" y1="45" x2="56" y2="45" stroke="#222" stroke-width="4"/></svg>`
  },
  {
    id: "mask_ninja",
    name: "หน้ากากนินจารัตติกาล",
    cat: "glasses",
    rarity: "rare",
    price: 120,
    icon: "🥷",
    svg: `<svg viewBox="0 0 100 100"><path d="M15 50 C 15 80, 85 80, 85 50 V 90 H 15 Z" fill="#1c1e22" stroke="#222"/></svg>`
  },
  {
    id: "mask_kabuki",
    name: "หน้ากากคาบูกิญี่ปุ่น",
    cat: "glasses",
    rarity: "rare",
    price: 180,
    icon: "👺",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" rx="10" fill="#fff" stroke="#ccc" stroke-width="2"/><path d="M30 40 Q 35 30 40 40" stroke="#d82626" stroke-width="4" fill="none"/><path d="M60 40 Q 65 30 70 40" stroke="#d82626" stroke-width="4" fill="none"/><polygon points="45,50 50,35 55,50" fill="#d82626"/><path d="M35 65 Q 50 75 65 65" stroke="#000" stroke-width="3" fill="none"/></svg>`
  },
  {
    id: "glasses_cyborg",
    name: "หน้ากากไซบอร์กเลเซอร์",
    cat: "glasses",
    rarity: "legendary",
    price: 300,
    icon: "🤖",
    svg: `<svg viewBox="0 0 100 100"><rect x="15" y="40" width="70" height="14" rx="4" fill="#455a64" stroke="#37474f" stroke-width="2"/><rect x="20" y="44" width="60" height="6" fill="#00ffff" rx="2"/></svg>`
  },
  {
    id: "glasses_fire",
    name: "ดวงตาปีศาจโลกันตร์",
    cat: "glasses",
    rarity: "legendary",
    price: 400,
    icon: "🔥",
    svg: `<svg viewBox="0 0 100 100"><path d="M20 45 C 20 20, 45 45, 30 50 Z" fill="#f79f1f" filter="drop-shadow(0 0 5px red)"/><path d="M80 45 C 80 20, 55 45, 70 50 Z" fill="#f79f1f" filter="drop-shadow(0 0 5px red)"/></svg>`
  },
  {
    id: "back_sword",
    name: "ดาบไม้ผู้ฝึกฝน",
    cat: "back",
    rarity: "common",
    price: 80,
    icon: "🪵",
    svg: `<svg viewBox="0 0 100 100"><rect x="46" y="10" width="8" height="60" fill="#d7ccc8" rx="2" transform="rotate(45 50 50)"/><rect x="36" y="55" width="28" height="6" fill="#5d4037" rx="1" transform="rotate(45 50 50)"/><rect x="47" y="60" width="6" height="15" fill="#8d6e63" rx="1" transform="rotate(45 50 50)"/></svg>`
  },
  {
    id: "back_shield",
    name: "โล่ไม้ผู้พิทักษ์",
    cat: "back",
    rarity: "common",
    price: 100,
    icon: "🛡️",
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="#8d6e63" stroke="#5d4037" stroke-width="4"/><circle cx="50" cy="50" r="22" fill="#d82626"/><polygon points="50,38 53,46 62,46 55,51 57,59 50,54 43,59 45,51 38,46 47,46" fill="#ffd700"/></svg>`
  },
  {
    id: "back_pack",
    name: "เป้นักผจญภัย",
    cat: "back",
    rarity: "rare",
    price: 150,
    icon: "🎒",
    svg: `<svg viewBox="0 0 100 100"><rect x="25" y="30" width="50" height="50" rx="8" fill="#5d4037" stroke="#3e2723" stroke-width="3"/><rect x="32" y="45" width="36" height="28" rx="4" fill="#8d6e63"/><rect x="45" y="45" width="10" height="10" fill="#f79f1f"/></svg>`
  },
  {
    id: "back_katana",
    name: "ดาบคู่นินจาพิฆาต",
    cat: "back",
    rarity: "rare",
    price: 250,
    icon: "⚔️",
    svg: `<svg viewBox="0 0 100 100"><rect x="47" y="10" width="6" height="80" fill="#222" transform="rotate(45 50 50)"/><rect x="47" y="10" width="6" height="80" fill="#222" transform="rotate(-45 50 50)"/><rect x="42" y="70" width="16" height="5" fill="#f79f1f" transform="rotate(45 50 50)"/><rect x="42" y="70" width="16" height="5" fill="#f79f1f" transform="rotate(-45 50 50)"/></svg>`
  },
  {
    id: "back_bat",
    name: "ปีกค้างคาวรัตติกาล",
    cat: "back",
    rarity: "legendary",
    price: 450,
    icon: "🦇",
    svg: `<svg viewBox="0 0 100 100"><path d="M50 50 C30 30, 20 20, 5 35 C15 50, 25 50, 50 50 Z" fill="#222"/><path d="M50 50 C70 30, 80 20, 95 35 C85 50, 75 50, 50 50 Z" fill="#222"/></svg>`
  },
  {
    id: "back_angel",
    name: "ปีกเทพสวรรค์ทองคำ",
    cat: "back",
    rarity: "legendary",
    price: 600,
    icon: "👼",
    svg: `<svg viewBox="0 0 100 100"><path d="M50 45 C30 20, 10 10, 0 35 C20 60, 35 50, 50 45 Z" fill="#ffd700" opacity="0.9" filter="drop-shadow(0 0 5px gold)"/><path d="M50 45 C70 20, 90 10, 100 35 C80 60, 65 50, 50 45 Z" fill="#ffd700" opacity="0.9" filter="drop-shadow(0 0 5px gold)"/></svg>`
  },
  {
    id: "back_laser",
    name: "ดาบเลเซอร์เรืองแสง",
    cat: "back",
    rarity: "legendary",
    price: 700,
    icon: "🔮",
    svg: `<svg viewBox="0 0 100 100"><rect x="47" y="10" width="6" height="55" fill="#00ffff" rx="3" transform="rotate(35 50 50)" filter="drop-shadow(0 0 8px #00ffff)"/><rect x="46" y="65" width="8" height="15" fill="#777" transform="rotate(35 50 50)"/></svg>`
  },
  {
    id: "pet_dog",
    name: "หมาบล็อกโกะ",
    cat: "pet",
    rarity: "common",
    price: 180,
    icon: "🐶",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="#a1887f" rx="8" stroke="#5d4037" stroke-width="2"/><rect x="25" y="35" width="12" height="12" fill="#000" rx="2"/><rect x="63" y="35" width="12" height="12" fill="#000" rx="2"/><rect x="43" y="55" width="14" height="10" fill="#000" rx="3"/><rect x="47" y="64" width="6" height="10" fill="#ff8a80" rx="2"/><rect x="10" y="15" width="16" height="35" fill="#5d4037" rx="4"/><rect x="74" y="15" width="16" height="35" fill="#5d4037" rx="4"/></svg>`
  },
  {
    id: "pet_cat",
    name: "แมวส้มบล็อกกี้",
    cat: "pet",
    rarity: "common",
    price: 200,
    icon: "🐱",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="#ff9800" rx="8" stroke="#e65100" stroke-width="2"/><polygon points="20,25 35,5 38,25" fill="#e65100"/><polygon points="80,25 65,5 62,25" fill="#e65100"/><rect x="28" y="38" width="10" height="10" fill="#000" rx="1"/><rect x="62" y="38" width="10" height="10" fill="#000" rx="1"/><polygon points="46,52 50,46 54,52" fill="#ff8a80"/><line x1="24" y1="52" x2="38" y2="52" stroke="#fff" stroke-width="2"/><line x1="76" y1="52" x2="62" y2="52" stroke="#fff" stroke-width="2"/></svg>`
  },
  {
    id: "pet_penguin",
    name: "เพนกวินขั้วโลก",
    cat: "pet",
    rarity: "rare",
    price: 300,
    icon: "🐧",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="#222" rx="15"/><ellipse cx="50" cy="55" rx="20" ry="22" fill="#fff"/><ellipse cx="38" cy="38" rx="5" ry="7" fill="#000"/><ellipse cx="62" cy="38" rx="5" ry="7" fill="#000"/><polygon points="44,45 50,56 56,45" fill="#ffb300"/></svg>`
  },
  {
    id: "pet_slime",
    name: "สไลม์เขียวเรืองแสง",
    cat: "pet",
    rarity: "rare",
    price: 350,
    icon: "🟢",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#00e676" rx="25" filter="drop-shadow(0 0 5px #00e676)"/><circle cx="38" cy="50" r="4" fill="#000"/><circle cx="62" cy="50" r="4" fill="#000"/><path d="M42 62 Q 50 68 58 62" stroke="#000" stroke-width="3" fill="none"/></svg>`
  },
  {
    id: "pet_dragon",
    name: "มังกรน้อยสปาร์กี้",
    cat: "pet",
    rarity: "legendary",
    price: 800,
    icon: "🐉",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="#d50000" rx="10" stroke="#7f0000" stroke-width="2"/><polygon points="30,20 40,5 50,20" fill="#ffd700"/><polygon points="50,20 60,5 70,20" fill="#ffd700"/><polygon points="25,42 10,30 20,55" fill="#7f0000"/><polygon points="75,42 90,30 80,55" fill="#7f0000"/><circle cx="36" cy="40" r="6" fill="#ffd700"/><circle cx="36" cy="40" r="3" fill="#000"/><circle cx="64" cy="40" r="6" fill="#ffd700"/><circle cx="64" cy="40" r="3" fill="#000"/><path d="M45 58 L 50 52 L 55 58" fill="none" stroke="#fff" stroke-width="3"/></svg>`
  },
  {
    id: "pet_unicorn",
    name: "ยูนิคอร์นสีรุ้ง",
    cat: "pet",
    rarity: "legendary",
    price: 900,
    icon: "🦄",
    svg: `<svg viewBox="0 0 100 100"><rect x="25" y="25" width="55" height="55" fill="#f8bbd0" rx="10" stroke="#f48fb1" stroke-width="2"/><polygon points="48,25 50,-5 54,25" fill="#ffd700" filter="drop-shadow(0 0 4px gold)"/><rect x="35" y="42" width="8" height="12" fill="#4a148c" rx="2"/><rect x="60" y="42" width="8" height="12" fill="#4a148c" rx="2"/><path d="M25 35 C 10 35, 10 65, 25 65 Z" fill="#ff4081"/></svg>`
  },
  // ===== SHIRTS =====
  {
    id: "shirt_red_stripe",
    name: "เสื้อลายทางสีแดง",
    cat: "shirt",
    rarity: "common",
    price: 60,
    icon: "👕",
    torsoColor: "#c0392b",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#c0392b" rx="6"/><rect x="20" y="38" width="60" height="6" fill="#e74c3c"/><rect x="20" y="50" width="60" height="6" fill="#e74c3c"/><rect x="20" y="62" width="60" height="6" fill="#e74c3c"/></svg>`
  },
  {
    id: "shirt_blue_hoodie",
    name: "ฮู้ดดี้น้ำเงินเย็น",
    cat: "shirt",
    rarity: "common",
    price: 80,
    icon: "🧥",
    torsoColor: "#1e63e6",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="25" width="60" height="55" fill="#1e63e6" rx="8"/><path d="M35 25 Q 50 40 65 25" fill="#1560d4" stroke="#1e63e6" stroke-width="2"/><rect x="42" y="30" width="16" height="25" fill="#1560d4" rx="4"/></svg>`
  },
  {
    id: "shirt_galaxy",
    name: "เสื้อกาแลคซี่จักรวาล",
    cat: "shirt",
    rarity: "rare",
    price: 180,
    icon: "🌌",
    torsoColor: "#2c3e50",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#2c3e50" rx="6"/><circle cx="35" cy="45" r="3" fill="#00ffff" opacity="0.8"/><circle cx="55" cy="40" r="2" fill="#ff00ff" opacity="0.9"/><circle cx="70" cy="55" r="2.5" fill="#f79f1f" opacity="0.8"/><circle cx="45" cy="60" r="1.5" fill="#fff"/><circle cx="65" cy="68" r="2" fill="#39ff14"/></svg>`
  },
  {
    id: "shirt_fire",
    name: "เสื้อลายไฟนรก",
    cat: "shirt",
    rarity: "rare",
    price: 220,
    icon: "🔥",
    torsoColor: "#7f0000",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#7f0000" rx="6"/><path d="M30 80 C 30 60, 40 65, 38 50 C 42 60, 50 55, 48 40 C 54 55, 60 50, 58 35 C 64 50, 70 60, 70 80 Z" fill="#f79f1f" opacity="0.85"/></svg>`
  },
  {
    id: "shirt_neon_cyber",
    name: "เสื้อไซเบอร์นีออนทอง",
    cat: "shirt",
    rarity: "legendary",
    price: 450,
    icon: "⚡",
    torsoColor: "#0a0a0a",
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#0a0a0a" rx="6"/><rect x="20" y="30" width="60" height="3" fill="#00ffff"/><rect x="20" y="77" width="60" height="3" fill="#00ffff"/><line x1="50" y1="33" x2="50" y2="77" stroke="#00ffff" stroke-width="2"/><line x1="20" y1="53" x2="80" y2="53" stroke="#f79f1f" stroke-width="2"/></svg>`
  },
  // ===== PANTS =====
  {
    id: "pants_black_jeans",
    name: "กางเกงยีนส์ดำคลาสสิค",
    cat: "pants",
    rarity: "common",
    price: 50,
    icon: "👖",
    legsColor: "#1a1a1a",
    svg: `<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#1a1a1a" rx="5"/><line x1="50" y1="10" x2="50" y2="90" stroke="#333" stroke-width="3"/></svg>`
  },
  {
    id: "pants_camo",
    name: "กางเกงลายพรางทหาร",
    cat: "pants",
    rarity: "common",
    price: 70,
    icon: "🪖",
    legsColor: "#556b2f",
    svg: `<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#556b2f" rx="5"/><rect x="30" y="20" width="12" height="10" fill="#3b4a1e" rx="2"/><rect x="55" y="35" width="10" height="12" fill="#3b4a1e" rx="2"/><rect x="35" y="55" width="14" height="8" fill="#3b4a1e" rx="2"/><rect x="58" y="62" width="10" height="10" fill="#3b4a1e" rx="2"/></svg>`
  },
  {
    id: "pants_gold_stripe",
    name: "กางเกงลายแถบทอง",
    cat: "pants",
    rarity: "rare",
    price: 160,
    icon: "✨",
    legsColor: "#2c2c2c",
    svg: `<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#2c2c2c" rx="5"/><rect x="25" y="10" width="8" height="80" fill="#ffd700"/><rect x="67" y="10" width="8" height="80" fill="#ffd700"/></svg>`
  },
  {
    id: "pants_neon_purple",
    name: "กางเกงม่วงนีออนระเบิด",
    cat: "pants",
    rarity: "rare",
    price: 200,
    icon: "💜",
    legsColor: "#6c3483",
    svg: `<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#6c3483" rx="5" filter="drop-shadow(0 0 5px #a855f7)"/><line x1="50" y1="10" x2="50" y2="90" stroke="#e056fd" stroke-width="3"/></svg>`
  },
  {
    id: "pants_legendary_dragon",
    name: "กางเกงมังกรตำนาน",
    cat: "pants",
    rarity: "legendary",
    price: 550,
    icon: "🐉",
    legsColor: "#7f0000",
    svg: `<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#7f0000" rx="5"/><path d="M50 90 C 40 70, 30 60, 35 40 C 40 55, 50 50, 50 30 C 50 50, 60 55, 65 40 C 70 60, 60 70, 50 90 Z" fill="#ffd700" opacity="0.9"/></svg>`
  },
  // ===== HATS extra (9 more → total 15) =====
  { id:"hat_samurai", name:"หมวกซามูไรเหล็ก", cat:"hat", rarity:"rare", price:180, icon:"⚔️",
    svg:`<svg viewBox="0 0 100 100"><path d="M10 60 Q 50 10 90 60 Z" fill="#455a64"/><rect x="15" y="58" width="70" height="8" fill="#37474f" rx="2"/><rect x="20" y="42" width="60" height="4" fill="#ffd700"/><path d="M5 60 H95" stroke="#546e7a" stroke-width="3"/></svg>` },
  { id:"hat_wizard", name:"หมวกแม่มดดาวเวทย์", cat:"hat", rarity:"rare", price:200, icon:"🧙",
    svg:`<svg viewBox="0 0 100 100"><path d="M50 5 L75 70 L25 70 Z" fill="#6a1b9a"/><rect x="15" y="68" width="70" height="10" fill="#4a148c" rx="3"/><circle cx="50" cy="35" r="5" fill="#ffd700"/><circle cx="38" cy="52" r="3" fill="#e040fb"/><circle cx="62" cy="52" r="3" fill="#e040fb"/></svg>` },
  { id:"hat_astronaut", name:"หมวกนักบินอวกาศ", cat:"hat", rarity:"rare", price:220, icon:"🚀",
    svg:`<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="36" ry="38" fill="#eceff1"/><ellipse cx="50" cy="50" rx="36" ry="38" fill="none" stroke="#b0bec5" stroke-width="4"/><rect x="30" y="38" width="40" height="24" fill="#1976d2" rx="4"/><ellipse cx="50" cy="50" rx="18" ry="12" fill="#0d47a1" opacity="0.6"/></svg>` },
  { id:"hat_viking", name:"หมวกไวกิ้งอาจหาญ", cat:"hat", rarity:"rare", price:190, icon:"🪓",
    svg:`<svg viewBox="0 0 100 100"><path d="M20 60 C20 25, 80 25, 80 60 Z" fill="#795548"/><rect x="15" y="58" width="70" height="10" fill="#5d4037" rx="2"/><path d="M10 45 C 5 38, 12 30, 20 35" fill="#c0c0c0"/><path d="M90 45 C 95 38, 88 30, 80 35" fill="#c0c0c0"/><rect x="38" y="20" width="6" height="18" fill="#ffd700" rx="2"/><rect x="56" y="20" width="6" height="18" fill="#ffd700" rx="2"/></svg>` },
  { id:"hat_cowboy", name:"หมวกคาวบอยทะเลทราย", cat:"hat", rarity:"common", price:90, icon:"🤠",
    svg:`<svg viewBox="0 0 100 100"><path d="M30 60 C30 30, 70 30, 70 60 Z" fill="#d2691e"/><ellipse cx="50" cy="62" rx="45" ry="10" fill="#a0522d"/><path d="M10 62 Q 50 55 90 62" fill="none" stroke="#8b4513" stroke-width="3"/><rect x="30" y="50" width="40" height="6" fill="#ffd700" rx="2"/></svg>` },
  { id:"hat_cyber", name:"หมวกไซเบอร์นีออน", cat:"hat", rarity:"legendary", price:400, icon:"🤖",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="35" width="60" height="35" fill="#0d0d1a" rx="5"/><rect x="20" y="35" width="60" height="5" fill="#00ffff"/><rect x="20" y="65" width="60" height="5" fill="#00ffff"/><rect x="15" y="55" width="8" height="4" fill="#ff00ff"/><rect x="77" y="55" width="8" height="4" fill="#ff00ff"/><rect x="35" y="48" width="12" height="8" fill="#00ffff" rx="1" opacity="0.6"/><rect x="53" y="48" width="12" height="8" fill="#ff00ff" rx="1" opacity="0.6"/></svg>` },
  { id:"hat_flower", name:"มงหัวดอกไม้สวรรค์", cat:"hat", rarity:"common", price:70, icon:"🌸",
    svg:`<svg viewBox="0 0 100 100"><circle cx="50" cy="45" r="8" fill="#ffd700"/><circle cx="50" cy="25" r="8" fill="#ff69b4"/><circle cx="68" cy="35" r="8" fill="#ff69b4"/><circle cx="68" cy="55" r="8" fill="#ff69b4"/><circle cx="50" cy="65" r="8" fill="#ff69b4"/><circle cx="32" cy="55" r="8" fill="#ff69b4"/><circle cx="32" cy="35" r="8" fill="#ff69b4"/></svg>` },
  { id:"hat_ninja_mask", name:"สายรัดหัวนินจาไฟ", cat:"hat", rarity:"rare", price:160, icon:"🥷",
    svg:`<svg viewBox="0 0 100 100"><rect x="10" y="42" width="80" height="16" fill="#1a1a1a" rx="3"/><circle cx="35" cy="50" r="5" fill="#ff0000" opacity="0.8"/><circle cx="65" cy="50" r="5" fill="#ff0000" opacity="0.8"/><path d="M5 50 H95" stroke="#ff4500" stroke-width="2"/></svg>` },
  { id:"hat_dragon_helm", name:"หมวกมังกรไฟนรก", cat:"hat", rarity:"legendary", price:480, icon:"🐲",
    svg:`<svg viewBox="0 0 100 100"><path d="M25 65 C25 25, 75 25, 75 65 Z" fill="#b71c1c"/><path d="M25 65 H75" fill="none"/><polygon points="38,25 30,8 45,22" fill="#d32f2f"/><polygon points="62,25 70,8 55,22" fill="#d32f2f"/><rect x="35" y="38" width="30" height="8" fill="#ffd700" rx="2"/><circle cx="38" cy="50" r="4" fill="#ff6600" opacity="0.9"/><circle cx="62" cy="50" r="4" fill="#ff6600" opacity="0.9"/></svg>` },
  // ===== GLASSES extra (9 more → total 15) =====
  { id:"glasses_star", name:"แว่นดาวน้อยน่ารัก", cat:"glasses", rarity:"common", price:45, icon:"⭐",
    svg:`<svg viewBox="0 0 100 100"><polygon points="30,38 33,45 40,45 35,50 37,57 30,52 23,57 25,50 20,45 27,45" fill="#ffd700"/><polygon points="70,38 73,45 80,45 75,50 77,57 70,52 63,57 65,50 60,45 67,45" fill="#ffd700"/><line x1="40" y1="46" x2="60" y2="46" stroke="#888" stroke-width="3"/></svg>` },
  { id:"glasses_heart", name:"แว่นหัวใจสีชมพู", cat:"glasses", rarity:"common", price:55, icon:"💕",
    svg:`<svg viewBox="0 0 100 100"><path d="M30 48 C30 40, 18 36, 18 45 C18 52, 30 58, 30 58 C30 58, 42 52, 42 45 C42 36, 30 40, 30 48Z" fill="#ff69b4"/><path d="M70 48 C70 40, 58 36, 58 45 C58 52, 70 58, 70 58 C70 58, 82 52, 82 45 C82 36, 70 40, 70 48Z" fill="#ff69b4"/><line x1="42" y1="46" x2="58" y2="46" stroke="#ff69b4" stroke-width="3"/></svg>` },
  { id:"glasses_rainbow", name:"แว่นสายรุ้งจิตใจ", cat:"glasses", rarity:"rare", price:130, icon:"🌈",
    svg:`<svg viewBox="0 0 100 100"><rect x="15" y="40" width="30" height="14" fill="#ff0000" rx="5"/><rect x="55" y="40" width="30" height="14" fill="#0000ff" rx="5"/><rect x="16" y="41" width="28" height="5" fill="#ff8800" rx="3"/><rect x="56" y="41" width="28" height="5" fill="#00bbff" rx="3"/><line x1="45" y1="47" x2="55" y2="47" stroke="#888" stroke-width="3"/></svg>` },
  { id:"mask_gas", name:"หน้ากากแก๊สสงคราม", cat:"glasses", rarity:"rare", price:170, icon:"☣️",
    svg:`<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="32" ry="28" fill="#424242"/><circle cx="35" cy="48" r="10" fill="#1a1a1a" stroke="#616161" stroke-width="2"/><circle cx="65" cy="48" r="10" fill="#1a1a1a" stroke="#616161" stroke-width="2"/><circle cx="35" cy="48" r="5" fill="#00ffff" opacity="0.4"/><circle cx="65" cy="48" r="5" fill="#00ffff" opacity="0.4"/><rect x="42" y="62" width="16" height="8" fill="#333" rx="3"/></svg>` },
  { id:"glasses_vr", name:"แว่น VR อนาคต", cat:"glasses", rarity:"rare", price:210, icon:"🥽",
    svg:`<svg viewBox="0 0 100 100"><rect x="10" y="38" width="80" height="24" fill="#212121" rx="8"/><rect x="15" y="42" width="30" height="16" fill="#1565c0" rx="4" opacity="0.8"/><rect x="55" y="42" width="30" height="16" fill="#1565c0" rx="4" opacity="0.8"/><rect x="10" y="50" width="5" height="3" fill="#424242"/><rect x="85" y="50" width="5" height="3" fill="#424242"/></svg>` },
  { id:"glasses_round_gold", name:"แว่นกลมทองวินเทจ", cat:"glasses", rarity:"common", price:65, icon:"🔮",
    svg:`<svg viewBox="0 0 100 100"><circle cx="30" cy="48" r="14" fill="none" stroke="#ffd700" stroke-width="4"/><circle cx="70" cy="48" r="14" fill="none" stroke="#ffd700" stroke-width="4"/><line x1="44" y1="48" x2="56" y2="48" stroke="#ffd700" stroke-width="3"/><line x1="5" y1="48" x2="16" y2="48" stroke="#ffd700" stroke-width="3"/><line x1="84" y1="48" x2="95" y2="48" stroke="#ffd700" stroke-width="3"/></svg>` },
  { id:"mask_oni", name:"หน้ากากโอนิญี่ปุ่น", cat:"glasses", rarity:"legendary", price:380, icon:"👹",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="25" width="60" height="55" rx="8" fill="#d32f2f"/><rect x="28" y="35" width="16" height="10" fill="#1a1a1a" rx="2"/><rect x="56" y="35" width="16" height="10" fill="#1a1a1a" rx="2"/><polygon points="40,25 50,12 60,25" fill="#ffd700"/><rect x="35" y="60" width="30" height="5" fill="#ffd700"/><rect x="30" y="65" width="10" height="8" fill="#ffd700"/><rect x="60" y="65" width="10" height="8" fill="#ffd700"/></svg>` },
  { id:"glasses_monocle", name:"โมโนเคิลนักสืบ", cat:"glasses", rarity:"rare", price:145, icon:"🧐",
    svg:`<svg viewBox="0 0 100 100"><circle cx="40" cy="48" r="16" fill="none" stroke="#8B6914" stroke-width="4"/><circle cx="40" cy="48" r="10" fill="#a5d8ff" opacity="0.4"/><line x1="56" y1="48" x2="90" y2="55" stroke="#8B6914" stroke-width="3"/></svg>` },
  { id:"glasses_neon_tri", name:"แว่นสามเหลี่ยมนีออน", cat:"glasses", rarity:"legendary", price:420, icon:"🔺",
    svg:`<svg viewBox="0 0 100 100"><polygon points="30,56 15,36 45,36" fill="none" stroke="#00ffff" stroke-width="3"/><polygon points="70,56 55,36 85,36" fill="none" stroke="#ff00ff" stroke-width="3"/><line x1="45" y1="43" x2="55" y2="43" stroke="#fff" stroke-width="2"/><circle cx="30" cy="46" r="3" fill="#00ffff"/><circle cx="70" cy="46" r="3" fill="#ff00ff"/></svg>` },
  // ===== BACK extra (8 more → total 15) =====
  { id:"back_rocket", name:"จรวดติดหลัง", cat:"back", rarity:"rare", price:220, icon:"🚀",
    svg:`<svg viewBox="0 0 100 100"><rect x="42" y="15" width="16" height="55" fill="#90a4ae" rx="6"/><ellipse cx="50" cy="15" rx="8" ry="10" fill="#ef5350"/><path d="M38 65 L30 85 L50 72 Z" fill="#ff7043"/><path d="M62 65 L70 85 L50 72 Z" fill="#ff7043"/><ellipse cx="50" cy="70" rx="6" ry="4" fill="#ff5722"/></svg>` },
  { id:"back_cape", name:"เสื้อคลุมฮีโร่แดง", cat:"back", rarity:"common", price:95, icon:"🦸",
    svg:`<svg viewBox="0 0 100 100"><path d="M25 20 C25 20, 20 80, 50 90 C80 80, 75 20, 75 20 Z" fill="#d32f2f"/><path d="M25 20 L75 20 L85 35 L50 30 L15 35 Z" fill="#b71c1c"/></svg>` },
  { id:"back_jetpack", name:"เจ็ทแพ็คไซเบอร์", cat:"back", rarity:"legendary", price:520, icon:"⚡",
    svg:`<svg viewBox="0 0 100 100"><rect x="28" y="20" width="44" height="55" fill="#455a64" rx="6"/><rect x="34" y="28" width="14" height="20" fill="#00bcd4" rx="3"/><rect x="52" y="28" width="14" height="20" fill="#00bcd4" rx="3"/><ellipse cx="41" cy="75" rx="7" ry="10" fill="#ff5722"/><ellipse cx="59" cy="75" rx="7" ry="10" fill="#ff5722"/><rect x="20" y="30" width="8" height="30" fill="#546e7a" rx="3"/><rect x="72" y="30" width="8" height="30" fill="#546e7a" rx="3"/></svg>` },
  { id:"back_fairy_wings", name:"ปีกนางฟ้าคริสตัล", cat:"back", rarity:"legendary", price:580, icon:"🧚",
    svg:`<svg viewBox="0 0 100 100"><path d="M50 50 C35 30, 8 20, 5 40 C2 60, 25 65, 50 50 Z" fill="#e1f5fe" stroke="#4fc3f7" stroke-width="2" opacity="0.9"/><path d="M50 50 C65 30, 92 20, 95 40 C98 60, 75 65, 50 50 Z" fill="#e1f5fe" stroke="#4fc3f7" stroke-width="2" opacity="0.9"/><path d="M50 50 C38 60, 12 75, 15 88 C20 98, 40 85, 50 50 Z" fill="#b3e5fc" stroke="#4fc3f7" stroke-width="1.5" opacity="0.8"/><path d="M50 50 C62 60, 88 75, 85 88 C80 98, 60 85, 50 50 Z" fill="#b3e5fc" stroke="#4fc3f7" stroke-width="1.5" opacity="0.8"/></svg>` },
  { id:"back_samurai_sword", name:"ดาบคาตานะซามูไร", cat:"back", rarity:"rare", price:270, icon:"🗡️",
    svg:`<svg viewBox="0 0 100 100"><rect x="47" y="5" width="6" height="70" fill="#e0e0e0" rx="2" transform="rotate(15 50 50)"/><rect x="46" y="75" width="8" height="18" fill="#8B4513" rx="2" transform="rotate(15 50 50)"/><rect x="38" y="68" width="24" height="5" fill="#ffd700" rx="1" transform="rotate(15 50 50)"/></svg>` },
  { id:"back_halo", name:"วงแหวนนักบุญ", cat:"back", rarity:"rare", price:240, icon:"😇",
    svg:`<svg viewBox="0 0 100 100"><ellipse cx="50" cy="30" rx="25" ry="8" fill="none" stroke="#ffd700" stroke-width="6" opacity="0.9" filter="url(#glow)"/><ellipse cx="50" cy="30" rx="25" ry="8" fill="none" stroke="#fff8dc" stroke-width="3"/></svg>` },
  { id:"back_treasure_chest", name:"หีบสมบัติอัศวิน", cat:"back", rarity:"rare", price:200, icon:"📦",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="40" width="60" height="40" fill="#8d6e63" rx="4" stroke="#5d4037" stroke-width="3"/><path d="M20 50 Q50 35 80 50" fill="#6d4c41" stroke="#5d4037" stroke-width="2"/><rect x="20" y="40" width="60" height="14" fill="#6d4c41" rx="4"/><rect x="43" y="55" width="14" height="10" fill="#ffd700" rx="2"/><circle cx="50" cy="60" r="3" fill="#ff6600"/></svg>` },
  { id:"back_dragon_tail", name:"หางมังกรโบราณ", cat:"back", rarity:"legendary", price:650, icon:"🐉",
    svg:`<svg viewBox="0 0 100 100"><path d="M50 20 C50 20, 55 35, 65 45 C75 55, 85 60, 90 75 C95 88, 80 95, 70 85 C60 75, 65 60, 55 50 C45 40, 40 30, 50 20 Z" fill="#c62828" stroke="#b71c1c" stroke-width="2"/><circle cx="88" cy="78" r="5" fill="#ff6600"/><circle cx="72" cy="87" r="4" fill="#ffd700"/></svg>` },
  // ===== SHIRTS extra (10 more → total 15) =====
  { id:"shirt_rainbow", name:"เสื้อสายรุ้งจิตใจ", cat:"shirt", rarity:"common", price:75, torsoColor:"#e91e63",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#fff" rx="6"/><rect x="20" y="30" width="60" height="8" fill="#ff0000"/><rect x="20" y="38" width="60" height="8" fill="#ff8800"/><rect x="20" y="46" width="60" height="8" fill="#ffff00"/><rect x="20" y="54" width="60" height="8" fill="#00cc00"/><rect x="20" y="62" width="60" height="8" fill="#0066ff"/><rect x="20" y="70" width="60" height="10" fill="#8800ff"/></svg>` },
  { id:"shirt_anchor", name:"เสื้อลายสมอเรือ", cat:"shirt", rarity:"common", price:65, torsoColor:"#1565c0",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#1565c0" rx="6"/><circle cx="50" cy="50" r="8" fill="none" stroke="#fff" stroke-width="3"/><line x1="50" y1="42" x2="50" y2="30" stroke="#fff" stroke-width="3"/><path d="M38 60 C38 65, 50 68, 62 60" fill="none" stroke="#fff" stroke-width="3"/></svg>` },
  { id:"shirt_pixel_art", name:"เสื้อลายพิกเซลอาร์ต", cat:"shirt", rarity:"rare", price:195, torsoColor:"#212121",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#212121" rx="6"/><rect x="25" y="35" width="8" height="8" fill="#ff0000"/><rect x="40" y="35" width="8" height="8" fill="#00ff00"/><rect x="55" y="35" width="8" height="8" fill="#0000ff"/><rect x="70" y="35" width="8" height="8" fill="#ffd700"/><rect x="32" y="50" width="8" height="8" fill="#ff00ff"/><rect x="48" y="50" width="8" height="8" fill="#00ffff"/><rect x="63" y="50" width="8" height="8" fill="#ff8800"/><rect x="25" y="65" width="50" height="6" fill="#333"/></svg>` },
  { id:"shirt_tropical", name:"เสื้อฮาวายดอกไม้", cat:"shirt", rarity:"common", price:70, torsoColor:"#00897b",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#00897b" rx="6"/><circle cx="35" cy="50" r="6" fill="#ffd700"/><circle cx="65" cy="50" r="6" fill="#ff5722"/><circle cx="50" cy="65" r="6" fill="#ff69b4"/><circle cx="30" cy="68" r="4" fill="#ff8800"/><circle cx="70" cy="68" r="4" fill="#00e676"/></svg>` },
  { id:"shirt_sport", name:"เสื้อกีฬาแชมป์", cat:"shirt", rarity:"rare", price:150, torsoColor:"#1565c0",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#1565c0" rx="6"/><path d="M20 30 L50 50 L80 30" fill="#1976d2"/><rect x="43" y="52" width="14" height="20" fill="#fff" rx="2"/><rect x="25" y="40" width="8" height="5" fill="#fff"/><rect x="67" y="40" width="8" height="5" fill="#fff"/></svg>` },
  { id:"shirt_tuxedo", name:"เสื้อสูทสุภาพบุรุษ", cat:"shirt", rarity:"rare", price:230, torsoColor:"#1a1a1a",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#1a1a1a" rx="4"/><path d="M40 30 L50 55 L45 80" fill="#fff" stroke="#ccc" stroke-width="1"/><path d="M60 30 L50 55 L55 80" fill="#fff" stroke="#ccc" stroke-width="1"/><rect x="48" y="45" width="4" height="4" fill="#d32f2f" rx="1"/><rect x="48" y="55" width="4" height="4" fill="#d32f2f" rx="1"/></svg>` },
  { id:"shirt_lava", name:"เสื้อลาวาระเบิด", cat:"shirt", rarity:"legendary", price:470, torsoColor:"#3e0000",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#3e0000" rx="6"/><path d="M20 80 C30 60, 40 70, 50 55 C60 40, 70 65, 80 80 Z" fill="#ff5722" opacity="0.8"/><path d="M25 80 C35 65, 45 72, 50 60 C55 48, 65 68, 75 80 Z" fill="#ffd700" opacity="0.6"/></svg>` },
  { id:"shirt_ghost", name:"เสื้อผีน่ารัก", cat:"shirt", rarity:"common", price:80, torsoColor:"#b0bec5",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#b0bec5" rx="6"/><path d="M32 65 Q38 72, 44 65 Q50 58, 56 65 Q62 72, 68 65 L68 80 L32 80 Z" fill="#eceff1"/><circle cx="43" cy="52" r="4" fill="#fff"/><circle cx="57" cy="52" r="4" fill="#fff"/><circle cx="43" cy="52" r="2" fill="#1a1a1a"/><circle cx="57" cy="52" r="2" fill="#1a1a1a"/></svg>` },
  { id:"shirt_knight", name:"เสื้อเกราะอัศวิน", cat:"shirt", rarity:"legendary", price:500, torsoColor:"#546e7a",
    svg:`<svg viewBox="0 0 100 100"><rect x="22" y="30" width="56" height="50" fill="#546e7a" rx="4" stroke="#37474f" stroke-width="3"/><rect x="30" y="38" width="40" height="8" fill="#ffd700" rx="2"/><rect x="35" y="52" width="30" height="5" fill="#90a4ae"/><rect x="35" y="62" width="30" height="5" fill="#90a4ae"/><circle cx="50" cy="45" r="5" fill="#d32f2f"/></svg>` },
  { id:"shirt_pastel", name:"เสื้อพาสเทลหวานๆ", cat:"shirt", rarity:"common", price:60, torsoColor:"#f8bbd0",
    svg:`<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" fill="#f8bbd0" rx="8"/><circle cx="35" cy="55" r="5" fill="#ce93d8" opacity="0.7"/><circle cx="50" cy="45" r="4" fill="#80deea" opacity="0.7"/><circle cx="65" cy="58" r="6" fill="#ffe082" opacity="0.7"/><path d="M30 72 Q50 65 70 72" stroke="#f48fb1" stroke-width="3" fill="none"/></svg>` },
  // ===== PANTS extra (10 more → total 15) =====
  { id:"pants_royal_blue", name:"กางเกงราชาน้ำเงิน", cat:"pants", rarity:"common", price:60, legsColor:"#1565c0",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#1565c0" rx="5"/><rect x="25" y="10" width="50" height="6" fill="#ffd700"/><line x1="50" y1="16" x2="50" y2="90" stroke="#1976d2" stroke-width="3"/></svg>` },
  { id:"pants_denim", name:"กางเกงยีนส์ขาดเดิม", cat:"pants", rarity:"common", price:55, legsColor:"#1565c0",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#1565c0" rx="5"/><rect x="28" y="25" width="18" height="10" fill="none" stroke="#90caf9" stroke-width="2" rx="1"/><rect x="54" y="25" width="18" height="10" fill="none" stroke="#90caf9" stroke-width="2" rx="1"/><line x1="50" y1="10" x2="50" y2="90" stroke="#0d47a1" stroke-width="4"/></svg>` },
  { id:"pants_rainbow_stripe", name:"กางเกงลายทางสีรุ้ง", cat:"pants", rarity:"rare", price:155, legsColor:"#fff",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="14" fill="#ff0000" rx="3"/><rect x="25" y="24" width="50" height="14" fill="#ff8800"/><rect x="25" y="38" width="50" height="14" fill="#ffff00"/><rect x="25" y="52" width="50" height="14" fill="#00cc00"/><rect x="25" y="66" width="50" height="14" fill="#0000ff" rx="3"/></svg>` },
  { id:"pants_armored", name:"กางเกงเกราะเหล็ก", cat:"pants", rarity:"rare", price:190, legsColor:"#455a64",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#455a64" rx="5" stroke="#37474f" stroke-width="2"/><rect x="27" y="20" width="20" height="12" fill="#546e7a" rx="2"/><rect x="53" y="20" width="20" height="12" fill="#546e7a" rx="2"/><rect x="27" y="38" width="20" height="12" fill="#546e7a" rx="2"/><rect x="53" y="38" width="20" height="12" fill="#546e7a" rx="2"/></svg>` },
  { id:"pants_wizard", name:"กางเกงแม่มดดาว", cat:"pants", rarity:"rare", price:175, legsColor:"#4a148c",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#4a148c" rx="5"/><circle cx="35" cy="30" r="4" fill="#ffd700"/><circle cx="65" cy="25" r="3" fill="#e040fb"/><circle cx="50" cy="50" r="5" fill="#ffd700"/><circle cx="38" cy="65" r="3" fill="#00ffff"/><circle cx="62" cy="70" r="4" fill="#ff69b4"/></svg>` },
  { id:"pants_lava", name:"กางเกงลาวานรก", cat:"pants", rarity:"legendary", price:490, legsColor:"#bf360c",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#bf360c" rx="5"/><path d="M25 90 C35 70, 45 78, 50 60 C55 42, 65 72, 75 90 Z" fill="#ff5722" opacity="0.7"/><path d="M30 90 C38 75, 48 80, 50 65 C52 50, 62 76, 70 90 Z" fill="#ffd700" opacity="0.5"/></svg>` },
  { id:"pants_ice", name:"กางเกงน้ำแข็งน้ำเย็น", cat:"pants", rarity:"rare", price:180, legsColor:"#e1f5fe",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#e1f5fe" rx="5" stroke="#b3e5fc" stroke-width="2"/><path d="M25 30 L75 30" stroke="#4fc3f7" stroke-width="2"/><path d="M25 50 L75 50" stroke="#4fc3f7" stroke-width="2"/><path d="M25 70 L75 70" stroke="#4fc3f7" stroke-width="2"/><circle cx="35" cy="40" r="3" fill="#4fc3f7"/><circle cx="65" cy="60" r="3" fill="#4fc3f7"/></svg>` },
  { id:"pants_choco", name:"กางเกงช็อกโกแลต", cat:"pants", rarity:"common", price:65, legsColor:"#4e342e",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#4e342e" rx="5"/><rect x="28" y="15" width="20" height="12" fill="#6d4c41" rx="2" stroke="#3e2723" stroke-width="1"/><rect x="52" y="15" width="20" height="12" fill="#6d4c41" rx="2" stroke="#3e2723" stroke-width="1"/><rect x="28" y="33" width="20" height="12" fill="#6d4c41" rx="2" stroke="#3e2723" stroke-width="1"/><rect x="52" y="33" width="20" height="12" fill="#6d4c41" rx="2" stroke="#3e2723" stroke-width="1"/></svg>` },
  { id:"pants_galaxy2", name:"กางเกงกาแลคซี่ลึก", cat:"pants", rarity:"legendary", price:520, legsColor:"#0a0a2e",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#0a0a2e" rx="5"/><circle cx="35" cy="30" r="2" fill="#fff"/><circle cx="55" cy="25" r="1.5" fill="#fff"/><circle cx="70" cy="40" r="2" fill="#fff"/><circle cx="40" cy="55" r="1.5" fill="#ffd700"/><circle cx="65" cy="60" r="2" fill="#ffd700"/><circle cx="32" cy="70" r="1.5" fill="#00ffff"/><circle cx="68" cy="75" r="2" fill="#ff00ff"/></svg>` },
  { id:"pants_flower", name:"กางเกงลายดอกไม้", cat:"pants", rarity:"common", price:70, legsColor:"#f8bbd0",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" fill="#f8bbd0" rx="5"/><circle cx="38" cy="35" r="6" fill="#ff69b4"/><circle cx="62" cy="30" r="5" fill="#ff69b4"/><circle cx="42" cy="60" r="5" fill="#ce93d8"/><circle cx="65" cy="58" r="6" fill="#ff69b4"/><circle cx="35" cy="75" r="4" fill="#ce93d8"/></svg>` },
  // ===== PETS extra (9 more → total 15) =====
  { id:"pet_rabbit", name:"กระต่ายจัมปี้", cat:"pet", rarity:"common", price:210, icon:"🐰",
    svg:`<svg viewBox="0 0 100 100"><rect x="25" y="35" width="50" height="45" fill="#fff" rx="10" stroke="#eee" stroke-width="2"/><rect x="30" y="10" width="12" height="30" fill="#fff" rx="5" stroke="#eee" stroke-width="2"/><rect x="33" y="12" width="6" height="22" fill="#ffcdd2"/><rect x="58" y="10" width="12" height="30" fill="#fff" rx="5" stroke="#eee" stroke-width="2"/><rect x="61" y="12" width="6" height="22" fill="#ffcdd2"/><circle cx="38" cy="55" r="5" fill="#000"/><circle cx="62" cy="55" r="5" fill="#000"/><ellipse cx="50" cy="65" rx="8" ry="5" fill="#ffcdd2"/></svg>` },
  { id:"pet_fox", name:"จิ้งจอกสีส้ม", cat:"pet", rarity:"common", price:230, icon:"🦊",
    svg:`<svg viewBox="0 0 100 100"><rect x="22" y="30" width="56" height="50" fill="#ff7043" rx="8"/><polygon points="25,30 10,5 35,25" fill="#ff7043"/><polygon points="75,30 90,5 65,25" fill="#ff7043"/><polygon points="25,30 15,10 33,27" fill="#fff"/><polygon points="75,30 85,10 67,27" fill="#fff"/><circle cx="36" cy="50" r="6" fill="#1a1a1a"/><circle cx="64" cy="50" r="6" fill="#1a1a1a"/><ellipse cx="50" cy="63" rx="10" ry="6" fill="#fff"/></svg>` },
  { id:"pet_owl", name:"นกฮูกปราชญ์", cat:"pet", rarity:"rare", price:280, icon:"🦉",
    svg:`<svg viewBox="0 0 100 100"><ellipse cx="50" cy="58" rx="24" ry="28" fill="#795548"/><ellipse cx="38" cy="48" rx="10" ry="12" fill="#a1887f"/><ellipse cx="62" cy="48" rx="10" ry="12" fill="#a1887f"/><circle cx="38" cy="48" r="7" fill="#ffd700"/><circle cx="62" cy="48" r="7" fill="#ffd700"/><circle cx="38" cy="48" r="3.5" fill="#1a1a1a"/><circle cx="62" cy="48" r="3.5" fill="#1a1a1a"/><polygon points="45,58 50,52 55,58" fill="#ff8f00"/><polygon points="42,32 50,22 58,32" fill="#795548"/></svg>` },
  { id:"pet_bee", name:"ผึ้งน้อยฮัมเพลง", cat:"pet", rarity:"common", price:190, icon:"🐝",
    svg:`<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="20" ry="25" fill="#fdd835"/><rect x="30" y="45" width="40" height="8" fill="#1a1a1a" rx="2"/><rect x="30" y="58" width="40" height="8" fill="#1a1a1a" rx="2"/><ellipse cx="35" cy="40" rx="10" ry="6" fill="#e1f5fe" opacity="0.7" transform="rotate(-30 35 40)"/><ellipse cx="65" cy="40" rx="10" ry="6" fill="#e1f5fe" opacity="0.7" transform="rotate(30 65 40)"/><circle cx="42" cy="65" r="4" fill="#1a1a1a"/><circle cx="58" cy="65" r="4" fill="#1a1a1a"/></svg>` },
  { id:"pet_panda", name:"แพนด้าซ่า", cat:"pet", rarity:"rare", price:310, icon:"🐼",
    svg:`<svg viewBox="0 0 100 100"><circle cx="50" cy="55" r="28" fill="#fff" stroke="#eee" stroke-width="2"/><circle cx="33" cy="38" r="10" fill="#1a1a1a"/><circle cx="67" cy="38" r="10" fill="#1a1a1a"/><circle cx="38" cy="55" r="7" fill="#1a1a1a"/><circle cx="62" cy="55" r="7" fill="#1a1a1a"/><circle cx="38" cy="55" r="3" fill="#fff"/><circle cx="62" cy="55" r="3" fill="#fff"/><ellipse cx="50" cy="67" rx="8" ry="5" fill="#ffcdd2"/></svg>` },
  { id:"pet_phoenix", name:"ฟีนิกซ์ไฟนิรันดร์", cat:"pet", rarity:"legendary", price:950, icon:"🔥",
    svg:`<svg viewBox="0 0 100 100"><path d="M50 20 C45 30, 30 35, 25 50 C20 65, 30 80, 50 80 C70 80, 80 65, 75 50 C70 35, 55 30, 50 20 Z" fill="#ff6f00"/><path d="M50 20 C47 32, 35 38, 32 53 C30 65, 38 75, 50 75" fill="#ffd600" opacity="0.7"/><path d="M25 50 C15 40, 10 28, 20 22 C30 16, 40 28, 38 40" fill="#ff3d00" opacity="0.8"/><path d="M75 50 C85 40, 90 28, 80 22 C70 16, 60 28, 62 40" fill="#ff3d00" opacity="0.8"/><circle cx="50" cy="52" r="5" fill="#fff8e1"/></svg>` },
  { id:"pet_turtle", name:"เต่าน้ำมนต์", cat:"pet", rarity:"common", price:175, icon:"🐢",
    svg:`<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="28" ry="22" fill="#388e3c"/><ellipse cx="50" cy="50" rx="22" ry="16" fill="#4caf50"/><rect x="30" y="64" width="10" height="10" fill="#388e3c" rx="3"/><rect x="60" y="64" width="10" height="10" fill="#388e3c" rx="3"/><rect x="36" y="64" width="8" height="8" fill="#388e3c" rx="2"/><rect x="56" y="64" width="8" height="8" fill="#388e3c" rx="2"/><ellipse cx="50" cy="38" rx="9" ry="8" fill="#388e3c"/><circle cx="46" cy="37" r="2" fill="#1a1a1a"/><circle cx="54" cy="37" r="2" fill="#1a1a1a"/></svg>` },
  { id:"pet_robot", name:"หุ่นยนต์ผู้ช่วย", cat:"pet", rarity:"rare", price:340, icon:"🤖",
    svg:`<svg viewBox="0 0 100 100"><rect x="28" y="30" width="44" height="50" fill="#455a64" rx="6" stroke="#37474f" stroke-width="2"/><rect x="38" y="20" width="24" height="15" fill="#546e7a" rx="4"/><circle cx="50" cy="27" r="3" fill="#00bcd4"/><rect x="33" y="40" width="12" height="10" fill="#00bcd4" rx="2"/><rect x="55" y="40" width="12" height="10" fill="#ff5722" rx="2"/><rect x="38" y="58" width="24" height="4" fill="#78909c" rx="1"/><rect x="22" y="45" width="6" height="20" fill="#546e7a" rx="3"/><rect x="72" y="45" width="6" height="20" fill="#546e7a" rx="3"/></svg>` },
  { id:"pet_mushroom", name:"เห็ดวิเศษแห่งนิรันดร์", cat:"pet", rarity:"legendary", price:880, icon:"🍄",
    svg:`<svg viewBox="0 0 100 100"><path d="M50 20 C25 20, 10 45, 15 60 C20 72, 35 75, 50 75 C65 75, 80 72, 85 60 C90 45, 75 20, 50 20 Z" fill="#d32f2f"/><ellipse cx="50" cy="75" rx="20" ry="8" fill="#ffcdd2"/><rect x="43" y="68" width="14" height="18" fill="#f5f5f5" rx="3"/><circle cx="38" cy="42" r="6" fill="#fff" opacity="0.9"/><circle cx="62" cy="38" r="5" fill="#fff" opacity="0.9"/><circle cx="52" cy="55" r="4" fill="#fff" opacity="0.9"/></svg>` }
];

function updateAvatarEquipment() {
  // Rebuild sidebar 3D avatar to reflect new equipment
  refreshSidebarAvatar();
}

// ==========================================================================
// SHARED ARENA INPUT CONTROLLER (PC + Mobile — all 3 arena modes)
// ==========================================================================
let bossController = null, chillController = null, dressController = null;

// Per-mode mutable camera state
const bossCamState  = { yaw: 0, dist: 13, minD: 6, maxD: 22 };
const chillCamState = { yaw: 0, dist: 13, minD: 6, maxD: 22 };
const dressCamState = { yaw: 0, dist: 10, minD: 5, maxD: 18 };

/**
 * createArenaController — universal cross-platform input handler
 * PC:     WASD move | right-click drag = camera | scroll = zoom | Space = jump
 * Mobile: Virtual Joystick | Touch drag (outside joy) = camera | Pinch = zoom | UI button = jump
 * Distinguishes joystick touch from camera drag by start-zone detection
 */
function createArenaController({ canvas, keys, camState, onJump, container, joystickId, jumpBtnId }) {
  // --- PC ---
  let pcDrag = false, pcLastX = 0;
  const _ctx  = e => e.preventDefault();
  const _mdn  = e => { if (e.button === 2) { pcDrag = true; pcLastX = e.clientX; } };
  const _mmv  = e => { if (pcDrag) { camState.yaw += (e.clientX - pcLastX) * 0.007; pcLastX = e.clientX; } };
  const _mup  = e => { if (e.button === 2) pcDrag = false; };
  const _whl  = e => {
    camState.dist = Math.max(camState.minD, Math.min(camState.maxD, camState.dist + e.deltaY * 0.02));
    e.preventDefault();
  };
  const _kdn  = e => {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (e.code === 'Space' && onJump) { onJump(); e.preventDefault(); }
    if ([' ','w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  };
  const _kup  = e => { keys[e.key.toLowerCase()] = false; };

  if (canvas) {
    canvas.addEventListener('contextmenu', _ctx);
    canvas.addEventListener('mousedown', _mdn);
    canvas.addEventListener('wheel', _whl, { passive: false });
  }
  window.addEventListener('mousemove', _mmv);
  window.addEventListener('mouseup', _mup);
  window.addEventListener('keydown', _kdn);
  window.addEventListener('keyup', _kup);

  // --- Mobile/Touch ---
  let joyId = null, camTId = null;
  let joyCX = 0, joyCY = 0, camLastTX = 0, pinchD = 0;

  const inJoystick = (x, y) => {
    const el = joystickId ? document.getElementById(joystickId) : null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return Math.sqrt((x - r.left - r.width/2)**2 + (y - r.top - r.height/2)**2) < r.width/2 + 32;
  };
  const isUIBtn = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && (el.tagName === 'BUTTON' || !!el.closest('button'));
  };

  const _ts = e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (isUIBtn(t.clientX, t.clientY)) continue;
      if (joyId === null && inJoystick(t.clientX, t.clientY)) {
        joyId = t.identifier;
        const el = joystickId ? document.getElementById(joystickId) : null;
        if (el) { const r=el.getBoundingClientRect(); joyCX=r.left+r.width/2; joyCY=r.top+r.height/2; }
      } else if (camTId === null) {
        camTId = t.identifier; camLastTX = t.clientX;
      }
    }
    if (e.touches.length === 2) {
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      pinchD = Math.sqrt(dx*dx+dy*dy);
    }
  };
  const _tm = e => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchD > 0) {
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      const d=Math.sqrt(dx*dx+dy*dy);
      camState.dist = Math.max(camState.minD, Math.min(camState.maxD, camState.dist*(pinchD/d)));
      pinchD=d; return;
    }
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const maxR=42, dx=t.clientX-joyCX, dy=t.clientY-joyCY;
        const dist=Math.sqrt(dx*dx+dy*dy), s=dist>maxR?maxR/dist:1;
        const knob = joystickId ? document.getElementById(joystickId+'-knob') : null;
        if (knob) knob.style.transform=`translate(calc(-50% + ${dx*s}px),calc(-50% + ${dy*s}px))`;
        const nx=dx*s/maxR, ny=dy*s/maxR;
        keys['a']=nx<-0.22; keys['d']=nx>0.22; keys['w']=ny<-0.22; keys['s']=ny>0.22;
      } else if (t.identifier === camTId) {
        camState.yaw += (t.clientX - camLastTX) * 0.008;
        camLastTX = t.clientX;
      }
    }
  };
  const _te = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null;
        const knob = joystickId ? document.getElementById(joystickId+'-knob') : null;
        if (knob) knob.style.transform='translate(-50%,-50%)';
        keys['a']=keys['d']=keys['w']=keys['s']=false;
      }
      if (t.identifier === camTId) camTId = null;
    }
  };

  if (canvas) {
    canvas.addEventListener('touchstart', _ts, { passive: false });
    canvas.addEventListener('touchmove',  _tm, { passive: false });
    canvas.addEventListener('touchend',   _te, { passive: false });
    canvas.addEventListener('touchcancel',_te, { passive: false });
  }

  // Build mobile overlay if container provided and joystick doesn't exist yet
  if (container && joystickId && !document.getElementById(joystickId)) {
    const ov = document.createElement('div');
    ov.className = 'arena-mobile-ctrl sd-overlay-el';
    ov.style.cssText = 'position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-end;padding:10px 14px;pointer-events:none;z-index:50;';
    ov.innerHTML = `
      <div id="${joystickId}" class="sd-joystick-zone" style="pointer-events:all">
        <div id="${joystickId}-knob" class="sd-joystick-knob"></div>
      </div>
      ${jumpBtnId
        ? `<button id="${jumpBtnId}" class="sd-jump-btn" style="pointer-events:all">⬆<br>กระโดด</button>`
        : '<div style="width:68px"></div>'}
    `;
    container.appendChild(ov);
    if (jumpBtnId && onJump) {
      setTimeout(() => {
        const jb = document.getElementById(jumpBtnId);
        if (jb) {
          jb.addEventListener('touchstart', e => { e.stopPropagation(); onJump(); unlockIOSAudio(); }, { passive: true });
          jb.addEventListener('mousedown',  e => { e.stopPropagation(); onJump(); });
        }
      }, 80);
    }
  }

  return {
    destroy() {
      if (canvas) {
        canvas.removeEventListener('contextmenu', _ctx);
        canvas.removeEventListener('mousedown', _mdn);
        canvas.removeEventListener('wheel', _whl);
        canvas.removeEventListener('touchstart', _ts);
        canvas.removeEventListener('touchmove', _tm);
        canvas.removeEventListener('touchend', _te);
        canvas.removeEventListener('touchcancel', _te);
      }
      window.removeEventListener('mousemove', _mmv);
      window.removeEventListener('mouseup', _mup);
      window.removeEventListener('keydown', _kdn);
      window.removeEventListener('keyup', _kup);
    }
  };
}

// ==========================================================================
// 0. Fullscreen Gameplay Manager
// ==========================================================================
function enterFullscreenGameplay(subscreenId) {
  const el = document.getElementById(subscreenId);
  if (el) {
    el.classList.add('gameplay-fullscreen-mode');
    const exitBtn = document.getElementById('btn-exit-fullscreen-fixed');
    if (exitBtn) exitBtn.classList.add('visible');
  }
}

function exitFullscreenGameplay() {
  document.querySelectorAll('.gameplay-fullscreen-mode').forEach(el => el.classList.remove('gameplay-fullscreen-mode'));
  document.querySelectorAll('.training-ios-fullscreen').forEach(el => el.classList.remove('training-ios-fullscreen'));
  document.body.classList.remove('training-body-lock');
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e) {}
  try { if (screen.orientation?.unlock) screen.orientation.unlock(); } catch(e) {}
  const exitBtn = document.getElementById('btn-exit-fullscreen-fixed');
  if (exitBtn) exitBtn.classList.remove('visible');
}

// ==========================================================================
// 0b. Success Overlay (shown after completion animation)
// ==========================================================================
function showSuccessOverlay3D(viewportContainerId, title, subtitle, onConfirm) {
  const vp = document.getElementById(viewportContainerId);
  const container = vp ? vp.parentElement : null;
  if (!container) { onConfirm(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'success-overlay-3d';
  overlay.id = 'current-success-overlay';
  overlay.innerHTML = `
    <div class="success-modal-3d">
      <div class="success-icon-big">🎉</div>
      <h2>${title}</h2>
      <p>${subtitle}</p>
      <div class="success-details-box" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 16px;margin:6px 0;text-align:left;font-size:0.85rem;color:var(--rbx-text-muted);line-height:1.8;">
        <div>📚 แม่สูตรคูณ: <strong style="color:#fff">แม่ ${selectedArenaTable || '?'}</strong></div>
        <div>✅ ตอบถูก: <strong style="color:var(--rbx-neon-green)">${bossQuestionsCorrect || scoreRobuxEarned/10 || '?'} ข้อ</strong></div>
        <div>💰 รางวัล: <strong style="color:var(--rbx-yellow)">R$ ${scoreRobuxEarned || 0}</strong></div>
        <div>❤️ HP เหลือ: <strong style="color:#ff6666">${playerHP || 0}%</strong></div>
      </div>
      <button class="btn-success-confirm" id="btn-success-ok">✅ ยืนยันและรับรางวัล!</button>
    </div>
  `;
  container.style.position = 'relative';
  container.appendChild(overlay);

  setTimeout(() => {
    document.getElementById('btn-success-ok')?.addEventListener('click', () => {
      overlay.remove();
      exitFullscreenGameplay();
      onConfirm();
    });
  }, 100);
}

function removeSuccessOverlay() {
  document.getElementById('current-success-overlay')?.remove();
}

// ==========================================================================
// 0c. Aura Milestone Banner
// ==========================================================================
function showMilestoneBanner(text) {
  const container = document.getElementById('dressup-3d-viewport')?.parentElement;
  if (!container) return;
  const banner = document.createElement('div');
  banner.className = 'aura-milestone-banner';
  banner.innerHTML = text;
  container.appendChild(banner);
  setTimeout(() => banner.remove(), 2500);
}

// ==========================================================================
// 4a. Shared Avatar Accessory Builder Functions
// ==========================================================================

function buildHair3D(head, gender) {
  if (gender === 'female') {
    const mat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.2, 0.82), mat);
    top.position.set(0, 0.4, -0.02); head.add(top);
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.17, 0.22), mat);
    bangs.position.set(0, 0.19, 0.41); head.add(bangs);
    const longBack = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.05, 0.19), mat);
    longBack.position.set(0, -0.22, -0.51); head.add(longBack);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.82, 0.65), mat);
    sideL.position.set(-0.5, -0.1, -0.05); head.add(sideL);
    const sideR = sideL.clone(); sideR.position.x = 0.5; head.add(sideR);
  } else {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.85 });
    const main = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.3, 0.84), mat);
    main.position.set(0, 0.38, -0.02); head.add(main);
    const sp1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.27, 0.21), mat);
    sp1.position.set(-0.22, 0.44, 0.3); sp1.rotation.x = -0.4; head.add(sp1);
    const sp2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.31, 0.2), mat);
    sp2.position.set(0.22, 0.46, 0.25); sp2.rotation.x = -0.3; head.add(sp2);
    const sp3 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.18), mat);
    sp3.position.set(0, 0.48, 0.28); sp3.rotation.x = -0.35; head.add(sp3);
    const sL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.54, 0.74), mat);
    sL.position.set(-0.49, 0.08, 0); head.add(sL);
    const sR = sL.clone(); sR.position.x = 0.49; head.add(sR);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.48, 0.19), mat);
    back.position.set(0, 0.1, -0.51); head.add(back);
  }
}

function buildHatOn3D(hatId, head) {
  const g = new THREE.Group();
  g.position.set(0, 0.45, 0);
  switch(hatId) {
    case 'hat_cap': {
      const r = new THREE.MeshStandardMaterial({color:0xd82626,roughness:0.6});
      const b = new THREE.MeshStandardMaterial({color:0x111111});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.87,0.32,0.87),r));
      const bill=new THREE.Mesh(new THREE.BoxGeometry(0.82,0.06,0.42),b);
      bill.position.set(0,-0.12,0.52);g.add(bill);break;
    }
    case 'hat_bunny': {
      const w=new THREE.MeshStandardMaterial({color:0xffffff});
      const p=new THREE.MeshStandardMaterial({color:0xffccd5});
      const eL=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.62,0.18),w);eL.position.set(-0.24,0.38,0);g.add(eL);
      const iL=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.44,0.08),p);iL.position.set(-0.24,0.38,0.06);g.add(iL);
      const eR=eL.clone();eR.position.x=0.24;g.add(eR);const iR=iL.clone();iR.position.x=0.24;g.add(iR);break;
    }
    case 'hat_chef': {
      const w=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.88,0.15,0.88),w));
      const top=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.55,0.72),w);top.position.y=0.35;g.add(top);break;
    }
    case 'hat_pirate': {
      const bl=new THREE.MeshStandardMaterial({color:0x111111,roughness:0.7});
      const w=new THREE.MeshStandardMaterial({color:0xffffff});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1,0.1,1.1),bl));
      const top=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.42,0.72),bl);top.position.y=0.26;g.add(top);
      const skull=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.18,0.05),w);skull.position.set(0,0.26,0.38);g.add(skull);break;
    }
    case 'hat_knight': {
      const s=new THREE.MeshStandardMaterial({color:0x8d9db6,roughness:0.3,metalness:0.7});
      const d=new THREE.MeshStandardMaterial({color:0x333333});
      const helm=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.5,0.92),s);helm.position.y=0.1;g.add(helm);
      const visor=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.08,0.1),d);visor.position.set(0,0.08,0.47);g.add(visor);break;
    }
    case 'hat_crown': {
      const gold=new THREE.MeshStandardMaterial({color:0xffd700,roughness:0.2,metalness:0.9});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.92,0.2,0.92),gold));
      [[0.34,0.3,0],[- 0.34,0.3,0],[0,0.3,0.34],[0,0.3,-0.34]].forEach(([x,y,z])=>{
        const pk=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.3,0.24),gold);pk.position.set(x,y,z);g.add(pk);
      });break;
    }
    case 'hat_wizard': {
      const pu=new THREE.MeshStandardMaterial({color:0x6a1b9a,roughness:0.7});
      const go=new THREE.MeshStandardMaterial({color:0xffd700});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.0,0.1,1.0),pu));
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.65,0.4,0.65),pu);m.position.y=0.25;g.add(m);
      const u=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.4,0.42),pu);u.position.y=0.6;g.add(u);
      const t=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.3,0.22),pu);t.position.y=0.9;g.add(t);
      const st=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.06),go);st.position.set(0,0.3,0.36);g.add(st);break;
    }
    case 'hat_samurai': {
      const gr=new THREE.MeshStandardMaterial({color:0x607d8b,roughness:0.4,metalness:0.6});
      const go=new THREE.MeshStandardMaterial({color:0xffd700,roughness:0.3,metalness:0.8});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.05,0.12,1.05),gr));
      const d=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.35,0.72),gr);d.position.y=0.24;g.add(d);
      const tr=new THREE.Mesh(new THREE.BoxGeometry(0.88,0.06,0.88),go);tr.position.y=0.18;g.add(tr);break;
    }
    case 'hat_cowboy': {
      const br=new THREE.MeshStandardMaterial({color:0xd2691e,roughness:0.8});
      const db=new THREE.MeshStandardMaterial({color:0x8b4513,roughness:0.8});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.15,0.1,1.15),br));
      const d=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.45,0.7),br);d.position.y=0.28;g.add(d);
      const bd=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.08,0.72),db);bd.position.y=0.08;g.add(bd);break;
    }
    case 'hat_cyber': {
      const bl=new THREE.MeshStandardMaterial({color:0x0d0d0d});
      const cy=new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:0.5});
      const bnd=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.28,0.9),bl);bnd.position.y=0.05;g.add(bnd);
      const led=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.07,0.1),cy);led.position.set(0,0.05,0.46);g.add(led);break;
    }
    case 'hat_flower': {
      const gn=new THREE.MeshStandardMaterial({color:0x4caf50});
      const leaf=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.07,0.9),gn);leaf.position.y=0.1;g.add(leaf);
      const cols=[0xff69b4,0xffd700,0xe040fb,0xff9800,0x00bcd4];
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2;
        const fl=new THREE.Mesh(new THREE.SphereGeometry(0.13,6,6),
          new THREE.MeshStandardMaterial({color:cols[i%5]}));
        fl.position.set(Math.cos(a)*0.32,0.22,Math.sin(a)*0.32);g.add(fl);
      }break;
    }
    case 'hat_ninja_mask': {
      const dk=new THREE.MeshStandardMaterial({color:0x1c1e22,roughness:0.9});
      const rd=new THREE.MeshStandardMaterial({color:0xd82626});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.88,0.2,0.88),dk));
      const kn=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.18,0.12),rd);kn.position.set(0,0,-0.52);g.add(kn);break;
    }
    case 'hat_dragon_helm': {
      const rd=new THREE.MeshStandardMaterial({color:0xb71c1c,roughness:0.5,metalness:0.4});
      const go=new THREE.MeshStandardMaterial({color:0xffd700,roughness:0.3,metalness:0.8});
      const h=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.4,0.92),rd);h.position.y=0.1;g.add(h);
      const hL=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.38,0.14),go);hL.position.set(-0.34,0.48,-0.1);hL.rotation.z=-0.3;g.add(hL);
      const hR=hL.clone();hR.position.x=0.34;hR.rotation.z=0.3;g.add(hR);break;
    }
    case 'hat_astronaut': {
      const w=new THREE.MeshStandardMaterial({color:0xeceff1,roughness:0.6});
      const bl=new THREE.MeshStandardMaterial({color:0x1976d2,roughness:0.3});
      const helm=new THREE.Mesh(new THREE.BoxGeometry(1.05,0.95,1.05),w);helm.position.y=0.22;g.add(helm);
      const vis=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.38,0.12),bl);vis.position.set(0,0.22,0.53);g.add(vis);break;
    }
    case 'hat_viking': {
      const br=new THREE.MeshStandardMaterial({color:0x795548,roughness:0.8});
      const si=new THREE.MeshStandardMaterial({color:0xb0bec5,metalness:0.7,roughness:0.3});
      const h=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.42,0.9),br);h.position.y=0.1;g.add(h);
      const hL=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.06,0.44),si);hL.position.set(-0.52,0.1,0);hL.rotation.y=0.3;g.add(hL);
      const hR=hL.clone();hR.position.x=0.52;hR.rotation.y=-0.3;g.add(hR);break;
    }
    default: {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.87,0.28,0.87),
        new THREE.MeshStandardMaterial({color:0x7f8c8d,roughness:0.7})));
    }
  }
  head.add(g);
}

function buildGlassesOn3D(glassesId, head) {
  const g = new THREE.Group();
  g.position.set(0, 0.06, 0.43);
  switch(glassesId) {
    case 'glasses_cool': {
      const m=new THREE.MeshStandardMaterial({color:0x111111,emissive:0x333333,emissiveIntensity:0.5});
      const lL=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.22,0.09),m);lL.position.x=-0.23;g.add(lL);
      const lR=lL.clone();lR.position.x=0.23;g.add(lR);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.06,0.07),m));break;
    }
    case 'glasses_nerd': {
      const m=new THREE.MeshStandardMaterial({color:0x5d4037,roughness:0.4});
      const lL=new THREE.Mesh(new THREE.TorusGeometry(0.14,0.04,6,12),m);
      lL.position.x=-0.22;lL.rotation.y=Math.PI/2;g.add(lL);
      const lR=lL.clone();lR.position.x=0.22;g.add(lR);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.09,0.04,0.06),m));break;
    }
    case 'glasses_cyborg': {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.78,0.16,0.08),
        new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:0.8})));break;
    }
    case 'glasses_fire': {
      const m=new THREE.MeshStandardMaterial({color:0xff6d00,emissive:0xff3000,emissiveIntensity:0.5});
      const fL=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.32,0.08),m);fL.position.x=-0.22;g.add(fL);
      const fR=fL.clone();fR.position.x=0.22;g.add(fR);break;
    }
    case 'glasses_heart': {
      const m=new THREE.MeshStandardMaterial({color:0xff69b4,emissive:0xff1493,emissiveIntensity:0.3});
      const hL=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.24,0.08),m);hL.position.x=-0.22;g.add(hL);
      const hR=hL.clone();hR.position.x=0.22;g.add(hR);break;
    }
    case 'glasses_star': {
      const m=new THREE.MeshStandardMaterial({color:0xffd700,emissive:0xffb300,emissiveIntensity:0.4,metalness:0.5});
      const sL=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.08),m);sL.position.x=-0.22;sL.rotation.z=Math.PI/4;g.add(sL);
      const sR=sL.clone();sR.position.x=0.22;g.add(sR);break;
    }
    case 'glasses_vr': {
      const m=new THREE.MeshStandardMaterial({color:0x212121});
      const bl=new THREE.MeshStandardMaterial({color:0x1565c0,transparent:true,opacity:0.8});
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.82,0.26,0.12),m));
      const sc=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.18,0.06),bl);sc.position.z=0.07;g.add(sc);break;
    }
    case 'glasses_round_gold': {
      const m=new THREE.MeshStandardMaterial({color:0xffd700,metalness:0.8,roughness:0.2});
      const lL=new THREE.Mesh(new THREE.TorusGeometry(0.13,0.035,6,10),m);lL.position.x=-0.22;lL.rotation.y=Math.PI/2;g.add(lL);
      const lR=lL.clone();lR.position.x=0.22;g.add(lR);break;
    }
    case 'glasses_neon_tri': {
      const m1=new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:0.8});
      const m2=new THREE.MeshStandardMaterial({color:0xff00ff,emissive:0xff00ff,emissiveIntensity:0.8});
      const tL=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.28,0.08),m1);tL.position.x=-0.22;tL.rotation.z=Math.PI/4;g.add(tL);
      const tR=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.28,0.08),m2);tR.position.x=0.22;tR.rotation.z=Math.PI/4;g.add(tR);break;
    }
    case 'glasses_monocle': {
      const m=new THREE.MeshStandardMaterial({color:0x8B6914,metalness:0.6});
      const l=new THREE.Mesh(new THREE.TorusGeometry(0.14,0.035,6,10),m);l.position.x=-0.22;l.rotation.y=Math.PI/2;g.add(l);
      const ch=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.22,0.04),m);ch.position.set(-0.22,-0.2,0);g.add(ch);break;
    }
    case 'mask_ninja': {
      const m=new THREE.MeshStandardMaterial({color:0x1c1e22,roughness:0.9});
      const mk=new THREE.Mesh(new THREE.BoxGeometry(0.82,0.3,0.1),m);mk.position.y=-0.08;g.add(mk);break;
    }
    case 'mask_kabuki': {
      const w=new THREE.MeshStandardMaterial({color:0xfff8f0,roughness:0.8});
      const r=new THREE.MeshStandardMaterial({color:0xd82626});
      const bl=new THREE.MeshStandardMaterial({color:0x111111});
      const mk=new THREE.Mesh(new THREE.BoxGeometry(0.86,0.72,0.1),w);mk.position.y=-0.08;g.add(mk);
      const brL=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.06,0.06),r);brL.position.set(-0.22,0.17,0.08);brL.rotation.z=0.3;g.add(brL);
      const brR=brL.clone();brR.position.x=0.22;brR.rotation.z=-0.3;g.add(brR);
      const eL=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.12,0.08),bl);eL.position.set(-0.22,0.0,0.08);g.add(eL);
      const eR=eL.clone();eR.position.x=0.22;g.add(eR);
      const ckL=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.06),r);ckL.position.set(-0.32,-0.1,0.08);ckL.rotation.z=0.2;g.add(ckL);
      const ckR=ckL.clone();ckR.position.x=0.32;ckR.rotation.z=-0.2;g.add(ckR);break;
    }
    case 'mask_oni': {
      const r=new THREE.MeshStandardMaterial({color:0xd32f2f,roughness:0.6});
      const go=new THREE.MeshStandardMaterial({color:0xffd700});
      const bl=new THREE.MeshStandardMaterial({color:0x111111});
      const mk=new THREE.Mesh(new THREE.BoxGeometry(0.86,0.7,0.1),r);mk.position.y=-0.06;g.add(mk);
      const eL=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.14,0.08),bl);eL.position.set(-0.22,0.06,0.08);g.add(eL);
      const eR=eL.clone();eR.position.x=0.22;g.add(eR);
      const hL=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.22,0.08),go);hL.position.set(-0.28,0.38,0.08);hL.rotation.z=-0.3;g.add(hL);
      const hR=hL.clone();hR.position.x=0.28;hR.rotation.z=0.3;g.add(hR);break;
    }
    case 'mask_gas': {
      const dk=new THREE.MeshStandardMaterial({color:0x424242,roughness:0.7});
      const cy=new THREE.MeshStandardMaterial({color:0x00bcd4,transparent:true,opacity:0.7});
      const mk=new THREE.Mesh(new THREE.BoxGeometry(0.84,0.6,0.12),dk);mk.position.y=-0.04;g.add(mk);
      const lL=new THREE.Mesh(new THREE.TorusGeometry(0.12,0.04,6,10),dk);lL.position.set(-0.2,0.05,0.12);lL.rotation.y=Math.PI/2;g.add(lL);
      const lR=lL.clone();lR.position.x=0.2;g.add(lR);
      const vL=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.06),cy);vL.position.set(-0.2,0.05,0.14);g.add(vL);
      const vR=vL.clone();vR.position.x=0.2;g.add(vR);break;
    }
    default: {
      const m=new THREE.MeshStandardMaterial({color:0x333333,emissive:0x222222,emissiveIntensity:0.4});
      const lL=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.2,0.09),m);lL.position.x=-0.22;g.add(lL);
      const lR=lL.clone();lR.position.x=0.22;g.add(lR);
    }
  }
  head.add(g);
}

function buildBackOn3D(backId, torso) {
  const g = new THREE.Group();
  g.position.set(0, 0, -0.35);
  switch(backId) {
    case 'back_sword': {
      const si=new THREE.MeshStandardMaterial({color:0xd7ccc8,roughness:0.3,metalness:0.7});
      const hd=new THREE.MeshStandardMaterial({color:0x5d4037});
      const bl=new THREE.Mesh(new THREE.BoxGeometry(0.1,1.6,0.06),si);bl.position.set(-0.35,0.3,0);bl.rotation.z=-Math.PI/4;g.add(bl);
      const gu=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.08,0.1),hd);gu.position.set(-0.35+0.5*0.707,0.3-0.5*0.707,0);gu.rotation.z=-Math.PI/4;g.add(gu);break;
    }
    case 'back_shield': {
      const rd=new THREE.MeshStandardMaterial({color:0xd32f2f});
      const go=new THREE.MeshStandardMaterial({color:0xffd700});
      const sh=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.1,0.12),rd);sh.position.set(0,0.1,0);g.add(sh);
      const cv=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.7,0.08),go);cv.position.z=0.07;g.add(cv);
      const ch=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.14,0.08),go);ch.position.z=0.07;g.add(ch);break;
    }
    case 'back_pack': {
      const br=new THREE.MeshStandardMaterial({color:0x5d4037,roughness:0.9});
      const tn=new THREE.MeshStandardMaterial({color:0x8d6e63,roughness:0.9});
      const pk=new THREE.Mesh(new THREE.BoxGeometry(0.92,1.1,0.35),br);pk.position.set(0,0.1,-0.08);g.add(pk);
      const po=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.42,0.12),tn);po.position.set(0,-0.1,0.12);g.add(po);break;
    }
    case 'back_katana': {
      const si=new THREE.MeshStandardMaterial({color:0xc0c0c0,metalness:0.9,roughness:0.1});
      const go=new THREE.MeshStandardMaterial({color:0xffd700});
      const b1=new THREE.Mesh(new THREE.BoxGeometry(0.08,1.8,0.05),si);b1.position.set(-0.25,0.3,0);b1.rotation.z=-Math.PI/4;g.add(b1);
      const b2=b1.clone();b2.position.x=0.25;b2.rotation.z=Math.PI/4;g.add(b2);
      const g1=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.06,0.08),go);g1.position.set(-0.25+0.6*0.707,0.3-0.6*0.707,0);g1.rotation.z=-Math.PI/4;g.add(g1);
      const g2=g1.clone();g2.position.set(0.25-0.6*0.707,0.3-0.6*0.707,0);g2.rotation.z=Math.PI/4;g.add(g2);break;
    }
    case 'back_bat': {
      const m=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.9});
      const wL=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.85,0.06),m);wL.position.set(-1.05,0.3,-0.05);wL.rotation.y=Math.PI/6;
      const wR=wL.clone();wR.position.x=1.05;wR.rotation.y=-Math.PI/6;g.add(wL,wR);break;
    }
    case 'back_angel': {
      const go=new THREE.MeshStandardMaterial({color:0xffd700,emissive:0xd4af37,roughness:0.3});
      const wL=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.05,0.05),go);wL.position.set(-1.15,0.4,-0.05);wL.rotation.y=Math.PI/8;
      const wR=wL.clone();wR.position.x=1.15;wR.rotation.y=-Math.PI/8;g.add(wL,wR);
      [[-0.8,-.3],[-.3,-.1],[0,0],[.3,-.1],[.8,-.3]].forEach(([x,y])=>{
        const f=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.42,0.05),go);f.position.set(x,y,0);g.add(f);
      });break;
    }
    case 'back_laser': {
      const gr=new THREE.MeshStandardMaterial({color:0x7f8c8d,metalness:0.7});
      const cy=new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:0.8});
      const hi=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.48,0.14),gr);hi.position.set(-.3,-.3,0);hi.rotation.z=Math.PI/4;g.add(hi);
      const bl=new THREE.Mesh(new THREE.BoxGeometry(0.08,1.9,0.08),cy);bl.position.set(-.3+.52,-.3+.52,0);bl.rotation.z=Math.PI/4;g.add(bl);break;
    }
    case 'back_cape': {
      const rd=new THREE.MeshStandardMaterial({color:0xd32f2f,roughness:0.9,side:THREE.DoubleSide});
      const dk=new THREE.MeshStandardMaterial({color:0x7f0000,roughness:0.9,side:THREE.DoubleSide});
      const cp=new THREE.Mesh(new THREE.BoxGeometry(1.0,1.4,0.06),rd);cp.position.set(0,-.4,-.12);g.add(cp);
      const in_=new THREE.Mesh(new THREE.BoxGeometry(0.82,1.2,0.04),dk);in_.position.set(0,-.4,-.1);g.add(in_);break;
    }
    case 'back_jetpack': {
      const me=new THREE.MeshStandardMaterial({color:0x455a64,roughness:0.4,metalness:0.6});
      const cy=new THREE.MeshStandardMaterial({color:0x00bcd4});
      const or=new THREE.MeshStandardMaterial({color:0xff5722,emissive:0xff3000,emissiveIntensity:0.5});
      const pk=new THREE.Mesh(new THREE.BoxGeometry(0.88,1.0,0.42),me);pk.position.y=0.1;g.add(pk);
      const dt=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.42,0.12),cy);dt.position.set(0,.18,.28);g.add(dt);
      const tL=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.36,0.26),or);tL.position.set(-.26,-.5,.08);g.add(tL);
      const tR=tL.clone();tR.position.x=.26;g.add(tR);break;
    }
    case 'back_fairy_wings': {
      const cr=new THREE.MeshStandardMaterial({color:0xe1f5fe,transparent:true,opacity:0.75,emissive:0x4fc3f7,emissiveIntensity:0.2});
      const wTL=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.9,0.04),cr);wTL.position.set(-.8,.45,-.08);wTL.rotation.y=Math.PI/9;g.add(wTL);
      const wTR=wTL.clone();wTR.position.x=.8;wTR.rotation.y=-Math.PI/9;g.add(wTR);
      const wBL=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.72,0.04),cr);wBL.position.set(-.55,-.15,-.08);wBL.rotation.y=Math.PI/10;g.add(wBL);
      const wBR=wBL.clone();wBR.position.x=.55;wBR.rotation.y=-Math.PI/10;g.add(wBR);break;
    }
    case 'back_halo': {
      const go=new THREE.MeshStandardMaterial({color:0xffd700,emissive:0xffb300,emissiveIntensity:0.6,metalness:0.6});
      const rg=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.07,8,16),go);rg.position.set(0,2.1,0);rg.rotation.x=Math.PI/2;g.add(rg);break;
    }
    case 'back_dragon_tail': {
      const rd=new THREE.MeshStandardMaterial({color:0xc62828,roughness:0.6});
      const go=new THREE.MeshStandardMaterial({color:0xffd700});
      [[0,-.1,.2,0],[.15,-.4,.15,.3],[.35,-.7,.12,.5],[.5,-.95,.09,.6]].forEach(([x,y,r,,rz],i)=>{
        const sg=new THREE.Mesh(new THREE.BoxGeometry(.3-i*.04,.25,.3-i*.04),rd);
        sg.position.set(x,y,-.15);sg.rotation.z=rz||0;g.add(sg);
      });
      const tp=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,.16),go);tp.position.set(.55,-1.1,-.15);tp.rotation.z=0.7;g.add(tp);break;
    }
    case 'back_samurai_sword': {
      const si=new THREE.MeshStandardMaterial({color:0xd0d0d0,metalness:0.9,roughness:0.1});
      const bl=new THREE.Mesh(new THREE.BoxGeometry(0.08,1.8,0.04),si);bl.position.set(.3,.3,0);bl.rotation.z=Math.PI/6;g.add(bl);
      const go=new THREE.MeshStandardMaterial({color:0xffd700});
      const gu=new THREE.Mesh(new THREE.BoxGeometry(.32,.07,.12),go);gu.position.set(.3+.5*0.5,.3-.5*0.866,0);gu.rotation.z=Math.PI/6;g.add(gu);break;
    }
    default: {
      if(backId){
        const m=new THREE.MeshStandardMaterial({color:0x8d6e63});
        const b=new THREE.Mesh(new THREE.BoxGeometry(.1,1.6,.08),m);b.position.set(-.3,.3,0);b.rotation.z=-Math.PI/4;g.add(b);
      }
    }
  }
  if(g.children.length>0) torso.add(g);
}

// ==========================================================================
// 4b. Sidebar 3D Avatar Renderer (Separate WebGL Context)
// ==========================================================================
let sidebarScene = null;
let sidebarCamera = null;
let sidebarRenderer = null;
let sidebarPlayerGroup = null;
let sidebarAnimId = null;
let sidebarClock = null;

function initSidebarAvatar() {
  const container = document.getElementById("sidebar-avatar-3d-container");
  if (!container || !window.THREE) return;

  // If already running, just rebuild the player model (don't re-init WebGL)
  if (sidebarRenderer && sidebarScene) {
    buildSidebarPlayerModel();
    return;
  }
  if (sidebarAnimId) { cancelAnimationFrame(sidebarAnimId); sidebarAnimId = null; }

  container.innerHTML = "";

  sidebarScene = new THREE.Scene();
  sidebarScene.background = new THREE.Color(0x1a3a5c); // deep blue showcase

  // Defer layout read slightly so flexbox has computed widths
  const w = container.offsetWidth  || container.clientWidth  || 220;
  const h = container.offsetHeight || container.clientHeight || 280;
  sidebarCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  sidebarCamera.position.set(0, 2.5, 7);
  sidebarCamera.lookAt(0, 1.5, 0);

  sidebarRenderer = new THREE.WebGLRenderer({ antialias: true });
  sidebarRenderer.setSize(w, h);
  sidebarRenderer.shadowMap.enabled = true;
  container.appendChild(sidebarRenderer.domElement);

  // Balanced lighting for any skin/torso color
  sidebarScene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dl = new THREE.DirectionalLight(0xffffff, 0.9);
  dl.position.set(3, 8, 6); dl.castShadow = true; sidebarScene.add(dl);
  const rimL = new THREE.DirectionalLight(0x88ccff, 0.45);
  rimL.position.set(-3, 3, -2); sidebarScene.add(rimL);

  // Platform
  const platGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.2, 32);
  const platMat = new THREE.MeshStandardMaterial({ color: 0x2e3033, roughness: 0.6 });
  const plat = new THREE.Mesh(platGeo, platMat);
  plat.position.y = -0.1;
  sidebarScene.add(plat);

  buildSidebarPlayerModel();

  sidebarClock = new THREE.Clock();
  animateSidebar();
}

function buildSidebarPlayerModel() {
  if (sidebarPlayerGroup) sidebarScene.remove(sidebarPlayerGroup);

  sidebarPlayerGroup = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: gameState.avatarColors.skin, roughness: 0.7 });

  // Shirt/Pants color from equipped items
  const shirtItem = gameState.equippedItems.shirt
    ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.shirt)
    : null;
  const pantsItem = gameState.equippedItems.pants
    ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.pants)
    : null;

  const torsoColor = shirtItem ? shirtItem.torsoColor : gameState.avatarColors.torso;
  const legsColor  = pantsItem ? pantsItem.legsColor  : gameState.avatarColors.legs;

  const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.7 });
  const legsMat  = new THREE.MeshStandardMaterial({ color: legsColor,  roughness: 0.7 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.6), torsoMat);
  torso.position.y = 1.5;
  torso.castShadow = true;
  torso.name = "sb_torso";
  sidebarPlayerGroup.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
  head.position.set(0, 1.2, 0);
  head.castShadow = true;
  torso.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), blackMat);
  eyeL.position.set(-0.2, 0.1, 0.41);
  head.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.2; head.add(eyeR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0x7f0000 }));
  mouth.position.set(0, -0.15, 0.41); head.add(mouth);

  // Arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), skinMat);
  armL.position.set(-0.8, 0, 0); torso.add(armL);
  const armR = armL.clone(); armR.position.x = 0.8; torso.add(armR);

  // Legs
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), legsMat);
  legL.position.set(-0.35, -1.1, 0); torso.add(legL);
  const legR = legL.clone(); legR.position.x = 0.35; torso.add(legR);

  buildHair3D(head, gameState.gender);
  const equip = gameState.equippedItems;
  if (equip.hat) buildHatOn3D(equip.hat, head);
  if (equip.glasses) buildGlassesOn3D(equip.glasses, head);
  if (equip.back) buildBackOn3D(equip.back, torso);

  sidebarScene.add(sidebarPlayerGroup);
}

function refreshSidebarAvatar() {
  if (!sidebarScene) {
    initSidebarAvatar();
  } else {
    buildSidebarPlayerModel();
  }
}

function animateSidebar() {
  sidebarAnimId = requestAnimationFrame(animateSidebar);
  if (!sidebarPlayerGroup || !sidebarRenderer) return;

  // Slow Y-rotation showcase
  sidebarPlayerGroup.rotation.y += 0.012;

  // Idle bobbing
  const t = sidebarClock.getElapsedTime();
  sidebarPlayerGroup.position.y = Math.sin(t * 1.5) * 0.05;

  sidebarRenderer.render(sidebarScene, sidebarCamera);
}

// ==========================================================================
// 4c. Beat & Tap Rhythm System
// ==========================================================================
let beatTapActive = false;
let beatTapStepDone = 0;
let beatTapTable = 2;
const BAR_FALL_MS = 1600;
let beatTapBars = [];
let beatTapRafId = null;

function initBeatTap(tableNum) {
  beatTapActive = true;
  beatTapStepDone = 0;
  beatTapTable = tableNum;
  beatTapBars = [];
  if (beatTapRafId) { cancelAnimationFrame(beatTapRafId); beatTapRafId = null; }

  const lane = document.getElementById('beattap-lane');
  if (lane) { lane.querySelectorAll('.beattap-bar').forEach(b => b.remove()); }
  if (document.getElementById('beattap-formula')) document.getElementById('beattap-formula').innerText = `${tableNum} × ? = ?`;
  if (document.getElementById('beattap-count')) document.getElementById('beattap-count').innerText = '0';
  if (document.getElementById('beattap-result')) document.getElementById('beattap-result').innerText = '0';

  if (soundEnabled) startBeatSequencer();
  scheduleNextBar(1, 600);
  animateBeatTapLoop();
}

function scheduleNextBar(step, delayMs) {
  if (step > 12 || !beatTapActive) return;
  setTimeout(() => {
    if (!beatTapActive) return;
    const lane = document.getElementById('beattap-lane');
    if (!lane) return;
    const bar = document.createElement('div');
    bar.className = 'beattap-bar';
    bar.innerText = `${beatTapTable} × ${step}`;
    bar.style.top = '0px';
    lane.appendChild(bar);
    beatTapBars.push({ el: bar, step, startTime: performance.now(), tapped: false, missed: false });
    const nextDelay = Math.round((60000 / currentBpm) * 2.5);
    scheduleNextBar(step + 1, nextDelay);
  }, delayMs);
}

function animateBeatTapLoop() {
  beatTapRafId = requestAnimationFrame(animateBeatTapLoop);
  const lane = document.getElementById('beattap-lane');
  if (!lane) return;
  const laneH = lane.offsetHeight || 200;
  const hitZoneTop = laneH * 0.68;
  const now = performance.now();

  beatTapBars.forEach(bar => {
    if (bar.tapped || bar.missed) return;
    const pct = (now - bar.startTime) / BAR_FALL_MS;
    const topPx = pct * (laneH - 40);
    bar.el.style.top = `${topPx}px`;
    if (topPx >= hitZoneTop) bar.el.classList.add('in-hitzone');
    else bar.el.classList.remove('in-hitzone');
    if (topPx > laneH) {
      bar.missed = true;
      bar.el.remove();
      showBeatFeedback('MISS 💨', '#ff4444');
    }
  });
  beatTapBars = beatTapBars.filter(b => !b.missed);
}

function handleBeatTapTap() {
  if (!beatTapActive) return;
  sounds.click();
  const lane = document.getElementById('beattap-lane');
  if (!lane) return;
  const laneH = lane.offsetHeight || 200;
  const hitZoneTop = laneH * 0.62;

  let hitBar = null;
  let maxTop = -1;
  beatTapBars.forEach(bar => {
    if (bar.tapped || bar.missed) return;
    const topPx = parseFloat(bar.el.style.top) || 0;
    if (topPx >= hitZoneTop && topPx > maxTop) { maxTop = topPx; hitBar = bar; }
  });

  if (hitBar) {
    hitBar.tapped = true;
    hitBar.el.classList.add('beattap-bar-hit');
    setTimeout(() => { if (hitBar.el.parentNode) hitBar.el.remove(); }, 350);

    beatTapStepDone = hitBar.step;
    const result = beatTapTable * hitBar.step;
    document.getElementById('beattap-count').innerText = hitBar.step;
    document.getElementById('beattap-result').innerText = result;
    document.getElementById('beattap-formula').innerText = `${beatTapTable} × ${hitBar.step} = ${result}`;
    showBeatFeedback('PERFECT! 🎯', 'var(--rbx-neon-green)');
    playDJPitch(beatTapTable, hitBar.step, result);
    animateSidebarDance();

    if (hitBar.step >= 12) {
      beatTapActive = false;
      stopBeatSequencer();
      if (beatTapRafId) { cancelAnimationFrame(beatTapRafId); beatTapRafId = null; }
      setTimeout(() => showBeatFeedback(`🎉 ท่องครบแม่ ${beatTapTable}!`, 'var(--rbx-yellow)'), 400);
    }
  } else {
    showBeatFeedback('MISS 💨', '#ff5252');
    sounds.oof();
  }
}

function showBeatFeedback(text, color) {
  const fb = document.getElementById('beattap-feedback');
  if (!fb) return;
  fb.innerText = text;
  fb.style.color = color || 'var(--rbx-neon-green)';
  fb.style.opacity = '1';
  setTimeout(() => { fb.style.opacity = '0'; }, 700);
}

function animateSidebarDance() {
  if (!sidebarPlayerGroup) return;
  let f = 0;
  const id = setInterval(() => {
    f++;
    const t = sidebarPlayerGroup.getObjectByName("sb_torso");
    if (t) t.rotation.z = Math.sin(f * 1.2) * 0.35;
    if (f > 14) {
      clearInterval(id);
      const t2 = sidebarPlayerGroup.getObjectByName("sb_torso");
      if (t2) t2.rotation.z = 0;
    }
  }, 45);
}

// ==========================================================================
// 4d. Block Stacker (Crane Activity)
// ==========================================================================
let stackerTable = 2;
let stackerMultiplier = 4;
let stackerDropsDone = 0;
let stackerTotalBlocks = 0;
const STACKER_COLORS = [
  '#e74c3c','#f39c12','#2ecc71','#3498db',
  '#9b59b6','#1abc9c','#e67e22','#e91e63',
  '#00bcd4','#cddc39','#ff5722','#607d8b'
];

function initBlockStacker(tableNum, mult) {
  stackerTable = tableNum;
  stackerMultiplier = mult || 4;
  stackerDropsDone = 0;
  stackerTotalBlocks = 0;

  const sf = document.getElementById('stacker-formula');
  const sl = document.getElementById('stacker-drops-left');
  const sb = document.getElementById('stacker-block-per-drop');
  const sc = document.getElementById('stacker-count-display');
  const canvas = document.getElementById('stacker-canvas');
  const btn = document.getElementById('stacker-drop-btn');

  if (sf) sf.innerText = `${tableNum} × ${stackerMultiplier} = ?`;
  if (sl) sl.innerText = stackerMultiplier;
  if (sb) sb.innerText = tableNum;
  if (sc) sc.innerText = '0';
  if (canvas) canvas.innerHTML = '';
  if (btn) btn.disabled = false;
}

function doStackerDrop() {
  if (stackerDropsDone >= stackerMultiplier) return;
  stackerDropsDone++;
  const dropsLeft = stackerMultiplier - stackerDropsDone;
  stackerTotalBlocks += stackerTable;

  const canvas = document.getElementById('stacker-canvas');
  if (canvas) {
    const tower = document.createElement('div');
    tower.className = 'stacker-tower';
    const color = STACKER_COLORS[(stackerDropsDone - 1) % STACKER_COLORS.length];
    for (let i = 0; i < stackerTable; i++) {
      const block = document.createElement('div');
      block.className = 'stacker-block';
      block.style.backgroundColor = color;
      block.style.animationDelay = `${i * 0.08}s`;
      block.innerText = stackerTotalBlocks - stackerTable + i + 1;
      tower.appendChild(block);
    }
    canvas.appendChild(tower);
  }

  const sl = document.getElementById('stacker-drops-left');
  if (sl) sl.innerText = dropsLeft;

  // Animated count-up
  const sc = document.getElementById('stacker-count-display');
  if (sc) {
    const prev = stackerTotalBlocks - stackerTable;
    let v = prev;
    const countInt = setInterval(() => {
      v++;
      sc.innerText = v;
      if (v >= stackerTotalBlocks) clearInterval(countInt);
    }, 60);
  }

  sounds.coin();
  speakThai(`${stackerTotalBlocks}`);

  if (stackerDropsDone >= stackerMultiplier) {
    const sf = document.getElementById('stacker-formula');
    const btn = document.getElementById('stacker-drop-btn');
    if (sf) sf.innerText = `${stackerTable} × ${stackerMultiplier} = ${stackerTotalBlocks} ✓`;
    if (btn) btn.disabled = true;
    setTimeout(() => { sounds.win(); speakThai(`คำตอบคือ ${stackerTotalBlocks}`); }, 400);
  }
}

// ==========================================================================
// 4e. Step Dance 3D Activity
// ==========================================================================
let sdScene = null, sdCamera = null, sdRenderer = null, sdAnimId = null;
let sdPlayer = null, sdTiles = [], sdCurrentLane = 1; // 0=left,1=center,2=right
let sdStep = 0, sdTable = 2, sdKeys3d = {}, sdAnswered = false;
let sdPlayerVel = { x: 0, z: 0 };
// Camera orbit
let sdCamYaw = 0, sdCamDist = 8;
const SD_CAM_MIN = 4, SD_CAM_MAX = 18;
let sdIsRightDrag = false, sdRightDragLast = { x: 0, y: 0 };
// Jump in step dance
let sdIsJumping = false, sdVertVel = 0;
// Touch tracking
let sdJoyTouchId = null, sdCamTouchId = null;
let sdJoyCenterX = 0, sdJoyCenterY = 0;
let sdCamTouchLastX = 0;
let sdPinchStartDist = 0;
const SD_LANE_POSITIONS = [-2.8, 0, 2.8]; // X positions of tiles
// Tile Z positions — spread out so player actually walks between them
const SD_TILE_Z = -2.5; // all tiles at same Z but spread laterally
const SD_LANE_PATTERN = [1,0,2,1,2,0,1,0,2,1,2,0];

function initStepDance3D(tableNum) {
  const container = document.getElementById('sd-arena');
  if (!container || typeof THREE === 'undefined') return;
  container.innerHTML = '';

  sdTable = tableNum; sdStep = 0; sdAnswered = false;

  sdScene = new THREE.Scene();
  sdScene.background = new THREE.Color(0x87ceeb); // bright sky blue
  sdScene.fog = new THREE.Fog(0x87ceeb, 22, 40);

  const w = container.offsetWidth || 320;
  const h = container.offsetHeight || 260;
  sdCamera = new THREE.PerspectiveCamera(55, w / h, 0.1, 60);
  sdCamera.position.set(0, 5, 10);
  sdCamera.lookAt(0, 0, -2);

  sdRenderer = new THREE.WebGLRenderer({ antialias: true });
  sdRenderer.setSize(w, h);
  sdRenderer.shadowMap.enabled = true;
  container.appendChild(sdRenderer.domElement);

  sdScene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sdSun = new THREE.DirectionalLight(0xfff9e0, 1.2);
  sdSun.position.set(5, 12, 5); sdSun.castShadow = true; sdScene.add(sdSun);

  // Dance floor base — bright white/cream
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.22, 20),
    new THREE.MeshStandardMaterial({ color: 0xf0f4ff, roughness: 0.5 }));
  floor.position.set(0, -0.11, -5); floor.receiveShadow = true; sdScene.add(floor);

  // Grid lines — subtle
  const gridH = new THREE.GridHelper(20, 20, 0xbbccee, 0xddeeff);
  gridH.position.set(0, 0.02, -5); sdScene.add(gridH);

  // Divider lines between lanes
  [-1.4, 1.4].forEach(x => {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 20),
      new THREE.MeshBasicMaterial({ color: 0x99aacc }));
    div.position.set(x, 0.03, -5); sdScene.add(div);
  });

  // 3 tile pads — vibrant bright colors
  sdTiles = [];
  const tileColors = [0xff3366, 0x2979ff, 0x00e676];
  const tileBases  = [0xff6699, 0x64b5f6, 0x69f0ae];
  // Tile positions: triangle layout for walk-around feel
  const tileWorldPositions = [
    { x: -2.8, z: -2.5 }, // Left
    { x:  0,   z: -5.0 }, // Center (deepest)
    { x:  2.8, z: -2.5 }  // Right
  ];

  tileWorldPositions.forEach((tPos, idx) => {
    const pad = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 2.8),
      new THREE.MeshStandardMaterial({ color: tileBases[idx], roughness: 0.35 }));
    base.name = 'pad_base'; base.castShadow = true; base.receiveShadow = true; pad.add(base);

    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.09, 2.82),
      new THREE.MeshBasicMaterial({ color: tileColors[idx], transparent: true, opacity: 0.0 }));
    glow.position.y = 0.14; glow.name = 'glow'; pad.add(glow);

    // Number label on tile surface
    const label = createTextSprite3D('?');
    label.position.set(0, 1.6, 0); label.scale.set(3.5, 1.8, 1);
    label.name = 'answer_label'; pad.add(label);

    // Neon border around tile
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.06, 3.0),
      new THREE.MeshBasicMaterial({ color: tileColors[idx], transparent: true, opacity: 0.4 })
    );
    border.position.y = -0.07; pad.add(border);

    pad.position.set(tPos.x, 0.09, tPos.z);
    sdScene.add(pad);
    sdTiles.push({ group: pad, glow, color: tileColors[idx], laneIdx: idx });
  });

  // Point lights per lane
  tileColors.forEach((c, i) => {
    const pl = new THREE.PointLight(c, 0, 8);
    pl.position.set(SD_LANE_POSITIONS[i], 2, -1.5);
    pl.name = `lane_light_${i}`;
    sdScene.add(pl);
  });

  // Player
  sdPlayer = buildSimplePlayer3D(sdScene);
  sdPlayer.position.set(0, 0.9, 2);

  sdCurrentLane = 1;
  sdKeys3d = {};
  sdPlayerVel = { x: 0, z: 0 };
  sdCamYaw = 0; sdCamDist = 8;
  sdIsJumping = false; sdVertVel = 0;

  window.addEventListener('keydown', handleSdKey);
  window.addEventListener('keyup', handleSdKeyUp);

  // Build overlay HUD + controls
  buildSdOverlay();
  setupSdPCControls();
  setupSdTouchControls();

  // Request landscape fullscreen on mobile
  requestTrainingLandscape(document.getElementById('sd-fullwrap'));

  // Start first step
  sdUpdateUI();
  sdHighlightLane(SD_LANE_PATTERN[0]);
  sdAnimateDanceFloor();

  // Start beat + melody
  if (soundEnabled) {
    startBeatSequencer();
    startMelodySequencer(activeBeatStyle);
  }
}

function handleSdKey(e) {
  const key = e.key.toLowerCase();
  sdKeys3d[key] = true;
  // Spacebar = jump in step dance
  if ((e.code === 'Space' || key === ' ') && !sdIsJumping && sdPlayer) {
    sdVertVel = 0.35; sdIsJumping = true; e.preventDefault();
  }
  if (['a','s','d','w','arrowleft','arrowright','arrowup','arrowdown',' '].includes(key)) {
    e.preventDefault();
  }
}

function handleSdKeyUp(e) {
  sdKeys3d[e.key.toLowerCase()] = false;
}

// Detect iOS Safari
const isIOSSafari = () => {
  const ua = navigator.userAgent;
  return (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    && !window.MSStream;
};

// === Landscape fullscreen for training activities ===
async function requestTrainingLandscape(wrapper) {
  if (!wrapper) return;

  if (isIOSSafari()) {
    // iOS doesn't support requestFullscreen — use CSS fixed overlay instead
    wrapper.classList.add('training-ios-fullscreen');
    document.body.classList.add('training-body-lock');

    // Resize Three.js renderer to match new size after CSS applied
    setTimeout(() => resizeTrainingRenderer(), 150);
  } else {
    // Native fullscreen for Chrome/Firefox/Android
    try {
      const fsCall = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen || wrapper.mozRequestFullScreen;
      if (fsCall && !document.fullscreenElement) await fsCall.call(wrapper, { navigationUI: 'hide' });
    } catch(e) {}
    try {
      if (screen.orientation?.lock) await screen.orientation.lock('landscape');
    } catch(e) {}
  }
}

function resizeTrainingRenderer() {
  // Resize the active Three.js renderer to match current container
  if (sdRenderer && sdScene) {
    const c = document.getElementById('sd-arena');
    if (c) { sdRenderer.setSize(c.offsetWidth, c.offsetHeight); }
  }
  if (trampRenderer && trampScene) {
    const c = document.getElementById('tramp-arena');
    if (c) { trampRenderer.setSize(c.offsetWidth, c.offsetHeight); }
  }
}

function exitTrainingFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e) {}
  try { if (screen.orientation?.unlock) screen.orientation.unlock(); } catch(e) {}

  // Remove iOS CSS fullscreen
  document.querySelectorAll('.training-ios-fullscreen').forEach(el => {
    el.classList.remove('training-ios-fullscreen');
  });
  document.body.classList.remove('training-body-lock');
}

// === Build HUD overlay inside the SD arena ===
function buildSdOverlay() {
  const arena = document.getElementById('sd-arena');
  if (!arena) return;
  // Remove previous overlays
  arena.querySelectorAll('.sd-overlay-el').forEach(e => e.remove());

  // Rotate hint (portrait only)
  const rotHint = document.createElement('div');
  rotHint.className = 'sd-rotate-hint sd-overlay-el';
  rotHint.innerHTML = `<span class="sd-rotate-icon">📱</span><span>หมุนมือถือให้แนวนอน</span>`;
  arena.appendChild(rotHint);

  // Top HUD
  const topHud = document.createElement('div');
  topHud.className = 'sd-top-hud sd-overlay-el';
  topHud.innerHTML = `
    <div class="sd-question-center">
      <div class="sd-formula-big" id="sd-formula">2 × 1 = ?</div>
      <div class="sd-step-info">ก้าว <span id="sd-step">0</span>/12 &nbsp;|&nbsp; คำตอบ: <span id="sd-result" style="color:var(--rbx-neon-cyan)">?</span></div>
    </div>
    <div class="sd-beat-btns">
      <button class="sd-beat-btn active" data-beat="hiphop">🎧</button>
      <button class="sd-beat-btn" data-beat="edm">⚡</button>
      <button class="sd-beat-btn" data-beat="drum">🥁</button>
    </div>
  `;
  arena.appendChild(topHud);

  // Feedback overlay
  const fb = document.createElement('div');
  fb.className = 'sd-feedback-overlay sd-overlay-el';
  fb.id = 'sd-feedback-ov';
  arena.appendChild(fb);

  // Mobile controls (joystick + jump)
  const mctrl = document.createElement('div');
  mctrl.className = 'sd-mobile-controls sd-overlay-el';
  mctrl.innerHTML = `
    <div class="sd-joystick-zone" id="sd-joystick">
      <div class="sd-joystick-knob" id="sd-joy-knob"></div>
    </div>
    <button class="sd-jump-btn" id="sd-jump-btn2">⬆<br>กระโดด</button>
  `;
  arena.appendChild(mctrl);

  // Exit button for step dance
  const sdExitBtn = document.createElement('button');
  sdExitBtn.className = 'training-exit-btn sd-overlay-el';
  sdExitBtn.innerHTML = '✕';
  sdExitBtn.title = 'ออกจากกิจกรรม';
  sdExitBtn.addEventListener('click', () => { sounds.click(); stopStepDance3D(); exitTrainingFullscreen(); });
  arena.appendChild(sdExitBtn);

  // Beat style button events + iOS audio unlock on first tap
  topHud.querySelectorAll('.sd-beat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      unlockIOSAudio(); // unlock audio on user gesture
      topHud.querySelectorAll('.sd-beat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeBeatStyle = btn.getAttribute('data-beat');
      if (soundEnabled) { startBeatSequencer(); startMelodySequencer(activeBeatStyle); }
    });
  });

  // Jump button
  const jumpBtn2 = document.getElementById('sd-jump-btn2');
  if (jumpBtn2) {
    const doJump = () => {
      if (!sdIsJumping && sdPlayer) { sdVertVel = 0.35; sdIsJumping = true; }
    };
    jumpBtn2.addEventListener('touchstart', doJump, { passive: true });
    jumpBtn2.addEventListener('mousedown', doJump);
  }
}

// Override showBeatFeedback to use overlay element if in SD arena
const _origShowBeatFeedback = showBeatFeedback;
function showBeatFeedback(text, color) {
  const ov = document.getElementById('sd-feedback-ov');
  if (ov && sdScene) {
    ov.innerText = text;
    ov.style.color = color || 'var(--rbx-neon-green)';
    ov.style.opacity = '1';
    setTimeout(() => { if (ov) ov.style.opacity = '0'; }, 700);
  } else {
    const fb = document.getElementById('beattap-feedback');
    if (!fb) return;
    fb.innerText = text;
    fb.style.color = color || 'var(--rbx-neon-green)';
    fb.style.opacity = '1';
    setTimeout(() => { fb.style.opacity = '0'; }, 700);
  }
}

// === PC Controls for Step Dance ===
function setupSdPCControls() {
  const canvas = sdRenderer?.domElement;
  if (!canvas) return;

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
      sdIsRightDrag = true;
      sdRightDragLast = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener('mousemove', e => {
    if (!sdIsRightDrag) return;
    sdCamYaw += (e.clientX - sdRightDragLast.x) * 0.007;
    sdRightDragLast = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 2) sdIsRightDrag = false;
  });

  canvas.addEventListener('wheel', e => {
    sdCamDist = Math.max(SD_CAM_MIN, Math.min(SD_CAM_MAX, sdCamDist + e.deltaY * 0.02));
    e.preventDefault();
  }, { passive: false });
}

// === Touch Controls — Joystick + Camera Drag + Pinch Zoom ===
function setupSdTouchControls() {
  const arena = document.getElementById('sd-arena');
  if (!arena) return;

  const isJoystickPoint = (x, y) => {
    const jz = document.getElementById('sd-joystick');
    if (!jz) return false;
    const r = jz.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return Math.sqrt((x-cx)**2 + (y-cy)**2) < r.width / 2 + 24;
  };
  const isUIButton = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && (el.tagName === 'BUTTON' || el.closest('button'));
  };

  arena.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (isUIButton(t.clientX, t.clientY)) continue;
      if (sdJoyTouchId === null && isJoystickPoint(t.clientX, t.clientY)) {
        sdJoyTouchId = t.identifier;
        const jz = document.getElementById('sd-joystick');
        if (jz) { const r=jz.getBoundingClientRect(); sdJoyCenterX=r.left+r.width/2; sdJoyCenterY=r.top+r.height/2; }
      } else if (sdCamTouchId === null) {
        sdCamTouchId = t.identifier;
        sdCamTouchLastX = t.clientX;
      }
    }
    if (e.touches.length === 2) {
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      sdPinchStartDist = Math.sqrt(dx*dx+dy*dy);
    }
  }, { passive: false });

  arena.addEventListener('touchmove', e => {
    e.preventDefault();
    // Pinch zoom
    if (e.touches.length === 2 && sdPinchStartDist > 0) {
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      const d=Math.sqrt(dx*dx+dy*dy);
      sdCamDist = Math.max(SD_CAM_MIN, Math.min(SD_CAM_MAX, sdCamDist*(sdPinchStartDist/d)));
      sdPinchStartDist=d; return;
    }
    for (const t of e.changedTouches) {
      if (t.identifier === sdJoyTouchId) {
        const maxR=40, dx=t.clientX-sdJoyCenterX, dy=t.clientY-sdJoyCenterY;
        const dist=Math.sqrt(dx*dx+dy*dy), s=dist>maxR?maxR/dist:1;
        const knob=document.getElementById('sd-joy-knob');
        if (knob) knob.style.transform=`translate(calc(-50% + ${dx*s}px), calc(-50% + ${dy*s}px))`;
        const nx=dx*s/maxR, ny=dy*s/maxR;
        sdKeys3d['a']=nx<-0.25; sdKeys3d['d']=nx>0.25;
        sdKeys3d['w']=ny<-0.25; sdKeys3d['s']=ny>0.25;
      } else if (t.identifier === sdCamTouchId) {
        sdCamYaw += (t.clientX - sdCamTouchLastX) * 0.008;
        sdCamTouchLastX = t.clientX;
      }
    }
  }, { passive: false });

  const endTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === sdJoyTouchId) {
        sdJoyTouchId=null;
        const knob=document.getElementById('sd-joy-knob');
        if (knob) knob.style.transform='translate(-50%,-50%)';
        sdKeys3d['a']=sdKeys3d['d']=sdKeys3d['w']=sdKeys3d['s']=false;
      }
      if (t.identifier === sdCamTouchId) sdCamTouchId=null;
    }
  };
  arena.addEventListener('touchend', endTouch, { passive: false });
  arena.addEventListener('touchcancel', endTouch, { passive: false });
}

function addStepDanceDpad() {
  const container = document.getElementById('sd-arena');
  if (!container) return;
  const old = document.getElementById('sd-dpad-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sd-dpad-overlay';
  overlay.style.cssText = 'position:absolute;bottom:60px;right:12px;z-index:100;display:flex;flex-direction:column;align-items:center;gap:4px;';

  overlay.innerHTML = `
    <button class="sd-dpad-btn" id="sdb-w" style="width:54px;height:54px;">▲<br><small>หน้า</small></button>
    <div style="display:flex;gap:4px;">
      <button class="sd-dpad-btn" id="sdb-a" style="width:54px;height:54px;">◀<br><small>ซ้าย</small></button>
      <button class="sd-dpad-btn" id="sdb-s" style="width:54px;height:54px;background:#ff4444;">↺<br><small>ถอย</small></button>
      <button class="sd-dpad-btn" id="sdb-d" style="width:54px;height:54px;">▶<br><small>ขวา</small></button>
    </div>
  `;

  // Style the buttons
  const style = document.createElement('style');
  style.textContent = `.sd-dpad-btn{background:rgba(0,0,0,0.65);color:#fff;border:2px solid rgba(255,255,255,0.3);border-radius:10px;font-size:0.75rem;font-weight:700;font-family:var(--font-gaming,sans-serif);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:manipulation;user-select:none;-webkit-user-select:none;} .sd-dpad-btn:active{background:rgba(100,150,255,0.7);}`;
  document.head.appendChild(style);

  container.style.position = 'relative';
  container.appendChild(overlay);

  const btnMap = { 'sdb-w': 'w', 'sdb-a': 'a', 'sdb-s': 's', 'sdb-d': 'd' };
  Object.entries(btnMap).forEach(([btnId, key]) => {
    const btn = overlay.querySelector('#' + btnId);
    if (!btn) return;
    const startMove = () => { sdKeys3d[key] = true; };
    const stopMove  = () => { sdKeys3d[key] = false; };
    btn.addEventListener('touchstart', startMove, { passive: true });
    btn.addEventListener('touchend', stopMove, { passive: true });
    btn.addEventListener('mousedown', startMove);
    btn.addEventListener('mouseup', stopMove);
    btn.addEventListener('mouseleave', stopMove);
  });
}

function sdMoveTo(laneIdx) {
  sdCurrentLane = laneIdx;
  if (sdPlayer) {
    sdPlayer.position.x = SD_LANE_POSITIONS[laneIdx];
    // Face movement direction
    const dx = SD_LANE_POSITIONS[laneIdx] - (sdPlayer.userData.prevX || 0);
    if (Math.abs(dx) > 0.1) sdPlayer.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    sdPlayer.userData.prevX = SD_LANE_POSITIONS[laneIdx];
  }
}

function sdHighlightLane(laneIdx) {
  const step = sdStep + 1;
  const answer = sdTable * step;

  sdTiles.forEach((tile, i) => {
    const glow = tile.glow;
    const light = sdScene?.getObjectByName(`lane_light_${i}`);
    const label = tile.group.getObjectByName('answer_label');

    if (i === laneIdx) {
      // Show answer on target tile
      if (label) {
        tile.group.remove(label);
        const newLabel = createTextSprite3D(`${answer}`);
        newLabel.position.set(0, 1.4, 0);
        newLabel.scale.set(3, 1.5, 1);
        newLabel.name = 'answer_label';
        tile.group.add(newLabel);
      }
      glow.material.opacity = 0.75;
      if (light) light.intensity = 2.5;
      // Pulse glow
      let p = 0;
      const pi = setInterval(() => {
        p++;
        if (!glow.material) { clearInterval(pi); return; }
        glow.material.opacity = 0.45 + Math.sin(p * 0.3) * 0.3;
        if (sdAnswered || SD_LANE_PATTERN[(sdStep) % 12] !== i) { clearInterval(pi); }
      }, 40);
    } else {
      // Hide answer on non-target tiles
      if (label) {
        tile.group.remove(label);
        const blankLabel = createTextSprite3D('');
        blankLabel.name = 'answer_label';
        blankLabel.position.set(0, 1.4, 0);
        tile.group.add(blankLabel);
      }
      glow.material.opacity = 0.05;
      if (light) light.intensity = 0;
    }
  });
}

function sdExplodeTile(laneIdx) {
  const tile = sdTiles[laneIdx];
  if (!tile || !sdScene) return;
  let f = 0;
  const int = setInterval(() => {
    f++;
    if (tile.glow.material) tile.glow.material.opacity = Math.max(0, 0.9 - f * 0.06);
    if (f >= 15) { clearInterval(int); tile.glow.material.opacity = 0; }
  }, 30);
}

function sdUpdateUI() {
  const step = sdStep + 1;
  const result = sdTable * step;
  const el = document.getElementById('sd-formula');
  if (el) el.innerText = `${sdTable} × ${step} = ?`;
  const re = document.getElementById('sd-result');
  if (re) re.innerText = sdAnswered ? result : '?';
  const se = document.getElementById('sd-step');
  if (se) se.innerText = sdStep;
}

function sdAnimateDanceFloor() {
  sdAnimId = requestAnimationFrame(sdAnimateDanceFloor);
  if (!sdScene || !sdRenderer || !sdPlayer) return;

  const t = performance.now() * 0.001;

  // === Physical WASD movement ===
  let mX = 0, mZ = 0;
  if (sdKeys3d['a'] || sdKeys3d['arrowleft'])  mX = -1;
  if (sdKeys3d['d'] || sdKeys3d['arrowright']) mX =  1;
  if (sdKeys3d['w'] || sdKeys3d['arrowup'])    mZ = -1;
  if (sdKeys3d['s'] || sdKeys3d['arrowdown'])  mZ =  1;

  const maxSpd = 0.13, acc = 0.04, dec = 0.2;
  if (mX !== 0 || mZ !== 0) {
    const len = Math.sqrt(mX*mX + mZ*mZ);
    sdPlayerVel.x += (mX/len)*acc; sdPlayerVel.z += (mZ/len)*acc;
    const spd = Math.sqrt(sdPlayerVel.x**2 + sdPlayerVel.z**2);
    if (spd > maxSpd) { sdPlayerVel.x=(sdPlayerVel.x/spd)*maxSpd; sdPlayerVel.z=(sdPlayerVel.z/spd)*maxSpd; }
    sdPlayer.rotation.y = Math.atan2(sdPlayerVel.x, sdPlayerVel.z);
    // Leg walk animation
    const torso = sdPlayer.getObjectByName("sp_torso");
    if (torso) {
      const swg = Math.sin(t * 16) * 0.5;
      const lL = torso.getObjectByName("sp_legL"); if (lL) lL.rotation.x = swg;
      const lR = torso.getObjectByName("sp_legR"); if (lR) lR.rotation.x = -swg;
    }
  } else {
    sdPlayerVel.x *= (1-dec); sdPlayerVel.z *= (1-dec);
    if (Math.abs(sdPlayerVel.x) < 0.003) sdPlayerVel.x = 0;
    if (Math.abs(sdPlayerVel.z) < 0.003) sdPlayerVel.z = 0;
  }

  sdPlayer.position.x += sdPlayerVel.x;
  sdPlayer.position.z += sdPlayerVel.z;
  // Boundary: keep on dance floor
  sdPlayer.position.x = Math.max(-4.5, Math.min(4.5, sdPlayer.position.x));
  sdPlayer.position.z = Math.max(-8, Math.min(4, sdPlayer.position.z));

  // === Tile glow under player (visual feedback) ===
  sdTiles.forEach((tile, i) => {
    const dx = sdPlayer.position.x - tile.group.position.x;
    const dz = sdPlayer.position.z - tile.group.position.z;
    const nearDist = Math.sqrt(dx*dx + dz*dz);
    // Boost glow when player is nearby
    if (nearDist < 1.8) {
      const light = sdScene.getObjectByName(`lane_light_${i}`);
      if (light) light.intensity = 3.5;
      if (tile.glow.material) tile.glow.material.opacity = 0.9;
    }
  });

  // === Proximity detection — step on the glowing tile ===
  if (!sdAnswered && sdStep < 12) {
    const targetLane = SD_LANE_PATTERN[sdStep % 12];
    const target = sdTiles[targetLane];
    if (target) {
      const dx = sdPlayer.position.x - target.group.position.x;
      const dz = sdPlayer.position.z - target.group.position.z;
      if (Math.sqrt(dx*dx + dz*dz) < 1.5) {
        // Player stepped on the correct tile!
        sdAnswered = true;
        const result = sdTable * (sdStep + 1);
        showBeatFeedback(`✅ ${sdTable}×${sdStep+1}=${result}`, 'var(--rbx-neon-green)');
        playDJPitch(sdTable, sdStep+1, result);
        animateSidebarDance();
        speakThai(`${sdTable} คูณ ${sdStep + 1} เท่ากับ ${result}`);
        sdExplodeTile(targetLane);

        // Update UI
        document.getElementById('sd-formula').innerText = `${sdTable} × ${sdStep+1} = ${result}`;
        document.getElementById('sd-step').innerText = sdStep + 1;
        document.getElementById('sd-result').innerText = result;

        sdStep++;
        if (sdStep >= 12) {
          setTimeout(() => {
            showBeatFeedback(`🎉 ท่องครบแม่ ${sdTable}!`, 'var(--rbx-yellow)');
            stopBeatSequencer(); stopMelodySequencer();
          }, 600);
        } else {
          setTimeout(() => {
            sdAnswered = false;
            sdUpdateUI();
            sdHighlightLane(SD_LANE_PATTERN[sdStep % 12]);
          }, 800);
        }
      }
    }
  }

  // Jump physics in Step Dance
  if (sdIsJumping || sdPlayer.position.y > 0.9) {
    sdVertVel -= 0.02;
    sdPlayer.position.y += sdVertVel;
    if (sdPlayer.position.y <= 0.9) {
      sdPlayer.position.y = 0.9; sdVertVel = 0; sdIsJumping = false;
    }
  }

  // Orbit camera around player with yaw + distance
  const camTX = sdPlayer.position.x + Math.sin(sdCamYaw) * sdCamDist;
  const camTZ = sdPlayer.position.z + Math.cos(sdCamYaw) * sdCamDist;
  const camTY = sdPlayer.position.y + 5;
  sdCamera.position.x += (camTX - sdCamera.position.x) * 0.08;
  sdCamera.position.y += (camTY - sdCamera.position.y) * 0.08;
  sdCamera.position.z += (camTZ - sdCamera.position.z) * 0.08;
  sdCamera.lookAt(sdPlayer.position.x, sdPlayer.position.y + 1, sdPlayer.position.z);

  sdRenderer.render(sdScene, sdCamera);
}

function stopStepDance3D() {
  if (sdAnimId) { cancelAnimationFrame(sdAnimId); sdAnimId = null; }
  window.removeEventListener('keydown', handleSdKey);
  window.removeEventListener('keyup', handleSdKeyUp);
  stopBeatSequencer();
  stopMelodySequencer();
  exitTrainingFullscreen();
  sdIsRightDrag = false; sdJoyTouchId = null; sdCamTouchId = null;
  if (sdRenderer) { try { sdRenderer.dispose(); } catch(e) {} sdRenderer = null; }
  sdScene = null;
}

// ==========================================================================
// 4f. Answer Trampoline 3D Activity
// ==========================================================================
let trampScene = null, trampCamera = null, trampRenderer = null, trampAnimId = null;
let trampPlayer = null, trampPlatforms = [];
let trampStep = 1, trampTable = 2;
let trampVelocity = { x: 0, z: 0 }, trampVertVel = 0;
let trampJumping = false, trampAnswerProcessing = false;
let trampKeys = {}, trampCamYaw = 0, trampRightDrag = false, trampDragX = 0;

function initTrampoline3D(tableNum) {
  const container = document.getElementById('tramp-arena');
  if (!container || typeof THREE === 'undefined') return;
  container.innerHTML = '';

  trampTable = tableNum; trampStep = 1; trampAnswerProcessing = false;
  trampVelocity = { x: 0, z: 0 }; trampVertVel = 0; trampJumping = false; trampCamYaw = 0;

  trampScene = new THREE.Scene();
  trampScene.background = new THREE.Color(0x0a1525);
  trampScene.fog = new THREE.Fog(0x0a1525, 20, 50);

  const w = container.offsetWidth || 400;
  const h = container.offsetHeight || 280;
  trampCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 80);

  trampRenderer = new THREE.WebGLRenderer({ antialias: true });
  trampRenderer.setSize(w, h);
  trampRenderer.shadowMap.enabled = true;
  container.appendChild(trampRenderer.domElement);

  trampScene.add(new THREE.AmbientLight(0x334455, 0.7));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
  sun.position.set(5, 12, 5); sun.castShadow = true; trampScene.add(sun);

  // Ground
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.9 }));
  ground.position.y = -0.15; ground.receiveShadow = true; trampScene.add(ground);

  // Trampoline platforms (3 in arc)
  trampPlatforms = [];
  buildTrampPlatforms();

  // Player
  trampPlayer = buildSimplePlayer3D(trampScene);
  trampPlayer.position.set(0, 0.9, 0);

  // Camera orbit for trampoline
  const tc = trampRenderer.domElement;
  tc.addEventListener('contextmenu', e => e.preventDefault());
  tc.addEventListener('mousedown', e => { if (e.button === 2) { trampRightDrag = true; trampDragX = e.clientX; } });
  tc.addEventListener('mousemove', e => { if (trampRightDrag) { trampCamYaw += (e.clientX - trampDragX) * 0.012; trampDragX = e.clientX; } });
  tc.addEventListener('mouseup', () => { trampRightDrag = false; });

  trampKeys = {};
  trampCamState.yaw = 0; trampCamState.dist = 11;

  window.addEventListener('keydown', handleTrampKey);
  window.addEventListener('keyup', e => { trampKeys[e.key.toLowerCase()] = false; });

  buildTrampOverlay();

  // Use shared arena controller (joystick + touch drag camera + pinch zoom + jump)
  if (trampCtrl) trampCtrl.destroy();
  trampCtrl = createArenaController({
    canvas:    trampRenderer.domElement,
    keys:      trampKeys,
    camState:  trampCamState,
    onJump:    () => { if (!trampJumping && trampPlayer) { trampVertVel = 0.45; trampJumping = true; } },
    container: document.getElementById('tramp-arena'),
    joystickId: 'tramp-ctrl-joy',
    jumpBtnId:  'tramp-ctrl-jump'
  });

  trampRenderer.domElement.addEventListener('touchstart', () => unlockIOSAudio(), { once: true, passive: true });
  requestTrainingLandscape(document.getElementById('tramp-fullwrap'));
  animateTrampoline3D();
}

function buildTrampOverlay() {
  const arena = document.getElementById('tramp-arena');
  if (!arena) return;
  arena.querySelectorAll('.sd-overlay-el').forEach(e => e.remove());

  // Exit button
  const exitBtn = document.createElement('button');
  exitBtn.className = 'training-exit-btn sd-overlay-el';
  exitBtn.innerHTML = '✕';
  exitBtn.title = 'ออกจากกิจกรรม';
  exitBtn.addEventListener('click', () => { sounds.click(); stopTrampoline3D(); exitTrainingFullscreen(); });
  arena.appendChild(exitBtn);

  // Rotate hint
  const rh = document.createElement('div');
  rh.className = 'sd-rotate-hint sd-overlay-el';
  rh.innerHTML = `<span class="sd-rotate-icon">📱</span><span>หมุนมือถือให้แนวนอน</span>`;
  arena.appendChild(rh);

  // Top HUD
  const topHud = document.createElement('div');
  topHud.className = 'sd-top-hud sd-overlay-el';
  topHud.innerHTML = `
    <div class="sd-question-center">
      <div class="sd-formula-big" id="tramp-formula">2 × 1 = ?</div>
      <div class="sd-step-info">ข้อ <span id="tramp-step">1</span>/12 &nbsp;|&nbsp; กระโดดบนแท่นคำตอบที่ถูก!</div>
    </div>
  `;
  arena.appendChild(topHud);

  // Feedback
  const fb = document.createElement('div');
  fb.className = 'sd-feedback-overlay sd-overlay-el';
  fb.id = 'tramp-feedback';
  arena.appendChild(fb);

  // Mobile controls
  const mctrl = document.createElement('div');
  mctrl.className = 'sd-mobile-controls sd-overlay-el';
  mctrl.innerHTML = `
    <div class="sd-joystick-zone" id="tramp-joystick">
      <div class="sd-joystick-knob" id="tramp-joy-knob"></div>
    </div>
    <button class="sd-jump-btn" id="tramp-jump-btn-ui">⬆<br>กระโดด</button>
  `;
  arena.appendChild(mctrl);

  // Jump button
  const jb = document.getElementById('tramp-jump-btn-ui');
  if (jb) {
    const doJump = () => {
      if (!trampJumping && trampPlayer) { trampVertVel = 0.45; trampJumping = true; }
    };
    jb.addEventListener('touchstart', doJump, { passive: true });
    jb.addEventListener('mousedown', doJump);
  }
}

// Tramp PC controls — right-click camera + scroll zoom
let trampCtrl = null; // shared controller instance for trampoline
const trampCamState = { yaw: 0, dist: 11, minD: 5, maxD: 20 };
let trampCamYaw2 = 0, trampIsRightDrag = false, trampRightDragLast = { x: 0, y: 0 }; // legacy (kept for compat)
let trampJoyTouchId = null, trampCamTouchId2 = null, trampCamTouchLastX2 = 0;
let trampPinchDist = 0;

function setupTrampPCControls() {
  const canvas = trampRenderer?.domElement;
  if (!canvas) return;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => {
    if (e.button === 2) { trampIsRightDrag=true; trampRightDragLast={x:e.clientX,y:e.clientY}; }
  });
  window.addEventListener('mousemove', e => {
    if (!trampIsRightDrag) return;
    trampCamYaw += (e.clientX-trampRightDragLast.x)*0.007;
    trampRightDragLast={x:e.clientX,y:e.clientY};
  });
  window.addEventListener('mouseup', e => { if(e.button===2) trampIsRightDrag=false; });
  canvas.addEventListener('wheel', e => {
    // Zoom: adjust camera distance
    const cdist = Math.max(8, Math.min(20, ((trampCamera?.position?.distanceTo(trampPlayer?.position||new THREE.Vector3())||12) + e.deltaY*0.02)));
    if (trampCamera && trampPlayer) {
      const dir = new THREE.Vector3().subVectors(trampCamera.position, trampPlayer.position).normalize();
      trampCamera.position.copy(trampPlayer.position).addScaledVector(dir, cdist);
    }
    e.preventDefault();
  }, { passive: false });
}

function setupTrampTouchControls() {
  const arena = document.getElementById('tramp-arena');
  if (!arena) return;
  const isJoy = (x,y) => {
    const jz = document.getElementById('tramp-joystick');
    if (!jz) return false;
    const r = jz.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    return Math.sqrt((x-cx)**2+(y-cy)**2) < r.width/2+24;
  };
  const isBtn = (x,y) => { const el=document.elementFromPoint(x,y); return el&&(el.tagName==='BUTTON'||el.closest('button')); };
  let joyCX=0, joyCY=0;

  arena.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (isBtn(t.clientX,t.clientY)) continue;
      if (trampJoyTouchId===null && isJoy(t.clientX,t.clientY)) {
        trampJoyTouchId=t.identifier;
        const jz=document.getElementById('tramp-joystick');
        if (jz) { const r=jz.getBoundingClientRect(); joyCX=r.left+r.width/2; joyCY=r.top+r.height/2; }
      } else if (trampCamTouchId2===null) {
        trampCamTouchId2=t.identifier; trampCamTouchLastX2=t.clientX;
      }
    }
    if (e.touches.length===2) {
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      trampPinchDist=Math.sqrt(dx*dx+dy*dy);
    }
  }, { passive:false });

  arena.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length===2 && trampPinchDist>0) {
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      const d=Math.sqrt(dx*dx+dy*dy);
      if (trampCamera && trampPlayer) {
        const ratio=trampPinchDist/d;
        const dir=new THREE.Vector3().subVectors(trampCamera.position,trampPlayer.position);
        const newLen=Math.max(8,Math.min(20,dir.length()*ratio));
        trampCamera.position.copy(trampPlayer.position).addScaledVector(dir.normalize(),newLen);
      }
      trampPinchDist=d; return;
    }
    for (const t of e.changedTouches) {
      if (t.identifier===trampJoyTouchId) {
        const maxR=40,dx=t.clientX-joyCX,dy=t.clientY-joyCY;
        const dist=Math.sqrt(dx*dx+dy*dy),s=dist>maxR?maxR/dist:1;
        const knob=document.getElementById('tramp-joy-knob');
        if (knob) knob.style.transform=`translate(calc(-50% + ${dx*s}px),calc(-50% + ${dy*s}px))`;
        const nx=dx*s/maxR, ny=dy*s/maxR;
        trampKeys['a']=nx<-0.25; trampKeys['d']=nx>0.25;
        trampKeys['w']=ny<-0.25; trampKeys['s']=ny>0.25;
      } else if (t.identifier===trampCamTouchId2) {
        trampCamYaw+=(t.clientX-trampCamTouchLastX2)*0.008;
        trampCamTouchLastX2=t.clientX;
      }
    }
  }, { passive:false });

  const endT = e => {
    for (const t of e.changedTouches) {
      if (t.identifier===trampJoyTouchId) {
        trampJoyTouchId=null;
        const k=document.getElementById('tramp-joy-knob'); if(k) k.style.transform='translate(-50%,-50%)';
        trampKeys['a']=trampKeys['d']=trampKeys['w']=trampKeys['s']=false;
      }
      if (t.identifier===trampCamTouchId2) trampCamTouchId2=null;
    }
  };
  arena.addEventListener('touchend', endT, { passive:false });
  arena.addEventListener('touchcancel', endT, { passive:false });
}

function addTrampolineControls() {
  const container = document.getElementById('tramp-arena');
  if (!container) return;
  const old = document.getElementById('tramp-ctrl-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tramp-ctrl-overlay';
  overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;z-index:100;display:flex;justify-content:space-between;align-items:flex-end;padding:8px;pointer-events:none;';

  // Virtual joystick zone (left side)
  const joyZone = document.createElement('div');
  joyZone.style.cssText = 'pointer-events:all;width:90px;height:90px;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);border-radius:50%;position:relative;touch-action:none;';
  const joyKnob = document.createElement('div');
  joyKnob.style.cssText = 'position:absolute;top:27px;left:27px;width:36px;height:36px;background:rgba(255,255,255,0.55);border-radius:50%;pointer-events:none;';
  joyZone.appendChild(joyKnob);

  // Jump button (right side)
  const jumpBtn = document.createElement('button');
  jumpBtn.style.cssText = 'pointer-events:all;width:72px;height:72px;background:rgba(0,200,120,0.8);border:3px solid #00ff88;border-radius:50%;color:#000;font-size:0.85rem;font-weight:900;font-family:sans-serif;cursor:pointer;touch-action:manipulation;';
  jumpBtn.textContent = '⬆ กระโดด';

  overlay.appendChild(joyZone);
  overlay.appendChild(jumpBtn);
  container.style.position = 'relative';
  container.appendChild(overlay);

  // Jump button events
  const doJump = () => {
    if (!trampJumping && trampPlayer) { trampVertVel = 0.45; trampJumping = true; }
  };
  jumpBtn.addEventListener('touchstart', doJump, { passive: true });
  jumpBtn.addEventListener('mousedown', doJump);

  // Joystick events
  let joyActive = false, joyCenter = { x: 0, y: 0 };
  const maxR = 36;

  const startJoy = (cx, cy) => {
    joyActive = true;
    const rect = joyZone.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const moveJoy = (cx, cy) => {
    if (!joyActive) return;
    const dx = cx - joyCenter.x, dy = cy - joyCenter.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const s = dist > maxR ? maxR / dist : 1;
    joyKnob.style.left = `${27 + dx * s}px`;
    joyKnob.style.top  = `${27 + dy * s}px`;
    const norm = dist > 0.1 ? dist : 1;
    // Map to tramp keys
    const threshold = 0.3;
    trampKeys['a'] = dx / (norm * s / maxR) < -threshold * maxR;
    trampKeys['d'] = dx / (norm * s / maxR) > threshold * maxR;
    trampKeys['w'] = dy / (norm * s / maxR) < -threshold * maxR;
    trampKeys['s'] = dy / (norm * s / maxR) > threshold * maxR;
    // Simpler approach
    const nx = dx * s / maxR, ny = dy * s / maxR;
    trampKeys['a'] = nx < -0.3;
    trampKeys['d'] = nx > 0.3;
    trampKeys['w'] = ny < -0.3;
    trampKeys['s'] = ny > 0.3;
  };
  const stopJoy = () => {
    joyActive = false;
    joyKnob.style.left = '27px'; joyKnob.style.top = '27px';
    trampKeys['a'] = trampKeys['d'] = trampKeys['w'] = trampKeys['s'] = false;
  };

  joyZone.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; startJoy(t.clientX, t.clientY); }, { passive: false });
  joyZone.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; moveJoy(t.clientX, t.clientY); }, { passive: false });
  joyZone.addEventListener('touchend', stopJoy);
  joyZone.addEventListener('touchcancel', stopJoy);
  joyZone.addEventListener('mousedown', e => startJoy(e.clientX, e.clientY));
  document.addEventListener('mousemove', e => { if (joyActive) moveJoy(e.clientX, e.clientY); });
  document.addEventListener('mouseup', stopJoy);
}

function buildTrampPlatforms() {
  const tableNum = trampTable, step = trampStep;
  const correct = tableNum * step;
  const wrongs = new Set([correct]);
  while (wrongs.size < 3) {
    const w = correct + (Math.floor(Math.random() * 6) - 3) * tableNum;
    if (w > 0 && w !== correct) wrongs.add(w);
  }
  const answers = [...wrongs].sort(() => Math.random() - 0.5).slice(0, 3);
  if (!answers.includes(correct)) answers[0] = correct;

  trampPlatforms.forEach(p => trampScene.remove(p.group));
  trampPlatforms = [];

  const radius = 5.5;
  const baseAngle = -Math.PI / 2;
  [0, 1, 2].forEach(idx => {
    const angle = baseAngle + (idx - 1) * (Math.PI * 0.55);
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const isCorrect = answers[idx] === correct;

    const g = new THREE.Group();
    g.position.set(px, 0, pz);

    // Trampoline base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0x2d3a4a, roughness: 0.6 }));
    base.position.y = 0.12; base.castShadow = true; g.add(base);

    // Bounce surface (colored)
    const colors = [0xff5252, 0x40c4ff, 0x69f0ae];
    const surf = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: colors[idx], roughness: 0.3, emissive: colors[idx], emissiveIntensity: 0.2 }));
    surf.position.y = 0.3; g.add(surf);

    // Number label
    const label = createTextSprite3D(`${answers[idx]}`);
    label.position.set(0, 1.5, 0); label.scale.set(3, 1.5, 1); g.add(label);

    trampScene.add(g);
    trampPlatforms.push({ group: g, answer: answers[idx], isCorrect, px, pz, surf });
  });

  // Update formula display
  const fe = document.getElementById('tramp-formula');
  if (fe) fe.innerText = `${tableNum} × ${step} = ?`;
  const se = document.getElementById('tramp-step');
  if (se) se.innerText = step;
}

function handleTrampKey(e) {
  const k = e.key.toLowerCase();
  trampKeys[k] = true;
  if ((k === ' ' || e.code === 'Space') && !trampJumping && trampPlayer) {
    trampVertVel = 0.45;
    trampJumping = true;
    e.preventDefault();
  }
}

function animateTrampoline3D() {
  trampAnimId = requestAnimationFrame(animateTrampoline3D);
  if (!trampScene || !trampRenderer) return;

  const t = performance.now() * 0.001;
  let mX = 0, mZ = 0;
  if (trampKeys['a'] || trampKeys['arrowleft'])  mX = -1;
  if (trampKeys['d'] || trampKeys['arrowright']) mX =  1;
  if (trampKeys['w'] || trampKeys['arrowup'])    mZ = -1;
  if (trampKeys['s'] || trampKeys['arrowdown'])  mZ =  1;

  const spd = 0.15;
  if (mX !== 0 || mZ !== 0) {
    trampVelocity.x = mX * spd;
    trampVelocity.z = mZ * spd;
    if (trampPlayer) trampPlayer.rotation.y = Math.atan2(mX, mZ);
  } else {
    trampVelocity.x *= 0.8; trampVelocity.z *= 0.8;
  }

  if (trampPlayer) {
    trampPlayer.position.x += trampVelocity.x;
    trampPlayer.position.z += trampVelocity.z;
    trampPlayer.position.x = Math.max(-10, Math.min(10, trampPlayer.position.x));
    trampPlayer.position.z = Math.max(-10, Math.min(10, trampPlayer.position.z));

    // Leg walk anim
    const torso = trampPlayer.getObjectByName("sp_torso");
    if (torso && (Math.abs(trampVelocity.x) > 0.01 || Math.abs(trampVelocity.z) > 0.01)) {
      const lL = torso.getObjectByName("sp_legL");
      const lR = torso.getObjectByName("sp_legR");
      if (lL) lL.rotation.x = Math.sin(t * 14) * 0.5;
      if (lR) lR.rotation.x = -Math.sin(t * 14) * 0.5;
    }

    // Vertical/jump
    if (trampJumping || trampPlayer.position.y > 0.9) {
      trampVertVel -= 0.022;
      trampPlayer.position.y += trampVertVel;
      if (trampPlayer.position.y <= 0.9) {
        trampPlayer.position.y = 0.9; trampVertVel = 0; trampJumping = false;
        checkTrampCollision();
      }
    }
  }

  // Camera follow with orbit
  if (trampPlayer && trampCamera) {
    // Smooth orbit camera using shared trampCamState
    const tTX = trampPlayer.position.x + Math.sin(trampCamState.yaw) * trampCamState.dist;
    const tTY = trampPlayer.position.y + 9;
    const tTZ = trampPlayer.position.z + Math.cos(trampCamState.yaw) * trampCamState.dist;
    trampCamera.position.x += (tTX - trampCamera.position.x) * 0.08;
    trampCamera.position.y += (tTY - trampCamera.position.y) * 0.08;
    trampCamera.position.z += (tTZ - trampCamera.position.z) * 0.08;
    trampCamera.lookAt(trampPlayer.position.x, trampPlayer.position.y + 1, trampPlayer.position.z);
  }

  // Rotate platform labels to face camera
  trampPlatforms.forEach(p => { p.group.rotation.y += 0.008; });

  trampRenderer.render(trampScene, trampCamera);
}

function checkTrampCollision() {
  if (trampAnswerProcessing || !trampPlayer) return;
  for (const p of trampPlatforms) {
    const dx = trampPlayer.position.x - p.px;
    const dz = trampPlayer.position.z - p.pz;
    if (Math.sqrt(dx*dx + dz*dz) < 1.6) {
      handleTrampAnswer(p);
      break;
    }
  }
}

function handleTrampAnswer(platform) {
  trampAnswerProcessing = true;
  if (platform.isCorrect) {
    sounds.coin();
    showBeatFeedback('PERFECT! 🎯', 'var(--rbx-neon-green)');

    // Launch player into air!
    trampVertVel = 0.8;
    trampJumping = true;

    // Flash platform green
    if (platform.surf?.material) {
      platform.surf.material.emissive.setHex(0x00ff00);
      platform.surf.material.emissiveIntensity = 1.0;
    }

    // Show block visualization (floating blocks appear in air)
    showTrampBlockViz(trampTable, trampStep);

    speakThai(`${trampTable} คูณ ${trampStep} เท่ากับ ${trampTable * trampStep}`);
    playDJPitch(trampTable, trampStep, trampTable * trampStep);
    animateSidebarDance();

    trampStep++;
    setTimeout(() => {
      if (trampStep > 12) {
        showBeatFeedback(`🎉 ท่องแม่ ${trampTable} ครบแล้ว!`, 'var(--rbx-yellow)');
      } else {
        buildTrampPlatforms();
        trampPlayer.position.set(0, 0.9, 0);
        trampVelocity = { x: 0, z: 0 };
        trampAnswerProcessing = false;
      }
    }, 1800);
  } else {
    sounds.oof();
    showBeatFeedback('ผิด! ลองอีกครั้ง', '#ff4444');
    // Bounce back
    trampVertVel = 0.35;
    trampJumping = true;
    setTimeout(() => { trampAnswerProcessing = false; }, 700);
  }
}

function showTrampBlockViz(tableNum, mult) {
  if (!trampScene || !trampPlayer) return;
  const correct = tableNum * mult;
  const colors = [0xff5252, 0x40c4ff, 0x69f0ae, 0xffd700, 0xff69b4, 0x00ffff];
  // Show tableNum × mult blocks floating in air
  for (let col = 0; col < mult; col++) {
    for (let row = 0; row < tableNum; row++) {
      setTimeout(() => {
        if (!trampScene) return;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.35, 0.35),
          new THREE.MeshStandardMaterial({ color: colors[col % colors.length], roughness: 0.5 })
        );
        block.position.set(
          trampPlayer.position.x + (col - mult/2) * 0.42,
          trampPlayer.position.y + 3.5 + row * 0.42,
          trampPlayer.position.z
        );
        trampScene.add(block);
        setTimeout(() => { if (trampScene) trampScene.remove(block); }, 2000);
      }, (col * tableNum + row) * 40);
    }
  }
}

function stopTrampoline3D() {
  if (trampAnimId) { cancelAnimationFrame(trampAnimId); trampAnimId = null; }
  window.removeEventListener('keydown', handleTrampKey);
  if (trampCtrl) { trampCtrl.destroy(); trampCtrl = null; }
  exitTrainingFullscreen();
  if (trampRenderer) { try { trampRenderer.dispose(); } catch(e) {} trampRenderer = null; }
  trampScene = null;
}

// ==========================================================================
// 5. Training Room Interface & Logic
// ==========================================================================
let activeTrainingTable = null;
let currentStoryStep = 1;

function initTrainingSelector() {
  const container = document.getElementById("training-table-buttons");
  container.innerHTML = "";
  for (let i = 2; i <= 24; i++) {
    const btn = document.createElement("button");
    btn.className = "btn-table-tag";
    btn.innerText = `แม่ ${i}`;
    btn.addEventListener("click", () => selectTrainingTable(i));
    container.appendChild(btn);
  }
}

function selectTrainingTable(tableNum) {
  sounds.click();
  activeTrainingTable = tableNum;

  const buttons = document.querySelectorAll(".btn-table-tag");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.innerText === `แม่ ${tableNum}`);
  });

  document.getElementById("training-prompt").style.display = "none";
  document.getElementById("training-area-wrapper").style.display = "flex";
  document.getElementById("current-training-table-label").innerText = `แม่ ${tableNum}`;

  const activeTab = document.querySelector(".tab-btn.active")?.getAttribute("data-tab");
  if (activeTab === "tab-stepdance" || !activeTab) {
    stopStepDance3D(); stopTrampoline3D();
    if (soundEnabled) startBeatSequencer();
    initStepDance3D(tableNum);
  } else if (activeTab === "tab-trampoline") {
    stopStepDance3D(); stopTrampoline3D();
    initTrampoline3D(tableNum);
  }
}

// Tool 1: Visual Story
function updateVisualStoryView() {
  if (!activeTrainingTable) return;
  const numB = currentStoryStep;
  const numA = activeTrainingTable;
  
  const formula = `${numA} x ${numB} = ${numA * numB}`;
  document.getElementById("story-math-text").innerText = formula;
  
  const storyData = getStoryForEquation(numA, numB);
  document.getElementById("story-emoji-display").innerText = storyData.emoji;
  document.getElementById("story-text").innerText = storyData.story;
  
  document.getElementById("story-progress").innerText = `${currentStoryStep} / 12`;
}

// Tool 2: DJ Beats Pads
function initDJPads(tableNum) {
  const container = document.getElementById("dj-pads");
  container.innerHTML = "";
  for (let i = 1; i <= 12; i++) {
    const pad = document.createElement("button");
    const colIdx = ((i - 1) % 4) + 1;
    pad.className = `dj-pad pad-color-${colIdx}`;
    
    const result = tableNum * i;
    pad.innerHTML = `
      <span class="pad-math">${tableNum} x ${i}</span>
      <span class="pad-result">${result}</span>
    `;

    pad.addEventListener("click", () => {
      pad.classList.add("playing");
      setTimeout(() => pad.classList.remove("playing"), 100);
      
      const storyData = getStoryForEquation(tableNum, i);
      document.getElementById("dj-vocal-display").innerText = `${tableNum} คูณ ${i} เท่ากับ ${result}! (${storyData.story.split('!')[0]})`;
      
      playDJPitch(tableNum, i, result);
    });

    container.appendChild(pad);
  }
}

// Tool 3: Block Grid Isometric 3D (CSS 3D)
function updateBlockBuilderView(tableNum, multiplier) {
  document.getElementById("block-rows-val").innerText = tableNum;
  document.getElementById("block-cols-val").innerText = multiplier;
  const total = tableNum * multiplier;
  document.getElementById("block-total-val").innerText = total;

  const canvas = document.getElementById("block-canvas");
  canvas.innerHTML = "";

  const colors = ["#ff7675", "#fdcb6e", "#00cec9", "#a29bfe", "#ffeaa7", "#55efc4", "#74b9ff"];
  const towerColor = colors[tableNum % colors.length];

  const blockGapX = 42;
  const blockHeightZ = 30;

  for (let t = 0; t < tableNum; t++) {
    for (let h = 0; h < multiplier; h++) {
      const cube = document.createElement("div");
      cube.className = "cube-block";
      cube.style.setProperty("--cube-color", towerColor);
      
      const x = t * blockGapX;
      const y = 0;
      const finalZ = h * blockHeightZ;
      const startZ = 400;

      cube.style.transform = `translate3d(${x}px, ${y}px, ${startZ}px)`;
      canvas.appendChild(cube);

      const faces = ["front", "back", "left", "right", "top", "bottom"];
      faces.forEach((f) => {
        const face = document.createElement("div");
        face.className = `cube-face ${f}`;
        if (f === "top") {
          const indexNum = (t * multiplier) + h + 1;
          face.innerText = indexNum;
        }
        cube.appendChild(face);
      });

      setTimeout(() => {
        cube.style.transform = `translate3d(${x}px, ${y}px, ${finalZ}px)`;
        if (soundEnabled) {
          setTimeout(() => {
            playSynthSound(100 + (h * 15), 0.05, "triangle", 0.15);
          }, 300);
        }
      }, (t + h) * 40);

      cube.addEventListener("click", () => {
        if (!cube.classList.contains("counted")) {
          cube.classList.add("counted");
          sounds.click();
          const orderNum = (t * multiplier) + h + 1;
          playSynthSound(220 + (orderNum * 12), 0.1, "sine", 0.3);
        } else {
          cube.classList.remove("counted");
        }
      });
    }
  }
}

// ==========================================================================
// 6. 3D WebGL Boss Battle Game Engine (Three.js)
// ==========================================================================
let scene3d, camera3d, renderer3d;
let threeEngineActive = false;
let animationFrameId = null;

// Game objects
let player3dGroup = null;
let boss3dGroup = null;
let portals3dArray = [];
let treesArray = [];
let bullet3d = null;
let bossLightningBeam = null;

// Physics / States
const keysPressed = {};
let playerVelocity = { x: 0, z: 0 };
const mapBoundaryRadius = 24;
let playerHP = 100;
let currentBossHP = 500;
let maxBossHP = 500;
let comboCount = 0;
let isAnswerProcessing = false;
let bossQuestionsCorrect = 0;
const BOSS_QUESTIONS_REQUIRED = 12;

// === 2-PLAYER LOCAL MULTIPLAYER ===
let multiplayerMode = false;       // true = 2 players on same keyboard
let player2Group = null;           // P2 avatar mesh
let player2Velocity = { x: 0, z: 0 };
let player2HP = 100;
let player2Score = 0;              // correct answers
let player2JoyVec = { x: 0, y: 0 };
let player2JoyActive = false;
let player2JoyStart = { x: 0, y: 0 };
let player2IsJumping = false;
let player2VertVel = 0;

// Boss attack loop
let bossAttackInterval = null;
let dangerZones3D = [];

// Jump mechanic
let playerVertVelocity = 0;
let playerIsJumping = false;
const JUMP_FORCE = 0.42;
const GRAVITY_FORCE = -0.022;

// Camera orbit
let cameraYaw = 0;
let isRightDrag = false;
let rightDragStartX = 0;

// Joystick Touch variables
let joystickActive = false;
let joystickStartPos = { x: 0, y: 0 };
let joystickCurPos = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };

function initThreeJS() {
  const container = document.getElementById("arena-3d-viewport");
  if (!container) return;

  // Clear existing
  container.innerHTML = "";

  // 1. Create Scene
  scene3d = new THREE.Scene();
  scene3d.background = new THREE.Color(0x1a1c1e);
  scene3d.fog = new THREE.FogExp2(0x1a1c1e, 0.015);

  // 2. Camera
  camera3d = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);

  // 3. Renderer
  renderer3d = new THREE.WebGLRenderer({ antialias: true });
  renderer3d.setSize(container.clientWidth, container.clientHeight);
  renderer3d.shadowMap.enabled = true;
  container.appendChild(renderer3d.domElement);

  // 4. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene3d.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  scene3d.add(dirLight);

  // Decorative grid floor
  const floorGeo = new THREE.PlaneGeometry(100, 100);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x27ae60, 
    roughness: 0.9,
    metalness: 0.1
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene3d.add(floor);

  // Grid Helper for Roblox aesthetic
  const gridHelper = new THREE.GridHelper(100, 50, 0x1e63e6, 0x222222);
  gridHelper.position.y = 0.01;
  scene3d.add(gridHelper);

  // Fences (Map boundaries blocky visual)
  buildMapBoundaryFences();

  // Create scattered trees
  spawnBlockyTrees();

  // 5. Build meshes
  build3DPlayer();
  build3DBoss();
  spawnAnswerPortals3D();

  // Resize listener
  window.addEventListener("resize", onWindowResize3D);

  // Remove old listeners from previous sessions
  if (bossController) bossController.destroy();

  bossCamState.yaw = 0; bossCamState.dist = 13;
  playerVertVelocity = 0; playerIsJumping = false;

  const arenaViewport = document.getElementById("arena-3d-viewport");

  bossController = createArenaController({
    canvas:  renderer3d.domElement,
    keys:    keysPressed,
    camState: bossCamState,
    onJump:  () => { if (!playerIsJumping && player3dGroup) { playerVertVelocity = JUMP_FORCE; playerIsJumping = true; } },
    container: arenaViewport,
    joystickId: 'boss-joystick',
    jumpBtnId:  'boss-jump-btn'
  });

  // iOS: unlock audio on first touch in arena
  renderer3d.domElement.addEventListener('touchstart', () => unlockIOSAudio(), { once: true, passive: true });

  threeEngineActive = true;
  animate3DScene();
  startBossAttackLoop();
}

function handleJumpKey3D(e) {
  const k = e.code || e.key;
  if ((k === 'Space' || k === ' ') && !playerIsJumping && player3dGroup) {
    playerVertVelocity = JUMP_FORCE;
    playerIsJumping = true;
    e.preventDefault();
  }
  // P2 jump: Enter or NumpadEnter
  if ((k === 'Enter' || k === 'NumpadEnter') && !player2IsJumping && player2Group && multiplayerMode) {
    player2VertVel = JUMP_FORCE;
    player2IsJumping = true;
    e.preventDefault();
  }
}

// Build P2 avatar (different color skin/torso to distinguish)
function build3DPlayer2() {
  if (player2Group) scene3d.remove(player2Group);
  player2Group = new THREE.Group();
  player2Group.position.set(2, 0, 10); // Start slightly right of P1

  const skinMat = new THREE.MeshStandardMaterial({ color: 0x90e0ff, roughness: 0.7 }); // Blue skin
  const torsoMat = new THREE.MeshStandardMaterial({ color: 0xe040fb, roughness: 0.7 }); // Purple torso
  const legsMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.6), torsoMat);
  torso.position.y = 1.5; torso.name = "p2_torso"; player2Group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
  head.position.set(0, 1.2, 0); head.castShadow = true; torso.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.15,0.1), blackMat);
  eyeL.position.set(-0.2,0.1,0.41); head.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.2; head.add(eyeR);

  // P2 label "P2" above head
  const p2Label = createTextSprite3D("P2");
  p2Label.position.set(0, 2.5, 0); p2Label.scale.set(2, 1, 1); player2Group.add(p2Label);

  // P1 label for player 1
  const p1Label = createTextSprite3D("P1");
  p1Label.position.set(0, 2.5, 0); p1Label.scale.set(2, 1, 1);
  if (player3dGroup) player3dGroup.add(p1Label);

  const aL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), skinMat);
  aL.position.set(-0.8,0,0); aL.name="p2_armL"; torso.add(aL);
  const aR = aL.clone(); aR.position.x=0.8; aR.name="p2_armR"; torso.add(aR);

  const lL = new THREE.Mesh(new THREE.BoxGeometry(0.5,1.4,0.5), legsMat);
  lL.position.set(-0.35,-1.1,0); lL.name="p2_legL"; torso.add(lL);
  const lR = lL.clone(); lR.position.x=0.35; lR.name="p2_legR"; torso.add(lR);

  // Female hair for P2 to distinguish
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.22, 0.82), hairMat);
  hairTop.position.set(0, 0.4, -0.02); head.add(hairTop);
  const hairLong = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.0, 0.19), hairMat);
  hairLong.position.set(0, -0.18, -0.51); head.add(hairLong);

  scene3d.add(player2Group);
}

function updatePlayer2Movement(time) {
  if (!multiplayerMode || !player2Group) return;

  // P2 controls: Arrow keys
  let mX = 0, mZ = 0;
  if (keysPressed['arrowleft'])  mX = -1;
  if (keysPressed['arrowright']) mX =  1;
  if (keysPressed['arrowup'])    mZ = -1;
  if (keysPressed['arrowdown'])  mZ =  1;

  const maxSpd = 0.22, accel2 = 0.05, deccel2 = 0.18;
  if (mX !== 0 || mZ !== 0) {
    const len = Math.sqrt(mX*mX + mZ*mZ);
    player2Velocity.x += (mX/len)*accel2;
    player2Velocity.z += (mZ/len)*accel2;
    const spd = Math.sqrt(player2Velocity.x**2 + player2Velocity.z**2);
    if (spd > maxSpd) { player2Velocity.x=(player2Velocity.x/spd)*maxSpd; player2Velocity.z=(player2Velocity.z/spd)*maxSpd; }

    const torso = player2Group.getObjectByName("p2_torso");
    if (torso) {
      const lL = torso.getObjectByName("p2_legL"); if (lL) lL.rotation.x = Math.sin(time*15)*0.55;
      const lR = torso.getObjectByName("p2_legR"); if (lR) lR.rotation.x = -Math.sin(time*15)*0.55;
    }
    player2Group.rotation.y = Math.atan2(player2Velocity.x, player2Velocity.z);
  } else {
    player2Velocity.x *= (1-deccel2); player2Velocity.z *= (1-deccel2);
    if (Math.abs(player2Velocity.x)<0.002) player2Velocity.x=0;
    if (Math.abs(player2Velocity.z)<0.002) player2Velocity.z=0;
  }

  player2Group.position.x += player2Velocity.x;
  player2Group.position.z += player2Velocity.z;

  // Boundary
  const d2 = Math.sqrt(player2Group.position.x**2 + player2Group.position.z**2);
  if (d2 > mapBoundaryRadius) {
    player2Group.position.x = (player2Group.position.x/d2)*mapBoundaryRadius;
    player2Group.position.z = (player2Group.position.z/d2)*mapBoundaryRadius;
  }

  // Jump physics P2
  if (player2IsJumping || player2Group.position.y > 0) {
    player2VertVel += GRAVITY_FORCE;
    player2Group.position.y += player2VertVel;
    if (player2Group.position.y <= 0) {
      player2Group.position.y = 0; player2VertVel = 0; player2IsJumping = false;
    }
  }

  // P2 portal collision
  if (!isAnswerProcessing) {
    portals3dArray.forEach(portalGroup => {
      const dx = player2Group.position.x - portalGroup.position.x;
      const dz = player2Group.position.z - portalGroup.position.z;
      if (Math.sqrt(dx*dx + dz*dz) < 1.6) {
        handleAnswerSelect3D_P2(parseInt(portalGroup.getAttribute("data-val")), portalGroup);
      }
    });
  }
}

function handleAnswerSelect3D_P2(chosenVal, hitPortalGroup) {
  if (isAnswerProcessing) return;
  const isCorrect = (chosenVal === currentQuestionData.ans);
  isAnswerProcessing = true;

  if (isCorrect) {
    sounds.coin();
    player2Score++;
    bossQuestionsCorrect++;
    triggerPlayerAttackAnimation_P2();
    scoreRobuxEarned += 10;
    document.getElementById("action-robux-earned").innerText = scoreRobuxEarned;
    document.getElementById("boss-questions-counter").innerText = `${bossQuestionsCorrect} / ${BOSS_QUESTIONS_REQUIRED}`;
    updateBossQuestionsUI();

    showFloatingText("P2 เข้า! +1 🎯", "#e040fb");

    setTimeout(() => {
      if (bossQuestionsCorrect >= BOSS_QUESTIONS_REQUIRED) { endGameplaySession3D(true); }
      else { isAnswerProcessing = false; nextActionQuestion3D(); }
    }, 1400);
  } else {
    sounds.oof();
    player2HP = Math.max(0, player2HP - 10);
    updatePlayer2HPUI();
    if (player2HP <= 0) {
      setTimeout(() => endGameplaySession3D(false), 800);
      return;
    }
    showFloatingText("P2 ผิด! -10❤️", "#ff4444");
    setTimeout(() => { isAnswerProcessing = false; }, 900);
  }
}

function triggerPlayerAttackAnimation_P2() {
  if (!player2Group || !boss3dGroup) return;
  const bulletGeo = new THREE.SphereGeometry(0.35, 8, 8);
  const bullet = new THREE.Mesh(bulletGeo,
    new THREE.MeshBasicMaterial({ color: 0xe040fb }));
  bullet.position.copy(player2Group.position);
  bullet.position.y += 1.5;
  scene3d.add(bullet);
  const target = new THREE.Vector3().copy(boss3dGroup.position).add(new THREE.Vector3(0, 2.5, 0));
  let f = 0;
  const bi = setInterval(() => {
    f++;
    bullet.position.lerp(target, 0.15);
    if (bullet.position.distanceTo(target) < 0.8 || f > 40) {
      clearInterval(bi);
      scene3d.remove(bullet);
    }
  }, 16);
}

function updatePlayer2HPUI() {
  const el = document.getElementById("player2-hp-fill-bar");
  const tx = document.getElementById("player2-current-hp");
  if (el) el.style.width = `${player2HP}%`;
  if (tx) tx.innerText = player2HP;
}

function showFloatingText(text, color) {
  const c = document.querySelector(".arena-3d-wrapper");
  if (!c) return;
  const el = document.createElement("div");
  el.style.cssText = `position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);font-size:1.1rem;font-weight:900;color:${color};z-index:200;pointer-events:none;text-shadow:0 0 8px ${color};transition:all 0.8s ease-out;`;
  el.innerText = text;
  c.appendChild(el);
  setTimeout(() => { el.style.top="15%"; el.style.opacity="0"; }, 50);
  setTimeout(() => el.remove(), 900);
}

function buildMapBoundaryFences() {
  const segmentCount = 24;
  const radius = mapBoundaryRadius + 2;
  for (let i = 0; i < segmentCount; i++) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const postGeo = new THREE.BoxGeometry(0.8, 2, 0.8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 1, z);
    scene3d.add(post);
  }
}

function spawnBlockyTrees() {
  // Clear old
  treesArray.forEach(t => scene3d.remove(t));
  treesArray = [];

  const treePositions = [
    {x: -15, z: -15}, {x: 15, z: -18}, {x: -20, z: 8}, {x: 20, z: 10},
    {x: -8, z: 18}, {x: 8, z: 22}, {x: -22, z: -5}, {x: 22, z: -8}
  ];

  treePositions.forEach((pos) => {
    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.BoxGeometry(0.6, 3, 0.6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    treeGroup.add(trunk);

    // Foliage (Leaves blocky)
    const leavesGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.8 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 3.5;
    treeGroup.add(leaves);

    treeGroup.position.set(pos.x, 0, pos.z);
    scene3d.add(treeGroup);
    treesArray.push(treeGroup);
  });
}

// Draw 3D player block character dynamically matching shop inventory
function build3DPlayer() {
  if (player3dGroup) scene3d.remove(player3dGroup);

  player3dGroup = new THREE.Group();
  player3dGroup.position.set(0, 0, 10); // Start position

  const shirtItem = gameState.equippedItems.shirt ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.shirt) : null;
  const pantsItem = gameState.equippedItems.pants ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.pants) : null;
  const torsoColorHex = shirtItem ? shirtItem.torsoColor : gameState.avatarColors.torso;
  const legsColorHex  = pantsItem ? pantsItem.legsColor  : gameState.avatarColors.legs;

  const skinMat  = new THREE.MeshStandardMaterial({ color: gameState.avatarColors.skin, roughness: 0.7 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColorHex, roughness: 0.7 });
  const legsMat  = new THREE.MeshStandardMaterial({ color: legsColorHex,  roughness: 0.7 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  // 1. Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.6), torsoMat);
  torso.position.y = 1.5;
  torso.castShadow = true;
  torso.name = "torso";
  player3dGroup.add(torso);

  // 2. Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
  head.position.set(0, 1.2, 0);
  head.castShadow = true;
  head.name = "head";
  torso.add(head);

  // Smile face
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), blackMat);
  eyeL.position.set(-0.2, 0.1, 0.41);
  head.add(eyeL);

  const eyeR = eyeL.clone();
  eyeR.position.x = 0.2;
  head.add(eyeR);

  const mouthGeo = new THREE.BoxGeometry(0.3, 0.08, 0.1);
  const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshStandardMaterial({ color: 0x7f0000 }));
  mouth.position.set(0, -0.15, 0.41);
  head.add(mouth);

  // 3. Limbs
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), skinMat);
  armL.position.set(-0.8, 0, 0);
  armL.castShadow = true;
  armL.name = "armL";
  torso.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), skinMat);
  armR.position.set(0.8, 0, 0);
  armR.castShadow = true;
  armR.name = "armR";
  torso.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), legsMat);
  legL.position.set(-0.35, -1.1, 0);
  legL.castShadow = true;
  legL.name = "legL";
  torso.add(legL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), legsMat);
  legR.position.set(0.35, -1.1, 0);
  legR.castShadow = true;
  legR.name = "legR";
  torso.add(legR);

  // Accessories via shared helpers
  buildHair3D(head, gameState.gender);
  const equip = gameState.equippedItems;
  if (equip.hat) buildHatOn3D(equip.hat, head);
  if (equip.glasses) buildGlassesOn3D(equip.glasses, head);
  if (equip.back) buildBackOn3D(equip.back, torso);

  // D. Floating Pet (Dog / Dragon / Slime)
  if (equip.pet) {
    const petGroup = new THREE.Group();
    petGroup.position.set(1.5, 0.6, -0.6); // Float right and slightly behind player
    petGroup.name = "pet";

    const petMatColors = {
      pet_dog: 0x8d6e63,
      pet_cat: 0xff9800,
      pet_penguin: 0x222222,
      pet_slime: 0x00e676,
      pet_dragon: 0xd50000,
      pet_unicorn: 0xf8bbd0
    };
    const colorHex = petMatColors[equip.pet] || 0x7f8c8d;
    
    // Slime transparency
    const petMat = new THREE.MeshStandardMaterial({ 
      color: colorHex, 
      roughness: 0.8,
      transparent: (equip.pet === "pet_slime"),
      opacity: (equip.pet === "pet_slime" ? 0.8 : 1.0)
    });
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), petMat);
    petGroup.add(body);

    // Simple facial feature
    const faceDot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), blackMat);
    faceDot.position.set(-0.15, 0.08, 0.26);
    body.add(faceDot);
    const faceDotR = faceDot.clone();
    faceDotR.position.x = 0.15;
    body.add(faceDotR);

    // Dragon wings or horns
    if (equip.pet === "pet_dragon") {
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), new THREE.MeshStandardMaterial({ color: 0x7f0000 }));
      wingL.position.set(-0.35, 0.1, -0.1);
      const wingR = wingL.clone();
      wingR.position.x = 0.35;
      body.add(wingL, wingR);
    }

    player3dGroup.add(petGroup);
  }

  scene3d.add(player3dGroup);
}

// Build giant block Boss monster in center of map
function build3DBoss() {
  if (boss3dGroup) scene3d.remove(boss3dGroup);

  boss3dGroup = new THREE.Group();
  boss3dGroup.position.set(0, 0, -10); // Center-rear of map

  // Golem robot style
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8e44ad, roughness: 0.6 }); // Purple base
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c }); // Red accents
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 }); // Glowing red eyes

  // Large Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.2, 2.0), bodyMat);
  torso.position.y = 2.5;
  torso.castShadow = true;
  torso.name = "boss_torso";
  boss3dGroup.add(torso);

  // Shoulders/Spikes
  const spikeL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), trimMat);
  spikeL.position.set(-2.2, 1.0, 0);
  torso.add(spikeL);
  const spikeR = spikeL.clone();
  spikeR.position.x = 2.2;
  torso.add(spikeR);

  // Large Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), bodyMat);
  head.position.set(0, 2.2, 0);
  head.castShadow = true;
  torso.add(head);

  // Red visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.1), eyeMat);
  visor.position.set(0, 0.2, 0.71);
  head.add(visor);

  scene3d.add(boss3dGroup);
}

// Spawn 3 glowing portals at randomized 120° positions around boss
function spawnAnswerPortals3D() {
  portals3dArray.forEach(p => scene3d.remove(p));
  portals3dArray = [];

  const baseAngle = Math.random() * Math.PI * 2;
  const portalRadius = 8.5;
  const labels = ["A", "B", "C"];
  const portalPositions = labels.map((label, idx) => {
    const angle = baseAngle + (idx * (Math.PI * 2 / 3));
    return {
      x: Math.cos(angle) * portalRadius,
      y: 0.05,
      z: Math.sin(angle) * portalRadius,
      label
    };
  });

  portalPositions.forEach((pos, idx) => {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(pos.x, pos.y, pos.z);
    portalGroup.name = `portal_${idx}`;

    // 1. Base ring geometry on ground
    const ringGeo = new THREE.RingGeometry(1.2, 1.4, 32);
    const ringColors = [0x00ffff, 0xff00ff, 0xf79f1f];
    const colorHex = ringColors[idx];
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: colorHex, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    portalGroup.add(ring);

    // 2. Translucent glowing cylinder representing portal energy beam
    const cylGeo = new THREE.CylinderGeometry(1.2, 1.2, 3.5, 32, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(cylGeo, cylMat);
    beam.position.y = 1.75;
    portalGroup.add(beam);

    // 3. Floating billboard sign (Canvas text texture)
    const billboard = createTextSprite3D(`${pos.label}: ?`);
    billboard.position.set(0, 4.2, 0);
    billboard.name = "billboard";
    portalGroup.add(billboard);

    scene3d.add(portalGroup);
    portals3dArray.push(portalGroup);
  });
}

// Canvas-drawn texture sprite billboard for portal answers
function createTextSprite3D(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Background box
  ctx.fillStyle = 'rgba(18, 19, 20, 0.85)';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#f79f1f';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 256, 128);

  // Content Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Fredoka, Mitr, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.5, 1.75, 1.0);
  return sprite;
}

// Update Portal billboard texts with current choices
function updatePortalBillboardTexts(optionsArray) {
  const labels = ["A", "B", "C"];
  portals3dArray.forEach((pGroup, idx) => {
    const val = optionsArray[idx] !== undefined ? optionsArray[idx] : "?";
    pGroup.setAttribute("data-val", val); // Set value onto group for comparison

    const billboard = pGroup.getObjectByName("billboard");
    if (billboard) pGroup.remove(billboard);

    const newBillboard = createTextSprite3D(`${labels[idx]}: ${val}`);
    newBillboard.position.set(0, 4.2, 0);
    newBillboard.name = "billboard";
    pGroup.add(newBillboard);
  });
}

// Custom attribute setter helpers
THREE.Object3D.prototype.setAttribute = function(name, val) {
  if (!this.userData) this.userData = {};
  this.userData[name] = val;
};
THREE.Object3D.prototype.getAttribute = function(name) {
  return this.userData ? this.userData[name] : undefined;
};

// --- Input Controls 3D ---
function handleKeyDown3D(e) {
  keysPressed[e.key.toLowerCase()] = true;
}
function handleKeyUp3D(e) {
  keysPressed[e.key.toLowerCase()] = false;
}

function setupJoystickEvents() {
  const zone = document.getElementById("joystick-zone");
  const handle = document.getElementById("joystick-handle");
  if (!zone || !handle) return;

  // Reset handle styling
  handle.style.left = "33px";
  handle.style.top = "33px";

  zone.addEventListener("touchstart", (e) => {
    joystickActive = true;
    const t = e.touches[0];
    const rect = zone.getBoundingClientRect();
    joystickStartPos = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  });

  zone.addEventListener("touchmove", (e) => {
    if (!joystickActive) return;
    const t = e.touches[0];
    
    // Offset vector
    const dx = t.clientX - joystickStartPos.x;
    const dy = t.clientY - joystickStartPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const maxDist = 45; // Max offset
    const scale = dist > maxDist ? maxDist / dist : 1.0;
    
    const dragX = dx * scale;
    const dragY = dy * scale;

    handle.style.left = `${33 + dragX}px`;
    handle.style.top = `${33 + dragY}px`;

    // Normalized vector
    joystickVector = {
      x: dragX / maxDist,
      y: dragY / maxDist
    };
  });

  const stopJoystick = () => {
    joystickActive = false;
    handle.style.left = "33px";
    handle.style.top = "33px";
    joystickVector = { x: 0, y: 0 };
  };

  zone.addEventListener("touchend", stopJoystick);
  zone.addEventListener("touchcancel", stopJoystick);
}

// --------------------------------------------------------------------------
// 3D Gameloop / Motion & Animations
// --------------------------------------------------------------------------
function animate3DScene() {
  if (!threeEngineActive) return;
  animationFrameId = requestAnimationFrame(animate3DScene);

  // Time-based variables
  const time = clock3D.getElapsedTime();

  // 1. Handle movement controls
  let moveX = 0;
  let moveZ = 0;

  // Keyboard controls
  if (keysPressed['w'] || keysPressed['arrowup']) moveZ = -1;
  if (keysPressed['s'] || keysPressed['arrowdown']) moveZ = 1;
  if (keysPressed['a'] || keysPressed['arrowleft']) moveX = -1;
  if (keysPressed['d'] || keysPressed['arrowright']) moveX = 1;

  // Joystick override
  if (joystickActive && (Math.abs(joystickVector.x) > 0.15 || Math.abs(joystickVector.y) > 0.15)) {
    moveX = joystickVector.x;
    moveZ = joystickVector.y;
  }

  // Smooth acceleration
  const maxSpeed = 0.24;
  const accel = 0.048;
  const deccel = 0.18; // smoother stop

  if (moveX !== 0 || moveZ !== 0) {
    // Normalize moving direction
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
    playerVelocity.x += (moveX / length) * accel;
    playerVelocity.z += (moveZ / length) * accel;
    
    // Clamp speed
    const currentSpeed = Math.sqrt(playerVelocity.x*playerVelocity.x + playerVelocity.z*playerVelocity.z);
    if (currentSpeed > maxSpeed) {
      playerVelocity.x = (playerVelocity.x / currentSpeed) * maxSpeed;
      playerVelocity.z = (playerVelocity.z / currentSpeed) * maxSpeed;
    }

    // Walking limbs animations (Arm & Leg swing)
    const swingSpeed = 15;
    const swingAngle = 0.55;
    const torso = player3dGroup.getObjectByName("torso");
    if (torso) {
      const legL = torso.getObjectByName("legL");
      const legR = torso.getObjectByName("legR");
      const armL = torso.getObjectByName("armL");
      const armR = torso.getObjectByName("armR");

      if (legL && legR && armL && armR) {
        legL.rotation.x = Math.sin(time * swingSpeed) * swingAngle;
        legR.rotation.x = -Math.sin(time * swingSpeed) * swingAngle;
        armL.rotation.x = -Math.sin(time * swingSpeed) * swingAngle * 0.8;
        armR.rotation.x = Math.sin(time * swingSpeed) * swingAngle * 0.8;
      }
    }

    // Rotate player direction to movement
    const targetAngle = Math.atan2(playerVelocity.x, playerVelocity.z);
    // Smooth rotate
    player3dGroup.rotation.y = targetAngle;

  } else {
    // Stop smoothly
    playerVelocity.x *= (1 - deccel);
    playerVelocity.z *= (1 - deccel);
    if (Math.abs(playerVelocity.x) < 0.01) playerVelocity.x = 0;
    if (Math.abs(playerVelocity.z) < 0.01) playerVelocity.z = 0;

    // Reset limbs to idle
    const torso = player3dGroup.getObjectByName("torso");
    if (torso) {
      const legL = torso.getObjectByName("legL");
      const legR = torso.getObjectByName("legR");
      const armL = torso.getObjectByName("armL");
      const armR = torso.getObjectByName("armR");
      if (legL && legR && armL && armR) {
        legL.rotation.x = 0;
        legR.rotation.x = 0;
        armL.rotation.x = 0;
        armR.rotation.x = 0;
      }
    }
  }

  // Update Player Position
  player3dGroup.position.x += playerVelocity.x;
  player3dGroup.position.z += playerVelocity.z;

  // Border boundaries enforcement
  const distFromCenter = Math.sqrt(player3dGroup.position.x*player3dGroup.position.x + player3dGroup.position.z*player3dGroup.position.z);
  if (distFromCenter > mapBoundaryRadius) {
    player3dGroup.position.x = (player3dGroup.position.x / distFromCenter) * mapBoundaryRadius;
    player3dGroup.position.z = (player3dGroup.position.z / distFromCenter) * mapBoundaryRadius;
  }

  // Pet float bobbing animation
  const pet = player3dGroup.getObjectByName("pet");
  if (pet) {
    pet.position.y = 0.5 + Math.sin(time * 3.5) * 0.15;
  }

  // Jump physics
  if (playerIsJumping || player3dGroup.position.y > 0) {
    playerVertVelocity += GRAVITY_FORCE;
    player3dGroup.position.y += playerVertVelocity;
    if (player3dGroup.position.y <= 0) {
      player3dGroup.position.y = 0;
      playerVertVelocity = 0;
      playerIsJumping = false;
      // Land squash effect
      const torso = player3dGroup.getObjectByName("torso");
      if (torso) {
        torso.scale.set(1.2, 0.8, 1.2);
        setTimeout(() => { if (torso) torso.scale.set(1, 1, 1); }, 120);
      }
    }
  }

  // Smooth orbit camera using bossCamState
  const camH = 11.5;
  const camTX = player3dGroup.position.x + Math.sin(bossCamState.yaw) * bossCamState.dist;
  const camTY = player3dGroup.position.y + camH;
  const camTZ = player3dGroup.position.z + Math.cos(bossCamState.yaw) * bossCamState.dist;
  camera3d.position.x += (camTX - camera3d.position.x) * 0.08;
  camera3d.position.y += (camTY - camera3d.position.y) * 0.08;
  camera3d.position.z += (camTZ - camera3d.position.z) * 0.08;
  camera3d.lookAt(player3dGroup.position.x, player3dGroup.position.y + 1.2, player3dGroup.position.z);

  // Golem Boss floating bobbing & rotating to face player
  if (boss3dGroup) {
    const bossTorso = boss3dGroup.getObjectByName("boss_torso");
    if (bossTorso) {
      bossTorso.position.y = 2.2 + Math.sin(time * 2.0) * 0.12;
    }
    // Face player
    boss3dGroup.lookAt(player3dGroup.position.x, 0, player3dGroup.position.z);
  }

  // Portal beams rotating effect
  portals3dArray.forEach((pGroup) => {
    pGroup.rotation.y += 0.015;
  });

  // Projectiles simulation (Player projectile & Boss lightning)
  update3DProjectiles();

  // P2 multiplayer movement + collision
  updatePlayer2Movement(time);

  // 2. Collision Check: Player meets answer Portal
  checkPortalCollisions3D();

  // 3. Render
  renderer3d.render(scene3d, camera3d);
}

const clock3D = new THREE.Clock();

function checkPortalCollisions3D() {
  if (isAnswerProcessing || !player3dGroup) return;

  portals3dArray.forEach((portalGroup, idx) => {
    const dist = player3dGroup.position.distanceTo(portalGroup.position);
    
    // Trigger zone (within 1.6 units)
    if (dist < 1.6) {
      isAnswerProcessing = true;
      const chosenVal = parseInt(portalGroup.getAttribute("data-val"));
      handleAnswerSelect3D(chosenVal, portalGroup);
    }
  });
}

function handleAnswerSelect3D(chosenVal, hitPortalGroup) {
  // Check answer correctness
  const isCorrect = (chosenVal === currentQuestionData.ans);

  if (isCorrect) {
    sounds.coin();
    comboCount++;
    bossQuestionsCorrect++;
    document.getElementById("action-combo-val").innerText = comboCount;

    const totalDmg = Math.round(maxBossHP / BOSS_QUESTIONS_REQUIRED) * comboCount;
    triggerPlayerAttackAnimation(totalDmg);
    triggerBossHitEffect();
    // TTS: announce the multiplication fact
    speakThai(`${currentQuestionData.table} คูณ ${currentQuestionData.mult} เท่ากับ ${currentQuestionData.ans} ถูกต้อง`);
    updateBossQuestionsUI(); // also updates HP bar

    scoreRobuxEarned += 10;
    document.getElementById("action-robux-earned").innerText = scoreRobuxEarned;
  } else {
    // --- WRONG PATH ---
    sounds.oof();
    comboCount = 0; // reset combo
    document.getElementById("action-combo-val").innerText = comboCount;

    triggerBossAttackAnimation();
    triggerPlayerDamageEffect();
    speakThai('ผิดแล้ว หลบวงแดงให้ทัน');
    playerHP = Math.max(0, playerHP - 10);
    updatePlayerHPUI();

    if (playerHP <= 0) {
      setTimeout(() => endGameplaySession3D(false), 1000);
      return;
    }
  }

  // Load next question — keep player's current position
  setTimeout(() => {
    if (bossQuestionsCorrect >= BOSS_QUESTIONS_REQUIRED) {
      endGameplaySession3D(true);
    } else {
      isAnswerProcessing = false;
      // No position reset! Player continues from where they are
      nextActionQuestion3D();
    }
  }, 1400);
}

// 3D Player weapon slash projectile
function triggerPlayerAttackAnimation(damageVal) {
  if (!player3dGroup || !boss3dGroup) return;

  sounds.shoot();

  // Custom player jump slash
  const torso = player3dGroup.getObjectByName("torso");
  if (torso) {
    // Jump animation
    let frames = 0;
    const jumpInterval = setInterval(() => {
      frames++;
      if (frames <= 10) {
        torso.position.y += 0.15; // Go up
        torso.rotation.x = -0.05 * frames;
      } else if (frames <= 20) {
        torso.position.y -= 0.15; // Fall back
        torso.rotation.x = -0.5 + (0.05 * (frames - 10));
      } else {
        torso.position.y = 1.5;
        torso.rotation.x = 0;
        clearInterval(jumpInterval);
      }
    }, 25);
  }

  // Spawn projectile sphere heading from player to boss
  const bulletGeo = new THREE.SphereGeometry(0.35, 8, 8);
  const bulletMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    emissive: 0x00ffff 
  });
  bullet3d = new THREE.Mesh(bulletGeo, bulletMat);
  bullet3d.position.copy(player3dGroup.position);
  bullet3d.position.y += 1.5;
  scene3d.add(bullet3d);

  bullet3d.userData = {
    targetPos: new THREE.Vector3().copy(boss3dGroup.position).add(new THREE.Vector3(0, 2.5, 0)),
    damage: damageVal
  };
}

// Boss fires red beam at player
function triggerBossAttackAnimation() {
  if (!boss3dGroup || !player3dGroup) return;

  sounds.hit();

  // Golem flashes red
  const bossTorso = boss3dGroup.getObjectByName("boss_torso");
  if (bossTorso) {
    const originalColor = new THREE.Color(0x8e44ad);
    const hitColor = new THREE.Color(0xe74c3c);
    bossTorso.material.color.copy(hitColor);
    setTimeout(() => {
      if (bossTorso.material) bossTorso.material.color.copy(originalColor);
    }, 400);
  }

  // Draw lighting line from boss to player
  const points = [];
  points.push(new THREE.Vector3().copy(boss3dGroup.position).add(new THREE.Vector3(0, 3, 0)));
  // Mid jagged point
  const midPoint = new THREE.Vector3().lerpVectors(boss3dGroup.position, player3dGroup.position, 0.5);
  midPoint.y += 4;
  points.push(midPoint);
  points.push(new THREE.Vector3().copy(player3dGroup.position).add(new THREE.Vector3(0, 1.2, 0)));

  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ 
    color: 0xff0000, 
    linewidth: 5 // fallback
  });
  bossLightningBeam = new THREE.Line(lineGeo, lineMat);
  scene3d.add(bossLightningBeam);

  // Clear beam soon
  setTimeout(() => {
    if (bossLightningBeam) {
      scene3d.remove(bossLightningBeam);
      bossLightningBeam = null;
    }
  }, 300);

  // Push player back (Knockback force)
  const pushDir = new THREE.Vector3().copy(player3dGroup.position).sub(boss3dGroup.position).normalize();
  player3dGroup.position.addScaledVector(pushDir, 3.5); // Push back along direction
}

function update3DProjectiles() {
  // Update player bullet towards boss
  if (bullet3d) {
    const target = bullet3d.userData.targetPos;
    const speed = 0.75;
    bullet3d.position.lerp(target, speed);

    // Hit check
    if (bullet3d.position.distanceTo(target) < 0.8) {
      scene3d.remove(bullet3d);
      
      const dmg = bullet3d.userData.damage;
      bullet3d = null;

      // Deduct Boss HP
      currentBossHP = Math.max(0, currentBossHP - dmg);
      updateBossHPUI();

      // Boss hit blink animation
      const bossTorso = boss3dGroup.getObjectByName("boss_torso");
      if (bossTorso) {
        bossTorso.material.emissive.setHex(0xff0000);
        setTimeout(() => {
          if (bossTorso.material) bossTorso.material.emissive.setHex(0x000000);
        }, 150);
      }

      // Spawn damage floating HTML text
      spawnFloatingDamageText(dmg);
    }
  }
}

// Boss periodic attack — spawns red danger zone every 4s, explodes after 1.2s
function startBossAttackLoop() {
  stopBossAttackLoop();
  bossAttackInterval = setInterval(() => {
    if (!threeEngineActive || !player3dGroup) return;
    spawnDangerZone();
  }, 4000);
}

// === Boss Attack Effect (correct answer) ===
function triggerBossHitEffect() {
  if (!boss3dGroup || !scene3d) return;
  // Shockwave ring expanding from boss
  const geo = new THREE.RingGeometry(0.5, 1.0, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(boss3dGroup.position);
  ring.position.y = 0.1;
  scene3d.add(ring);
  let f = 0;
  const ri = setInterval(() => {
    f++; ring.scale.setScalar(1 + f * 0.25);
    ring.material.opacity = Math.max(0, 0.9 - f * 0.06);
    if (f >= 15) { clearInterval(ri); scene3d.remove(ring); }
  }, 20);
  // Boss flash red
  const bossTorso = boss3dGroup.getObjectByName("boss_torso");
  if (bossTorso?.material) {
    bossTorso.material.emissive.setHex(0xff2200);
    bossTorso.material.emissiveIntensity = 1.5;
    setTimeout(() => { if (bossTorso.material) { bossTorso.material.emissive.setHex(0x000000); bossTorso.material.emissiveIntensity = 0; } }, 250);
  }
}

// === Player Damage Effect (wrong answer) ===
function triggerPlayerDamageEffect() {
  if (!player3dGroup) return;
  // Red screen flash overlay
  const vp = document.getElementById('arena-3d-viewport');
  if (vp) {
    const flash = document.createElement('div');
    flash.style.cssText = 'position:absolute;inset:0;background:rgba(255,0,0,0.4);z-index:100;pointer-events:none;transition:opacity 0.4s;';
    vp.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 400); }, 80);
  }
  // Player knockback blink
  const torso = player3dGroup.getObjectByName("torso");
  if (torso?.material) {
    const orig = new THREE.Color().copy(torso.material.color);
    torso.material.color.setHex(0xff2222);
    setTimeout(() => { if (torso.material) torso.material.color.copy(orig); }, 300);
  }
}

// Boss death + player victory — KEEP boss corpse in scene
function playBossDeathAnimation() {
  threeEngineActive = false;
  stopBossAttackLoop();
  sounds.win();

  let frame = 0;
  const bossDeathInt = setInterval(() => {
    frame++;
    if (boss3dGroup) {
      // Fall sideways and sink — but remain as corpse
      boss3dGroup.rotation.z = Math.min(Math.PI / 2, (frame / 35) * (Math.PI / 2));
      boss3dGroup.position.y = Math.max(-1.5, boss3dGroup.position.y - 0.04);
    }
    if (frame >= 50) {
      clearInterval(bossDeathInt);
      // Boss stays as corpse (not removed from scene!)
      // Dim it slightly to show it's dead
      if (boss3dGroup) {
        boss3dGroup.traverse(child => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.color.multiplyScalar(0.3);
            child.material.emissive?.setHex(0x000000);
          }
        });
      }
      // Smoke effect from corpse
      spawnBossDeathSmoke();
      playPlayerVictoryDance3D();
    }
    if (scene3d && renderer3d && camera3d) renderer3d.render(scene3d, camera3d);
  }, 25);
}

function spawnBossDeathSmoke() {
  if (!scene3d || !boss3dGroup) return;
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      if (!scene3d) return;
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.5 + Math.random(), 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.7 })
      );
      smoke.position.set(
        boss3dGroup.position.x + (Math.random()-0.5)*3,
        Math.random()*2,
        boss3dGroup.position.z + (Math.random()-0.5)*3
      );
      scene3d.add(smoke);
      let sf = 0;
      const si = setInterval(() => {
        sf++; smoke.position.y += 0.05; smoke.material.opacity = Math.max(0, 0.7-sf*0.04);
        smoke.scale.setScalar(1+sf*0.05);
        if (sf >= 20) { clearInterval(si); scene3d?.remove(smoke); }
      }, 40);
    }, i * 120);
  }
}

function playPlayerVictoryDance3D() {
  let frame = 0;
  const danceInt = setInterval(() => {
    frame++;
    if (player3dGroup) {
      // Bob up and down
      player3dGroup.position.y = Math.abs(Math.sin(frame * 0.28)) * 0.8;
      player3dGroup.rotation.y += 0.15;
      // Arm raise
      const torso = player3dGroup.getObjectByName("torso");
      if (torso) {
        const aL = torso.getObjectByName("armL");
        const aR = torso.getObjectByName("armR");
        if (aL) aL.rotation.x = -Math.abs(Math.sin(frame * 0.28)) * 1.8;
        if (aR) aR.rotation.x = -Math.abs(Math.sin(frame * 0.28 + 0.5)) * 1.8;
      }
    }
    if (scene3d && renderer3d && camera3d) renderer3d.render(scene3d, camera3d);
    if (frame >= 100) {
      clearInterval(danceInt);
      if (player3dGroup) { player3dGroup.position.y = 0; player3dGroup.rotation.y = 0; }
      showSuccessOverlay3D(
        'arena-3d-viewport',
        '🏆 โค่นบอสสำเร็จ!',
        `ตอบครบ ${BOSS_QUESTIONS_REQUIRED} ข้อ | R$ +${scoreRobuxEarned + playerHP}`,
        () => { endGameplaySession3D(true); }
      );
    }
  }, 25);
}

function stopBossAttackLoop() {
  if (bossAttackInterval) {
    clearInterval(bossAttackInterval);
    bossAttackInterval = null;
  }
  dangerZones3D.forEach(dz => {
    if (dz.mesh && scene3d) scene3d.remove(dz.mesh);
  });
  dangerZones3D = [];
}

function spawnDangerZone() {
  if (!scene3d || !player3dGroup) return;

  // Random position near player (within 6 units)
  const offsetX = (Math.random() - 0.5) * 10;
  const offsetZ = (Math.random() - 0.5) * 10;
  const px = player3dGroup.position.x + offsetX;
  const pz = player3dGroup.position.z + offsetZ;
  const dangerRadius = 3.5;

  // Red glowing disc on ground
  const geo = new THREE.CylinderGeometry(dangerRadius, dangerRadius, 0.08, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff2200,
    transparent: true,
    opacity: 0.55
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, 0.05, pz);
  scene3d.add(mesh);

  // Show HUD warning
  const warnEl = document.getElementById("danger-zone-warning");
  if (warnEl) { warnEl.style.display = "block"; setTimeout(() => { warnEl.style.display = "none"; }, 1400); }

  const dzData = { mesh, px, pz, radius: dangerRadius, exploded: false };
  dangerZones3D.push(dzData);

  // Pulse scale animation
  let pulse = 0;
  const pulseInt = setInterval(() => {
    pulse += 0.1;
    const s = 1.0 + Math.sin(pulse * 6) * 0.08;
    if (mesh) mesh.scale.set(s, 1, s);
  }, 50);

  // After 1.2s — explode
  setTimeout(() => {
    clearInterval(pulseInt);
    if (!dzData.exploded) {
      dzData.exploded = true;
      // Check if player is still inside
      if (player3dGroup) {
        const dx = player3dGroup.position.x - px;
        const dz = player3dGroup.position.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < dangerRadius) {
          // Deal 10% HP damage
          playerHP = Math.max(0, playerHP - 10);
          updatePlayerHPUI();
          sounds.hit();
          if (playerHP <= 0) {
            setTimeout(() => endGameplaySession3D(false), 800);
          }
        }
      }
    }
    // Flash red before removal
    if (mesh && mesh.material) mesh.material.color.setHex(0xff6600);
    setTimeout(() => {
      if (scene3d && mesh) scene3d.remove(mesh);
      dangerZones3D = dangerZones3D.filter(d => d !== dzData);
    }, 300);
  }, 1200);
}

// Display floating damage text overlay on screen
function spawnFloatingDamageText(damageVal) {
  const container = document.querySelector(".arena-3d-wrapper");
  if (!container) return;

  const dmgLabel = document.createElement("div");
  dmgLabel.className = "floating-damage-label";
  dmgLabel.innerText = `-${damageVal} HP!`;
  
  // Custom coloring for high damage
  if (comboCount > 2) {
    dmgLabel.style.color = "#ff3388";
    dmgLabel.style.fontSize = "2.0rem";
    dmgLabel.style.textShadow = "0 0 10px red";
  } else {
    dmgLabel.style.color = "#ffcc00";
    dmgLabel.style.fontSize = "1.5rem";
  }

  // Place center of viewport
  dmgLabel.style.position = "absolute";
  dmgLabel.style.left = "50%";
  dmgLabel.style.top = "40%";
  dmgLabel.style.transform = "translate(-50%, -50%)";
  dmgLabel.style.fontWeight = "900";
  dmgLabel.style.zIndex = "150";
  dmgLabel.style.pointerEvents = "none";
  dmgLabel.style.transition = "all 0.8s ease-out";
  container.appendChild(dmgLabel);

  // Animate floats and fades
  setTimeout(() => {
    dmgLabel.style.top = "15%";
    dmgLabel.style.opacity = "0";
  }, 50);

  setTimeout(() => {
    dmgLabel.remove();
  }, 900);
}

function updateBossQuestionsUI() {
  const el = document.getElementById("boss-questions-counter");
  if (el) el.innerText = `${bossQuestionsCorrect} / ${BOSS_QUESTIONS_REQUIRED}`;
  // Update boss HP bar proportionally to questions answered
  const pct = Math.min(100, (bossQuestionsCorrect / BOSS_QUESTIONS_REQUIRED) * 100);
  currentBossHP = Math.max(0, maxBossHP - Math.round((pct / 100) * maxBossHP));
  updateBossHPUI();
}

function updatePlayerHPUI() {
  const fill = document.getElementById("player-hp-fill-bar");
  const text = document.getElementById("player-current-hp");
  if (fill) fill.style.width = `${playerHP}%`;
  if (text) text.innerText = playerHP;

  // Color shift: green → yellow → red
  if (fill) {
    if (playerHP > 60) {
      fill.style.background = "linear-gradient(90deg,#00b06f,#39ff14)";
    } else if (playerHP > 30) {
      fill.style.background = "linear-gradient(90deg,#f79f1f,#ffe000)";
    } else {
      fill.style.background = "linear-gradient(90deg,#d82626,#ff6b6b)";
    }
  }
}

function updateBossHPUI() {
  document.getElementById("boss-current-hp").innerText = currentBossHP;
  const pct = Math.max(0, (currentBossHP / maxBossHP) * 100);
  document.getElementById("boss-hp-fill-bar").style.width = `${pct}%`;
}

// --- Next Question Arena 3D ---
function nextActionQuestion3D() {
  currentQuestionIndex++;
  currentQuestionData = generateMathQuestion(selectedArenaTable);

  document.getElementById("action-question").innerText = `${currentQuestionData.table} x ${currentQuestionData.mult} = ?`;
  updatePortalBillboardTexts(currentQuestionData.opts);

  // TTS: read the question aloud
  setTimeout(() => {
    speakThai(`${currentQuestionData.table} คูณ ${currentQuestionData.mult} เท่ากับเท่าไร`);
  }, 200);
}

function onWindowResize3D() {
  const container = document.getElementById("arena-3d-viewport");
  if (!container || !renderer3d) return;
  camera3d.aspect = container.clientWidth / container.clientHeight;
  camera3d.updateProjectionMatrix();
  renderer3d.setSize(container.clientWidth, container.clientHeight);
}

function endGameplaySession3D(success) {
  if (success && boss3dGroup) {
    playBossDeathAnimation();
    return;
  }
  // Player HP = 0 → death animation
  if (!success) {
    playPlayerDeathAnimation3D();
    return;
  }
  // Cleanup
  threeEngineActive = false;
  stopBossAttackLoop();
  if (bossController) { bossController.destroy(); bossController = null; }
  if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
  window.removeEventListener("resize", onWindowResize3D);
  exitFullscreenGameplay();
  endGameplaySession(success);
}

function playPlayerDeathAnimation3D() {
  threeEngineActive = false;
  stopBossAttackLoop();
  sounds.oof();
  speakThai('หมดแรงแล้ว สู้ต่อไปนะ');

  let frame = 0;
  const deathInt = setInterval(() => {
    frame++;
    if (player3dGroup) {
      player3dGroup.rotation.z = Math.min(Math.PI / 2, (frame / 30) * (Math.PI / 2));
      player3dGroup.position.y = Math.max(-0.5, player3dGroup.position.y - 0.03);
      // Fade to gray
      player3dGroup.traverse(child => {
        if (child.isMesh && child.material && frame === 15) {
          child.material = child.material.clone();
          child.material.color.lerp(new THREE.Color(0x555555), 0.5);
        }
      });
    }
    if (scene3d && renderer3d && camera3d) renderer3d.render(scene3d, camera3d);

    if (frame >= 45) {
      clearInterval(deathInt);
      showPlayerDeathOverlay();
    }
  }, 25);
}

function showPlayerDeathOverlay() {
  const vp = document.getElementById('arena-3d-viewport');
  if (!vp) return;
  vp.style.position = 'relative';
  const ov = document.createElement('div');
  ov.className = 'success-overlay-3d';
  ov.innerHTML = `
    <div class="success-modal-3d" style="border-color:#d82626;box-shadow:0 0 40px rgba(216,38,38,0.5);">
      <div class="success-icon-big">💀</div>
      <h2 style="color:#ff4444;">อวาตาร์หมดแรง!</h2>
      <p style="color:var(--rbx-text-muted);">HP หมดแล้ว แต่อย่าท้อนะ!</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button class="btn-success-confirm" style="background:linear-gradient(135deg,var(--rbx-red),#ff5252);" id="btn-retry-boss">⚔️ ลองใหม่</button>
        <button class="btn-success-confirm" style="background:rgba(40,40,40,0.8);color:#aaa;border:1px solid #555;" id="btn-exit-dead">🏠 หน้าหลัก</button>
      </div>
    </div>
  `;
  vp.appendChild(ov);

  document.getElementById('btn-retry-boss')?.addEventListener('click', () => {
    ov.remove();
    // Cleanup and restart
    if (bossController) { bossController.destroy(); bossController = null; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    window.removeEventListener("resize", onWindowResize3D);
    startPathGameplay('action'); // restart
  });
  document.getElementById('btn-exit-dead')?.addEventListener('click', () => {
    ov.remove();
    if (bossController) { bossController.destroy(); bossController = null; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    window.removeEventListener("resize", onWindowResize3D);
    exitFullscreenGameplay();
    endGameplaySession(false);
  });
}

// ==========================================================================
// 6. Arena Mode Logic (General Paths Manager)
// ==========================================================================
let activeArenaZone = 1;
let selectedArenaTable = null;
let activePlayPath = null; // "action", "chill", "dressup"

let currentQuestionIndex = 0;
let currentQuestionData = {};
let scoreRobuxEarned = 0;
let chillHintUsed = false;
let currentStreak = 0;
let targetStreak = 5;
let questItemToUnlock = null;
let isPlayingSequential = false;

const ZONE_TABLES = {
  1: [2, 3, 4, 5, 6],
  2: [7, 8, 9, 10, 11, 12],
  3: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
};

function renderArenaTables() {
  const container = document.getElementById("arena-table-list");
  container.innerHTML = "";
  const tables = ZONE_TABLES[activeArenaZone];

  tables.forEach((tableNum) => {
    const btn = document.createElement("button");
    btn.className = "btn-arena-table";
    btn.innerText = `แม่ ${tableNum}`;
    
    if (gameState.completedTables.includes(tableNum)) {
      btn.classList.add("completed");
    }

    btn.addEventListener("click", () => {
      isPlayingSequential = false;
      selectArenaTable(tableNum);
    });
    container.appendChild(btn);
  });
}

function selectArenaTable(tableNum) {
  sounds.click();
  selectedArenaTable = tableNum;

  // Safe element updates (some may no longer exist after HTML changes)
  const safe = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  safe("arena-selected-table-label", `แม่ ${tableNum}`);
  safe("quest-table-name", tableNum);
  safe("boss-table-val", tableNum);
  safe("quest-target-combo", targetStreak);

  document.getElementById("arena-step-table").classList.remove("active");
  document.getElementById("arena-step-path").classList.add("active");
}

function generateMathQuestion(tableNum) {
  const multiplier = Math.floor(Math.random() * 12) + 1;
  const result = tableNum * multiplier;

  // Generate exactly 2 wrong answers + 1 correct = 3 total (no 4th that gets cut off)
  const wrongSet = new Set();
  let tries = 0;
  while (wrongSet.size < 2 && tries < 300) {
    tries++;
    const wm = Math.floor(Math.random() * 12) + 1;
    if (wm !== multiplier) wrongSet.add(tableNum * wm);
  }
  // Fallback wrong answers if couldn't generate enough
  if (wrongSet.size < 2) wrongSet.add(result + tableNum);
  if (wrongSet.size < 2) wrongSet.add(Math.abs(result - tableNum) || result + 1);

  // Always exactly 3 options, correct answer guaranteed
  const opts = [result, ...Array.from(wrongSet).slice(0, 2)];
  opts.sort(() => Math.random() - 0.5);

  return {
    table: tableNum,
    mult: multiplier,
    ans: result,
    opts   // exactly 3 items, correct answer always present
  };
}

// Start Game Play
function startPathGameplay(path) {
  sounds.click();
  activePlayPath = path;
  currentQuestionIndex = 0;
  scoreRobuxEarned = 0;
  currentStreak = 0;

  document.getElementById("arena-step-path").classList.remove("active");
  document.getElementById("arena-step-gameplay").classList.add("active");

  document.getElementById("gameplay-action").style.display = "none";
  document.getElementById("gameplay-chill").style.display = "none";
  document.getElementById("gameplay-dressup").style.display = "none";

  // Unlock iOS audio immediately (user gesture context)
  unlockIOSAudio();

  // Enter fullscreen — CSS approach works on iOS
  setTimeout(() => {
    enterFullscreenGameplay(`gameplay-${path}`);
    // iOS: also try CSS landscape expand
    if (isIOSSafari()) {
      const el = document.getElementById(`gameplay-${path}`);
      if (el) { el.classList.add('training-ios-fullscreen'); document.body.classList.add('training-body-lock'); }
    }
  }, 80);

  if (path === "action") {
    document.getElementById("gameplay-action").style.display = "block";

    // Reset player HP to 100%
    playerHP = 100;
    updatePlayerHPUI();

    // Fixed 240 HP — consistent with 12 correct answers × 20 HP each
    maxBossHP = 240;
    currentBossHP = maxBossHP;
    document.getElementById("boss-max-hp").innerText = maxBossHP;
    updateBossHPUI();

    comboCount = 0;
    bossQuestionsCorrect = 0;
    document.getElementById("action-combo-val").innerText = 0;
    document.getElementById("action-robux-earned").innerText = 0;
    updateBossQuestionsUI();

    // Show/hide P2 HUD
    const p2Hud = document.getElementById("p2-hud");
    if (p2Hud) p2Hud.style.display = multiplayerMode ? "inline-flex" : "none";

    isAnswerProcessing = false;

    // Load Three.js 3D Viewport
    initThreeJS();
    nextActionQuestion3D();

    // Init P2 if multiplayer
    if (multiplayerMode) {
      player2HP = 100; player2Score = 0;
      player2Velocity = { x: 0, z: 0 };
      setTimeout(() => { if (scene3d) { build3DPlayer2(); updatePlayer2HPUI(); } }, 500);
    }

  } else if (path === "chill") {
    document.getElementById("gameplay-chill").style.display = "block";
    document.getElementById("chill-robux-earned").innerText = 0;
    setTimeout(() => initChillFarm3D(), 80);

  } else if (path === "dressup") {
    document.getElementById("gameplay-dressup").style.display = "block";

    const locked = SHOP_ITEMS.filter(i => !gameState.unlockedItems.includes(i.id));
    questItemToUnlock = locked.length > 0
      ? locked[Math.floor(Math.random() * locked.length)]
      : { name: "ดาบแสงจักรวาลระดับตำนาน", icon: "👑", price: 999, id: "rare_gift", rarity: "legendary" };

    document.getElementById("quest-item-icon").innerText = questItemToUnlock.icon;
    document.getElementById("quest-item-name").innerText = questItemToUnlock.name;
    document.getElementById("quest-combo-fill").style.width = "0%";
    document.getElementById("quest-current-combo").innerText = 0;

    targetStreak = (questItemToUnlock.rarity === "legendary") ? 9 : (questItemToUnlock.rarity === "rare") ? 7 : 5;
    document.getElementById("quest-target-combo-text").innerText = targetStreak;

    setTimeout(() => initDressupRunway3D(), 80);
  }
}

// --------------------------------------------------------------------------
// Path 2: Chill Logic
// --------------------------------------------------------------------------
function nextChillQuestion() {
  if (currentQuestionIndex >= 10) {
    endGameplaySession(true);
    return;
  }
  currentQuestionIndex++;
  chillHintUsed = false;
  document.getElementById("hint-display-panel").style.display = "none";

  currentQuestionData = generateMathQuestion(selectedArenaTable);
  document.getElementById("chill-question").innerText = `${currentQuestionData.table} x ${currentQuestionData.mult} = ?`;

  const choicesContainer = document.getElementById("chill-choices");
  choicesContainer.innerHTML = "";

  currentQuestionData.opts.forEach((optVal) => {
    const btn = document.createElement("button");
    btn.className = "chill-choice-btn";
    btn.innerText = optVal;
    btn.addEventListener("click", () => {
      const btns = choicesContainer.querySelectorAll("button");
      btns.forEach(b => b.disabled = true);

      if (optVal === currentQuestionData.ans) {
        btn.classList.add("correct");
        sounds.coin();
        scoreRobuxEarned += 5;
        document.getElementById("chill-robux-earned").innerText = scoreRobuxEarned;
        setTimeout(nextChillQuestion, 1000);
      } else {
        btn.classList.add("wrong");
        sounds.oof();
        btns.forEach(b => {
          if (parseInt(b.innerText) === currentQuestionData.ans) {
            b.classList.add("correct");
          }
        });
        setTimeout(nextChillQuestion, 2000);
      }
    });
    choicesContainer.appendChild(btn);
  });
}

function triggerChillHint() {
  if (chillHintUsed) return;
  sounds.click();
  chillHintUsed = true;
  
  const hintPanel = document.getElementById("hint-display-panel");
  hintPanel.style.display = "block";

  const numA = currentQuestionData.table;
  const numB = currentQuestionData.mult;
  
  const storyData = getStoryForEquation(numA, numB);
  document.getElementById("hint-text-content").innerText = storyData.story;

  const blocksContainer = document.getElementById("hint-blocks-container");
  blocksContainer.innerHTML = "";
  const totalDots = numA * numB;
  
  const renderLimit = Math.min(totalDots, 36);
  for (let i = 0; i < renderLimit; i++) {
    const dot = document.createElement("div");
    dot.className = "hint-dot";
    blocksContainer.appendChild(dot);
  }
  if (totalDots > 36) {
    const moreText = document.createElement("span");
    moreText.innerText = `...และอีก ${totalDots - 36} บล็อก`;
    moreText.style.fontSize = "0.75rem";
    blocksContainer.appendChild(moreText);
  }
}

// --------------------------------------------------------------------------
// Path 3: Dressup Quest Logic
// --------------------------------------------------------------------------
function nextDressupQuestion() {
  currentQuestionData = generateMathQuestion(selectedArenaTable);
  document.getElementById("dressup-question").innerText = `${currentQuestionData.table} x ${currentQuestionData.mult} = ?`;

  const choicesContainer = document.getElementById("dressup-choices");
  choicesContainer.innerHTML = "";

  const shuffledChoices = [...currentQuestionData.opts].slice(0, 3);
  if (!shuffledChoices.includes(currentQuestionData.ans)) {
    shuffledChoices[0] = currentQuestionData.ans;
    shuffledChoices.sort(() => Math.random() - 0.5);
  }

  shuffledChoices.forEach((optVal) => {
    const btn = document.createElement("button");
    btn.className = "dressup-choice-btn";
    btn.innerText = optVal;
    
    btn.addEventListener("click", () => {
      const btns = choicesContainer.querySelectorAll("button");
      btns.forEach(b => b.disabled = true);

      if (optVal === currentQuestionData.ans) {
        btn.style.backgroundColor = "var(--rbx-green)";
        sounds.coin();
        currentStreak++;
        
        document.getElementById("quest-current-combo").innerText = currentStreak;
        const fillPercent = Math.min(100, (currentStreak / targetStreak) * 100);
        document.getElementById("quest-combo-fill").style.width = `${fillPercent}%`;

        if (currentStreak >= targetStreak) {
          endGameplaySession(true);
        } else {
          setTimeout(nextDressupQuestion, 1000);
        }
      } else {
        btn.style.backgroundColor = "var(--rbx-red)";
        sounds.oof();
        currentStreak = 0;
        document.getElementById("quest-current-combo").innerText = 0;
        document.getElementById("quest-combo-fill").style.width = "0%";
        setTimeout(nextDressupQuestion, 1500);
      }
    });
    choicesContainer.appendChild(btn);
  });
}

// --------------------------------------------------------------------------
// End Gameplay & Result View
// --------------------------------------------------------------------------
function stopAllGameScenes() {
  stopBossAttackLoop();
  if (chillFarmAnimId) { cancelAnimationFrame(chillFarmAnimId); chillFarmAnimId = null; }
  if (dressupAnimId3d) { cancelAnimationFrame(dressupAnimId3d); dressupAnimId3d = null; }
  stopStepDance3D();
  stopTrampoline3D();
  try { speechSynthesis.cancel(); } catch(e) {}
}

function endGameplaySession(success) {
  
  // Shutdown 3D scene engine loop
  threeEngineActive = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  sounds.win();

  document.getElementById("arena-step-gameplay").classList.remove("active");
  document.getElementById("arena-step-result").classList.add("active");

  const resultTitle = document.getElementById("result-title");
  const resultSummary = document.getElementById("result-summary");
  const resultIcon = document.getElementById("result-icon");
  const robuxRewardSpan = document.getElementById("result-robux-reward");
  const unlockedBox = document.getElementById("result-unlocked-box");
  const unlockedItemName = document.getElementById("result-unlocked-item-name");

  unlockedBox.style.display = "none";

  if (success && !gameState.completedTables.includes(selectedArenaTable)) {
    gameState.completedTables.push(selectedArenaTable);
  }

  if (activePlayPath === "action") {
    resultIcon.innerText = "⚔️";
    if (success) {
      resultTitle.innerText = "ผู้พิทักษ์ 3D พิชิตบอสสำเร็จ! 👾🎉";
      const hpBonus = playerHP;  // เลือดเหลือยิ่งมาก โบนัสยิ่งเยอะ
      const totalReward = scoreRobuxEarned + hpBonus;
      resultSummary.innerText = `โค่นบอสแม่ ${selectedArenaTable} สำเร็จ! ได้ ${scoreRobuxEarned} R$ + โบนัส HP เหลือ ${hpBonus} R$ รวม ${totalReward} R$!`;
      robuxRewardSpan.innerText = totalReward;
      gameState.robux += totalReward;
    } else {
      resultTitle.innerText = "บอสคณิตศาสตร์ชนะคุณ! 💔";
      resultSummary.innerText = `พลังชีวิตของคุณหรือเวลาหมดแล้ว! แต่คุณเก่งมากแล้วสะสมรางวัลจากการลดเลือดบอสได้บางส่วน`;
      robuxRewardSpan.innerText = Math.max(10, scoreRobuxEarned);
      gameState.robux += Math.max(10, scoreRobuxEarned);
    }

  } else if (activePlayPath === "chill") {
    resultIcon.innerText = "🏕️";
    resultTitle.innerText = "การท่องเที่ยวสำเร็จเรียบร้อย! 🌈";
    resultSummary.innerText = `คุณเรียนรู้สูตรคูณแม่ ${selectedArenaTable} โหมดชิลครบ 10 ข้อด้วยสมาธิที่ยอดเยี่ยม`;
    robuxRewardSpan.innerText = scoreRobuxEarned;
    gameState.robux += scoreRobuxEarned;

  } else if (activePlayPath === "dressup") {
    if (currentStreak >= targetStreak) {
      resultIcon.innerText = "👑";
      resultTitle.innerText = "ยินดีด้วย นักล่าคอสตูม! 🎉";
      resultSummary.innerText = `คุณทำคอมโบคำตอบถูกต้องครบ ${targetStreak} ข้อติดกัน ปลดล็อกคอสตูมสำเร็จ!`;
      
      if (questItemToUnlock && questItemToUnlock.id !== "rare_gift") {
        // Unlock item
        if (!gameState.unlockedItems.includes(questItemToUnlock.id)) {
          gameState.unlockedItems.push(questItemToUnlock.id);
        }
        // AUTO-EQUIP immediately — no need to go buy it
        if (['hat','glasses','back','pet','shirt','pants'].includes(questItemToUnlock.cat)) {
          gameState.equippedItems[questItemToUnlock.cat] = questItemToUnlock.id;
        }
        unlockedBox.style.display = "block";
        unlockedItemName.innerText = `${questItemToUnlock.icon} ${questItemToUnlock.name} (สวมใส่แล้ว!)`;
      }
      
      robuxRewardSpan.innerText = 100;
      gameState.robux += 100;
    } else {
      resultTitle.innerText = "ภารกิจยังไม่สำเร็จ";
      resultSummary.innerText = "อย่าท้อนะ! พยายามฝึกฝนทำคอมโบอีกนิดเพื่อปลดไอเทม!";
      robuxRewardSpan.innerText = 0;
    }
  }

  saveGameState();
}

function checkSequentialPlayNext() {
  if (isPlayingSequential) {
    const list = ZONE_TABLES[activeArenaZone];
    const nextIdx = list.indexOf(selectedArenaTable) + 1;
    if (nextIdx < list.length) {
      selectedArenaTable = list[nextIdx];
      selectArenaTable(selectedArenaTable);
    } else {
      isPlayingSequential = false;
      document.getElementById("arena-step-result").classList.remove("active");
      document.getElementById("arena-step-table").classList.add("active");
      renderArenaTables();
    }
  } else {
    document.getElementById("arena-step-result").classList.remove("active");
    document.getElementById("arena-step-table").classList.add("active");
    renderArenaTables();
  }
}

// Badges system
const BADGES = [
  { id: "badge_beginner", name: "เด็กฝึกหัด", desc: "ผ่านสูตรคูณแม่แรก", icon: "🌱", check: (state) => state.completedTables.length >= 1 },
  { id: "badge_zone1", name: "แชมป์เปี้ยนเกาะป่า", desc: "ผ่านแม่ 2-6 ครบ", icon: "🏔️", check: (state) => ZONE_TABLES[1].every(t => state.completedTables.includes(t)) },
  { id: "badge_zone2", name: "ผู้พิชิตภูเขาไฟ", desc: "ผ่านแม่ 7-12 ครบ", icon: "🌋", check: (state) => ZONE_TABLES[2].every(t => state.completedTables.includes(t)) },
  { id: "badge_zone3", name: "ราชาแห่งอวกาศ", desc: "ผ่านแม่ 13-24 ครบ", icon: "🪐", check: (state) => ZONE_TABLES[3].every(t => state.completedTables.includes(t)) },
  { id: "badge_fashion", name: "เจ้าพ่อแฟชั่น", desc: "ปลดล็อกไอเทมคอสตูม 5 ชิ้น", icon: "🕶️", check: (state) => state.unlockedItems.length >= 5 }
];

function renderAchievementsList() {
  const container = document.getElementById("badges-list");
  container.innerHTML = "";
  
  BADGES.forEach((badge) => {
    const isUnlocked = badge.check(gameState);
    
    const div = document.createElement("div");
    div.className = `badge-item ${isUnlocked ? 'unlocked' : ''}`;
    div.title = badge.desc;
    div.innerHTML = `
      <span class="badge-icon">${badge.icon}</span>
      <span class="badge-name">${badge.name}</span>
    `;
    container.appendChild(div);
  });
}

// ==========================================================================
// 6b. Shop Item Preview Popup (3D avatar in a modal)
// ==========================================================================
let previewPopupScene = null, previewPopupCamera = null, previewPopupRenderer = null;
let previewPopupAnimId = null;

function openItemPreviewPopup(item) {
  // Remove existing popup
  closeItemPreviewPopup();

  const isUnlocked = gameState.unlockedItems.includes(item.id);
  const isEquipped = Object.values(gameState.equippedItems).includes(item.id);
  const canAfford  = gameState.robux >= item.price;

  // Build popup DOM
  const overlay = document.createElement('div');
  overlay.id = 'item-preview-overlay';
  overlay.className = 'item-preview-overlay';

  const rarityIcons = {
    common:    `<svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor"><polygon points="6,0 12,6 6,12 0,6"/></svg>`,
    rare:      `<svg viewBox="0 0 16 12" width="13" height="10" fill="currentColor"><polygon points="4,0 8,6 4,12 0,6"/><polygon points="12,0 16,6 12,12 8,6"/></svg>`,
    legendary: `<svg viewBox="0 0 14 12" width="12" height="10" fill="currentColor"><polygon points="7,0 9,4 14,4 10,7 12,12 7,9 2,12 4,7 0,4 5,4"/></svg>`
  };

  let actionBtn = '';
  if (isEquipped) {
    actionBtn = `<button class="preview-btn preview-btn-secondary" id="preview-action-btn">ถอดออก</button>`;
  } else if (isUnlocked) {
    actionBtn = `<button class="preview-btn preview-btn-primary" id="preview-action-btn">✓ สวมใส่เลย</button>`;
  } else {
    actionBtn = `<button class="preview-btn preview-btn-buy ${!canAfford ? 'disabled' : ''}" id="preview-action-btn" ${!canAfford ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM5.83 6h14.17l-1.68 8.39c-.17.85-.93 1.61-1.79 1.61H7.42c-.83 0-1.58-.67-1.66-1.5L5.25 8H4l-.83-2H1V4h4l.83 2z"/></svg>
      ซื้อ R$${item.price}
    </button>`;
  }

  overlay.innerHTML = `
    <div class="item-preview-modal">
      <button class="item-preview-close" id="preview-close-btn">✕</button>
      <div class="item-preview-canvas-wrap">
        <canvas id="item-preview-canvas" width="220" height="280"></canvas>
      </div>
      <div class="item-preview-info">
        <div class="item-preview-icon">${item.icon}</div>
        <div class="item-preview-name">${item.name}</div>
        <div class="product-rarity-badge rarity-${item.rarity}" style="display:inline-flex;align-items:center;gap:4px;margin:4px 0;">
          ${rarityIcons[item.rarity] || ''} ${item.rarity}
        </div>
        ${!isUnlocked ? `<div class="item-preview-price"><svg viewBox="0 0 20 20" fill="none" width="16" height="16"><circle cx="10" cy="10" r="9" fill="#00B06F" stroke="#00D385" stroke-width="1.5"/><text x="10" y="14" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="Arial">R$</text></svg> ${item.price}</div>` : ''}
      </div>
      <div class="item-preview-actions">
        ${actionBtn}
        <button class="preview-btn preview-btn-close" id="preview-close-btn2">ปิด</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  overlay.addEventListener('click', e => { if (e.target === overlay) closeItemPreviewPopup(); });
  document.getElementById('preview-close-btn').addEventListener('click', closeItemPreviewPopup);
  document.getElementById('preview-close-btn2').addEventListener('click', closeItemPreviewPopup);

  const actionBtnEl = document.getElementById('preview-action-btn');
  if (actionBtnEl && !actionBtnEl.disabled) {
    actionBtnEl.addEventListener('click', () => {
      if (isEquipped) {
        gameState.equippedItems[item.cat] = null;
      } else if (isUnlocked) {
        gameState.equippedItems[item.cat] = item.id;
      } else if (canAfford) {
        sounds.coin();
        gameState.robux -= item.price;
        gameState.unlockedItems.push(item.id);
        gameState.equippedItems[item.cat] = item.id;
      }
      saveGameState();
      renderCatalogProducts();
      closeItemPreviewPopup();
    });
  }

  // Init 3D preview in the popup canvas
  setTimeout(() => initItemPreview3D(item), 60);
}

function initItemPreview3D(item) {
  const canvas = document.getElementById('item-preview-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  previewPopupScene = new THREE.Scene();
  // Light-ish background so dark accessories (glasses) are visible
  previewPopupScene.background = new THREE.Color(0x2d3a4a);

  const isFaceItem2 = ['glasses','hat'].includes(item.cat);
  previewPopupCamera = new THREE.PerspectiveCamera(isFaceItem2 ? 32 : 38, 220 / 280, 0.1, 100);
  if (isFaceItem2) {
    // Zoom toward face for glasses/hat
    previewPopupCamera.position.set(0, 3.2, 5.2);
    previewPopupCamera.lookAt(0, 2.8, 0);
  } else {
    previewPopupCamera.position.set(0, 2.2, 6.5);
    previewPopupCamera.lookAt(0, 2.0, 0);
  }

  previewPopupRenderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  previewPopupRenderer.setSize(220, 280);

  // Lights
  previewPopupScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dl = new THREE.DirectionalLight(0xffffff, 1.1);
  dl.position.set(4, 8, 6); previewPopupScene.add(dl);
  const fl = new THREE.DirectionalLight(0x8888ff, 0.4);
  fl.position.set(-4, 2, -3); previewPopupScene.add(fl);

  // Platform
  const plat = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 0.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x2e3033 })
  );
  plat.position.y = -0.1;
  previewPopupScene.add(plat);

  // Build avatar with item previewed
  const savedEquip = { ...gameState.equippedItems };
  if (['hat','glasses','back','pet','shirt','pants'].includes(item.cat)) {
    gameState.equippedItems[item.cat] = item.id;
  }
  buildPopupAvatarModel();
  gameState.equippedItems = savedEquip;

  // Slow gentle rotation — start facing front
  let angle = 0;
  const isFaceItem = ['glasses','hat'].includes(item.cat);
  function animPopup() {
    previewPopupAnimId = requestAnimationFrame(animPopup);
    if (!previewPopupScene || !previewPopupRenderer) return;
    // Face items rotate slowly to show front clearly; others rotate normally
    angle += isFaceItem ? 0.006 : 0.016;
    const player = previewPopupScene.getObjectByName('popup_player');
    if (player) player.rotation.y = angle;
    previewPopupRenderer.render(previewPopupScene, previewPopupCamera);
  }
  animPopup();
}

function buildPopupAvatarModel() {
  if (!previewPopupScene) return;
  const old = previewPopupScene.getObjectByName('popup_player');
  if (old) previewPopupScene.remove(old);

  const g = new THREE.Group();
  g.name = 'popup_player';

  const shirtItem = gameState.equippedItems.shirt ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.shirt) : null;
  const pantsItem = gameState.equippedItems.pants ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.pants) : null;
  const skinMat  = new THREE.MeshStandardMaterial({ color: gameState.avatarColors.skin, roughness: 0.7 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: shirtItem ? shirtItem.torsoColor : gameState.avatarColors.torso, roughness: 0.7 });
  const legsMat  = new THREE.MeshStandardMaterial({ color: pantsItem ? pantsItem.legsColor  : gameState.avatarColors.legs,  roughness: 0.7 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.6), torsoMat);
  torso.position.y = 1.5; torso.name = 'pp_torso'; g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
  head.position.set(0, 1.2, 0); torso.add(head);

  [[-0.2, 0.1], [0.2, 0.1]].forEach(([ex]) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), blackMat);
    eye.position.set(ex, 0.1, 0.41); head.add(eye);
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0x7f0000 }));
  mouth.position.set(0, -0.15, 0.41); head.add(mouth);

  const aL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), skinMat);
  aL.position.set(-0.8, 0, 0); torso.add(aL);
  const aR = aL.clone(); aR.position.x = 0.8; torso.add(aR);

  const lL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), legsMat);
  lL.position.set(-0.35, -1.1, 0); torso.add(lL);
  const lR = lL.clone(); lR.position.x = 0.35; torso.add(lR);

  buildHair3D(head, gameState.gender);
  const equip = gameState.equippedItems;
  if (equip.hat) buildHatOn3D(equip.hat, head);
  if (equip.glasses) buildGlassesOn3D(equip.glasses, head);
  if (equip.back) buildBackOn3D(equip.back, torso);

  // Pet (floating block beside player)
  if (equip.pet) {
    const petColors = { pet_dog: 0x8d6e63, pet_cat: 0xff9800, pet_penguin: 0x222222, pet_slime: 0x00e676, pet_dragon: 0xd50000, pet_unicorn: 0xf8bbd0, pet_rabbit: 0xffffff, pet_fox: 0xff7043, pet_phoenix: 0xff6f00, pet_panda: 0xffffff, pet_mushroom: 0xd32f2f, pet_robot: 0x455a64 };
    const petColor = petColors[equip.pet] || 0x888888;
    const petBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: petColor, roughness: 0.8, transparent: equip.pet === 'pet_slime', opacity: equip.pet === 'pet_slime' ? 0.8 : 1.0 }));
    petBody.position.set(1.6, 0.5, -0.5);
    const eyeMat2 = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), eyeMat2);
    pe.position.set(-0.13, 0.08, 0.26); petBody.add(pe);
    const pe2 = pe.clone(); pe2.position.x = 0.13; petBody.add(pe2);
    g.add(petBody);
  }

  previewPopupScene.add(g);
}

function closeItemPreviewPopup() {
  // Stop animation
  if (previewPopupAnimId) { cancelAnimationFrame(previewPopupAnimId); previewPopupAnimId = null; }
  // Dispose renderer
  if (previewPopupRenderer) { previewPopupRenderer.dispose(); previewPopupRenderer = null; }
  previewPopupScene = null;
  previewPopupCamera = null;
  // Remove DOM
  const overlay = document.getElementById('item-preview-overlay');
  if (overlay) overlay.remove();
}

// ==========================================================================
// 6c. Chill Farm 3D — Floating Island Farming Scene
// ==========================================================================
let chillFarmScene = null, chillFarmCamera = null, chillFarmRenderer = null;
let chillFarmAnimId = null, chillFarmClock = null;
let chillFarmPlayer = null;
let chillFarmVelocity = { x: 0, z: 0 };
let chillFarmKeys = {};
let chillFarmPortals = [];
let chillFarmAnswerProcessing = false;
let chillFarmGems = 0;
let farmPlots = [];
let activeTreeIdx = -1;
let chillFarmJoyVec = { x: 0, y: 0 };
let chillFarmJoyActive = false;
let chillFarmJoyStart = { x: 0, y: 0 };
let chillFarmCurrentQ = {};

const FARM_PLOT_POS = [
  { x: -5, z: -5 }, { x: 5, z: -5 },
  { x: -5, z: 5 },  { x: 5, z: 5 }
];

function initChillFarm3D() {
  const container = document.getElementById("chill-3d-viewport");
  if (!container || typeof THREE === 'undefined') return;
  container.innerHTML = "";

  chillFarmScene = new THREE.Scene();
  chillFarmScene.background = new THREE.Color(0x87ceeb);
  chillFarmScene.fog = new THREE.Fog(0x87ceeb, 30, 70);

  const w = container.offsetWidth || 500;
  const h = container.offsetHeight || 320;
  chillFarmCamera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);

  chillFarmRenderer = new THREE.WebGLRenderer({ antialias: true });
  chillFarmRenderer.setSize(w, h);
  chillFarmRenderer.shadowMap.enabled = true;
  container.appendChild(chillFarmRenderer.domElement);

  chillFarmScene.add(new THREE.AmbientLight(0xfff9e0, 0.8));
  const sun = new THREE.DirectionalLight(0xfffde7, 1.3);
  sun.position.set(25, 50, 20);
  sun.castShadow = true;
  chillFarmScene.add(sun);

  buildFarmIsland3D();

  farmPlots = [];
  FARM_PLOT_POS.forEach(pos => buildFarmPlot3D(pos.x, pos.z));

  chillFarmPlayer = buildSimplePlayer3D(chillFarmScene);
  chillFarmPlayer.position.set(0, 0.9, 0);

  spawnFarmClouds3D();

  chillFarmKeys = {};
  chillFarmVelocity = { x: 0, z: 0 };
  chillFarmPortals = [];
  chillFarmAnswerProcessing = false;
  chillFarmGems = 0;
  activeTreeIdx = -1;
  chillCamState.yaw = 0; chillCamState.dist = 13;
  farmPetCompanions = []; // reset pets

  const banner = document.getElementById("chill-question-banner");
  if (banner) banner.style.display = "none";

  if (chillController) chillController.destroy();
  chillController = createArenaController({
    canvas: chillFarmRenderer.domElement,
    keys: chillFarmKeys,
    camState: chillCamState,
    onJump: null, // no jump in chill farm (farm mode)
    container: document.getElementById('chill-3d-viewport'),
    joystickId: 'chill-joystick',
    jumpBtnId: null
  });
  chillFarmRenderer.domElement.addEventListener('touchstart', () => unlockIOSAudio(), { once: true, passive: true });

  chillFarmClock = new THREE.Clock();
  animateChillFarm3D();
}

function handleChillFarmKey_down(e) { chillFarmKeys[e.key.toLowerCase()] = true; }
function handleChillFarmKey_up(e)   { chillFarmKeys[e.key.toLowerCase()] = false; }

function buildFarmIsland3D() {
  // Island dirt body (octagonal)
  const dirt = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 11, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.9 })
  );
  dirt.position.y = -2;
  dirt.receiveShadow = true;
  chillFarmScene.add(dirt);

  // Grass top
  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(12.5, 12.5, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.8 })
  );
  grass.position.y = -0.15;
  grass.receiveShadow = true;
  chillFarmScene.add(grass);

  // Rocky bottom stalactites
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 3.5 + (i % 3);
    const st = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 1.5, 3.5 + (i % 2), 6),
      new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1.0 })
    );
    st.position.set(Math.cos(angle)*r, -4.2, Math.sin(angle)*r);
    chillFarmScene.add(st);
  }

  // Fence posts around perimeter
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.9, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xA0522D })
    );
    post.position.set(Math.cos(angle)*11.5, 0.25, Math.sin(angle)*11.5);
    chillFarmScene.add(post);
  }

  // Wooden path planks
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.06, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xD2B48C })
    );
    plank.position.set(0, 0.05, -2 + i * 2);
    chillFarmScene.add(plank);
  }
}

function buildFarmPlot3D(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.18, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 1.0 })
  );
  soil.position.y = 0.08;
  soil.receiveShadow = true;
  g.add(soil);

  // Stage 0 tree (seed)
  const seedTree = buildFarmTreeMesh(0);
  g.add(seedTree);

  chillFarmScene.add(g);
  farmPlots.push({ group: g, stage: 0, pos: { x, z }, treeGroup: seedTree });
}

function buildFarmTreeMesh(stage) {
  const g = new THREE.Group();
  if (stage === 0) {
    // Tiny sprout
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.3, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x81C784 })
    );
    s.position.y = 0.25; g.add(s);
    return g;
  }
  const trunkH  = [0, 0.8, 1.6, 2.8][stage];
  const leafS   = [0, 0.9, 1.5, 2.4][stage];
  const tColors = [null, 0x795548, 0x5D4037, 0x4E342E];
  const lColors = [null, 0x81C784, 0x4CAF50, 0x2E7D32];

  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, trunkH, 0.35),
    new THREE.MeshStandardMaterial({ color: tColors[stage] })
  );
  trunk.position.y = 0.18 + trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.BoxGeometry(leafS, leafS * 0.85, leafS),
    new THREE.MeshStandardMaterial({ color: lColors[stage], roughness: 0.8 })
  );
  leaves.position.y = 0.18 + trunkH + leafS * 0.42;
  leaves.castShadow = true;
  g.add(leaves);

  // Stage 3: add fruit decorations
  if (stage === 3) {
    const fruitColors = [0xff5722, 0xfdd835, 0xe91e63];
    for (let i = 0; i < 3; i++) {
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshStandardMaterial({ color: fruitColors[i] })
      );
      const fAngle = (i / 3) * Math.PI * 2;
      fruit.position.set(
        Math.cos(fAngle) * (leafS * 0.4),
        0.18 + trunkH + leafS * 0.3,
        Math.sin(fAngle) * (leafS * 0.4)
      );
      g.add(fruit);
    }
  }
  return g;
}

function growFarmTree3D(plotIdx) {
  const plot = farmPlots[plotIdx];
  if (!plot || plot.stage >= 3) return;

  plot.group.remove(plot.treeGroup);
  plot.stage = Math.min(3, plot.stage + 1);
  const newTree = buildFarmTreeMesh(plot.stage);
  plot.treeGroup = newTree;
  plot.group.add(newTree);

  spawnFarmGems3D(plot.pos.x, plot.pos.z);
  chillFarmGems += 5;
  document.getElementById("chill-robux-earned").innerText = chillFarmGems;
  sounds.coin();

  // TTS announce correct answer
  speakThai(`${chillFarmCurrentQ.table} คูณ ${chillFarmCurrentQ.mult} เท่ากับ ${chillFarmCurrentQ.ans} ถูกต้อง เยี่ยมมาก`);

  // Add pet companion when a tree reaches full grown (stage 3)
  if (plot.stage >= 3) {
    const grownCount = farmPlots.filter(p => p.stage >= 3).length;
    if (grownCount > farmPetCompanions.length) {
      setTimeout(() => addFarmPet(farmPetCompanions.length), 800);
    }
  }
}

function spawnFarmGems3D(x, z) {
  const gemColors = [0x00ffff, 0xffd700, 0xff00ff, 0x00ff88, 0xff6600];
  for (let i = 0; i < 5; i++) {
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 6, 6),
      new THREE.MeshBasicMaterial({ color: gemColors[i % 5] })
    );
    const angle = (i / 5) * Math.PI * 2;
    gem.position.set(x + Math.cos(angle) * 0.6, 1.5, z + Math.sin(angle) * 0.6);
    chillFarmScene.add(gem);

    let f = 0;
    const anim = setInterval(() => {
      f++;
      gem.position.y += 0.06;
      gem.material.transparent = true;
      gem.material.opacity = Math.max(0, 1 - f / 25);
      if (f >= 25) { clearInterval(anim); chillFarmScene.remove(gem); }
    }, 30);
  }
}

function spawnFarmClouds3D() {
  for (let i = 0; i < 7; i++) {
    const cg = new THREE.Group();
    const ang = (i / 7) * Math.PI * 2;
    const r = 22 + (i % 3) * 4;

    for (let j = 0; j < 3; j++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(3.5 + (j * 0.8), 1.6, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 })
      );
      c.position.set(j * 2.8 - 2.8, 0, 0);
      cg.add(c);
    }

    cg.position.set(Math.cos(ang) * r, 9 + (i % 3) * 2, Math.sin(ang) * r);
    cg.userData.driftAngle = ang;
    cg.userData.radius = r;
    cg.userData.driftSpeed = 0.0008 + (i % 3) * 0.0003;
    chillFarmScene.add(cg);
  }
}

function buildSimplePlayer3D(scene) {
  const g = new THREE.Group();
  const shirtItem = gameState.equippedItems.shirt ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.shirt) : null;
  const pantsItem = gameState.equippedItems.pants ? SHOP_ITEMS.find(i => i.id === gameState.equippedItems.pants) : null;
  const skinMat  = new THREE.MeshStandardMaterial({ color: gameState.avatarColors.skin, roughness: 0.7 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: shirtItem ? shirtItem.torsoColor : gameState.avatarColors.torso, roughness: 0.7 });
  const legsMat  = new THREE.MeshStandardMaterial({ color: pantsItem ? pantsItem.legsColor  : gameState.avatarColors.legs, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.5), torsoMat);
  torso.position.y = 1.3; torso.name = "sp_torso"; g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skinMat);
  head.position.set(0, 1.0, 0); torso.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  [[-0.17, 0.36], [0.17, 0.36]].forEach(([ex]) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), eyeMat);
    eye.position.set(ex, 0.08, 0.36); head.add(eye);
  });

  if (gameState.gender === "female") {
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 0.7 });
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.22, 0.74), hairMat);
    hairTop.position.set(0, 0.35, 0); head.add(hairTop);
    const hairLong = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.18), hairMat);
    hairLong.position.set(0, -0.08, -0.44); head.add(hairLong);
  }

  const aL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.3, 0.35), skinMat);
  aL.position.set(-0.67, 0, 0); aL.name = "sp_armL"; torso.add(aL);
  const aR = aL.clone(); aR.position.x = 0.67; aR.name = "sp_armR"; torso.add(aR);

  const lL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.2, 0.42), legsMat);
  lL.position.set(-0.28, -0.95, 0); lL.name = "sp_legL"; torso.add(lL);
  const lR = lL.clone(); lR.position.x = 0.28; lR.name = "sp_legR"; torso.add(lR);

  scene.add(g);
  return g;
}

function spawnChillFarmPortals3D(treePos, opts) {
  chillFarmPortals.forEach(p => chillFarmScene.remove(p));
  chillFarmPortals = [];

  const baseAngle = Math.random() * Math.PI * 2;
  const radius = 2.8;
  const labels = ["A", "B", "C"];
  const ringColors = [0x00ffff, 0xff00ff, 0xffcc00];

  opts.forEach((val, idx) => {
    const angle = baseAngle + idx * (Math.PI * 2 / 3);
    const pg = new THREE.Group();
    pg.position.set(treePos.x + Math.cos(angle) * radius, 0.05, treePos.z + Math.sin(angle) * radius);
    pg.userData.val = val;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 24),
      new THREE.MeshBasicMaterial({ color: ringColors[idx], side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    pg.add(ring);

    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 2.8, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: ringColors[idx], transparent: true, opacity: 0.12, side: THREE.DoubleSide })
    );
    cyl.position.y = 1.4;
    pg.add(cyl);

    const bb = createTextSprite3D(`${labels[idx]}: ${val}`);
    bb.position.set(0, 3.6, 0);
    pg.add(bb);

    chillFarmScene.add(pg);
    chillFarmPortals.push(pg);
  });
}

function setupChillFarmJoystick() {
  const zone = document.getElementById("joystick-zone-chill");
  const handle = document.getElementById("joystick-handle-chill");
  if (!zone || !handle) return;
  handle.style.left = "33px"; handle.style.top = "33px";
  chillFarmJoyVec = { x: 0, y: 0 }; chillFarmJoyActive = false;

  zone.addEventListener("touchstart", e => {
    chillFarmJoyActive = true;
    const rect = zone.getBoundingClientRect();
    chillFarmJoyStart = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  });
  zone.addEventListener("touchmove", e => {
    if (!chillFarmJoyActive) return;
    const t = e.touches[0];
    const dx = t.clientX - chillFarmJoyStart.x;
    const dy = t.clientY - chillFarmJoyStart.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxD = 40;
    const s = dist > maxD ? maxD/dist : 1;
    handle.style.left = `${33 + dx*s}px`;
    handle.style.top  = `${33 + dy*s}px`;
    chillFarmJoyVec = { x: dx*s/maxD, y: dy*s/maxD };
  });
  const stop = () => {
    chillFarmJoyActive = false;
    handle.style.left = "33px"; handle.style.top = "33px";
    chillFarmJoyVec = { x: 0, y: 0 };
  };
  zone.addEventListener("touchend", stop);
  zone.addEventListener("touchcancel", stop);
}

function animateChillFarm3D() {
  chillFarmAnimId = requestAnimationFrame(animateChillFarm3D);
  if (!chillFarmScene || !chillFarmRenderer) return;

  const time = chillFarmClock.getElapsedTime();
  let mX = 0, mZ = 0;

  if (chillFarmKeys['w'] || chillFarmKeys['arrowup'])    mZ = -1;
  if (chillFarmKeys['s'] || chillFarmKeys['arrowdown'])  mZ =  1;
  if (chillFarmKeys['a'] || chillFarmKeys['arrowleft'])  mX = -1;
  if (chillFarmKeys['d'] || chillFarmKeys['arrowright']) mX =  1;
  if (chillFarmJoyActive) { mX = chillFarmJoyVec.x; mZ = chillFarmJoyVec.y; }

  const maxSpd = 0.18, accel = 0.042, deccel = 0.16;

  if (mX !== 0 || mZ !== 0) {
    const len = Math.sqrt(mX*mX + mZ*mZ);
    chillFarmVelocity.x += (mX/len)*accel;
    chillFarmVelocity.z += (mZ/len)*accel;
    const spd = Math.sqrt(chillFarmVelocity.x**2 + chillFarmVelocity.z**2);
    if (spd > maxSpd) {
      chillFarmVelocity.x = (chillFarmVelocity.x/spd)*maxSpd;
      chillFarmVelocity.z = (chillFarmVelocity.z/spd)*maxSpd;
    }
    const torso = chillFarmPlayer.getObjectByName("sp_torso");
    if (torso) {
      const swg = Math.sin(time*14) * 0.5;
      const lL = torso.getObjectByName("sp_legL"); if (lL) lL.rotation.x = swg;
      const lR = torso.getObjectByName("sp_legR"); if (lR) lR.rotation.x = -swg;
    }
    chillFarmPlayer.rotation.y = Math.atan2(chillFarmVelocity.x, chillFarmVelocity.z);
  } else {
    chillFarmVelocity.x *= (1 - deccel);
    chillFarmVelocity.z *= (1 - deccel);
    if (Math.abs(chillFarmVelocity.x) < 0.002) chillFarmVelocity.x = 0;
    if (Math.abs(chillFarmVelocity.z) < 0.002) chillFarmVelocity.z = 0;
    const torso = chillFarmPlayer.getObjectByName("sp_torso");
    if (torso) {
      const lL = torso.getObjectByName("sp_legL"); if (lL) lL.rotation.x = 0;
      const lR = torso.getObjectByName("sp_legR"); if (lR) lR.rotation.x = 0;
    }
  }

  chillFarmPlayer.position.x += chillFarmVelocity.x;
  chillFarmPlayer.position.z += chillFarmVelocity.z;
  const d2 = Math.sqrt(chillFarmPlayer.position.x**2 + chillFarmPlayer.position.z**2);
  if (d2 > 11) {
    chillFarmPlayer.position.x = (chillFarmPlayer.position.x/d2)*11;
    chillFarmPlayer.position.z = (chillFarmPlayer.position.z/d2)*11;
  }

  // Check proximity to trees → trigger question
  if (!chillFarmAnswerProcessing && chillFarmPortals.length === 0) {
    farmPlots.forEach((plot, idx) => {
      if (plot.stage >= 3) return;
      const dx = chillFarmPlayer.position.x - plot.pos.x;
      const dz = chillFarmPlayer.position.z - plot.pos.z;
      if (Math.sqrt(dx*dx + dz*dz) < 3.0) {
        triggerChillFarmQuestion3D(idx);
      }
    });
  }

  // Check portal collisions
  if (chillFarmPortals.length > 0 && !chillFarmAnswerProcessing) {
    for (const portal of chillFarmPortals) {
      const dx = chillFarmPlayer.position.x - portal.position.x;
      const dz = chillFarmPlayer.position.z - portal.position.z;
      if (Math.sqrt(dx*dx + dz*dz) < 1.1) {
        handleChillFarmAnswer3D(portal.userData.val);
        break;
      }
    }
  }

  // Drift clouds
  chillFarmScene.children.forEach(obj => {
    if (obj.userData.driftAngle !== undefined) {
      obj.userData.driftAngle += obj.userData.driftSpeed;
      obj.position.x = Math.cos(obj.userData.driftAngle) * obj.userData.radius;
      obj.position.z = Math.sin(obj.userData.driftAngle) * obj.userData.radius;
    }
  });

  chillFarmPortals.forEach(p => { p.rotation.y += 0.022; });
  updateFarmPets(time);

  // Orbit camera with yaw + pinch zoom
  const cfTX = chillFarmPlayer.position.x + Math.sin(chillCamState.yaw) * chillCamState.dist;
  const cfTY = chillFarmPlayer.position.y + 13;
  const cfTZ = chillFarmPlayer.position.z + Math.cos(chillCamState.yaw) * chillCamState.dist;
  chillFarmCamera.position.x += (cfTX - chillFarmCamera.position.x) * 0.08;
  chillFarmCamera.position.y += (cfTY - chillFarmCamera.position.y) * 0.08;
  chillFarmCamera.position.z += (cfTZ - chillFarmCamera.position.z) * 0.08;
  chillFarmCamera.lookAt(chillFarmPlayer.position.x, chillFarmPlayer.position.y + 1, chillFarmPlayer.position.z);

  chillFarmRenderer.render(chillFarmScene, chillFarmCamera);
}

function triggerChillFarmHint3D() {
  if (!chillFarmScene || activeTreeIdx < 0) return;
  const plot = farmPlots[activeTreeIdx];
  if (!plot) return;

  const tableNum = selectedArenaTable;
  const mult = chillFarmCurrentQ.mult || 1;
  const stepResults = [];
  for (let i = 1; i <= mult; i++) stepResults.push(tableNum * i);

  stepResults.forEach((val, idx) => {
    setTimeout(() => {
      if (!chillFarmScene) return;
      const geo = new THREE.BoxGeometry(0.8, 0.5, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600, roughness: 0.3 });
      const cube = new THREE.Mesh(geo, mat);
      const angle = (idx / stepResults.length) * Math.PI * 2;
      cube.position.set(
        plot.pos.x + Math.cos(angle) * 1.8,
        6,
        plot.pos.z + Math.sin(angle) * 1.8
      );
      cube.userData.targetY = 1.8;
      cube.userData.isHintBlock = true;
      chillFarmScene.add(cube);

      // Label sprite
      const sprite = createTextSprite3D(`${val}`);
      sprite.position.set(0, 0.8, 0);
      cube.add(sprite);

      // Fall down animation
      let falling = true;
      const fallInt = setInterval(() => {
        if (!falling || !chillFarmScene) { clearInterval(fallInt); return; }
        cube.position.y -= 0.18;
        if (cube.position.y <= cube.userData.targetY) {
          cube.position.y = cube.userData.targetY;
          falling = false;
          sounds.coin();
        }
      }, 25);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        if (chillFarmScene && cube.parent) chillFarmScene.remove(cube);
      }, 4000);
    }, idx * 180);
  });

  speakThai(`${tableNum} คูณ ${mult} เท่ากับ ${tableNum * mult}`);
}

function triggerChillFarmQuestion3D(plotIdx) {
  if (chillFarmAnswerProcessing) return;
  activeTreeIdx = plotIdx;

  const q = generateMathQuestion(selectedArenaTable);
  chillFarmCurrentQ = q;

  const qEl = document.getElementById("chill-question");
  const banner = document.getElementById("chill-question-banner");
  if (qEl) qEl.innerText = `🌱 รดน้ำต้นไม้: ${q.table} × ${q.mult} = ?`;
  if (banner) banner.style.display = "block";
  const hintBtn = document.getElementById("chill-farm-hint-btn");
  if (hintBtn) hintBtn.style.display = "flex";

  const opts = [...new Set([q.ans, ...q.opts])].slice(0, 3);
  if (!opts.includes(q.ans)) opts[0] = q.ans;
  opts.sort(() => Math.random() - 0.5);

  spawnChillFarmPortals3D(farmPlots[plotIdx].pos, opts);
}

function handleChillFarmAnswer3D(chosenVal) {
  chillFarmAnswerProcessing = true;
  const banner = document.getElementById("chill-question-banner");

  if (chosenVal === chillFarmCurrentQ.ans) {
    sounds.coin();
    growFarmTree3D(activeTreeIdx);

    const allGrown = farmPlots.every(p => p.stage >= 3);

    setTimeout(() => {
      chillFarmPortals.forEach(p => chillFarmScene.remove(p));
      chillFarmPortals = [];
      if (banner) banner.style.display = "none";
      const hb = document.getElementById("chill-farm-hint-btn");
      if (hb) hb.style.display = "none";
      chillFarmAnswerProcessing = false;
      activeTreeIdx = -1;

      if (allGrown) {
        playFarmCompletionDance();
      }
    }, 1200);
  } else {
    sounds.oof();
    speakThai('ผิดแล้ว ลองใหม่นะ');
    const torso = chillFarmPlayer.getObjectByName("sp_torso");
    if (torso && torso.material) {
      const orig = new THREE.Color().copy(torso.material.color);
      torso.material.color.setHex(0xff0000);
      setTimeout(() => { if (torso.material) torso.material.color.copy(orig); }, 300);
    }
    setTimeout(() => { chillFarmAnswerProcessing = false; }, 900);
  }
}

function playFarmCompletionDance() {
  sounds.win();
  let frame = 0;
  const danceInt = setInterval(() => {
    frame++;
    if (chillFarmPlayer) {
      chillFarmPlayer.position.y = Math.abs(Math.sin(frame * 0.3)) * 0.9;
      chillFarmPlayer.rotation.y += 0.18;
      const torso = chillFarmPlayer.getObjectByName("sp_torso");
      if (torso) {
        const aL = torso.getObjectByName("sp_armL");
        const aR = torso.getObjectByName("sp_armR");
        if (aL) aL.rotation.x = -1.5;
        if (aR) aR.rotation.x = -1.5;
      }
    }
    if (chillFarmScene && chillFarmRenderer && chillFarmCamera) {
      chillFarmRenderer.render(chillFarmScene, chillFarmCamera);
    }
    if (frame >= 90) {
      clearInterval(danceInt);
      showSuccessOverlay3D(
        'chill-3d-viewport',
        '🌱 ฟาร์มสมบูรณ์แบบ!',
        `ปลูกต้นไม้ครบทั้ง 4 ต้น | 💎 ${chillFarmGems} อัญมณี`,
        () => {
          stopChillFarm3D();
          scoreRobuxEarned = chillFarmGems;
          exitFullscreenGameplay();
          endGameplaySession(true);
        }
      );
    }
  }, 25);
}

// === Chill Farm pet companions ===
let farmPetCompanions = [];
const FARM_PET_DEFS = [
  { type: 'cat',      color: 0xff9800, accent: 0xe65100, radius: 2.2, speed: 0.022 },
  { type: 'bird',     color: 0x2196f3, accent: 0x1a237e, radius: 2.9, speed: 0.028 },
  { type: 'dog',      color: 0x795548, accent: 0x4e342e, radius: 3.6, speed: 0.018 },
  { type: 'elephant', color: 0x9e9e9e, accent: 0x616161, radius: 4.4, speed: 0.015 }
];

function addFarmPet(petIdx) {
  if (!chillFarmScene || farmPetCompanions.length > petIdx) return;
  const def = FARM_PET_DEFS[petIdx];
  const g = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 });
  const aMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.55), bMat);
  body.position.y = 0.32; g.add(body);
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.3), bMat);
  head.position.set(0, 0.58, 0.28); g.add(head);
  // Eyes
  [-0.08, 0.08].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), eyeMat);
    eye.position.set(ex, 0.58, 0.44); g.add(eye);
  });

  if (def.type === 'cat') {
    // Pointy ears
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), bMat);
    earL.position.set(-0.1, 0.72, 0.28); g.add(earL);
    const earR = earL.clone(); earR.position.x = 0.1; g.add(earR);
    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), bMat);
    tail.position.set(0, 0.42, -0.32); tail.rotation.x = 0.5; g.add(tail);
  }
  if (def.type === 'bird') {
    // Wings
    [-1, 1].forEach(s => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.22), aMat);
      wing.position.set(s * 0.3, 0.38, 0); g.add(wing);
    });
    // Beak
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
    beak.position.set(0, 0.55, 0.43); g.add(beak);
  }
  if (def.type === 'dog') {
    // Floppy ears
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.06), aMat);
      ear.position.set(s * 0.18, 0.54, 0.25); g.add(ear);
    });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), bMat);
    tail.position.set(0.1, 0.44, -0.32); tail.rotation.x = 0.8; g.add(tail);
  }
  if (def.type === 'elephant') {
    // Trunk
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), bMat);
    trunk.position.set(0, 0.5, 0.4); g.add(trunk);
    // Big ears
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.35), aMat);
      ear.position.set(s * 0.28, 0.52, 0.25); g.add(ear);
    });
  }

  const startAngle = petIdx * (Math.PI * 0.5);
  g.position.set(
    chillFarmPlayer.position.x + Math.cos(startAngle) * def.radius,
    0.32,
    chillFarmPlayer.position.z + Math.sin(startAngle) * def.radius
  );
  chillFarmScene.add(g);
  farmPetCompanions.push({ mesh: g, angle: startAngle, speed: def.speed, radius: def.radius, type: def.type });

  // Announce
  speakThai(`${['แมว','นก','สุนัข','ช้าง'][petIdx]}มาร่วมด้วย!`);
}

function updateFarmPets(time) {
  farmPetCompanions.forEach((p, i) => {
    p.angle += p.speed;
    if (chillFarmPlayer) {
      p.mesh.position.x = chillFarmPlayer.position.x + Math.cos(p.angle) * p.radius;
      p.mesh.position.z = chillFarmPlayer.position.z + Math.sin(p.angle) * p.radius;
      p.mesh.position.y = 0.32 + Math.abs(Math.sin(time * 3 + i)) * 0.08;
      p.mesh.rotation.y = -p.angle + Math.PI / 2;
    }
  });
}

function stopChillFarm3D() {
  if (chillFarmAnimId) { cancelAnimationFrame(chillFarmAnimId); chillFarmAnimId = null; }
  window.removeEventListener("keydown", handleChillFarmKey_down);
  window.removeEventListener("keyup", handleChillFarmKey_up);
  if (chillController) { chillController.destroy(); chillController = null; }
  chillFarmScene = null;
}

// ==========================================================================
// 6d. Dressup Runway 3D — Fashion Catwalk Scene + TTS
// ==========================================================================
let dressupScene3d = null, dressupCamera3d = null, dressupRenderer3d = null;
let dressupAnimId3d = null, dressupClock3d = null;
let dressupPlayer3d = null;
let dressupVelocity3d = { x: 0, z: 0 };
let dressupKeys3d = {};
let dressupMannequins3d = [];
let dressupAnswerProcessing3d = false;
let dressupCombo3d = 0;
let dressupQ3d = {};
let dressupJoyVec3d = { x: 0, y: 0 };
let dressupJoyActive3d = false;
let dressupJoyStart3d = { x: 0, y: 0 };
let dressupWalkingFinale = false;

function initDressupRunway3D() {
  const container = document.getElementById("dressup-3d-viewport");
  if (!container || typeof THREE === 'undefined') return;
  container.innerHTML = "";

  dressupScene3d = new THREE.Scene();
  dressupScene3d.background = new THREE.Color(0x2b1f4a); // deep purple stage

  const w = container.offsetWidth || 500;
  const h = container.offsetHeight || 320;
  dressupCamera3d = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);

  dressupRenderer3d = new THREE.WebGLRenderer({ antialias: true });
  dressupRenderer3d.setSize(w, h);
  dressupRenderer3d.shadowMap.enabled = true;
  container.appendChild(dressupRenderer3d.domElement);

  // Runway lights — bright enough to see clearly
  dressupScene3d.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dirL = new THREE.DirectionalLight(0xffffff, 1.1);
  dirL.position.set(5, 12, 8); dirL.castShadow = true;
  dressupScene3d.add(dirL);
  const spot = new THREE.SpotLight(0xffffff, 1.4, 40, Math.PI/4.5, 0.4);
  spot.position.set(0, 14, 4);
  spot.target.position.set(0, 0, -2);
  dressupScene3d.add(spot); dressupScene3d.add(spot.target);
  const pinkL = new THREE.PointLight(0xff69b4, 1.1, 25); pinkL.position.set(-7, 4, 2); dressupScene3d.add(pinkL);
  const cyanL = new THREE.PointLight(0x00ffff, 1.1, 25); cyanL.position.set(7, 4, 2);  dressupScene3d.add(cyanL);
  const backL = new THREE.PointLight(0xffd700, 0.8, 20); backL.position.set(0, 5, -8); dressupScene3d.add(backL);

  buildRunwayStage3D();

  dressupPlayer3d = buildSimplePlayer3D(dressupScene3d);
  dressupPlayer3d.position.set(0, 0.9, 8);

  dressupKeys3d = {};
  dressupVelocity3d = { x: 0, z: 0 };
  dressupMannequins3d = [];
  dressupAnswerProcessing3d = false;
  dressupCombo3d = 0;
  dressupWalkingFinale = false;
  dressCamState.yaw = 0; dressCamState.dist = 10;

  if (dressController) dressController.destroy();
  dressController = createArenaController({
    canvas: dressupRenderer3d.domElement,
    keys: dressupKeys3d,
    camState: dressCamState,
    onJump: null,
    container: document.getElementById('dressup-3d-viewport'),
    joystickId: 'dress-joystick',
    jumpBtnId: null
  });
  dressupRenderer3d.domElement.addEventListener('touchstart', () => unlockIOSAudio(), { once: true, passive: true });

  // Set initial camera position before first render
  dressupCamera3d.position.set(0, 12, 18);
  dressupCamera3d.lookAt(0, 1, 5);

  dressupClock3d = new THREE.Clock();
  nextDressupRunwayQ3D();
  animateDressupRunway3D();
}

function handleDressupKey3d_down(e) { dressupKeys3d[e.key.toLowerCase()] = true; }
function handleDressupKey3d_up(e)   { dressupKeys3d[e.key.toLowerCase()] = false; }

function buildRunwayStage3D() {
  const RL = 1000; // 1000 units — covers ~100 wrong answers before ending
  const RC = -(RL / 2) + 10;
  const RW = 11; // wider runway

  // Main runway
  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(RW, 0.22, RL),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.28, metalness: 0.12 })
  );
  runway.position.set(0, 0, RC);
  runway.receiveShadow = true;
  dressupScene3d.add(runway);

  // Gold edges — spaced to match wider runway
  [-1, 1].forEach(side => {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, RL),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xc8a000, roughness: 0.2, metalness: 0.85 })
    );
    edge.position.set(side * (RW / 2 + 0.1), 0.02, RC);
    dressupScene3d.add(edge);
  });

  // Neon runway lights — every 8 units to keep geometry count low
  const neonCols = [0xff00ff, 0x00ffff, 0xff6600, 0x00ff88];
  [-1, 1].forEach(side => {
    for (let z = 10; z > -RL + 5; z -= 8) {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.32),
        new THREE.MeshBasicMaterial({ color: neonCols[Math.abs(Math.floor(z / 8)) % 4] })
      );
      light.position.set(side * (RW / 2 - 0.1), 0.2, z);
      dressupScene3d.add(light);
    }
  });

  // Audience every 25 units × 40 segments = 1000 units (fewer objects per segment)
  for (let seg = 0; seg < 40; seg++) {
    const segZ = -seg * 25; // 25 unit spacing × 40 = 1000 units
    [-1, 1].forEach(side => {
      for (let row = 0; row < 2; row++) { // 2 rows only (performance)
        for (let seat = 0; seat < 5; seat++) {
          const s = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.55, 0.7),
            new THREE.MeshStandardMaterial({ color: [0xd32f2f, 0x1976d2, 0x388e3c][row % 3] })
          );
          s.position.set(side * (RW/2 + 1.2 + row * 1.4), row * 0.45 + 0.3, segZ - seat * 3.5);
          dressupScene3d.add(s);
        }
      }
    });
  }

  // Start backdrop
  const backdrop = new THREE.Mesh(
    new THREE.BoxGeometry(14, 9, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x16213e })
  );
  backdrop.position.set(0, 4.5, 13);
  dressupScene3d.add(backdrop);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.2, 0.25),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600, roughness: 0.3 })
  );
  sign.position.set(0, 7.5, 13.2);
  dressupScene3d.add(sign);
}

function buildMannequin3D(x, z, label) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  // Pedestal
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.75, 0.32, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0e68c, roughness: 0.4, metalness: 0.6 })
  );
  ped.position.set(0, 0.16, 0);
  g.add(ped);

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9, roughness: 0.18 })
  );
  pole.position.y = 1.62;
  g.add(pole);

  // Rotating display cube
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x664400, roughness: 0.3 })
  );
  cube.position.y = 3.45;
  cube.name = "mannequin_cube";
  g.add(cube);

  // Billboard text
  const bb = createTextSprite3D(label);
  bb.position.set(0, 4.9, 0);
  g.add(bb);

  return g;
}

function nextDressupRunwayQ3D() {
  if (dressupCombo3d >= targetStreak) {
    dressupWalkingFinale = true;
    speakThai("เย้! แต่งตัวครบแล้ว เดินรันเวย์กันเลย!");
    return;
  }

  const q = generateMathQuestion(selectedArenaTable);
  dressupQ3d = q;

  const qEl = document.getElementById("dressup-question");
  if (qEl) qEl.innerText = `${q.table} × ${q.mult} = ?`;

  speakThai(`${q.table} คูณ ${q.mult} เท่ากับเท่าไร`);

  // Clear old mannequins
  dressupMannequins3d.forEach(m => dressupScene3d.remove(m.group));
  dressupMannequins3d = [];

  const opts = [...new Set([q.ans, ...q.opts])].slice(0, 3);
  if (!opts.includes(q.ans)) opts[0] = q.ans;
  opts.sort(() => Math.random() - 0.5);

  // Spawn mannequins very far ahead — 3x original distance
  const playerZ = dressupPlayer3d ? dressupPlayer3d.position.z : 8;
  const aheadDist = 54; // 3x farther (was 18)
  const spread = 3.2;
  const positions = [
    { x: -spread, z: playerZ - aheadDist + 10 },
    { x:  0,      z: playerZ - aheadDist - 5  },
    { x:  spread, z: playerZ - aheadDist + 10 }
  ];

  opts.forEach((val, idx) => {
    const mg = buildMannequin3D(positions[idx].x, positions[idx].z, `${val}`);
    mg.userData.val = val;
    dressupScene3d.add(mg);
    dressupMannequins3d.push({ group: mg, val });
  });

  // Don't reset player position! Just stop sliding
  dressupVelocity3d.x *= 0.2;
  dressupAnswerProcessing3d = false;
}

function speakThai(text) {
  if (!soundEnabled || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'th-TH'; utt.rate = 0.9; utt.pitch = 1.2;
    speechSynthesis.speak(utt);
  } catch(e) { /* TTS unavailable */ }
}

function setupDressupJoystick3D() {
  const zone = document.getElementById("joystick-zone-dressup");
  const handle = document.getElementById("joystick-handle-dressup");
  if (!zone || !handle) return;
  handle.style.left = "33px"; handle.style.top = "33px";

  zone.addEventListener("touchstart", e => {
    dressupJoyActive3d = true;
    const rect = zone.getBoundingClientRect();
    dressupJoyStart3d = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  });
  zone.addEventListener("touchmove", e => {
    if (!dressupJoyActive3d) return;
    const t = e.touches[0];
    const dx = t.clientX - dressupJoyStart3d.x;
    const dy = t.clientY - dressupJoyStart3d.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxD = 40;
    const s = dist > maxD ? maxD/dist : 1;
    handle.style.left = `${33+dx*s}px`; handle.style.top = `${33+dy*s}px`;
    dressupJoyVec3d = { x: dx*s/maxD, y: dy*s/maxD };
  });
  const stop = () => {
    dressupJoyActive3d = false;
    handle.style.left = "33px"; handle.style.top = "33px";
    dressupJoyVec3d = { x: 0, y: 0 };
  };
  zone.addEventListener("touchend", stop);
  zone.addEventListener("touchcancel", stop);
}

function animateDressupRunway3D() {
  dressupAnimId3d = requestAnimationFrame(animateDressupRunway3D);
  if (!dressupScene3d || !dressupRenderer3d) return;

  const time = dressupClock3d.getElapsedTime();

  if (dressupWalkingFinale) {
    // Cinematic catwalk finale — elegant strut
    dressupPlayer3d.position.z -= 0.08;
    dressupPlayer3d.rotation.y = Math.PI;
    // Slight side sway for catwalk effect
    dressupPlayer3d.rotation.z = Math.sin(time * 4) * 0.06;
    dressupPlayer3d.position.x = Math.sin(time * 2) * 0.3; // slight weave
    const torso = dressupPlayer3d.getObjectByName("sp_torso");
    if (torso) {
      const lL = torso.getObjectByName("sp_legL"); if (lL) lL.rotation.x = Math.sin(time*10)*0.7;
      const lR = torso.getObjectByName("sp_legR"); if (lR) lR.rotation.x = -Math.sin(time*10)*0.7;
      const aL = torso.getObjectByName("sp_armL"); if (aL) aL.rotation.x = -Math.sin(time*10)*0.4;
      const aR = torso.getObjectByName("sp_armR"); if (aR) aR.rotation.x = Math.sin(time*10)*0.4;
    }
    // Camera zooms in slowly for cinematic feel
    dressCamState.dist = Math.max(6, dressCamState.dist - 0.02);
    if (dressupPlayer3d.position.z < -11) {
      dressupWalkingFinale = false;
      scoreRobuxEarned = dressupCombo3d * 12;
      showSuccessOverlay3D(
        'dressup-3d-viewport',
        '👑 เดินรันเวย์เสร็จสวย!',
        `ตอบครบ 12 ข้อ | ปลดออร่า 3 ชั้น | R$ +${scoreRobuxEarned}`,
        () => {
          stopDressupRunway3D();
          exitFullscreenGameplay();
          endGameplaySession(true);
        }
      );
      return;
    }
  } else {
    // Player movement
    let mX = 0, mZ = 0;
    if (dressupKeys3d['w'] || dressupKeys3d['arrowup'])    mZ = -1;
    if (dressupKeys3d['s'] || dressupKeys3d['arrowdown'])  mZ =  1;
    if (dressupKeys3d['a'] || dressupKeys3d['arrowleft'])  mX = -1;
    if (dressupKeys3d['d'] || dressupKeys3d['arrowright']) mX =  1;
    if (dressupJoyActive3d) { mX = dressupJoyVec3d.x; mZ = dressupJoyVec3d.y; }

    const maxSpd = 0.15, accel = 0.035, deccel = 0.18;
    if (mX !== 0 || mZ !== 0) {
      const len = Math.sqrt(mX*mX + mZ*mZ);
      dressupVelocity3d.x += (mX/len)*accel;
      dressupVelocity3d.z += (mZ/len)*accel;
      const spd = Math.sqrt(dressupVelocity3d.x**2 + dressupVelocity3d.z**2);
      if (spd > maxSpd) {
        dressupVelocity3d.x = (dressupVelocity3d.x/spd)*maxSpd;
        dressupVelocity3d.z = (dressupVelocity3d.z/spd)*maxSpd;
      }
      const torso = dressupPlayer3d.getObjectByName("sp_torso");
      if (torso) {
        const swg = Math.sin(time*15)*0.5;
        const lL = torso.getObjectByName("sp_legL"); if (lL) lL.rotation.x = swg;
        const lR = torso.getObjectByName("sp_legR"); if (lR) lR.rotation.x = -swg;
      }
      dressupPlayer3d.rotation.y = Math.atan2(dressupVelocity3d.x, dressupVelocity3d.z);
    } else {
      dressupVelocity3d.x *= (1-deccel); dressupVelocity3d.z *= (1-deccel);
      if (Math.abs(dressupVelocity3d.x) < 0.002) dressupVelocity3d.x = 0;
      if (Math.abs(dressupVelocity3d.z) < 0.002) dressupVelocity3d.z = 0;
      const torso = dressupPlayer3d.getObjectByName("sp_torso");
      if (torso) {
        const lL = torso.getObjectByName("sp_legL"); if (lL) lL.rotation.x = 0;
        const lR = torso.getObjectByName("sp_legR"); if (lR) lR.rotation.x = 0;
      }
    }

    dressupPlayer3d.position.x += dressupVelocity3d.x;
    dressupPlayer3d.position.z += dressupVelocity3d.z;
    // Runway width ±5.0 matching RW=11
    dressupPlayer3d.position.x = Math.max(-5.0, Math.min(5.0, dressupPlayer3d.position.x));

    // Mannequin collision
    if (!dressupAnswerProcessing3d) {
      for (const m of dressupMannequins3d) {
        const dx = dressupPlayer3d.position.x - m.group.position.x;
        const dz = dressupPlayer3d.position.z - m.group.position.z;
        if (Math.sqrt(dx*dx + dz*dz) < 2.8) { // wider hit box
          handleDressupAnswer3D(m.val);
          break;
        }
      }
    }
  }

  // Mannequin cube rotation
  dressupMannequins3d.forEach(m => {
    const cube = m.group.getObjectByName("mannequin_cube");
    if (cube) cube.rotation.y += 0.03;
  });

  // Orbit camera with dressCamState yaw + zoom
  const dcTX = dressupPlayer3d.position.x + Math.sin(dressCamState.yaw) * dressCamState.dist;
  const dcTY = dressupPlayer3d.position.y + 11;
  const dcTZ = dressupPlayer3d.position.z + Math.cos(dressCamState.yaw) * dressCamState.dist;
  dressupCamera3d.position.x += (dcTX - dressupCamera3d.position.x) * 0.07;
  dressupCamera3d.position.y += (dcTY - dressupCamera3d.position.y) * 0.07;
  dressupCamera3d.position.z += (dcTZ - dressupCamera3d.position.z) * 0.07;
  dressupCamera3d.lookAt(dressupPlayer3d.position.x, dressupPlayer3d.position.y + 1, dressupPlayer3d.position.z - 3);

  dressupRenderer3d.render(dressupScene3d, dressupCamera3d);
}

function handleDressupAnswer3D(chosenVal) {
  dressupAnswerProcessing3d = true;

  if (chosenVal === dressupQ3d.ans) {
    sounds.coin();
    dressupCombo3d++;
    currentStreak = dressupCombo3d;
    document.getElementById("quest-current-combo").innerText = dressupCombo3d;
    const fillPct = Math.min(100, (dressupCombo3d / targetStreak) * 100);
    document.getElementById("quest-combo-fill").style.width = `${fillPct}%`;

    speakThai(`ถูกต้อง คำตอบคือ ${dressupQ3d.ans}`);
    applyItemToRunwayPlayer();
    updateDressupAuraByCombo(dressupCombo3d);

    // Flash correct mannequin gold
    const hit = dressupMannequins3d.find(m => m.val === chosenVal);
    if (hit) {
      const cube = hit.group.getObjectByName("mannequin_cube");
      if (cube && cube.material) { cube.material.emissive.setHex(0xffd700); cube.material.color.setHex(0xffffff); }
    }

    setTimeout(() => { nextDressupRunwayQ3D(); }, 1000);
  } else {
    sounds.oof();
    dressupCombo3d = 0; currentStreak = 0;
    document.getElementById("quest-current-combo").innerText = 0;
    document.getElementById("quest-combo-fill").style.width = "0%";
    speakThai("ลองใหม่นะ!");

    dressupMannequins3d.forEach(m => {
      const cube = m.group.getObjectByName("mannequin_cube");
      if (cube && cube.material) {
        cube.material.color.setHex(m.val === dressupQ3d.ans ? 0x00ff00 : 0xff2200);
      }
    });

    setTimeout(() => { dressupAnswerProcessing3d = false; }, 1300);
  }
}

function applyItemToRunwayPlayer() {
  if (!dressupPlayer3d || !questItemToUnlock) return;
  const item = questItemToUnlock;
  const torso = dressupPlayer3d.getObjectByName("sp_torso");
  if (!torso) return;

  if (item.cat === 'shirt' && item.torsoColor) {
    // Update torso mesh color
    torso.traverse(child => {
      if (child.isMesh && child.name === 'sp_torso') {
        child.material = child.material.clone();
        child.material.color.set(item.torsoColor);
      }
    });
    if (torso.material) {
      torso.material = torso.material.clone();
      torso.material.color.set(item.torsoColor);
    }
  } else if (item.cat === 'pants' && item.legsColor) {
    torso.traverse(child => {
      if (child.isMesh && (child.name === 'sp_legL' || child.name === 'sp_legR')) {
        child.material = child.material.clone();
        child.material.color.set(item.legsColor);
      }
    });
  } else if (item.cat === 'hat') {
    // Add a colored block hat on player head
    const head = torso.getObjectByName("dr_head") || torso.children.find(c => c.name === 'dr_head');
    if (head) {
      const hatGeo = new THREE.BoxGeometry(0.75, 0.28, 0.75);
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xd82626, roughness: 0.5 });
      const hat = new THREE.Mesh(hatGeo, hatMat);
      hat.position.set(0, 0.42, 0);
      hat.name = 'runway_hat';
      // Remove existing runway hat
      const existing = head.getObjectByName('runway_hat');
      if (existing) head.remove(existing);
      head.add(hat);
    }
  }
}

// Aura particle system for dressup milestones
let dressupAuraParticles = null;

function setDressupAura(type) {
  if (!dressupScene3d || !dressupPlayer3d) return;
  if (dressupAuraParticles) { dressupPlayer3d.remove(dressupAuraParticles); dressupAuraParticles = null; }

  const count = 120;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 0.5;
    pos[i*3]   = Math.cos(angle) * r;
    pos[i*3+1] = Math.random() * 3.5;
    pos[i*3+2] = Math.sin(angle) * r;

    if (type === 'fire') {
      col[i*3] = 1; col[i*3+1] = 0.2 + Math.random() * 0.3; col[i*3+2] = 0;
    } else if (type === 'lightning') {
      col[i*3] = 0.2; col[i*3+1] = 0.4 + Math.random() * 0.4; col[i*3+2] = 1;
    } else { // sparkle
      col[i*3] = 1; col[i*3+1] = 0.9; col[i*3+2] = 0.2 + Math.random() * 0.5;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: type === 'lightning' ? 0.18 : 0.14, vertexColors: true, transparent: true, opacity: 0.9 });
  dressupAuraParticles = new THREE.Points(geo, mat);
  dressupPlayer3d.add(dressupAuraParticles);
}

function updateDressupAuraByCombo(combo) {
  if (combo === 4) {
    setDressupAura('fire');
    showMilestoneBanner('🔥 ออร่าไฟลุก ปลดล็อกแล้ว! (4/12)');
    speakThai('ออร่าไฟลุกปลดล็อกแล้ว');
  } else if (combo === 8) {
    setDressupAura('lightning');
    showMilestoneBanner('⚡ ออร่าสายฟ้า ปลดล็อกแล้ว! (8/12)');
    speakThai('ออร่าสายฟ้าปลดล็อกแล้ว');
  } else if (combo === 12) {
    setDressupAura('sparkle');
    showMilestoneBanner('✨ รอยเท้าประกาย ปลดล็อกแล้ว! แต่งตัวสำเร็จ!');
    speakThai('ยอดเยี่ยมมาก แต่งตัวสำเร็จแล้ว');
    setTimeout(() => playDressupFinaleWalk(), 2500);
  }

  if (dressupAuraParticles) {
    // Animate aura particles
    const positions = dressupAuraParticles.geometry.attributes.position.array;
    setInterval(() => {
      if (!dressupAuraParticles) return;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i*3+1] = (positions[i*3+1] + 0.04) % 3.5;
      }
      dressupAuraParticles.geometry.attributes.position.needsUpdate = true;
    }, 30);
  }
}

function playDressupFinaleWalk() {
  dressupWalkingFinale = true;
  speakThai("เดินรันเวย์กันเลย!");
}

function stopDressupRunway3D() {
  if (dressupAnimId3d) { cancelAnimationFrame(dressupAnimId3d); dressupAnimId3d = null; }
  window.removeEventListener("keydown", handleDressupKey3d_down);
  window.removeEventListener("keyup", handleDressupKey3d_up);
  try { speechSynthesis.cancel(); } catch(e) {}
  dressupScene3d = null;
}

// ==========================================================================
// 7. Catalog Shop System & Item purchasing
// ==========================================================================
let activeShopCategory = "all";

function renderCatalogProducts() {
  const container = document.getElementById("catalog-products");
  container.innerHTML = "";
  
  const filtered = SHOP_ITEMS.filter(i => activeShopCategory === "all" || i.cat === activeShopCategory);
  
  filtered.forEach((item) => {
    const isUnlocked = gameState.unlockedItems.includes(item.id);
    const isEquipped = Object.values(gameState.equippedItems).includes(item.id);
    
    const card = document.createElement("div");
    card.className = "product-card";
    
    const rarityIcons = {
      common:    `<svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor"><polygon points="6,0 12,6 6,12 0,6"/></svg> Common`,
      rare:      `<svg viewBox="0 0 16 12" width="14" height="10" fill="currentColor"><polygon points="4,0 8,6 4,12 0,6"/><polygon points="12,0 16,6 12,12 8,6"/></svg> Rare`,
      legendary: `<svg viewBox="0 0 14 12" width="12" height="10" fill="currentColor"><polygon points="7,0 9,4 14,4 10,7 12,12 7,9 2,12 4,7 0,4 5,4"/></svg> Legendary`
    };
    card.innerHTML = `
      <span class="product-rarity-badge rarity-${item.rarity}">${rarityIcons[item.rarity] || item.rarity}</span>
      <div class="product-icon">${item.icon}</div>
      <div class="product-name">${item.name}</div>
    `;

    // Click to open preview popup
    card.style.cursor = 'pointer';
    card.addEventListener("click", () => {
      sounds.click();
      openItemPreviewPopup(item);
    });

    // Status badge — action is in the popup
    const statusBadge = document.createElement("div");
    statusBadge.className = "product-status-badge";
    if (isEquipped) {
      statusBadge.innerHTML = `<span class="equipped-tag">✓ กำลังสวมใส่</span>`;
    } else if (isUnlocked) {
      statusBadge.innerHTML = `<span class="unlocked-tag">🔓 ปลดล็อกแล้ว</span>`;
    } else {
      const canAfford = gameState.robux >= item.price;
      statusBadge.innerHTML = `<span class="price-tag ${!canAfford ? 'cant-afford' : ''}">
        <svg viewBox="0 0 20 20" fill="none" width="13" height="13"><circle cx="10" cy="10" r="9" fill="#00B06F" stroke="#00D385" stroke-width="1.5"/><text x="10" y="14" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="Arial">R$</text></svg>
        ${item.price}
      </span>`;
    }
    card.appendChild(statusBadge);

    const tapHint = document.createElement("div");
    tapHint.className = "product-tap-hint";
    tapHint.innerText = "กดดูตัวอย่าง ▶";
    card.appendChild(tapHint);
    container.appendChild(card);
  });
}

// ==========================================================================
// 8. View Switching / Screens Routing
// ==========================================================================
function switchScreen(targetScreenId) {
  sounds.click();
  closeItemPreviewPopup(); // close shop preview popup if open

  threeEngineActive = false;
  stopAllGameScenes();
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (targetScreenId !== "screen-training") {
    stopBeatSequencer(); stopMelodySequencer();
    document.querySelectorAll(".dj-beat-style-btn, .sd-beat-btn").forEach(btn => btn.classList.remove("active"));
    const hiphopBtn = document.querySelector("[data-beat='hiphop']");
    if (hiphopBtn) hiphopBtn.classList.add("active"); // null-safe
  }

  const screens = document.querySelectorAll(".game-screen");
  screens.forEach(s => s.classList.remove("active"));
  
  const target = document.getElementById(targetScreenId);
  if (target) target.classList.add("active");

  if (targetScreenId === "screen-hub") {
    renderAchievementsList();
  } else if (targetScreenId === "screen-shop") {
    renderCatalogProducts();
  }
}

// ==========================================================================
// 9. Event Listeners & Bootstrapping
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  loadGameState();
  renderAchievementsList();
  initSidebarAvatar();

  // iOS Safari audio unlock — fire on first ANY user interaction
  const _iosAudioUnlock = () => {
    unlockIOSAudio();
    document.removeEventListener('touchstart', _iosAudioUnlock);
    document.removeEventListener('touchend',   _iosAudioUnlock);
    document.removeEventListener('click',      _iosAudioUnlock);
  };
  document.addEventListener('touchstart', _iosAudioUnlock, { once: true, passive: true });
  document.addEventListener('touchend',   _iosAudioUnlock, { once: true, passive: true });
  document.addEventListener('click',      _iosAudioUnlock, { once: true });

  // --- Router Events ---
  document.getElementById("mode-to-training").addEventListener("click", () => switchScreen("screen-training"));
  document.getElementById("mode-to-arena").addEventListener("click", () => {
    switchScreen("screen-arena");
    document.getElementById("arena-step-table").classList.add("active");
    document.getElementById("arena-step-path").classList.remove("active");
    document.getElementById("arena-step-gameplay").classList.remove("active");
    document.getElementById("arena-step-result").classList.remove("active");
    renderArenaTables();
  });
  document.getElementById("btn-open-shop").addEventListener("click", () => switchScreen("screen-shop"));
  document.getElementById("robux-display-btn").addEventListener("click", () => switchScreen("screen-shop"));

  document.getElementById("back-to-hub-from-training").addEventListener("click", () => switchScreen("screen-hub"));
  document.getElementById("back-to-hub-from-arena").addEventListener("click", () => switchScreen("screen-hub"));
  document.getElementById("back-to-hub-from-shop").addEventListener("click", () => switchScreen("screen-hub"));

  document.getElementById("player-username").addEventListener("change", (e) => {
    gameState.username = e.target.value.trim() || "GuestPlayer";
    saveGameState();
  });

  document.getElementById("sound-toggle-btn").addEventListener("click", () => {
    unlockIOSAudio(); // iOS audio unlock on sound toggle
    soundEnabled = !soundEnabled;
    const btnIcon = document.getElementById("sound-icon");
    btnIcon.innerText = soundEnabled ? "🔊" : "🔇";
    if (!soundEnabled) stopBeatSequencer();
  });

  // --- Training Room Events ---
  initTrainingSelector();

  // --- Training Tab Switching ---
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sounds.click();
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tabTarget = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
      const targetEl = document.getElementById(tabTarget);
      if (targetEl) targetEl.classList.add("active");

      if (!activeTrainingTable) return;
      stopBeatSequencer(); stopStepDance3D(); stopTrampoline3D();

      if (tabTarget === "tab-stepdance") {
        if (soundEnabled) startBeatSequencer();
        initStepDance3D(activeTrainingTable);
      } else if (tabTarget === "tab-trampoline") {
        stopBeatSequencer();
        initTrampoline3D(activeTrainingTable);
      }
    });
  });

  // Beat & Tap pad button
  const beatTapPad = document.getElementById("beattap-pad");
  if (beatTapPad) beatTapPad.addEventListener("click", handleBeatTapTap);

  // Beat style buttons (shared with beat & tap)
  document.querySelectorAll(".dj-beat-style-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      sounds.click();
      document.querySelectorAll(".dj-beat-style-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeBeatStyle = btn.getAttribute("data-beat");
      if (soundEnabled) {
        startBeatSequencer();
        if (sdScene) startMelodySequencer(activeBeatStyle); // restart melody if in step dance
      }
    });
  });

  // Block Stacker buttons
  const stackerDropBtn = document.getElementById("stacker-drop-btn");
  if (stackerDropBtn) stackerDropBtn.addEventListener("click", doStackerDrop);
  const stackerResetBtn = document.getElementById("stacker-reset-btn");
  if (stackerResetBtn) stackerResetBtn.addEventListener("click", () => {
    if (activeTrainingTable) { sounds.click(); initBlockStacker(activeTrainingTable, 4); }
  });

  // --- Gender Toggle ---
  const maleBtm = document.getElementById("gender-male-btn");
  const femaleBtm = document.getElementById("gender-female-btn");
  if (maleBtm) maleBtm.addEventListener("click", () => {
    gameState.gender = "male";
    // Cool male default colors — visible blue/gray
    if (!gameState.equippedItems.shirt) gameState.avatarColors.torso = "#1e63e6";
    if (!gameState.equippedItems.pants) gameState.avatarColors.legs  = "#555555";
    maleBtm.classList.add("active"); femaleBtm.classList.remove("active");
    saveGameState(); refreshSidebarAvatar();
  });
  if (femaleBtm) femaleBtm.addEventListener("click", () => {
    gameState.gender = "female";
    // Cute female default colors (pink/white)
    if (!gameState.equippedItems.shirt) gameState.avatarColors.torso = "#e91e63";
    if (!gameState.equippedItems.pants) gameState.avatarColors.legs  = "#f5f5f5";
    femaleBtm.classList.add("active"); maleBtm.classList.remove("active");
    saveGameState(); refreshSidebarAvatar();
  });

  // Chill Farm Hint button
  const hintBtn = document.getElementById("chill-farm-hint-btn");
  if (hintBtn) hintBtn.addEventListener("click", triggerChillFarmHint3D);

  // Multiplayer toggle
  const mpToggle = document.getElementById("multiplayer-toggle");
  if (mpToggle) {
    mpToggle.addEventListener("change", () => {
      multiplayerMode = mpToggle.checked;
      const knob = document.getElementById("toggle-knob");
      const track = knob?.previousElementSibling;
      if (knob) knob.style.left = multiplayerMode ? "25px" : "3px";
      if (track) track.style.background = multiplayerMode ? "#9c27b0" : "#333";
      sounds.click();
    });
  }

  // Exit fullscreen button
  document.getElementById("btn-exit-fullscreen-fixed")?.addEventListener("click", () => {
    sounds.click();
    stopAllGameScenes();
    exitFullscreenGameplay();
    removeSuccessOverlay();
    // Return to arena table selection
    document.getElementById("arena-step-gameplay")?.classList.remove("active");
    document.getElementById("arena-step-table")?.classList.add("active");
    document.querySelectorAll(".gameplay-subscreen").forEach(el => el.style.display = "none");
  });

  // --- Arena Mode Events ---
  const zoneButtons = document.querySelectorAll(".zone-tab");
  zoneButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sounds.click();
      zoneButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      activeArenaZone = parseInt(btn.getAttribute("data-zone"));
      
      document.getElementById("arena-step-table").classList.add("active");
      document.getElementById("arena-step-path").classList.remove("active");
      document.getElementById("arena-step-gameplay").classList.remove("active");
      document.getElementById("arena-step-result").classList.remove("active");
      
      renderArenaTables();
    });
  });

  document.getElementById("btn-play-sequence-zone").addEventListener("click", () => {
    isPlayingSequential = true;
    const firstTable = ZONE_TABLES[activeArenaZone][0];
    selectArenaTable(firstTable);
  });

  document.getElementById("btn-back-to-arena-tables").addEventListener("click", () => {
    sounds.click();
    document.getElementById("arena-step-path").classList.remove("active");
    document.getElementById("arena-step-table").classList.add("active");
  });

  const pathCards = document.querySelectorAll(".path-card");
  pathCards.forEach((card) => {
    card.addEventListener("click", () => {
      const pathType = card.getAttribute("data-path");
      startPathGameplay(pathType);
    });
  });

  document.getElementById("btn-quit-chill").addEventListener("click", () => {
    sounds.click();
    document.getElementById("arena-step-gameplay").classList.remove("active");
    document.getElementById("arena-step-table").classList.add("active");
  });

  document.getElementById("btn-quit-dressup").addEventListener("click", () => {
    sounds.click();
    document.getElementById("arena-step-gameplay").classList.remove("active");
    document.getElementById("arena-step-table").classList.add("active");
  });

  document.getElementById("btn-result-replay").addEventListener("click", () => {
    startPathGameplay(activePlayPath);
  });
  document.getElementById("btn-result-to-shop").addEventListener("click", () => {
    document.getElementById("arena-step-result").classList.remove("active");
    switchScreen("screen-shop");
  });
  document.getElementById("btn-result-to-lobby").addEventListener("click", () => {
    document.getElementById("arena-step-result").classList.remove("active");
    checkSequentialPlayNext();
  });

  // --- Shop Event Listeners ---
  const shopCatButtons = document.querySelectorAll(".shop-cat-btn");
  shopCatButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sounds.click();
      shopCatButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeShopCategory = btn.getAttribute("data-cat");
      renderCatalogProducts();
    });
  });

  // --- Custom Color Modal Events ---
  const colorModal = document.getElementById("color-modal");
  document.getElementById("btn-custom-colors").addEventListener("click", () => {
    sounds.click();
    colorModal.style.display = "flex";
    
    const highlightDot = (containerId, colorHex) => {
      const dots = document.getElementById(containerId).querySelectorAll(".color-dot");
      dots.forEach(d => {
        if (d.getAttribute("data-color") === colorHex) {
          d.classList.add("active");
        } else {
          d.classList.remove("active");
        }
      });
    };
    highlightDot("color-skin-options", gameState.avatarColors.skin);
    highlightDot("color-torso-options", gameState.avatarColors.torso);
    highlightDot("color-legs-options", gameState.avatarColors.legs);
  });

  document.getElementById("btn-close-colors").addEventListener("click", () => {
    sounds.click();
    colorModal.style.display = "none";
    // Sync skin colors back onto 3D character if running
    if (threeEngineActive) {
      build3DPlayer();
    }
  });

  const addColorSelector = (containerId, stateKey) => {
    const dots = document.getElementById(containerId).querySelectorAll(".color-dot");
    dots.forEach(dot => {
      dot.addEventListener("click", () => {
        sounds.click();
        dots.forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        
        gameState.avatarColors[stateKey] = dot.getAttribute("data-color");
        saveGameState();
      });
    });
  };
  
  addColorSelector("color-skin-options", "skin");
  addColorSelector("color-torso-options", "torso");
  addColorSelector("color-legs-options", "legs");
});
