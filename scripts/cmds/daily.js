const moment = require("moment-timezone");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shortMoney(n) {
  const suf = ["", "K", "M", "B", "T", "QA", "QI"];
  let num = Number(n) || 0;
  let i = 0;
  while (Math.abs(num) >= 1000 && i < suf.length - 1) {
    num /= 1000;
    i++;
  }
  return `${Number(num.toFixed(2))}${suf[i]}`;
}

function fmtDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const GIFT_FRAMES = ["🎁", "📦", "🎀", "🎁"];
const STREAK_BREAK_MS = 48 * 60 * 60 * 1000; // miss more than 48h -> streak resets

module.exports = {
  config: {
    name: "daily",
    version: "2.0",
    author: "ROCKY CHOWDHURY",
    countDown: 5,
    role: 0,
    description: {
      en: "Receive daily gift"
    },
    category: "𝗪𝗔𝗟𝗟𝗘𝗧",
    guide: {
      en: "   {pn}: Claim your daily bonus"
        + "\n   {pn} info: View daily bonus information"
    },
    envConfig: {
      dailyReward: 1000000, // flat coin reward every claim
      cooldownHours: 24     // hours required between claims
    }
  },

  langs: {
    en: {
      alreadyReceived: "💌 𝒚𝒐𝒖'𝒗𝒆 𝒂𝒍𝒓𝒆𝒂𝒅𝒚 𝒄𝒍𝒂𝒊𝒎𝒆𝒅 𝒚𝒐𝒖𝒓 𝒃𝒐𝒏𝒖𝒔~",
      received: "🎁 𝑹𝒆𝒘𝒂𝒓𝒅: +💲%1 𝒄𝒐𝒊𝒏"
    }
  },

  onStart: async function ({ args, message, event, envCommands, usersData, commandName, getLang, api }) {
    const env = (envCommands && envCommands[commandName]) || this.config.envConfig;
    const dailyReward = env.dailyReward;
    const cooldownMs = env.cooldownHours * 60 * 60 * 1000;
    const { senderID } = event;

    // ---- Info page ----
    if (args[0] === "info") {
      const msg =
        `❀°• 𝑫𝒂𝒊𝒍𝒚 𝑩𝒐𝒏𝒖𝒔 •°❀\n\n` +
        `🎁 𝑹𝒆𝒘𝒂𝒓𝒅: 💲${shortMoney(dailyReward)} 𝒑𝒆𝒓 𝒄𝒍𝒂𝒊𝒎\n` +
        `⏰ 𝑪𝒐𝒐𝒍𝒅𝒐𝒘𝒏: ${env.cooldownHours}𝒉\n\n` +
        `✨ 𝑼𝒔𝒂𝒈𝒆: {pn}`;
      return message.reply(msg);
    }

    const userData = await usersData.get(senderID);
    const data = userData.data || {};

    const lastDaily = data.lastDaily || 0;
    const prevStreak = data.dailyStreak || 0;
    const now = Date.now();
    const elapsed = now - lastDaily;

    // ---- Still on cooldown ----
    if (lastDaily && elapsed < cooldownMs) {
      const remaining = cooldownMs - elapsed;
      const nextClaimStr = moment(lastDaily + cooldownMs)
        .tz("Asia/Dhaka")
        .format("MMM D, h:mm A");

      return message.reply(
        `⏳ ❀°• 𝑫𝒂𝒊𝒍𝒚 𝑩𝒐𝒏𝒖𝒔 •°❀ ⏳\n\n` +
        `${getLang("alreadyReceived")}\n\n` +
        `⏰ 𝑻𝒊𝒎𝒆 𝒍𝒆𝒇𝒕: ${fmtDuration(remaining)}\n` +
        `📅 𝑵𝒆𝒙𝒕 𝒄𝒍𝒂𝒊𝒎: ${nextClaimStr}\n` +
        `🔥 𝑺𝒕𝒓𝒆𝒂𝒌: ${prevStreak} ${prevStreak === 1 ? "day" : "days"}`
      );
    }

    // ---- Work out new streak ----
    const streakBroken = lastDaily && elapsed > STREAK_BREAK_MS;
    const newStreak = streakBroken || !lastDaily ? 1 : prevStreak + 1;

    // ---- Send the first "gift box" frame ----
    const sentInfo = await new Promise((resolve, reject) => {
      api.sendMessage(
        `❀°• 𝑫𝒂𝒊𝒍𝒚 𝑩𝒐𝒏𝒖𝒔 •°❀\n\n${GIFT_FRAMES[0]}  𝒐𝒑𝒆𝒏𝒊𝒏𝒈 𝒚𝒐𝒖𝒓 𝒈𝒊𝒇𝒕...`,
        event.threadID,
        (err, info) => {
          if (err) return reject(err);
          resolve(info);
        },
        event.messageID
      );
    });

    async function safeEdit(text, retries = 3) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          await api.editMessage(text, sentInfo.messageID);
          return true;
        } catch (e) {
          if (attempt === retries) {
            console.log("editMessage failed after retries:", e);
            return false;
          }
          await delay(300);
        }
      }
      return false;
    }

    // ---- Little unwrap animation ----
    for (let i = 1; i < GIFT_FRAMES.length; i++) {
      await delay(500);
      await safeEdit(`❀°• 𝑫𝒂𝒊𝒍𝒚 𝑩𝒐𝒏𝒖𝒔 •°❀\n\n${GIFT_FRAMES[i]}  𝒐𝒑𝒆𝒏𝒊𝒏𝒈 𝒚𝒐𝒖𝒓 𝒈𝒊𝒇𝒕...`);
    }
    await delay(500);

    // ---- Apply the reward (flat amount every time) ----
    data.lastDaily = now;
    data.dailyStreak = newStreak;

    const newBalance = (userData.money || 0) + dailyReward;
    await usersData.set(senderID, {
      money: newBalance,
      data
    });

    const msg =
      `🎉 ❀°• 𝑫𝒂𝒊𝒍𝒚 𝑩𝒐𝒏𝒖𝒔 •°❀ 🎉\n` +
      `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n\n` +
      `💌 𝒚𝒐𝒖𝒓 𝒈𝒊𝒇𝒕 𝒉𝒂𝒔 𝒂𝒓𝒓𝒊𝒗𝒆𝒅! 💌\n\n` +
      `${getLang("received", shortMoney(dailyReward))}\n` +
      `🔥 𝑺𝒕𝒓𝒆𝒂𝒌: ${newStreak} ${newStreak === 1 ? "day" : "days"} 𝒊𝒏 𝒂 𝒓𝒐𝒘\n` +
      `💰 𝑩𝒂𝒍𝒂𝒏𝒄𝒆: ${shortMoney(newBalance)}\n` +
      `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n` +
      `⏰ 𝒄𝒐𝒎𝒆 𝒃𝒂𝒄𝒌 𝒊𝒏 ${env.cooldownHours}𝒉 𝒇𝒐𝒓 𝒚𝒐𝒖𝒓 𝒏𝒆𝒙𝒕 𝒈𝒊𝒇𝒕~ ✨`;

    await safeEdit(msg);
  }
};
