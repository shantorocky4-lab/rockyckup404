module.exports = {
  config: {
    name: "draft",
    aliases: ["gs", "upload"],
    version: "2.0",
    author: "Rocky Chowdhury",
    countDown: 5,
    role: 0,
    shortDescription: "Command কে GoatStore link এ convert করো",
    longDescription: "Command name দিলে সেই .js file upload করে link দেবে। File না থাকলে reply করে দাও।",
    category: "utility",
    guide: {
      en: "{pn} <cmdname>\n{pn} (reply a .js file attachment)"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const fs = require("fs");
    const path = require("path");
    const GOATSTORE_URL = "https://goatstore-phi.vercel.app";

    let codeContent = "";
    let fileName = "";

    // ─── Case 1: .js file attachment reply ───────────────────
    if (
      event.type === "message_reply" &&
      event.messageReply.attachments &&
      event.messageReply.attachments.length > 0 &&
      event.messageReply.attachments[0].type === "file"
    ) {
      const fileUrl = event.messageReply.attachments[0].url;
      fileName = event.messageReply.attachments[0].name || "draft.js";
      try {
        const res = await fetch(fileUrl);
        codeContent = await res.text();
      } catch (e) {
        return message.reply("❌ File download করতে পারিনি:\n" + e.message);
      }
    }

    // ─── Case 2: Command name দিয়েছে ─────────────────────────
    else if (args.length > 0) {
      const cmdName = args[0].toLowerCase().replace(/\.js$/, "");
      fileName = cmdName + ".js";

      // GoatBot command folder paths (common structures)
      const possiblePaths = [
        path.join(__dirname, `${cmdName}.js`),
        path.join(process.cwd(), "modules", "commands", `${cmdName}.js`),
        path.join(process.cwd(), "scripts", "cmds", `${cmdName}.js`),
        path.join(process.cwd(), "commands", `${cmdName}.js`),
      ];

      let foundPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }

      if (foundPath) {
        try {
          codeContent = fs.readFileSync(foundPath, "utf8");
        } catch (e) {
          return message.reply("❌ File পড়তে পারিনি:\n" + e.message);
        }
      } else {
        // File পাওয়া যায়নি — reply করতে বলো
        return message.reply(
          `❌ \`${cmdName}.js\` file খুঁজে পাইনি।\n\n` +
          `📎 ${cmdName}.js file টা এই message এ reply করে পাঠাও, তাহলে upload করে দেব।`
        );
      }
    }

    // ─── Case 3: কিছুই দেয়নি ─────────────────────────────────
    else {
      return message.reply(
        "📋 ব্যবহারের নিয়ম:\n\n" +
        "• `.draft info` → info.js upload করবে\n" +
        "• `.draft` (reply করে .js file) → সেই file upload করবে"
      );
    }

    // ─── Upload to GoatStore ──────────────────────────────────
    const waitMsg = await message.reply("⏳ GoatStore এ upload হচ্ছে...");

    try {
      const response = await fetch(`${GOATSTORE_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: codeContent, filename: fileName })
      });

      if (!response.ok) {
        const errText = await response.text();
        return api.editMessage(
          `❌ Upload failed (${response.status}):\n${errText}`,
          waitMsg.messageID
        );
      }

      const data = await response.json();

      if (!data.url) {
        return api.editMessage(
          "❌ Server থেকে URL পাওয়া যায়নি।",
          waitMsg.messageID
        );
      }

      const lines = codeContent.split("\n").length;
      const kb = (Buffer.byteLength(codeContent, "utf8") / 1024).toFixed(2);

      return api.editMessage(
        `✅ Upload সফল!\n\n` +
        `📁 File: ${fileName}\n` +
        `🔗 Link:\n${data.url}\n\n` +
        `📄 Lines: ${lines}\n` +
        `📦 Size: ${kb} KB\n` +
        `⏱️ Expires: ২৪ ঘণ্টা পর`,
        waitMsg.messageID
      );

    } catch (err) {
      return api.editMessage(
        `❌ Error:\n${err.message}`,
        waitMsg.messageID
      );
    }
  }
};
