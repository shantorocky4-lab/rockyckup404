// Shuffle
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Valid suffixes
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

// Normalize amount -> returns { valid, raw (real number), formatted (string) }
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

const ICONS = ["🍒", "🍇", "🍉", "🍓", "🍋", "🔔", "💎"];

function buildFrame(e1, e2, e3, footer) {
  let msg = `❀°• 𝑺𝒍𝒐𝒕 𝑴𝒂𝒄𝒉𝒊𝒏𝒆 •°❀\n`;
  msg += `🎰  ✨  💫  ✨  🎰\n\n`;
  msg += `♡┈┈┈┈┈┈┈┈┈┈┈┈♡\n`;
  msg += ` ► [ ${e1} | ${e2} | ${e3} ] ◄\n`;
  msg += `♡┈┈┈┈┈┈┈┈┈┈┈┈♡\n\n`;
  msg += footer;
  return msg;
}

module.exports.config = {
  name: "slot",
  version: "6.1.0",
  hasPermssion: 0,
  credits: "ROCKY CHOWDHURY",
  description: "Slot machine game",
  commandCategory: "games",
  usages: "[amount]",
  cooldowns: 5
};

// GoatBot requires "onStart" as the entry function.
// usersData is provided directly by GoatBot's core.
module.exports.onStart = async function ({ api, event, args, usersData }) {
  const uid = event.senderID;

  try {
    const betRaw = args[0];

    if (!betRaw) {
      return api.sendMessage(
        "💌 | 𝑬𝒏𝒕𝒆𝒓 𝒂 𝒃𝒆𝒕 𝒂𝒎𝒐𝒖𝒏𝒕 𝒑𝒍𝒆𝒂𝒔𝒆~ 🎰",
        event.threadID,
        event.messageID
      );
    }

    const betData = money(betRaw);

    if (!betData.valid) {
      return api.sendMessage(
        "💔 | 𝑻𝒉𝒂𝒕'𝒔 𝒏𝒐𝒕 𝒂 𝒗𝒂𝒍𝒊𝒅 𝒂𝒎𝒐𝒖𝒏𝒕~",
        event.threadID,
        event.messageID
      );
    }

    const betNumber = betData.raw;
    const bet = betData.formatted;

    // ---- Balance check + deduct via GoatBot's usersData ----
    const currentBalance = (await usersData.get(uid, "money")) || 0;

    if (currentBalance < betNumber) {
      return api.sendMessage(
        `💔 | 𝒚𝒐𝒖 𝒅𝒐𝒏'𝒕 𝒉𝒂𝒗𝒆 𝒆𝒏𝒐𝒖𝒈𝒉 𝒃𝒂𝒍𝒂𝒏𝒄𝒆~\n💰 𝑩𝒂𝒍𝒂𝒏𝒄𝒆: ${money(String(currentBalance)).formatted}`,
        event.threadID,
        event.messageID
      );
    }

    // Bet is taken immediately. If the player loses, it simply stays deducted.
    await usersData.set(uid, currentBalance - betNumber, "money");

    // ---- Decide the outcome BEFORE the animation, so we know where to land ----
    // Win rate raised so most spins win; jackpot pays out much bigger now.
    const isWin = Math.random() < 0.78;
    let e1, e2, e3;
    let profitX = 0;

    if (isWin) {
      const isJackpot = Math.random() < 0.12;
      const pick = shuffle(ICONS);

      if (isJackpot) {
        e1 = pick[0];
        e2 = pick[0];
        e3 = pick[0];
        // Jackpot: total return = 10x bet (e.g. bet 500 -> get back 5000)
        profitX = 9;
      } else {
        e1 = pick[0];
        e2 = pick[0];
        e3 = pick[1];
        // Normal win: total return = 2x bet (e.g. bet 500 -> get back 1000)
        profitX = 1;
      }
    } else {
      let pick = shuffle(ICONS);
      e1 = pick[0];
      e2 = pick[1];
      e3 = pick[2];
      // guard: a "lost" roll must never accidentally show 3 matching icons
      while (e1 === e2 && e2 === e3) {
        pick = shuffle(ICONS);
        e1 = pick[0];
        e2 = pick[1];
        e3 = pick[2];
      }
    }

    const randIcon = () => ICONS[Math.floor(Math.random() * ICONS.length)];

    // ---- Send the first "spinning" frame ----
    const sentInfo = await new Promise((resolve, reject) => {
      api.sendMessage(
        buildFrame(randIcon(), randIcon(), randIcon(), "✨💫 𝒔𝒑𝒊𝒏𝒏𝒊𝒏𝒈... 💫✨"),
        event.threadID,
        (err, info) => {
          if (err) return reject(err);
          resolve(info);
        },
        event.messageID
      );
    });

    // Wraps api.editMessage so a single failed edit (rate limit, FB glitch, etc.)
    // never crashes the whole command. It retries a couple of times before
    // giving up on that frame - we never fall back to sending a new message,
    // everything must appear inside this one edited message.
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
          await delay(400);
        }
      }
      return false;
    }

    // ---- Animate: reels spin a few times before settling ----
    // Kept short (3 edits total) so we stay well under any per-message edit
    // limit the platform enforces - going over that limit is what caused
    // the final edit to fail and a duplicate message to be sent before.
    const SPIN_ROUNDS = 3;
    for (let i = 0; i < SPIN_ROUNDS; i++) {
      await delay(700);
      await safeEdit(
        buildFrame(randIcon(), randIcon(), randIcon(), "✨💫 𝒔𝒑𝒊𝒏𝒏𝒊𝒏𝒈... 💫✨")
      );
    }

    await delay(700);

    // ---- Apply reward if won ----
    if (isWin) {
      const rewardData = money(bet, profitX + 1);
      if (!rewardData.valid) throw new Error("Reward parse failed");

      const balanceAfterBet = (await usersData.get(uid, "money")) || 0;
      await usersData.set(uid, balanceAfterBet + rewardData.raw, "money");
    }

    const profit = money(bet, profitX).formatted;
    let footer;

    if (isWin) {
      footer = profitX === 9
        ? `💖✨ 𝑱𝑨𝑪𝑲𝑷𝑶𝑻!! ✨💖\n🎇 𝒚𝒐𝒖'𝒓𝒆 𝒔𝒐 𝒍𝒖𝒄𝒌𝒚~ 🎇\n💌 𝑷𝒓𝒐𝒇𝒊𝒕: 💲${profit} ✨`
        : `💗 𝒚𝒐𝒖 𝒘𝒐𝒏! 💗\n💌 𝑷𝒓𝒐𝒇𝒊𝒕: 💲${profit} ✨`;
    } else {
      footer = `💔 𝒂𝒘𝒘, 𝒚𝒐𝒖 𝒍𝒐𝒔𝒕~ 💔\n➖ 💲${bet}`;
    }

    const newBalance = (await usersData.get(uid, "money")) || 0;
    footer += `\n♡┈┈┈┈┈┈┈┈┈┈┈┈♡\n💰 𝑩𝒂𝒍𝒂𝒏𝒄𝒆: ${money(String(newBalance)).formatted} 💞`;

    // ---- Final frame: all reels locked + result ----
    // Everything must appear inside this one edited message - no separate
    // message is ever sent, even if the edit needs a couple of retries.
    await safeEdit(buildFrame(e1, e2, e3, footer));

  } catch (err) {
    console.log(err);
    return api.sendMessage(
      "❌ | Error occurred: " + (err && err.message ? err.message : String(err)),
      event.threadID,
      event.messageID
    );
  }
};
