const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MIN_TRANSFER = 1_000_000; // 1M minimum

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

// Understands: 1000000, 1m, 1.5m, 2b, 500k, 1t, 1qa, 1qi
function parseAmount(str) {
  if (!str) return NaN;
  const match = String(str).toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)(k|m|b|t|qa|qi)?$/);
  if (!match) return NaN;
  const mult = { "": 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qi: 1e18 };
  const value = Math.floor(parseFloat(match[1]) * mult[match[2] || ""]);
  return Number.isFinite(value) ? value : NaN;
}

const FRAMES = ["💸", "🔄", "💰", "✨"];
const HEADER = "❀°• 𝑻𝒓𝒂𝒏𝒔𝒇𝒆𝒓 •°❀";
const LINE = "♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡";

module.exports = {
  config: {
    name: "transfer",
    aliases: ["pay", "send"],
    version: "1.0",
    author: "ROCKY CHOWDHURY",
    countDown: 5,
    role: 0,
    description: {
      en: "Transfer coins from your balance to someone else (min 1M)"
    },
    category: "𝗪𝗔𝗟𝗟𝗘𝗧",
    guide: {
      en: "   {pn} @mention <amount>: Send coins to a mentioned user"
        + "\n   {pn} <amount> (reply to someone): Send coins to the replied user"
        + "\n   {pn} <uid> <amount>: Send coins using a UID"
        + "\n\n   Minimum: 1M | Example: {pn} @user 5m"
    }
  },

  onStart: async function ({ args, message, event, usersData, api }) {
    const senderID = event.senderID;

    // ---- Work out the target ----
    let targetID = null;
    let uidArg = null;

    if (event.type === "message_reply" && event.messageReply) {
      targetID = event.messageReply.senderID;
    } else if (Object.keys(event.mentions || {}).length > 0) {
      targetID = Object.keys(event.mentions)[0];
    } else {
      uidArg = args.find((a) => /^\d{10,}$/.test(a));
      if (uidArg) targetID = uidArg;
    }

    if (!targetID) {
      return message.reply(
        `${HEADER}\n${LINE}\n\n` +
        `⚠️ 𝒌𝒂𝒂𝒌𝒆 𝒑𝒂𝒕𝒉𝒂𝒃𝒆 𝒕𝒂 𝒃𝒐𝒍𝒐!\n\n` +
        `📌 @mention • reply • UID\n` +
        `💡 𝒆𝒙𝒂𝒎𝒑𝒍𝒆: transfer @user 5m\n\n` +
        `${LINE}`
      );
    }

    // ---- Work out the amount (last argument that isn't the UID) ----
    const amountArgs = args.filter((a) => a !== uidArg);
    const amount = parseAmount(amountArgs[amountArgs.length - 1]);

    if (targetID === senderID) {
      return message.reply(
        `${HEADER}\n${LINE}\n\n` +
        `🚫 𝒏𝒊𝒋𝒆𝒓 𝒌𝒂𝒎𝒆 𝒏𝒊𝒋𝒆 𝒑𝒂𝒕𝒉𝒂𝒃𝒂 𝒑𝒂𝒓𝒃𝒆 𝒏𝒂!\n\n${LINE}`
      );
    }

    if (isNaN(amount) || amount <= 0) {
      return message.reply(
        `${HEADER}\n${LINE}\n\n` +
        `⚠️ 𝒔𝒐𝒉𝒐𝒊 𝒂𝒎𝒐𝒖𝒏𝒕 𝒍𝒆𝒌𝒉𝒐!\n\n` +
        `💡 𝒆𝒙𝒂𝒎𝒑𝒍𝒆: 1m, 2.5m, 10m, 1b\n\n${LINE}`
      );
    }

    if (amount < MIN_TRANSFER) {
      return message.reply(
        `${HEADER}\n${LINE}\n\n` +
        `❌ 𝒎𝒊𝒏𝒊𝒎𝒖𝒎 𝒕𝒓𝒂𝒏𝒔𝒇𝒆𝒓: ${shortMoney(MIN_TRANSFER)}\n` +
        `💲 𝒕𝒖𝒎𝒊 𝒅𝒊𝒕𝒆 𝒄𝒉𝒆𝒆𝒔𝒉𝒐: ${shortMoney(amount)}\n\n${LINE}`
      );
    }

    // ---- Check sender balance ----
    const senderData = await usersData.get(senderID);
    const senderBalance = (senderData && senderData.money) || 0;

    if (senderBalance < amount) {
      return message.reply(
        `${HEADER}\n${LINE}\n\n` +
        `😢 𝒕𝒐𝒎𝒂𝒓 𝒃𝒂𝒍𝒂𝒏𝒄𝒆 𝒌𝒐𝒎!\n\n` +
        `💰 𝒕𝒐𝒎𝒂𝒓 𝒃𝒂𝒍𝒂𝒏𝒄𝒆: ${shortMoney(senderBalance)}\n` +
        `💸 𝒅𝒊𝒕𝒆 𝒄𝒉𝒂𝒐: ${shortMoney(amount)}\n\n${LINE}`
      );
    }

    // ---- Send the first animation frame ----
    const sentInfo = await new Promise((resolve, reject) => {
      api.sendMessage(
        `${HEADER}\n\n${FRAMES[0]}  𝒕𝒓𝒂𝒏𝒔𝒇𝒆𝒓𝒓𝒊𝒏𝒈...`,
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

    for (let i = 1; i < FRAMES.length; i++) {
      await delay(400);
      await safeEdit(`${HEADER}\n\n${FRAMES[i]}  𝒕𝒓𝒂𝒏𝒔𝒇𝒆𝒓𝒓𝒊𝒏𝒈...`);
    }
    await delay(400);

    // ---- Re-fetch fresh balances and do the transfer ----
    const freshSender = await usersData.get(senderID);
    const freshBalance = (freshSender && freshSender.money) || 0;

    if (freshBalance < amount) {
      return safeEdit(
        `${HEADER}\n${LINE}\n\n😢 𝒕𝒓𝒂𝒏𝒔𝒇𝒆𝒓 𝒇𝒂𝒊𝒍𝒆𝒅, 𝒃𝒂𝒍𝒂𝒏𝒄𝒆 𝒌𝒐𝒎!\n\n${LINE}`
      );
    }

    const receiverData = await usersData.get(targetID);
    const receiverBalance = (receiverData && receiverData.money) || 0;

    const newSenderBalance = freshBalance - amount;
    const newReceiverBalance = receiverBalance + amount;

    try {
      await usersData.set(senderID, { money: newSenderBalance });
      await usersData.set(targetID, { money: newReceiverBalance });
    } catch (e) {
      console.log("transfer failed:", e);
      // try to give the money back to the sender
      try {
        await usersData.set(senderID, { money: freshBalance });
      } catch (_) {}
      return safeEdit(
        `${HEADER}\n${LINE}\n\n❌ 𝒌𝒊𝒄𝒉𝒖 𝒗𝒖𝒍 𝒉𝒐𝒚𝒆𝒄𝒉𝒆, 𝒂𝒃𝒂𝒓 𝒄𝒉𝒆𝒔𝒕𝒂 𝒌𝒐𝒓𝒐!\n\n${LINE}`
      );
    }

    // ---- Resolve names ----
    let senderName = "you";
    let receiverName = "this user";
    try {
      const info = await api.getUserInfo([senderID, targetID]);
      senderName = (info[senderID] && info[senderID].name) || "you";
      receiverName = (info[targetID] && info[targetID].name) || "this user";
    } catch (e) {}

    const msg =
      `💸 ❀°• 𝑻𝒓𝒂𝒏𝒔𝒇𝒆𝒓 𝑺𝒖𝒄𝒄𝒆𝒔𝒔 •°❀ 💸\n` +
      `${LINE}\n\n` +
      `📤 𝑭𝒓𝒐𝒎: ${senderName}\n` +
      `📥 𝑻𝒐: ${receiverName}\n\n` +
      `💲 𝑨𝒎𝒐𝒖𝒏𝒕: ${shortMoney(amount)}\n\n` +
      `💰 𝒀𝒐𝒖𝒓 𝒏𝒆𝒘 𝒃𝒂𝒍𝒂𝒏𝒄𝒆: ${shortMoney(newSenderBalance)}\n` +
      `${LINE}\n` +
      `✨ 𝒕𝒉𝒂𝒏𝒌 𝒚𝒐𝒖 𝒇𝒐𝒓 𝒔𝒉𝒂𝒓𝒊𝒏𝒈~ ✨`;

    await safeEdit(msg);
  }
};
