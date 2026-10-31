const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { createCanvas, loadImage } = require("canvas");

/* ═══════════════════════════════════════════════
   🔒 AUTHOR PROTECTION — DO NOT EDIT
   Changing the author name will break this file.
═══════════════════════════════════════════════ */
const _h = (s) => {
  let x = 5381;
  for (const c of String(s)) {
    x = ((x << 5) + x + c.charCodeAt(0) * 31) >>> 0;
    x ^= x >>> 7;
  }
  return x >>> 0;
};
const _OWNER = String.fromCharCode(82, 111, 99, 107, 121); // owner credit
const _SEAL = 3337801638;
const _guard = (cfg) => {
  if (!cfg || _h(cfg.author) !== _SEAL || _h(_OWNER) !== _SEAL) {
    throw new Error(
      "⛔ [kiss3.js] Author credit has been modified. This command is locked."
    );
  }
};

// ================== SETTINGS ==================
//
//  HOW TO ADD A NEW PHOTO
//  1) Look at the photo: which side is the GIRL on?
//  2) Paste the image link into the matching list below:
//       girl on the LEFT   ->  GIRL_ON_LEFT
//       girl on the RIGHT  ->  GIRL_ON_RIGHT
//  3) Save and restart the bot. That's it!
//
//  (kiss3 = SMART)
//  A boy's avatar goes on the boy's head, a girl's avatar on the girl's head.
//  The person who sends the command decides first; the mentioned person gets the other spot.
//
//  (Optional) If a circle is not exactly on the head, give that photo
//  its own position instead of a plain link, like this:
//    { url: "https://i.imgur.com/xxxx.jpeg",
//      boy:  { x: 0.60, y: 0.20, size: 0.18 },
//      girl: { x: 0.30, y: 0.35, size: 0.18 } }
//  x, y = head center (0 to 1 of image width/height), size = diameter (0 to 1 of width)

// 👩 girl on the LEFT side, boy on the RIGHT side
const GIRL_ON_LEFT = [
  {
    url: "https://i.imgur.com/JiOr6OR.jpeg",
    boy: { x: 0.65, y: 0.34, size: 0.20 },
    girl: { x: 0.38, y: 0.42, size: 0.20 }
  }
];

// 👩 girl on the RIGHT side, boy on the LEFT side
const GIRL_ON_RIGHT = [
  {
    url: "https://i.imgur.com/C8tDiT2.jpeg",
    boy: { x: 0.60, y: 0.16, size: 0.17 },
    girl: { x: 0.82, y: 0.38, size: 0.17 }
  },
  "https://i.imgur.com/vqWLKzx.jpeg",
  "https://i.imgur.com/EQ4TB8h.jpeg",
  "https://i.imgur.com/qXGdXXW.jpeg",
  "https://i.imgur.com/i66Iai5.jpeg",
  "https://i.imgur.com/q5kGuR1.jpeg",
  "https://i.imgur.com/86PqiiG.jpeg",
  "https://i.imgur.com/ld0KjSb.jpeg"
];

// default circle positions (used when you add a plain link)
const DEFAULT_FOR_GIRL_LEFT = {
  boy: { x: 0.65, y: 0.25, size: 0.18 },
  girl: { x: 0.35, y: 0.25, size: 0.18 }
};
const DEFAULT_FOR_GIRL_RIGHT = {
  boy: { x: 0.35, y: 0.25, size: 0.18 },
  girl: { x: 0.65, y: 0.25, size: 0.18 }
};

const BORDER_COLOR = "#ffffff";
const BORDER_WIDTH = 5;
// ==============================================

function buildTemplates(list, defaults) {
  return list
    .map((item) => (typeof item === "string" ? { url: item } : item))
    .filter((o) => o && typeof o.url === "string" && o.url.trim())
    .map((o) => ({
      url: o.url.trim(),
      boy: o.boy || defaults.boy,
      girl: o.girl || defaults.girl
    }));
}

const TEMPLATES = [
  ...buildTemplates(GIRL_ON_LEFT, DEFAULT_FOR_GIRL_LEFT),
  ...buildTemplates(GIRL_ON_RIGHT, DEFAULT_FOR_GIRL_RIGHT)
];

