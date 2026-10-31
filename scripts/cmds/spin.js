const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------
// Money formatting (same suffix system as slot.js)
// ---------------------------------------------------------
const SUFFIXES = [
  "", "K", "M", "B", "T",
  "QA", "QI", "SX", "SP",
  "O", "N", "D",
  "UD", "DD", "TD",
  "QAD", "QID", "SXD", "SPD",
  "OD", "ND",
  "V", "UV", "DV", "TV",
  "QAV", "QIV", "SXV", "SPV",
  "OV", "NV",
  "TG", "UTG", "GG"
];

const FORMAT = [
  "", "K", "M", "B", "T",
  "Qa", "Qi", "Sx", "Sp",
  "O", "N", "D",
  "Ud", "Dd", "Td",
  "Qad", "Qid", "Sxd", "Spd",
  "Od", "Nd",
  "V", "Uv", "Dv", "Tv",
  "Qav", "Qiv", "Sxv", "Spv",
  "Ov", "Nv",
  "Tg", "Utg", "GG"
];

function money(value, multi = 1) {
  const txt = String(value).replace(/,/g, "").trim();
  const match = txt.match(/^([0-9.]+)([a-zA-Z]*)$/);

  if (!match) return { valid: false };

  let num = parseFloat(match[1]);
  let suffix = match[2].toUpperCase();

  let index = SUFFIXES.indexOf(suffix);
  if (index === -1 || isNaN(num) || num <= 0) return { valid: false };

  let rawIndex = index;
  let rawNum = num;
  while (rawIndex > 0) {
    rawNum *= 1000;
    rawIndex--;
  }
  const raw = Math.round(rawNum * multi);

  num *= multi;

  while (num >= 1000 && index < SUFFIXES.length - 1) {
    num /= 1000;
    index++;
  }

  while (num < 1 && index > 0) {
    num *= 1000;
    index--;
  }

  num = Number(num.toFixed(2));

  return {
    valid: true,
    raw,
    formatted: `${num}${FORMAT[index]}`
  };
}

// ---------------------------------------------------------
// Wheel segments — each has a multiplier, a label, an emoji,
// and a weight (higher weight = more common).
// Bet is taken up front, so multiplier 0 simply means "you lose it all".
// ---------------------------------------------------------
const WHEEL = [
  { mult: 0,    label: "𝐁𝐔𝐒𝐓",     emoji: "💥", weight: 10, tier: "bust"  },
  { mult: 0.5,  label: "𝐇𝐀𝐋𝐅 𝐁𝐀𝐂𝐊", emoji: "🌗", weight: 5,  tier: "small" },
  { mult: 2,    label: "𝐖𝐈𝐍",       emoji: "🔵", weight: 35, tier: "mid"   },
  { mult: 3,    label: "𝐍𝐈𝐂𝐄",      emoji: "🟢", weight: 20, tier: "mid"   },
  { mult: 5,    label: "𝐆𝐑𝐄𝐀𝐓",     emoji: "🟠", weight: 15, tier: "big"   },
  { mult: 10,   label: "𝐇𝐔𝐆𝐄",      emoji: "🟡", weight: 10, tier: "big"   },
  { mult: 50,   label: "𝐉𝐀𝐂𝐊𝐏𝐎𝐓",   emoji: "💎", weight: 5,  tier: "jackpot" }
];

function pickSegment() {
  const totalWeight = WHEEL.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const seg of WHEEL) {
    if (roll < seg.weight) return seg;
    roll -= seg.weight;
  }
  return WHEEL[0];
}

function tierBanner(tier) {
  switch (tier) {
    case "jackpot": return "💖✨ 𝑱𝑨𝑪𝑲𝑷𝑶𝑻 𝑯𝑰𝑻!! ✨💖\n🎇 𝒚𝒐𝒖'𝒓𝒆 𝒔𝒐 𝒍𝒖𝒄𝒌𝒚~ 🎇";
    case "big":     return "🌟💌 𝑩𝑰𝑮 𝑾𝑰𝑵! 💌🌟";
    case "mid":     return "✨💞 𝑵𝑰𝑪𝑬 𝑺𝑷𝑰𝑵! 💞✨";
    case "small":   return "💗 𝒚𝒐𝒖 𝒘𝒐𝒏! 💗";
    default:        return "💔 𝒂𝒘𝒘, 𝒃𝒖𝒔𝒕𝒆𝒅~ 💔";
  }
}

