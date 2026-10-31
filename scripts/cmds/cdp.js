const axios = require("axios");

const rocky = async () => {
  const base = await axios.get("https://raw.githubusercontent.com/messengergoatbot320-lang/cdp-api/main/baseApiUrl.json");
  return base.data.rocky;
};

module.exports = {
  config: {
    name: "cdp",
    version: "2.0",
    author: "Rocky",
    countDown: 5,
    role: 0,
    category: "love",
    guide: "{pn} — Random Couple DP\n{pn} list — Total CDP\n{pn} add boy [link] girl [link] — Add new CDP"
  },

  onStart: async function ({ message, args, event, api }) {
    const obfuscatedAuthor = String.fromCharCode(82, 111, 99, 107, 121);

    if (module.exports.config.author !== obfuscatedAuthor) {
      return api.sendMessage(
        "You are not authorized to change the author name.",
        event.threadID,
        event.messageID
      );
    }

    try {
      const baseURL = await rocky();

      // ✅ LIST
      if (args[0] === "list") {
        const res = await axios.get(`${baseURL}/api/list`);
        return message.reply(`🎀 𝐓𝐨𝐭𝐚𝐥 𝐂𝐨𝐮𝐩𝐥𝐞 𝐃𝐏: ${res.data.total}`);
      }

      // ✅ ADD
      if (args[0] === "add") {
        const fullText = args.slice(1).join(" ");
        const urls = fullText.match(/https?:\/\/[^\s\[\]<>\"]+/gi);

        if (!urls || urls.length < 2) {
          return message.reply(
            "⚠️ দুটো link দাও:\n.cdp add boy https://... girl https://..."
          );
        }

        const boyUrl = urls[0].trim();
        const girlUrl = urls[1].trim();

        await message.reply("⏳ Adding couple DP, please wait...");

        const addRes = await axios.post(`${baseURL}/api/add`, {
          boyUrl,
          girlUrl,
          secret: "rocky_secret_2025"
        });

        return message.reply(
          `✅ নতুন CDP add হয়েছে!\n\n` +
          `👦 Boy: ${addRes.data.boy}\n` +
          `👧 Girl: ${addRes.data.girl}\n` +
          `🎀 Total CDP: ${addRes.data.total}`
        );
      }

      // ✅ RANDOM CDP
      const res = await axios.get(`${baseURL}/api/cdp`);
      const { boy, girl } = res.data;

      if (!boy || !girl) {
        return message.reply("⚠️ কোনো Couple DP পাওয়া যায়নি!");
      }

      const getStream = async (url) => {
        const response = await axios({
          method: "GET",
          url,
          responseType: "stream",
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        return response.data;
      };

      const attachments = [
        await getStream(boy),
        await getStream(girl)
      ];

      return message.reply({
        body: "🎀 | 𝐇𝐞𝐫𝐞'𝐬 𝐲𝐨𝐮𝐫 𝐜𝐝𝐩 𝐛𝐚𝐛𝐲",
        attachment: attachments
      });

    } catch (error) {
      console.error("CDP Error:", error.message || error);
      return message.reply(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  }
};
