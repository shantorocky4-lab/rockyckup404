const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const __AUTHOR__ = "Rocky Chowdhury";

// Converts normal text to Unicode "bold" style (Messenger has no real bold formatting)
function toBold(str) {
  const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bold = Array.from(
    "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"
  ); // Array.from correctly splits by codepoint, not UTF-16 code unit
  return str
    .split("")
    .map((ch) => {
      const idx = normal.indexOf(ch);
      return idx === -1 ? ch : bold[idx];
    })
    .join("");
}

const WAIT_TEXT = toBold("Please wait, your video is downloading...");
const CAPTION_TEXT = `🎬 ${toBold("Here is your video, enjoy!")}`;

const rocky = async () => {
  const base = await axios.get("https://raw.githubusercontent.com/Alvee-Evan-telegrame-bot/rv-api/main/baseApiUrl.json");
  return base.data.rocky;
};

module.exports = {
  config: {
    name: "rv",
    version: "5.0",
    author: __AUTHOR__,
    role: 0,
    shortDescription: "Send video from API",
    category: "media",
    guide: "{pn} — Random Video\n{pn} list — Total videos\n{pn} add [imgur_link] — Add new video"
  },

  onStart: async function ({ api, event, args }) {
    try {
      if (module.exports.config.author !== __AUTHOR__) {
        return api.sendMessage("❌ Unauthorized edit!", event.threadID, event.messageID);
      }

      const baseURL = await rocky();

      // ✅ LIST
      if (args[0] === "list") {
        const res = await axios.get(`${baseURL}/api/list`);
        return api.sendMessage(
          `🎬 Total Videos: ${res.data.total}`,
          event.threadID, event.messageID
        );
      }

      // ✅ ADD
      if (args[0] === "add") {
        const fullText = args.slice(1).join(" ");
        const urls = fullText.match(/https?:\/\/[^\s\[\]<>\"]+/gi);

        if (!urls || urls.length < 1) {
          return api.sendMessage(
            "⚠️ Imgur video link দাও:\n.rv add https://i.imgur.com/xxx.mp4",
            event.threadID, event.messageID
          );
        }

        const videoUrl = urls[0].trim();
        await api.sendMessage("⏳ Adding video, please wait...", event.threadID, event.messageID);

        try {
          const addRes = await axios.post(`${baseURL}/api/add`, {
            videoUrl,
            secret: "rocky_rv_2025"
          });

          return api.sendMessage(
            `✅ নতুন Video add হয়েছে!\n🎬 URL: ${addRes.data.url}\n📊 Total: ${addRes.data.total}`,
            event.threadID, event.messageID
          );
        } catch (err) {
          return api.sendMessage(
            `❌ ${err.response?.data?.error || err.message}`,
            event.threadID, event.messageID
          );
        }
      }

      // ✅ RANDOM VIDEO
      const res = await axios.get(`${baseURL}/api/rv`);
      const { url } = res.data;

      if (!url) return api.sendMessage("⚠️ কোনো video পাওয়া যায়নি!", event.threadID, event.messageID);

      // Text sent BEFORE the video starts downloading
      let waitMsgID = null;
      await new Promise((resolve) => {
        api.sendMessage(
          WAIT_TEXT,
          event.threadID,
          (err, info) => {
            if (!err && info) waitMsgID = info.messageID;
            resolve();
          },
          event.messageID
        );
      });

      for (let i = 0; i < 3; i++) {
        try {
          const filePath = path.join(__dirname, "cache", `rv_${Date.now()}.mp4`);
          fs.ensureDirSync(path.dirname(filePath));

          const response = await axios({
            method: "GET",
            url,
            responseType: "stream",
            timeout: 30000,
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Referer": "https://imgur.com"
            }
          });

          if (!response || !response.data) throw new Error("No stream");

          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });

          const stats = fs.statSync(filePath);
          if (stats.size < 1000) {
            fs.unlinkSync(filePath);
            throw new Error("Empty video");
          }

          // Delete the "wait" text before sending the video
          if (waitMsgID) {
            try { await api.unsendMessage(waitMsgID); } catch (e) {}
          }

          // Text sent WITH the video
          const caption = CAPTION_TEXT;

          return api.sendMessage(
            {
              body: caption,
              attachment: fs.createReadStream(filePath)
            },
            event.threadID,
            () => fs.unlinkSync(filePath),
            event.messageID
          );

        } catch (err) {
          console.log(`Retry ${i + 1} failed:`, err.message);
        }
      }

      return api.sendMessage(
        "❌ Video load failed! Try again...",
        event.threadID, event.messageID
      );

    } catch (err) {
      console.error("RV Error:", err.message);
      return api.sendMessage(
        `❌ Error: ${err.response?.data?.error || err.message}`,
        event.threadID, event.messageID
      );
    }
  }
};
