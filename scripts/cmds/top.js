// Helper to convert rank/tier name to mathematical sans-serif (𝗅𝗂𝗄𝖾 𝗍𝗁𝗂𝗌 𝖿𝗈𝗇𝗍)
const toSansMath = (str) => {
  const map = {'a': '𝖺', 'b': '𝖻', 'c': '𝖼', 'd': '𝖽', 'e': '𝖾', 'f': '𝖿', 'g': '𝗀', 'h': '𝗁', 'i': '𝗂', 'j': '𝗃', 'k': '𝗄', 'l': '𝗅', 'm': '𝗆', 'n': '𝗇', 'o': '𝗈', 'p': '𝗉', 'q': '𝗊', 'r': '𝗋', 's': '𝗌', 't': '𝗍', 'u': '𝗎', 'v': '𝗏', 'w': '𝗐', 'x': '𝗑', 'y': '𝗒', 'z': '𝗓', 'A': '𝖠', 'B': '𝖡', 'C': '𝖢', 'D': '𝖣', 'E': '𝖤', 'F': '𝖥', 'G': '𝖦', 'H': '𝖧', 'I': '𝖨', 'J': '𝖩', 'K': '𝖪', 'L': '𝖫', 'M': '𝖬', 'N': '𝖭', 'O': '𝖮', 'P': '𝖯', 'Q': '𝖰', 'R': '𝖱', 'S': '𝖲', 'T': '𝖳', 'U': '𝖴', 'V': '𝖵', 'W': '𝖶', 'X': '𝖷', 'Y': '𝖸', 'Z': '𝖹'};
  return String(str).replace(/[a-zA-Z]/g, m => map[m] || m);
};

// Helper for Footer (Math Sans Bold)
const toSansBold = (str) => {
  const map = {'a':'𝗮','b':'𝗯','c':'𝗰','d':'𝗱','e':'𝗲','f':'𝗳','g':'𝗴','h':'𝗵','i':'𝗶','j':'𝗷','k':'𝗸','l':'𝗹','m':'𝗺','n':'𝗻','o':'𝗼','p':'𝗽','q':'𝗾','r':'𝗿','s':'𝘀','t':'𝘁','u':'𝘂','v':'𝘃','w':'𝘄','x':'𝘅','y':'𝘆','z':'𝘇', 'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝','K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧','U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭', '0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'};
  return String(str).replace(/[a-zA-Z0-9]/g, m => map[m] || m);
};

// Helper to convert numbers to bold serif for the ranks
const toBoldNum = (num) => {
  const map = {'0':'𝟎','1':'𝟏','2':'𝟐','3':'𝟑','4':'𝟒','5':'𝟓','6':'𝟔','7':'𝟕','8':'𝟖','9':'𝟗'};
  return String(num).replace(/[0-9]/g, m => map[m] || m);
};

const getMedal = (rank) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `[${toBoldNum(rank)}]`;
};

// Money short-suffix formatting (same style used across the games)
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

// Local rank tiers based on total balance — replaces the old external API's
// "rank_name" field, no network call needed.
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PAGE_SIZE = 10;

module.exports.config = {
  name: "top",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "ROCKY CHOWDHURY",
  description: "View leaderboard",
  commandCategory: "economy",
  usages: "[page]",
  cooldowns: 10
};

// GoatBot requires "onStart" as the entry function.
// usersData is provided directly by GoatBot's core.
module.exports.onStart = async function ({ api, event, args, usersData }) {
  try {
    const page = Math.max(1, parseInt(args[0]) || 1);

    // ---- Send a cute "loading" frame first ----
    const sentInfo = await new Promise((resolve, reject) => {
      api.sendMessage(
        `👑 ❀°• 𝑷𝑹𝑬𝑴𝑰𝑼𝑴 𝑳𝑬𝑨𝑫𝑬𝑹𝑩𝑶𝑨𝑹𝑫 •°❀ 👑\n✨💫 𝒇𝒆𝒕𝒄𝒉𝒊𝒏𝒈 𝒓𝒂𝒏𝒌𝒊𝒏𝒈𝒔... 💫✨`,
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
          await delay(350);
        }
      }
      return false;
    }

    await delay(500);

    // ---- Pull every user's balance from GoatBot's local database ----
    const allUsers = await usersData.getAll();

    const ranked = allUsers
      .map((u) => ({
        userID: u.userID,
        money: u.data && typeof u.data.money === "number" ? u.data.money : (u.money || 0)
      }))
      .filter((u) => u.money > 0)
      .sort((a, b) => b.money - a.money);

    if (ranked.length === 0) {
      return safeEdit(
        `👑 ❀°• 𝑷𝑹𝑬𝑴𝑰𝑼𝑴 𝑳𝑬𝑨𝑫𝑬𝑹𝑩𝑶𝑨𝑹𝑫 •°❀ 👑\n💔 𝒏𝒐 𝒐𝒏𝒆 𝒉𝒂𝒔 𝒂𝒏𝒚 𝒃𝒂𝒍𝒂𝒏𝒄𝒆 𝒚𝒆𝒕~`
      );
    }

    const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const slice = ranked.slice(start, start + PAGE_SIZE);

    // ---- Resolve display names for just this page ----
    const idList = slice.map((u) => u.userID);
    let namesMap = {};
    try {
      namesMap = await api.getUserInfo(idList);
    } catch (e) {
      namesMap = {};
    }

    // ---- Build the leaderboard message ----
    let msg = `👑 ❀°• 𝑷𝑹𝑬𝑴𝑰𝑼𝑴 𝑳𝑬𝑨𝑫𝑬𝑹𝑩𝑶𝑨𝑹𝑫 •°❀ 👑\n`;
    msg += `🏆 ✨ 𝑻𝒐𝒑 𝑬𝒂𝒓𝒏𝒆𝒓𝒔 ✨ 🏆\n`;
    msg += `♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n\n`;

    slice.forEach((u, i) => {
      const rank = start + i + 1;
      const medal = getMedal(rank);
      const name = (namesMap[u.userID] && namesMap[u.userID].name) || "Unknown";
      const tier = tierFor(u.money);
      const tierIcon = tierEmoji(tier);
      const tierName = toSansMath(tier);

      msg += `${medal} 𝟇 ${name} 𝟇\n`;
      msg += ` ↳ 💰 ${shortMoney(u.money)}  ${tierIcon} ❨${tierName}❩\n`;
      msg += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    });

    const footerPage = toSansBold(`Page ${safePage}/${totalPages}`);
    msg += `\n♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n`;
    msg += `📄 ${footerPage}  💌  ✨ 𝒌𝒆𝒆𝒑 𝒈𝒓𝒊𝒏𝒅𝒊𝒏𝒈~ ✨ 💞`;

    await safeEdit(msg.trim());

  } catch (error) {
    console.log(error);
    return api.sendMessage(
      "❌ | 𝑬𝒓𝒓𝒐𝒓: " + (error && error.message ? error.message : String(error)),
      event.threadID,
      event.messageID
    );
  }
};
