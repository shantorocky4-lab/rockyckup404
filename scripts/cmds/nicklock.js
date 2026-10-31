// GoatBot V2 - Nickname Lock Command
// Path: scripts/cmds/nicklock.js
// Credit: Rocky  (author change korle command kaj korbe na)

const crypto = require("crypto");
const fs = require("fs");

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ================== AUTHOR PROTECTION ==================
const _sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const _KEY = "e7f5d4066c9f8195959866aa6915027679384f97ed822a03b8b1b3ce4ecfae5b";

// Author ta thik ache ki na 2 vabe check kore:
//  1) runtime config theke  2) file er source code theke
function authorOK() {
	try {
		if (_sha(module.exports.config.author) !== _KEY) return false;
		const src = fs.readFileSync(__filename, "utf8");
		const m = src.match(/author:\s*["'`]([^"'`]*)["'`]/);
		if (!m || _sha(m[1]) !== _KEY) return false;
		return true;
	}
	catch (e) {
		return false;
	}
}

const LOCKED_MSG =
	"╭───〔 ⛔ ACCESS DENIED 〕───╮"
	+ "\n│ Author change kora hoyeche."
	+ "\n│ Command ta kaj korbe na."
	+ "\n│ Original author: Rocky"
	+ "\n╰──────────────────────╯";

// ================== HELPER ==================
// Retry soho nickname set kora
async function forceNickname(api, nickname, threadID, uid, tries = 3) {
	for (let i = 1; i <= tries; i++) {
		try {
			await api.changeNickname(nickname, threadID, uid);
			return true;
		}
		catch (e) {
			if (i === tries) {
				console.error(`[nicklock] failed (${uid}):`, e && (e.error || e.message || e));
				return false;
			}
			await sleep(800 * i);
		}
	}
	return false;
}

module.exports = {
	config: {
		name: "nicklock",
		aliases: ["nl", "locknick"],
		version: "2.1",
		author: "Rocky",
		countDown: 3,
		role: 1, // 1 = group admin (command use korar permission)
		description: {
			en: "Set a nickname & lock it. Nobody (even admins) can change it, only the bot"
		},
		category: "box chat",
		guide: {
			en: "   {pn} set <uid | @mention | reply> <nickname>: nickname set & lock"
				+ "\n   {pn} off <uid | @mention | reply>: lock remove"
				+ "\n   {pn} list: locked nickname list"
				+ "\n   {pn} clear: shob lock remove"
		}
	},

	// ================== COMMAND ==================
	onStart: async function ({ api, event, args, message, threadsData, usersData }) {
		if (!authorOK()) return message.reply(LOCKED_MSG);

		const { threadID, messageReply, mentions } = event;
		const sub = (args[0] || "").toLowerCase();
		const locks = await threadsData.get(threadID, "data.nicklock", {});

		// Target user + nickname ber kora
		const getTarget = () => {
			let uid;
			let rest = args.slice(1).join(" ");

			if (messageReply) {
				uid = messageReply.senderID;
			}
			else if (Object.keys(mentions || {}).length) {
				uid = Object.keys(mentions)[0];
				for (const name of Object.values(mentions))
					rest = rest.replace(name, "");
			}
			else {
				const first = rest.split(/\s+/)[0] || "";
				if (/^\d{5,}$/.test(first)) {
					uid = first;
					rest = rest.slice(first.length);
				}
			}
			return { uid, nickname: rest.trim() };
		};

		// ---------- SET ----------
		if (sub === "set") {
			const { uid, nickname } = getTarget();
			if (!uid)
				return message.reply("⚠️ UID dao, kauke mention koro ba reply koro.");
			if (!nickname)
				return message.reply("⚠️ Nickname likho.\nExample: nicklock set 1000123456789 King 👑");

			const ok = await forceNickname(api, nickname, threadID, uid);
			if (!ok)
				return message.reply("❌ Nickname set hoyni. Bot ta ei group e ache ki na ar UID thik ki na check koro.");

			locks[uid] = nickname;
			await threadsData.set(threadID, locks, "data.nicklock");
			const name = await usersData.getName(uid);

			return message.reply(
				"╭───〔 🔒 NICKNAME LOCKED 〕───╮"
				+ `\n│ 👤 User : ${name}`
				+ `\n│ 🆔 UID  : ${uid}`
				+ `\n│ 🏷️ Nick : ${nickname}`
				+ "\n╰──────────────────────╯"
				+ "\n✅ Ekhon keu (admin soho) ei nickname change korte parbe na."
			);
		}

		// ---------- OFF ----------
		if (sub === "off" || sub === "remove") {
			const { uid } = getTarget();
			if (!uid)
				return message.reply("⚠️ UID dao, kauke mention koro ba reply koro.");
			if (!locks[uid])
				return message.reply("⚠️ Ei user er nickname lock kora nai.");

			delete locks[uid];
			await threadsData.set(threadID, locks, "data.nicklock");
			const name = await usersData.getName(uid);
			return message.reply(`🔓 ${name} (${uid}) er nickname unlock hoyeche.`);
		}

		// ---------- LIST ----------
		if (sub === "list") {
			const entries = Object.entries(locks);
			if (!entries.length)
				return message.reply("📭 Ei group e kono nickname lock kora nai.");

			let msg = "╭───〔 📋 LOCKED NICKNAMES 〕───╮\n";
			let i = 1;
			for (const [uid, nick] of entries) {
				const name = await usersData.getName(uid);
				msg += `\n${i++}. 👤 ${name}\n    🆔 ${uid}\n    🏷️ ${nick}\n`;
			}
			msg += "\n╰───────────────────────╯";
			return message.reply(msg);
		}

		// ---------- CLEAR ----------
		if (sub === "clear") {
			await threadsData.set(threadID, {}, "data.nicklock");
			return message.reply("🧹 Shob nickname lock remove kora hoyeche.");
		}

		return message.SyntaxError();
	},

	// ================== EVENTS ==================
	onEvent: async function ({ api, event, threadsData }) {
		if (!authorOK()) return;

		const { threadID, logMessageType, logMessageData, author } = event;

		// 1) Keu nickname change korle (admin, member, jei hok) abar ferot
		if (logMessageType === "log:user-nickname") {
			// bot nijer change ignore koro (loop bondho)
			if (author == api.getCurrentUserID()) return;

			const uid = logMessageData.participant_id;
			const newNick = logMessageData.nickname;

			const locks = await threadsData.get(threadID, "data.nicklock", {});
			const locked = locks[uid];
			if (!locked || newNick === locked) return;

			await sleep(500);
			await forceNickname(api, locked, threadID, uid);
			return;
		}

		// 2) Locked member group e abar add hole nickname abar set
		if (logMessageType === "log:subscribe") {
			const locks = await threadsData.get(threadID, "data.nicklock", {});
			const added = logMessageData.addedParticipants || [];
			for (const p of added) {
				const uid = String(p.userFbId);
				if (locks[uid]) {
					await sleep(1500);
					await forceNickname(api, locks[uid], threadID, uid);
				}
			}
		}
	}
};

// config ta freeze kora (runtime e change hobe na)
Object.freeze(module.exports.config);