// Shuffle-bag: every template is used once before any repeats,
// and the same picture never shows twice in a row.
let _bag = [];
let _last = -1;
function nextTemplateIndex() {
  if (_bag.length === 0) {
    _bag = TEMPLATES.map((_, i) => i);
    for (let i = _bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_bag[i], _bag[j]] = [_bag[j], _bag[i]];
    }
    if (_bag.length > 1 && _bag[_bag.length - 1] === _last) {
      [_bag[0], _bag[_bag.length - 1]] = [_bag[_bag.length - 1], _bag[0]];
    }
  }
  _last = _bag.pop();
  return _last;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  Referer: "https://imgur.com/"
};

async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: HEADERS,
    timeout: 20000,
    maxRedirects: 5
  });
  return Buffer.from(res.data);
}

async function loadTemplateImage(tpl) {
  const cacheDir = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);
  const key = crypto.createHash("md5").update(tpl.url).digest("hex").slice(0, 12);
  const cacheFile = path.join(cacheDir, `kiss_${key}.jpg`);

  if (fs.existsSync(cacheFile)) {
    try { return await loadImage(cacheFile); } catch (e) { fs.removeSync(cacheFile); }
  }

  const urls = [tpl.url];
  const m = tpl.url.match(/imgur\.com\/([A-Za-z0-9]+)/);
  if (m) for (const ext of ["jpeg", "jpg", "png"]) urls.push(`https://i.imgur.com/${m[1]}.${ext}`);

  let lastErr;
  for (const url of [...new Set(urls)]) {
    try {
      const buf = await fetchBuffer(url);
      const img = await loadImage(buf);
      fs.writeFileSync(cacheFile, buf);
      return img;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Template download failed (${tpl.url}): ` + (lastErr && lastErr.message));
}

// picks the next random template; if one fails to download, tries another
async function pickTemplate() {
  let lastErr;
  for (let i = 0; i < TEMPLATES.length; i++) {
    const tpl = TEMPLATES[nextTemplateIndex()];
    try {
      return { tpl, img: await loadTemplateImage(tpl) };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("No kiss photos added. Add image links to GIRL_ON_LEFT / GIRL_ON_RIGHT.");
}

async function loadAvatar(uid, usersData) {
  const urls = [];
  try {
    const u = await usersData.getAvatarUrl(uid);
    if (u) urls.push(u);
  } catch (e) {}
  urls.push(
    `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`
  );
  for (const url of urls) {
    try {
      return await loadImage(await fetchBuffer(url));
    } catch (e) {}
  }
  return null; // fallback: grey circle
}

function drawCircle(ctx, img, cx, cy, size) {
  const r = size / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, r + BORDER_WIDTH, 0, Math.PI * 2);
  ctx.fillStyle = BORDER_COLOR;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, size, size);
  } else {
    ctx.fillStyle = "#888";
    ctx.fillRect(cx - r, cy - r, size, size);
  }
  ctx.restore();
}

// ---------- gender detection ----------
function normGender(g) {
  if (g == null) return null;
  const t = String(g).trim().toLowerCase();
  if (["1", "female", "f", "girl"].includes(t)) return "female";
  if (["2", "male", "m", "boy"].includes(t)) return "male";
  return null;
}

async function getGender(uid, usersData, api) {
  try {
    const d = await usersData.get(uid);
    const g = normGender(d && d.gender);
    if (g) return g;
  } catch (e) {}
  try {
    const info = await Promise.race([
      new Promise((resolve) => {
        try { api.getUserInfo([uid], (err, data) => resolve(err ? null : data)); }
        catch (e) { resolve(null); }
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 8000))
    ]);
    const g = normGender(info && info[uid] && info[uid].gender);
    if (g) return g;
  } catch (e) {}
  return null; // unknown (Facebook may hide gender)
}

// decide which spot (boy / girl) each person takes
function assignSpots(senderGender, targetGender) {
  let senderSpot;
  if (senderGender) senderSpot = senderGender === "male" ? "boy" : "girl";
  else if (targetGender) senderSpot = targetGender === "male" ? "girl" : "boy";
  else senderSpot = "boy"; // both unknown: sender = boy, mentioned = girl
  return { senderSpot, targetSpot: senderSpot === "boy" ? "girl" : "boy" };
}

const CONFIG = {
  name: "kiss",
  version: "1.0",
  author: "Rocky",
  countDown: 5,
  role: 0,
  shortDescription: { en: "Send a kiss 💋 (smart: boy on boy spot, girl on girl spot)" },
  longDescription: { en: "Mention someone to create a kiss picture. Each profile picture goes on the matching head: boys on the boy, girls on the girl." },
  category: "love",
  guide: { en: "{pn} @mention\nor reply to someone's message with {pn}" }
};

// runs when the bot loads the file
_guard(CONFIG);

module.exports = {
  config: CONFIG,

  onStart: async function ({ api, message, event, usersData }) {
    _guard(module.exports.config); // runs on every command use

    const senderID = event.senderID;
    let targetID = Object.keys(event.mentions || {})[0];
    if (!targetID && event.messageReply) targetID = event.messageReply.senderID;

    if (!targetID)
      return message.reply("💋 Who do you want to kiss?\nMention someone or reply to their message!");
    if (targetID === senderID)
      return message.reply("😅 You can't kiss yourself!\nMention someone else.");

    let file;
    try {
      const [picked, senderImg, targetImg, senderGender, targetGender] = await Promise.all([
        pickTemplate(),
        loadAvatar(senderID, usersData),
        loadAvatar(targetID, usersData),
        getGender(senderID, usersData, api),
        getGender(targetID, usersData, api)
      ]);
      const template = picked.img;
      const BOY = picked.tpl.boy;
      const GIRL = picked.tpl.girl;

      const W = template.width;
      const H = template.height;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(template, 0, 0, W, H);

      // each avatar goes on the head that matches the person's gender
      const spots = { boy: BOY, girl: GIRL };
      const { senderSpot, targetSpot } = assignSpots(senderGender, targetGender);
      const sp = spots[senderSpot];
      const tp = spots[targetSpot];
      drawCircle(ctx, senderImg, sp.x * W, sp.y * H, sp.size * W);
      drawCircle(ctx, targetImg, tp.x * W, tp.y * H, tp.size * W);

      const dir = path.join(__dirname, "cache");
      fs.ensureDirSync(dir);
      file = path.join(dir, `kiss3_${senderID}_${targetID}_${Date.now()}.png`);
      fs.writeFileSync(file, canvas.toBuffer("image/png"));

      const cleanName = (n, fallback) => {
        const t = n == null ? "" : String(n).trim();
        return !t || ["null", "undefined"].includes(t.toLowerCase()) ? fallback : t;
      };
      const mentionText = event.mentions && event.mentions[targetID]
        ? String(event.mentions[targetID]).replace(/^@/, "").trim()
        : "";
      let senderName = "Someone", targetName = mentionText || "Friend";
      try { senderName = cleanName(await usersData.getName(senderID), senderName); } catch (e) {}
      try { targetName = cleanName(await usersData.getName(targetID), targetName); } catch (e) {}

      const body =
        "╭━━━━━━━━━━━━━━━━━━╮\n" +
        "   💋 𝐊𝐈𝐒𝐒 𝐌𝐎𝐌𝐄𝐍𝐓 💋\n" +
        "╰━━━━━━━━━━━━━━━━━━╯\n\n" +
        `💞 ${senderName}\n` +
        "        ❤️ 𝐤𝐢𝐬𝐬𝐞𝐝 ❤️\n" +
        `💞 ${targetName}\n\n` +
        "✨ Two hearts, one unforgettable moment 🌹";

      await message.reply({
        body,
        mentions: [
          { tag: senderName, id: senderID },
          { tag: targetName, id: targetID }
        ],
        attachment: fs.createReadStream(file)
      });
    } catch (err) {
      console.error("[kiss3] error:", err);
      return message.reply("❌ Failed to create the image:\n" + (err && err.message ? err.message : err));
    } finally {
      if (file) fs.remove(file).catch(() => {});
    }
  }
};
