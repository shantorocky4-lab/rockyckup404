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

// Same tier system as top.js, kept in sync so ranks feel consistent everywhere.
function tierFor(balance) {
  if (balance >= 100_000_000) return "Legend";
  if (balance >= 10_000_000) return "Diamond";
  if (balance >= 1_000_000) return "Platinum";
  if (balance >= 100_000) return "Gold";
  if (balance >= 10_000) return "Silver";
  if (balance >= 1_000) return "Bronze";
  return "Rookie";
}

function tierEmoji(tier) {
  const map = {
    Legend: "👑",
    Diamond: "💎",
    Platinum: "🌟",
    Gold: "🏵️",
    Silver: "🔷",
    Bronze: "🔶",
    Rookie: "🌱"
  };
  return map[tier] || "✨";
}

const SEARCH_FRAMES = ["🔍", "💰", "✨"];

module.exports = {
  config: {
    name: "balance",
    version: "1.0",
    author: "ROCKY CHOWDHURY",
    countDown: 5,
    role: 0,
    description: {
      en: "Check your (or someone else's) coin balance"
    },
    category: "𝗪𝗔𝗟𝗟𝗘𝗧",
    guide: {
      en: "   {pn}: Check your own balance"
        + "\n   {pn} @mention (or reply to someone): Check their balance"
    }
  },

  onStart: async function ({ args, message, event, usersData, api }) {
    // ---- Work out whose balance we're checking ----
    let targetID = event.senderID;
    let targetName = null;

    if (event.type === "message_reply" && event.messageReply) {
      targetID = event.messageReply.senderID;
    } else if (Object.keys(event.mentions || {}).length > 0) {
      targetID = Object.keys(event.mentions)[0];
    }

    const isSelf = targetID === event.senderID;

    // ---- Send the first "searching" frame ----
    const sentInfo = await new Promise((resolve, reject) => {
      api.sendMessage(
        `❀°• 𝑩𝒂𝒍𝒂𝒏𝒄𝒆 𝑪𝒉𝒆𝒄𝒌 •°❀\n\n${SEARCH_FRAMES[0]}  𝒄𝒉𝒆𝒄𝒌𝒊𝒏𝒈...`,
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

    for (let i = 1; i < SEARCH_FRAMES.length; i++) {
      await delay(400);
      await safeEdit(`❀°• 𝑩𝒂𝒍𝒂𝒏𝒄𝒆 𝑪𝒉𝒆𝒄𝒌 •°❀\n\n${SEARCH_FRAMES[i]}  𝒄𝒉𝒆𝒄𝒌𝒊𝒏𝒈...`);
    }
    await delay(400);

    // ---- Fetch balance ----
    const userData = await usersData.get(targetID);
    const balance = (userData && userData.money) || 0;
    const streak = (userData && userData.data && userData.data.dailyStreak) || 0;
    const tier = tierFor(balance);
    const icon = tierEmoji(tier);

    // ---- Resolve display name ----
    let name = "you";
    if (!isSelf) {
      try {
        const info = await api.getUserInfo(targetID);
        name = (info[targetID] && info[targetID].name) || "this user";
      } catch (e) {
        name = "this user";
      }
    }

    const msg =
      `💰 ❀°• 𝑩𝒂𝒍𝒂𝒏𝒄𝒆 𝑪𝒉𝒆𝒄𝒌 •°❀ 💰\n` +
      `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n\n` +
      (isSelf
        ? `💌 𝒚𝒐𝒖𝒓 𝒃𝒂𝒍𝒂𝒏𝒄𝒆:\n`
        : `💌 ${name}'𝒔 𝒃𝒂𝒍𝒂𝒏𝒄𝒆:\n`) +
      `💲 ${shortMoney(balance)}\n\n` +
      `${icon} 𝑻𝒊𝒆𝒓: ${tier}\n` +
      (streak > 0 ? `🔥 𝑫𝒂𝒊𝒍𝒚 𝑺𝒕𝒓𝒆𝒂𝒌: ${streak} ${streak === 1 ? "day" : "days"}\n` : "") +
      `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n` +
      `✨ 𝒌𝒆𝒆𝒑 𝒆𝒂𝒓𝒏𝒊𝒏𝒈~ ✨`;

    await safeEdit(msg);
  }
};