function bar(percent, length = 14) {
  const filled = Math.round((percent / 100) * length);
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

function buildFrame({ header, ring, pointerIndex, footer }) {
  let msg = `❀°• 𝑾𝒉𝒆𝒆𝒍 𝒐𝒇 𝑺𝒑𝒊𝒏 •°❀\n`;
  msg += `🎡  ✨  💫  ✨  🎡\n\n`;

  if (header) msg += `${header}\n\n`;

  // Render the ring of segments with a pointer under the active one
  const line1 = ring.map((e, i) => (i === pointerIndex ? `⟦${e}⟧` : ` ${e} `)).join("");
  msg += `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n`;
  msg += `${line1}\n`;
  msg += `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n\n`;

  if (footer) msg += footer;

  return msg;
}

module.exports.config = {
  name: "spin",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "ROCKY CHOWDHURY",
  description: "Wheel of Spin — bet and spin the wheel for multipliers up to 25x!",
  commandCategory: "games",
  usages: "[amount]",
  cooldowns: 6
};

// GoatBot requires "onStart" as the entry function.
// usersData is provided directly by GoatBot's core.
module.exports.onStart = async function ({ api, event, args, usersData }) {
  const uid = event.senderID;

  try {
    const betRaw = args[0];

    if (!betRaw) {
      return api.sendMessage(
        "⚠️ | 𝐄𝐧𝐭𝐞𝐫 𝐛𝐞𝐭 𝐚𝐦𝐨𝐮𝐧𝐭.\n𝐔𝐬𝐚𝐠𝐞: spin <amount>\n𝐄𝐱: spin 500",
        event.threadID,
        event.messageID
      );
    }

    if (betRaw.toLowerCase() === "info" || betRaw.toLowerCase() === "help") {
      let info = `❀°• 𝑾𝒉𝒆𝒆𝒍 𝒐𝒇 𝑺𝒑𝒊𝒏 •°❀\n🎡  ✨  💫  ✨  🎡\n\n`;
      info += `💌 𝑷𝒂𝒚𝒐𝒖𝒕 𝒕𝒊𝒆𝒓𝒔:\n`;
      for (const seg of WHEEL) {
        info += ` ${seg.emoji}  ${seg.label} — ${seg.mult}x\n`;
      }
      info += `\n✨ 𝑼𝒔𝒂𝒈𝒆: spin <amount> 💞`;
      return api.sendMessage(info, event.threadID, event.messageID);
    }

    const betData = money(betRaw);

    if (!betData.valid) {
      return api.sendMessage(
        "⚠️ | 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐚𝐦𝐨𝐮𝐧𝐭.",
        event.threadID,
        event.messageID
      );
    }

    const betNumber = betData.raw;
    const bet = betData.formatted;

    // ---- Balance check + deduct ----
    const currentBalance = (await usersData.get(uid, "money")) || 0;

    if (currentBalance < betNumber) {
      return api.sendMessage(
        `⚠️ | 𝐘𝐨𝐮 𝐝𝐨𝐧'𝐭 𝐡𝐚𝐯𝐞 𝐞𝐧𝐨𝐮𝐠𝐡 𝐛𝐚𝐥𝐚𝐧𝐜𝐞.\n💰 𝐁𝐚𝐥𝐚𝐧𝐜𝐞: ${money(String(currentBalance)).formatted}`,
        event.threadID,
        event.messageID
      );
    }

    // Bet is taken immediately. If nothing is won it simply stays deducted.
    await usersData.set(uid, currentBalance - betNumber, "money");

    // ---- Decide outcome up front ----
    const result = pickSegment();

    // Build a ring of emojis, ensure the winning emoji appears in it,
    // then shuffle so the "landing" position looks natural.
    let ringEmojis = shuffle(WHEEL.map((s) => s.emoji));
    let landIndex = ringEmojis.indexOf(result.emoji);
    if (landIndex === -1) {
      ringEmojis[0] = result.emoji;
      landIndex = 0;
    }

    const randPointer = () => Math.floor(Math.random() * ringEmojis.length);

    // ---- Send first spinning frame ----
    const sentInfo = await new Promise((resolve, reject) => {
      api.sendMessage(
        buildFrame({
          header: `🎯 𝑩𝒆𝒕: 💲${bet}`,
          ring: ringEmojis,
          pointerIndex: randPointer(),
          footer: `✨💫 𝒔𝒑𝒊𝒏𝒏𝒊𝒏𝒈. 💫✨`
        }),
        event.threadID,
        (err, info) => {
          if (err) return reject(err);
          resolve(info);
        },
        event.messageID
      );
    });

    // Edits everything into the same message. Retries a couple of times on
    // failure so a rate-limit blip never crashes the command, and never
    // falls back to sending a brand new message.
    async function safeEdit(text, retries = 2) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          await api.editMessage(text, sentInfo.messageID);
          return true;
        } catch (e) {
          if (attempt === retries) {
            console.log("editMessage failed after retries:", e);
            return false;
          }
          await delay(350);
        }
      }
      return false;
    }

    // ---- Spin animation: kept short (4 edits total) so we stay well under
    // any per-message edit limit the platform enforces - too many edits was
    // why the final win/lost frame silently failed to appear before.
    const spinSchedule = [150, 200, 250];
    let dots = 1;

    for (let i = 0; i < spinSchedule.length; i++) {
      await delay(spinSchedule[i]);
      dots = (dots % 3) + 1;
      const pointer = i < spinSchedule.length - 1 ? randPointer() : landIndex;
      await safeEdit(
        buildFrame({
          header: `🎯 𝑩𝒆𝒕: 💲${bet}`,
          ring: ringEmojis,
          pointerIndex: pointer,
          footer: `✨💫 𝒔𝒑𝒊𝒏𝒏𝒊𝒏𝒈${".".repeat(dots)} 💫✨`
        })
      );
    }

    // ---- Apply payout ----
    let payout = 0;
    if (result.mult > 0) {
      const rewardData = money(bet, result.mult);
      if (!rewardData.valid) throw new Error("Reward parse failed");
      payout = rewardData.raw;
      const balanceAfterBet = (await usersData.get(uid, "money")) || 0;
      await usersData.set(uid, balanceAfterBet + payout, "money");
    }

    const newBalance = (await usersData.get(uid, "money")) || 0;
    const net = payout - betNumber;

    let footer = `${result.emoji}  ${result.label}  (${result.mult}x)\n\n`;

    if (net > 0) {
      footer += `💌 𝑷𝒓𝒐𝒇𝒊𝒕: 💲${money(String(net)).formatted} ✨\n`;
    } else if (net === 0) {
      footer += `🤍 𝑩𝒓𝒐𝒌𝒆 𝒆𝒗𝒆𝒏~\n`;
    } else {
      footer += `💔 𝑳𝒐𝒔𝒕: 💲${money(String(Math.abs(net))).formatted}\n`;
    }

    footer += `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n`;
    footer += `💰 𝑩𝒂𝒍𝒂𝒏𝒄𝒆: ${money(String(newBalance)).formatted} 💞`;

    const banner = tierBanner(result.tier);

    await safeEdit(
      buildFrame({
        header: `🎯 𝑩𝒆𝒕: 💲${bet}\n${banner}`,
        ring: ringEmojis,
        pointerIndex: landIndex,
        footer
      }),
      4
    );

  } catch (err) {
    console.log(err);
    return api.sendMessage(
      "❌ | Error occurred: " + (err && err.message ? err.message : String(err)),
      event.threadID,
      event.messageID
    );
  }
};
