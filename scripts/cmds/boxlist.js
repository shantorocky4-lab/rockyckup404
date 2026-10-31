// Small Caps Map
const SC_MAP = {
  a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",i:"ɪ",j:"ᴊ",
  k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",q:"ǫ",r:"ʀ",s:"ꜱ",t:"ᴛ",
  u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ",
  A:"ᴀ",B:"ʙ",C:"ᴄ",D:"ᴅ",E:"ᴇ",F:"ꜰ",G:"ɢ",H:"ʜ",I:"ɪ",J:"ᴊ",
  K:"ᴋ",L:"ʟ",M:"ᴍ",N:"ɴ",O:"ᴏ",P:"ᴘ",Q:"ǫ",R:"ʀ",S:"ꜱ",T:"ᴛ",
  U:"ᴜ",V:"ᴠ",W:"ᴡ",X:"x",Y:"ʏ",Z:"ᴢ"
};

function sc(text) {
  if (!text) return "";
  return text.split("").map(c => SC_MAP[c] || c).join("");
}

module.exports = {
  config: {
    name: "boxlist",
    aliases: ["boxes", "grouplist", "allbox"],
    version: "1.1.0",
    author: "DI-ABLO",
    role: 2, // শুধু বট এডমিন বা তুই চালাতে পারবি
    countDown: 10,
    shortDescription: "📦 List active groups bot is in",
    category: "system",
    guide: { en: "{pn} - show all boxes\nReply with '1 join' or '1 leave'" }
  },

  onStart: async function ({ api, event, message }) {
    try {
      // ★ Facebook API থেকে সরাসরি লাইভ গ্রুপ লিস্ট আনা ★
      api.getThreadList(100, null, ["INBOX"], async (err, list) => {
        if (err) {
          return message.reply("❌ গ্রুপ লিস্ট আনতে সমস্যা হয়েছে। API Error!");
        }

        // শুধু গ্রুপগুলো ফিল্টার করা (মেসেঞ্জার চ্যাট বাদ দিয়ে)
        const groups = list.filter(t => t.isGroup === true);

        if (groups.length === 0) {
          return message.reply("❌ বট বর্তমানে কোনো গ্রুপে নেই!");
        }

        let msg = `┍━━━━━━━━━━━━━━━●\n┋ 𓊈◎ 𝗕𝗢𝗧 𝗕𝗢𝗫 𝗟𝗜𝗦𝗧 ◎𓊉\n┕━━━━━━━━━━━━━━━●\n\n`;
        const threadIDs = []; // রিপ্লাইয়ের জন্য TID সেভ করব

        groups.forEach((group, index) => {
          const num = index + 1;
          
          // গ্রুপের নাম বের করা (কখনো threadName থাকে, কখনো name)
          const name = group.threadName || group.name || "Unknown Group";
          
          // মেম্বার সংখ্যা বের করা
          const members = group.participantIDs ? group.participantIDs.length : (group.userInfo ? group.userInfo.length : 0);
          
          const tid = group.threadID;
          threadIDs.push(tid);

          msg += `┃ ${num}. ${sc(name)}\n`;
          msg += `┃ 👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${members}\n`;
          msg += `┃ 🆔 𝗧𝗜𝗗: ${tid}\n`;
          msg += `┃━━━━━━━━━━━━━━━━━━\n`;
        });

        msg += `\n💡 𝗥𝗲𝗽𝗹𝘆 𝗘𝘅𝗮𝗺𝗽𝗹𝗲:\n`;
        msg += `'1 join' - নিজেকে অ্যাড করতে\n`;
        msg += `'1 leave' - বটকে বের করতে`;

        const info = await message.reply(msg);

        // রিপ্লাই মেমোরি সেভ
        if (global.GoatBot?.onReply) {
          global.GoatBot.onReply.set(info.messageID, {
            commandName: "boxlist",
            messageID: info.messageID,
            author: event.senderID,
            threadIDs: threadIDs
          });
        }
      });

    } catch (e) {
      console.error("BoxList Error:", e);
      return message.reply(`❌ Error: ${e.message}`);
    }
  },

  onReply: async function ({ api, event, Reply, message }) {
    try {
      // শুধু যে কমান্ড দিয়েছে সে-ই রিপ্লাই দিতে পারবে
      if (String(event.senderID) !== String(Reply.author)) return;

      const { threadIDs } = Reply;
      const text = (event.body || "").trim().toLowerCase();
      
      // ইনপুট পার্স করা (যেমন: "1 join" বা "2 leave")
      const parts = text.split(/\s+/);
      if (parts.length < 2) return message.reply("❌ ফরম্যাট ভুল! লিখ: `1 join` অথবা `1 leave`");

      const num = parseInt(parts[0]);
      const action = parts[1];

      if (isNaN(num) || num < 1 || num > threadIDs.length) {
        return message.reply("❌ ভুল নাম্বার দিছিস!");
      }

      const targetThreadID = threadIDs[num - 1];
      const botID = api.getCurrentUserID();

      // ---- LEAVE ACTION ----
      if (action === "leave") {
        try {
          await api.removeUserFromGroup(botID, targetThreadID);
          return message.reply(`✅ বটকে ${num} নাম্বার গ্রুপ থেকে বের করে দেওয়া হয়েছে!`);
        } catch (e) {
          return message.reply(`❌ বের হতে পারলাম না। হয়তো আমি ওই গ্রুপের অ্যাডমিন না।\nError: ${e.message}`);
        }
      }

      // ---- JOIN ACTION ----
      if (action === "join") {
        try {
          await api.addUserToGroup(event.senderID, targetThreadID);
          return message.reply(`✅ তোমাকে ${num} নাম্বার গ্রুপে অ্যাড করা হয়েছে!`);
        } catch (e) {
          return message.reply(`❌ তোমাকে অ্যাড করতে পারলাম না। হয়তো ওই গ্রুপের অ্যাডমিন Approve লিস্ট অন করা আছে, অথবা প্রাইভেসি সমস্যা।\nError: ${e.message}`);
        }
      }

      return message.reply("❌ ভুল কমান্ড! `join` অথবা `leave` লিখতে হবে।");

    } catch (err) {
      console.error("[BOXLIST Reply ERROR]:", err);
    }
  }
};
