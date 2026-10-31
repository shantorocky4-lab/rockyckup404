const { createCanvas } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

// If gifencoder is installed the bot sends animated GIFs, otherwise HD photos (PNG)
// install: npm i gifencoder
let GIFEncoder = null;
try { GIFEncoder = require("gifencoder"); } catch (e) { GIFEncoder = null; }

// ============================ SETTINGS (edit freely) ============================
const WINS_NEEDED = 2;            // first to this many round wins takes the match (best of 3)
const MIN_BET = 100;              // smallest bet
const MAX_BET = 10000000;         // biggest bet (10M)
const FLAWLESS_RATE = 0.5;        // extra bonus (50% of bet) for a 2-0 win
const FREE_WIN_REWARD = 5000;     // coins for winning a free-play match (0 = disabled)
const STREAK_EVERY = 3;           // win this many matches in a row = JACKPOT
const STREAK_JACKPOT = 1000000;   // jackpot coins (1M)
const EXPIRE_MS = 120000;         // no reply for this long = match cancelled + bet refunded
const COUNTDOWN_DELAY = 650;      // delay between "Rock... Paper... Scissors... SHOOT!" edits (ms)
const ANIMATION = true;           // false = HD photo only (no GIF)
const GIF_SCALE = 0.75;           // GIF size (bigger = slower)
const GIF_QUALITY = 15;           // lower number = better quality (but slower)
const PNG_SCALE = 2;              // HD photo quality (2 = 1440x2000)
const COUNT_STEPS = 10;           // how many times the reward message is edited
const COUNT_DELAY = 800;          // delay between reward edits (ms)
// ================================================================================

// ===================== AUTHOR PROTECTION (command stops working if the author is changed) =====================
const _sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const _A1 = "d8ede70b56bfd05498652fe5b39e008a2b8811f0c32a2b0cea9cb080f4b76ca5";
const _A2 = "b069e5ac34800ce56059b5e58a20b16e5eb03f47e4dc9804ea0b60e6447a6d70";
function _authorName() {
	try { return String(module.exports.config.author); } catch (e) { return ""; }
}
function _authOK() {
	try {
		const a = _authorName();
		return _sha(a) === _A1 && _sha(a.split("").reverse().join("")) === _A2;
	} catch (e) {
		return false;
	}
}
function _guard() {
	if (!_authOK()) throw new Error("AUTHOR_TAMPERED");
}
const TAMPER_MSG = "⚠️ The author name of this command was changed!\nRestore the original author or the command will not work.";
// =============================================================================================================

const W = 720, H = 1000;
const NAMES = ["ROCK", "PAPER", "SCISSORS"];
const LABELS = ["Rock", "Paper", "Scissors"];
const EMOJI = ["✊", "✋", "✌️"];
const CONFETTI = ["#ffe259", "#ff6b81", "#43e97b", "#4fc3f7", "#d17cff", "#ffffff", "#ffa502"];

const games = new Map(); // userID -> active game

// ============================== HELPERS ==============================
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => Number(n).toLocaleString("en-US");
const rand3 = () => (crypto.randomInt ? crypto.randomInt(3) : Math.floor(Math.random() * 3));

function shortMoney(n) {
	const suf = ["", "K", "M", "B", "T", "QA", "QI"];
	let num = Number(n) || 0;
	let i = 0;
	while (Math.abs(num) >= 1000 && i < suf.length - 1) { num /= 1000; i++; }
	return `${Number(num.toFixed(2))}${suf[i]}`;
}
function tierFor(b) {
	if (b >= 100000000) return "Legend";
	if (b >= 10000000) return "Diamond";
	if (b >= 1000000) return "Platinum";
	if (b >= 100000) return "Gold";
	if (b >= 10000) return "Silver";
	if (b >= 1000) return "Bronze";
	return "Rookie";
}
function tierEmoji(t) {
	return ({ Legend: "👑", Diamond: "💎", Platinum: "🌟", Gold: "🏵️", Silver: "🔷", Bronze: "🔶", Rookie: "🌱" })[t] || "✨";
}

// "10k" -> 10000, "2.5m" -> 2500000
function parseAmount(str) {
	const m = String(str || "").toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)([kmb]?)$/);
	if (!m) return null;
	const mult = { "": 1, k: 1e3, m: 1e6, b: 1e9 }[m[2]];
	return Math.floor(parseFloat(m[1]) * mult);
}

function parseChoice(text) {
	const s = String(text || "").trim().toLowerCase();
	if (["rock", "r", "1", "✊", "stone"].includes(s)) return 0;
	if (["paper", "p", "2", "✋", "🖐", "🖐️"].includes(s)) return 1;
	if (["scissors", "scissor", "s", "3", "✌️", "✌"].includes(s)) return 2;
	return null;
}

// 0 = rock, 1 = paper, 2 = scissors
function outcome(you, bot) {
	if (you === bot) return "draw";
	return (you - bot + 3) % 3 === 1 ? "win" : "lose";
}

// ============================== MONEY / STATS ==============================
async function readMoney(usersData, uid) {
	const ud = await usersData.get(uid);
	return Number(ud && ud.money) || 0;
}

// add (or subtract) coins and verify by reading the database again
async function changeMoney(usersData, uid, delta) {
	_guard();
	const before = await readMoney(usersData, uid);
	const target = before + delta;
	await usersData.set(uid, { money: target });
	let after = await readMoney(usersData, uid);
	if (after !== target) {
		try { await usersData.set(uid, target, "money"); } catch (e) { /* ignore */ }
		after = await readMoney(usersData, uid);
	}
	return { before, after, ok: after === target };
}

async function getStats(usersData, uid) {
	const ud = await usersData.get(uid);
	const s = (ud && ud.data && ud.data.rps) || {};
	return { w: s.w || 0, l: s.l || 0, streak: s.streak || 0, best: s.best || 0 };
}

async function saveStats(usersData, uid, stats) {
	const ud = await usersData.get(uid);
	const data = (ud && ud.data) || {};
	data.rps = stats;
	await usersData.set(uid, { data });
}

// ============================== DRAWING ==============================
function mulberry32(a) {
	return function () {
		a |= 0; a = a + 0x6D2B79F5 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}

function rr(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function spark(ctx, x, y, r) {
	ctx.beginPath();
	ctx.moveTo(x, y - r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.quadraticCurveTo(x, y, x, y + r);
	ctx.quadraticCurveTo(x, y, x - r, y);
	ctx.quadraticCurveTo(x, y, x, y - r);
	ctx.closePath();
}

function txt(ctx, s, x, y, size, fill, stroke, align) {
	ctx.textAlign = align || "center";
	ctx.font = `bold ${size}px Arial, sans-serif`;
	if (stroke) {
		ctx.lineWidth = size * 0.14;
		ctx.lineJoin = "round";
		ctx.strokeStyle = stroke;
		ctx.strokeText(s, x, y);
	}
	ctx.fillStyle = fill;
	ctx.fillText(s, x, y);
}

function easeOutBack(t) {
	const c1 = 1.70158, c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ---------- icon helpers (unit space: icon radius ~ 1) ----------
function circ(ctx, x, y, r, fill) {
	ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fillStyle = fill; ctx.fill();
}
function eye(ctx, x, y, s) {
	circ(ctx, x, y, s, "#2a2230");
	circ(ctx, x - s * 0.3, y - s * 0.35, s * 0.38, "#ffffff");
	circ(ctx, x + s * 0.35, y + s * 0.3, s * 0.18, "#ffffff");
}
function blush(ctx, x, y) {
	ctx.beginPath(); ctx.ellipse(x, y, 0.16, 0.09, 0, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(255,105,140,0.5)"; ctx.fill();
}
function smile(ctx, y, w) {
	ctx.strokeStyle = "#5a3a2a";
	ctx.lineWidth = 0.05;
	ctx.beginPath();
	ctx.arc(0, y, w, 0.12 * Math.PI, 0.88 * Math.PI);
	ctx.stroke();
}
function line(ctx, x1, y1, x2, y2, w, col) {
	ctx.strokeStyle = col;
	ctx.lineWidth = w;
	ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

// type: 0 rock, 1 paper, 2 scissors
function drawIcon(ctx, type, cx, cy, u, rot) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(rot || 0);
	ctx.scale(u, u);
	ctx.lineCap = "round";
	ctx.lineJoin = "round";

	// ground shadow
	ctx.fillStyle = "rgba(0,0,0,0.28)";
	ctx.beginPath(); ctx.ellipse(0, 0.98, 0.7, 0.12, 0, 0, Math.PI * 2); ctx.fill();

	if (type === 0) {
		// ---------- ROCK ----------
		const pts = [[-0.9, 0.2], [-0.75, -0.45], [-0.15, -0.85], [0.5, -0.72], [0.92, -0.1], [0.75, 0.55], [0.15, 0.82], [-0.55, 0.72]];
		const n = pts.length;
		ctx.beginPath();
		ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
		for (let i = 0; i < n; i++) {
			const p0 = pts[i], p1 = pts[(i + 1) % n];
			ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
		}
		ctx.closePath();
		const g = ctx.createRadialGradient(-0.3, -0.4, 0.1, 0, 0, 1.15);
		g.addColorStop(0, "#eef0f5");
		g.addColorStop(0.55, "#a3aab8");
		g.addColorStop(1, "#5d6475");
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 0.06;
		ctx.strokeStyle = "rgba(40,45,60,0.65)";
		ctx.stroke();
		ctx.fillStyle = "rgba(255,255,255,0.45)";
		ctx.beginPath(); ctx.ellipse(-0.38, -0.46, 0.3, 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = "rgba(60,65,80,0.5)";
		ctx.lineWidth = 0.04;
		ctx.beginPath(); ctx.moveTo(0.42, -0.55); ctx.lineTo(0.27, -0.3); ctx.lineTo(0.4, -0.14); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(-0.6, 0.5); ctx.lineTo(-0.45, 0.38); ctx.stroke();
		eye(ctx, -0.3, 0.02, 0.1);
		eye(ctx, 0.3, 0.02, 0.1);
		smile(ctx, 0.14, 0.14);
		blush(ctx, -0.5, 0.24);
		blush(ctx, 0.5, 0.24);
	} else if (type === 1) {
		// ---------- PAPER ----------
		ctx.rotate(-0.06);
		ctx.beginPath();
		ctx.moveTo(-0.68, -0.88); ctx.lineTo(0.34, -0.88); ctx.lineTo(0.68, -0.54);
		ctx.lineTo(0.68, 0.88); ctx.lineTo(-0.68, 0.88);
		ctx.closePath();
		const g = ctx.createLinearGradient(-0.6, -0.9, 0.6, 0.9);
		g.addColorStop(0, "#ffffff");
		g.addColorStop(1, "#d9e3ff");
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 0.06;
		ctx.strokeStyle = "#9fb0de";
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0.34, -0.88); ctx.lineTo(0.34, -0.54); ctx.lineTo(0.68, -0.54);
		ctx.closePath();
		ctx.fillStyle = "#c3d1f6";
		ctx.fill();
		ctx.stroke();
		for (const y of [0.5, 0.64, 0.78]) line(ctx, -0.44, y, y === 0.78 ? 0.1 : 0.44, y, 0.05, "#b4c2ea");
		eye(ctx, -0.28, -0.12, 0.1);
		eye(ctx, 0.28, -0.12, 0.1);
		smile(ctx, 0.02, 0.14);
		blush(ctx, -0.46, 0.1);
		blush(ctx, 0.46, 0.1);
	} else {
		// ---------- SCISSORS ----------
		for (const s of [-1, 1]) {
			line(ctx, 0, 0.05, s * -0.4, 0.62, 0.26, "#a32a2a");
		}
		for (const s of [-1, 1]) {
			line(ctx, 0, 0.05, s * -0.4, 0.62, 0.15, "#ff5e57");
			ctx.beginPath(); ctx.arc(s * -0.46, 0.8, 0.25, 0, Math.PI * 2);
			ctx.lineWidth = 0.2; ctx.strokeStyle = "#a32a2a"; ctx.stroke();
			ctx.beginPath(); ctx.arc(s * -0.46, 0.8, 0.25, 0, Math.PI * 2);
			ctx.lineWidth = 0.11; ctx.strokeStyle = "#ff5e57"; ctx.stroke();
		}
		for (const s of [-1, 1]) {
			line(ctx, 0, 0.05, s * -0.38, -0.98, 0.26, "#6f7d99");
			line(ctx, 0, 0.05, s * -0.38, -0.98, 0.16, "#e9eef7");
			line(ctx, s * -0.02, -0.05, s * -0.33, -0.85, 0.04, "rgba(255,255,255,0.95)");
		}
		circ(ctx, 0, 0.05, 0.12, "#ffd43b");
		circ(ctx, 0, 0.05, 0.06, "#b8860b");
		ctx.fillStyle = "#fff";
		spark(ctx, 0.5, -0.7, 0.16);
		ctx.fill();
	}
	ctx.restore();
}

function drawTrophy(ctx, cx, cy, s) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.scale(s, s);
	ctx.shadowColor = "rgba(255,200,0,0.8)";
	ctx.shadowBlur = 30;
	const gold = ctx.createLinearGradient(-60, -80, 60, 80);
	gold.addColorStop(0, "#fff6a8");
	gold.addColorStop(0.5, "#ffc400");
	gold.addColorStop(1, "#b8860b");
	ctx.strokeStyle = gold;
	ctx.lineWidth = 9;
	ctx.beginPath(); ctx.arc(-58, -42, 22, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
	ctx.beginPath(); ctx.arc(58, -42, 22, Math.PI * 1.5, Math.PI * 0.5); ctx.stroke();
	ctx.fillStyle = gold;
	ctx.beginPath();
	ctx.moveTo(-56, -76);
	ctx.lineTo(56, -76);
	ctx.quadraticCurveTo(56, 8, 0, 28);
	ctx.quadraticCurveTo(-56, 8, -56, -76);
	ctx.closePath();
	ctx.fill();
	ctx.fillRect(-9, 26, 18, 34);
	rr(ctx, -42, 58, 84, 18, 7);
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.fillStyle = "rgba(255,255,255,0.55)";
	ctx.beginPath(); ctx.ellipse(-30, -40, 8, 24, 0.15, 0, Math.PI * 2); ctx.fill();
	ctx.fillStyle = "#fff";
	spark(ctx, 6, -36, 20);
	ctx.fill();
	ctx.restore();
}

const confettiList = (() => {
	const rnd = mulberry32(99);
	return Array.from({ length: 70 }, () => ({
		x: rnd() * W, y: rnd() * H, vy: 14 + rnd() * 14, ph: rnd() * 6,
		w: 8 + rnd() * 8, h: 14 + rnd() * 10, rot: rnd() * 6, vr: 0.15 + rnd() * 0.3,
		c: CONFETTI[Math.floor(rnd() * CONFETTI.length)]
	}));
})();

const coinList = (() => {
	const rnd = mulberry32(555);
	return Array.from({ length: 26 }, () => ({
		x: rnd() * W, y: rnd() * H, vy: 16 + rnd() * 14, ph: rnd() * 6, r: 14 + rnd() * 10
	}));
})();

function drawCoin(ctx, x, y, r, spin) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(Math.max(0.25, Math.abs(Math.cos(spin))), 1);
	const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
	g.addColorStop(0, "#fff6a8");
	g.addColorStop(0.6, "#ffc400");
	g.addColorStop(1, "#b8860b");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = "#8a5a00";
	ctx.stroke();
	ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();
	txt(ctx, "$", 0, r * 0.4, r * 1.1, "#8a5a00");
	ctx.restore();
}

// layout
const PL = { y: 430, r: 128, lx: 185, rx: 535 };
const CARD = { y: 722, w: 200, h: 172, xs: [50, 260, 470] };

// ---------- static background ----------
function makeBackground(ps, author) {
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	ctx.scale(ps, ps);
	const rnd = mulberry32(777);

	const bg = ctx.createLinearGradient(0, 0, W, H);
	bg.addColorStop(0, "#0f1b4d");
	bg.addColorStop(0.5, "#4a1c8c");
	bg.addColorStop(1, "#c2255c");
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);

	const l1 = ctx.createRadialGradient(140, 420, 0, 140, 420, 380);
	l1.addColorStop(0, "rgba(64,224,255,0.30)");
	l1.addColorStop(1, "rgba(64,224,255,0)");
	ctx.fillStyle = l1; ctx.fillRect(0, 0, W, H);
	const l2 = ctx.createRadialGradient(580, 420, 0, 580, 420, 380);
	l2.addColorStop(0, "rgba(255,90,160,0.32)");
	l2.addColorStop(1, "rgba(255,90,160,0)");
	ctx.fillStyle = l2; ctx.fillRect(0, 0, W, H);

	// faint floating icons
	ctx.globalAlpha = 0.10;
	for (let i = 0; i < 12; i++) drawIcon(ctx, i % 3, rnd() * W, rnd() * H, 26 + rnd() * 22, rnd() * 1.2 - 0.6);
	ctx.globalAlpha = 1;
	for (let i = 0; i < 26; i++) {
		ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.5})`;
		spark(ctx, rnd() * W, rnd() * H, 3 + rnd() * 8);
		ctx.fill();
	}

	// title
	ctx.save();
	ctx.shadowColor = "rgba(0,0,0,0.5)";
	ctx.shadowBlur = 14;
	ctx.shadowOffsetY = 6;
	const tg = ctx.createLinearGradient(0, 30, 0, 80);
	tg.addColorStop(0, "#ffffff");
	tg.addColorStop(1, "#ffe08a");
	txt(ctx, "ROCK PAPER SCISSORS", W / 2, 68, 50, tg, "#2a0a5e");
	ctx.restore();
	txt(ctx, "B E S T   O F   3   •   F I R S T   T O   2", W / 2, 100, 16, "rgba(255,255,255,0.9)");
	ctx.fillStyle = "rgba(255,255,255,0.9)";
	spark(ctx, 40, 52, 13); ctx.fill();
	spark(ctx, W - 40, 52, 13); ctx.fill();

	// platforms
	for (const [cx, col, name] of [[PL.lx, "64,224,255", "YOU"], [PL.rx, "255,90,160", "BOT"]]) {
		ctx.save();
		ctx.shadowColor = `rgba(${col},0.7)`;
		ctx.shadowBlur = 36;
		const pg = ctx.createRadialGradient(cx, PL.y - 30, 10, cx, PL.y, PL.r);
		pg.addColorStop(0, "rgba(255,255,255,0.28)");
		pg.addColorStop(1, "rgba(20,10,60,0.55)");
		ctx.fillStyle = pg;
		ctx.beginPath(); ctx.arc(cx, PL.y, PL.r, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
		ctx.lineWidth = 5;
		ctx.strokeStyle = `rgba(${col},0.95)`;
		ctx.beginPath(); ctx.arc(cx, PL.y, PL.r, 0, Math.PI * 2); ctx.stroke();
		ctx.lineWidth = 2;
		ctx.strokeStyle = "rgba(255,255,255,0.35)";
		ctx.beginPath(); ctx.arc(cx, PL.y, PL.r - 14, 0, Math.PI * 2); ctx.stroke();
		txt(ctx, name, cx, PL.y + PL.r + 38, 30, "#fff", `rgba(${col},0.9)`);
	}
	// VS
	ctx.save();
	ctx.shadowColor = "#ffd43b";
	ctx.shadowBlur = 22;
	txt(ctx, "VS", W / 2, PL.y + 20, 56, "#ffe259", "#7a3b00");
	ctx.restore();

	// footer + watermark (author name comes from config, so changing it breaks the security check)
	ctx.fillStyle = "rgba(10,5,40,0.45)";
	rr(ctx, 40, 916, W - 80, 44, 22);
	ctx.fill();
	txt(ctx, "Reply:  rock  •  paper  •  scissors   (or 1 2 3)  •  quit", W / 2, 945, 21, "#fff");
	txt(ctx, `© ${author}`, W / 2, 985, 15, "rgba(255,255,255,0.75)");
	return canvas;
}

function pill(ctx, x, y, w, h, label, value) {
	ctx.save();
	ctx.shadowColor = "rgba(0,0,30,0.4)";
	ctx.shadowBlur = 12;
	ctx.shadowOffsetY = 4;
	const g = ctx.createLinearGradient(0, y, 0, y + h);
	g.addColorStop(0, "rgba(255,255,255,0.30)");
	g.addColorStop(1, "rgba(255,255,255,0.10)");
	ctx.fillStyle = g;
	rr(ctx, x, y, w, h, 20);
	ctx.fill();
	ctx.restore();
	ctx.lineWidth = 2;
	ctx.strokeStyle = "rgba(255,255,255,0.5)";
	rr(ctx, x, y, w, h, 20);
	ctx.stroke();
	txt(ctx, label, x + w / 2, y + 26, 18, "rgba(255,255,255,0.88)");
	if (value !== undefined) txt(ctx, String(value), x + w / 2, y + 62, 34, "#fff", "rgba(40,0,80,0.5)");
}

function pips(ctx, cx, y, wins) {
	const total = WINS_NEEDED;
	const gap = 38;
	const start = cx - ((total - 1) * gap) / 2;
	for (let i = 0; i < total; i++) {
		const x = start + i * gap;
		if (i < wins) {
			ctx.save();
			ctx.shadowColor = "#ffd43b";
			ctx.shadowBlur = 14;
			ctx.fillStyle = "#ffd43b";
			ctx.beginPath();
			for (let k = 0; k < 10; k++) {
				const a = (Math.PI / 5) * k - Math.PI / 2;
				const rad = k % 2 === 0 ? 15 : 7;
				k === 0 ? ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
			}
			ctx.closePath(); ctx.fill();
			ctx.restore();
		} else {
			ctx.fillStyle = "rgba(255,255,255,0.22)";
			ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
		}
	}
}

// ---------- draw a single frame ----------
// o: { phase: pick|shake|reveal|final, round, youWins, botWins, bet, you, bot, result, banner:{text,color},
//      shakeT, popP, status: win|lose, lines, jackpot, confettiF, pulse }
function drawScene(ctx, ps, bg, o) {
	ctx.setTransform(ps, 0, 0, ps, 0, 0);
	ctx.clearRect(0, 0, W, H);
	ctx.drawImage(bg, 0, 0, W, H);

	// scoreboard
	pill(ctx, 40, 122, 230, 84, "YOU");
	pips(ctx, 155, 180, o.youWins);
	pill(ctx, 450, 122, 230, 84, "BOT");
	pips(ctx, 565, 180, o.botWins);
	pill(ctx, 290, 122, 140, 84, "ROUND", o.round);

	// bet strip
	ctx.fillStyle = "rgba(10,5,40,0.45)";
	rr(ctx, 200, 222, 320, 40, 20);
	ctx.fill();
	txt(ctx, o.bet > 0 ? `BET: ${fmt(o.bet)} COINS` : "FREE PLAY", W / 2, 250, 20, o.bet > 0 ? "#ffe259" : "#9ff0ff");

	// platform icons
	const winSide = o.result === "win" ? "you" : o.result === "lose" ? "bot" : null;
	const revealed = o.phase === "reveal" || o.phase === "final";
	for (const [who, cx] of [["you", PL.lx], ["bot", PL.rx]]) {
		const choice = who === "you" ? o.you : o.bot;
		const isWinner = revealed && winSide === who;
		const isLoser = revealed && winSide && winSide !== who;

		if (isWinner || (revealed && o.result === "draw")) {
			ctx.save();
			ctx.shadowColor = isWinner ? "#ffd43b" : "#ffffff";
			ctx.shadowBlur = 40;
			ctx.lineWidth = 8;
			ctx.strokeStyle = isWinner ? "#ffd43b" : "rgba(255,255,255,0.85)";
			ctx.beginPath(); ctx.arc(cx, PL.y, PL.r + 6, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		}
		ctx.save();
		if (isLoser) ctx.globalAlpha = 0.55;

		if (o.phase === "pick") {
			const pulse = 1 + Math.sin((o.pulse || 0) * 0.9) * 0.06;
			ctx.save();
			ctx.translate(cx, PL.y + 38);
			ctx.scale(pulse, pulse);
			ctx.shadowColor = who === "you" ? "#40e0ff" : "#ff5aa0";
			ctx.shadowBlur = 26;
			txt(ctx, "?", 0, 0, 170, "#fff", who === "you" ? "#0b6a86" : "#9b1450");
			ctx.restore();
		} else if (o.phase === "shake") {
			const dy = Math.sin(o.shakeT * 1.5) * 24;
			const rot = Math.sin(o.shakeT * 1.5) * 0.12 * (who === "you" ? 1 : -1);
			drawIcon(ctx, 0, cx, PL.y - 6 - Math.abs(dy) * 0.4 + dy * 0.6, 100, rot);
		} else {
			const e = o.popP === undefined ? 1 : Math.max(0.05, easeOutBack(o.popP));
			drawIcon(ctx, choice, cx, PL.y - 4, 100 * (isLoser ? 0.92 : 1) * e, 0);
		}
		ctx.restore();
	}

	// banner
	if (o.banner) {
		ctx.save();
		const g = ctx.createLinearGradient(0, 628, 0, 696);
		g.addColorStop(0, "rgba(255,255,255,0.25)");
		g.addColorStop(1, "rgba(255,255,255,0.08)");
		ctx.fillStyle = g;
		rr(ctx, 100, 628, 520, 66, 33);
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = o.banner.color;
		ctx.shadowColor = o.banner.color;
		ctx.shadowBlur = 16;
		rr(ctx, 100, 628, 520, 66, 33);
		ctx.stroke();
		ctx.restore();
		txt(ctx, o.banner.text, W / 2, 673, 34, o.banner.color, "rgba(10,0,40,0.7)");
	}

	// choice cards
	for (let i = 0; i < 3; i++) {
		const x = CARD.xs[i], y = CARD.y;
		const picked = revealed && o.you === i;
		ctx.save();
		if (picked) {
			ctx.shadowColor = "#ffd43b";
			ctx.shadowBlur = 26;
		}
		const g = ctx.createLinearGradient(0, y, 0, y + CARD.h);
		g.addColorStop(0, picked ? "rgba(255,226,89,0.45)" : "rgba(255,255,255,0.26)");
		g.addColorStop(1, picked ? "rgba(255,226,89,0.18)" : "rgba(255,255,255,0.08)");
		ctx.fillStyle = g;
		rr(ctx, x, y, CARD.w, CARD.h, 26);
		ctx.fill();
		ctx.restore();
		ctx.lineWidth = picked ? 4 : 2;
		ctx.strokeStyle = picked ? "#ffd43b" : "rgba(255,255,255,0.45)";
		rr(ctx, x, y, CARD.w, CARD.h, 26);
		ctx.stroke();
		drawIcon(ctx, i, x + CARD.w / 2, y + 78, 52, 0);
		txt(ctx, NAMES[i], x + CARD.w / 2, y + 152, 24, "#fff", "rgba(10,0,40,0.6)");
		ctx.fillStyle = "rgba(10,5,40,0.6)";
		ctx.beginPath(); ctx.arc(x + 28, y + 28, 18, 0, Math.PI * 2); ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.stroke();
		txt(ctx, String(i + 1), x + 28, y + 36, 22, "#fff");
	}

	// match end overlay
	if (o.status) {
		const f = o.confettiF || 0;
		const mx = W / 2;
		ctx.fillStyle = "rgba(12,0,40,0.78)";
		rr(ctx, 30, 236, 660, 668, 34);
		ctx.fill();
		if (o.status === "win") {
			ctx.save();
			ctx.translate(mx, 400);
			ctx.rotate(f * 0.06);
			for (let i = 0; i < 14; i++) {
				ctx.rotate((Math.PI * 2) / 14);
				const g = ctx.createLinearGradient(0, 0, 330, 0);
				g.addColorStop(0, "rgba(255,226,89,0.38)");
				g.addColorStop(1, "rgba(255,226,89,0)");
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.moveTo(0, 0); ctx.lineTo(330, -34); ctx.lineTo(330, 34);
				ctx.closePath(); ctx.fill();
			}
			ctx.restore();
			drawTrophy(ctx, mx, 395 + Math.sin(f * 0.5) * 6, 1.1);
			const pulse = 1 + Math.sin(f * 0.7) * 0.05;
			ctx.save();
			ctx.translate(mx, 548);
			ctx.scale(pulse, pulse);
			txt(ctx, "YOU WIN!", 0, 0, 86, "#ffe259", "#8a3b00");
			ctx.restore();
			let ty = 600;
			if (o.jackpot) {
				const jp = 1 + Math.sin(f * 1.1) * 0.08;
				ctx.save();
				ctx.translate(mx, ty + 14);
				ctx.scale(jp, jp);
				txt(ctx, "STREAK JACKPOT!", 0, 0, 50, f % 2 ? "#ff4fd8" : "#fff36b", "#4a0a5a");
				ctx.restore();
				ty += 56;
			}
			for (const l of (o.lines || [])) {
				txt(ctx, l.text, mx, ty + 26, l.size || 30, l.color || "#fff", "rgba(40,0,80,0.6)");
				ty += (l.size || 30) + 16;
			}
			for (let i = 0; i < 3; i++) {
				const py = 856 - Math.abs(Math.sin(f * 0.6 + i * 1.1)) * 20;
				drawIcon(ctx, i, 180 + i * 180, py, 34, Math.sin(f * 0.6 + i) * 0.1);
			}
		} else {
			txt(ctx, "BOT WINS!", mx, 450, 88, "#ff7b93", "#5a0020");
			let ty = 500;
			for (const l of (o.lines || [])) {
				txt(ctx, l.text, mx, ty + 26, l.size || 30, l.color || "#fff", "rgba(40,0,80,0.6)");
				ty += (l.size || 30) + 18;
			}
			drawIcon(ctx, 1, 270, 800, 46, -0.15);
			drawIcon(ctx, 0, 450, 800, 46, 0.15);
		}
	}

	if (o.confettiF !== undefined) {
		const f = o.confettiF;
		for (const p of confettiList) {
			const y = ((p.y + p.vy * f) % (H + 60)) - 30;
			const x = p.x + Math.sin(f * 0.4 + p.ph) * 14;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(p.rot + p.vr * f);
			ctx.fillStyle = p.c;
			ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
			ctx.restore();
		}
		if (o.jackpot) {
			for (const c of coinList) {
				const y = ((c.y + c.vy * f) % (H + 80)) - 40;
				drawCoin(ctx, c.x + Math.sin(f * 0.3 + c.ph) * 10, y, c.r, f * 0.5 + c.ph);
			}
		}
	}
}

// ---------- frames ----------
const BANNER = {
	win: { text: "YOU WIN THIS ROUND!", color: "#7dffb0" },
	lose: { text: "BOT WINS THIS ROUND", color: "#ff7b93" },
	draw: { text: "DRAW! PLAY AGAIN", color: "#ffe259" }
};

function baseOpts(d, next) {
	return {
		round: d.round,
		youWins: next ? d.next.you : d.prev.you,
		botWins: next ? d.next.bot : d.prev.bot,
		bet: d.bet
	};
}

function roundFrames(d, ps, bg) {
	const frames = [];
	const mk = (o, delay) => frames.push({ delay, draw: ctx => drawScene(ctx, ps, bg, o) });

	const texts = ["ROCK...", "PAPER...", "SCISSORS...", "SHOOT!"];
	for (let i = 0; i < 8; i++) {
		const ti = Math.min(3, Math.floor(i / 2));
		mk(Object.assign(baseOpts(d, false), {
			phase: "shake", shakeT: i * 1.7, banner: { text: texts[ti], color: ti === 3 ? "#ffe259" : "#ffffff" }
		}), 110);
	}
	for (const p of [0.3, 0.65, 1]) {
		mk(Object.assign(baseOpts(d, true), {
			phase: "reveal", you: d.you, bot: d.bot, result: d.result, popP: p, banner: BANNER[d.result]
		}), 60);
	}
	const finalOpts = Object.assign(baseOpts(d, true), {
		phase: "final", you: d.you, bot: d.bot, result: d.result, banner: BANNER[d.result]
	});
	mk(finalOpts, d.end ? 1300 : 3000);

	if (d.end === "win") {
		for (let f = 0; f < 24; f++) {
			mk(Object.assign({}, finalOpts, { status: "win", lines: d.lines, jackpot: d.jackpot, confettiF: f }), 70);
		}
	} else if (d.end === "lose") {
		mk(Object.assign({}, finalOpts, { status: "lose", lines: d.lines }), 3500);
	}
	return frames;
}

async function encodeGif(file, ps, frames) {
	const w = Math.round(W * ps), h = Math.round(H * ps);
	const canvas = createCanvas(w, h);
	const ctx = canvas.getContext("2d");
	const enc = new GIFEncoder(w, h);
	const ws = fs.createWriteStream(file);
	const done = new Promise((res, rej) => { ws.on("finish", res); ws.on("error", rej); });
	enc.createReadStream().pipe(ws);
	enc.start();
	enc.setRepeat(0);
	enc.setQuality(GIF_QUALITY);
	for (const f of frames) {
		f.draw(ctx);
		enc.setDelay(f.delay);
		enc.addFrame(ctx);
		await new Promise(r => setImmediate(r));
	}
	enc.finish();
	await done;
}

// mode: "pick" | "round" | "forfeit"
async function renderMedia(mode, d) {
	_guard();
	const author = _authorName();
	const dir = path.join(__dirname, "cache");
	await fs.ensureDir(dir);
	const base = path.join(dir, `rps_${d.uid}_${Date.now()}`);

	if (ANIMATION && GIFEncoder && mode === "round") {
		try {
			const ps = GIF_SCALE;
			const bg = makeBackground(ps, author);
			const file = base + ".gif";
			await encodeGif(file, ps, roundFrames(d, ps, bg));
			return file;
		} catch (e) {
			console.error("[rps] GIF error, falling back to PNG:", e.message);
		}
	}

	const ps = PNG_SCALE;
	const bg = makeBackground(ps, author);
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	let o;
	if (mode === "pick") {
		o = { phase: "pick", round: d.round, youWins: d.prev.you, botWins: d.prev.bot, bet: d.bet, banner: { text: "CHOOSE YOUR MOVE!", color: "#ffffff" }, pulse: 2 };
	} else if (mode === "forfeit") {
		o = { phase: "final", round: d.round, youWins: d.prev.you, botWins: d.prev.bot, bet: d.bet, status: "lose", lines: d.lines };
	} else {
		o = Object.assign(baseOpts(d, true), {
			phase: "final", you: d.you, bot: d.bot, result: d.result, banner: BANNER[d.result],
			status: d.end || undefined, lines: d.lines, jackpot: d.jackpot, confettiF: d.end === "win" ? 3 : undefined
		});
	}
	drawScene(ctx, ps, bg, o);
	const file = base + ".png";
	await fs.writeFile(file, canvas.toBuffer("image/png"));
	return file;
}

// ============================== SEND / EDIT HELPERS ==============================
// sends the game image; if keep = true the message becomes the active game message
function sendGameMedia(message, game, body, file, keep, prevID) {
	_guard();
	return new Promise(resolve => {
		message.reply({ body, attachment: fs.createReadStream(file) }, (err, info) => {
			fs.remove(file).catch(() => { });
			if (err || !info) return resolve(null);
			if (keep) {
				game.messageID = info.messageID;
				global.GoatBot.onReply.set(info.messageID, {
					commandName: "rockpaperscissors",
					messageID: info.messageID,
					author: game.uid
				});
			}
			// unsend the old game image so it looks like the board was edited
			if (prevID) {
				global.GoatBot.onReply.delete(prevID);
				Promise.resolve(message.unsend(prevID)).catch(() => { });
			}
			resolve(info);
		});
	});
}

// same approach as balance.js: api.sendMessage with a callback to get the message info
function sendInfo(api, threadID, text, replyTo) {
	return new Promise(resolve => {
		try {
			api.sendMessage(text, threadID, (err, info) => resolve(err ? null : info), replyTo);
		} catch (e) {
			resolve(null);
		}
	});
}

// same as balance.js safeEdit: api.editMessage with retries
async function safeEdit(api, messageID, text, retries) {
	retries = retries === undefined ? 3 : retries;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			await api.editMessage(text, messageID);
			return true;
		} catch (e) {
			if (attempt === retries) {
				console.log("[rps] editMessage failed:", e && e.message ? e.message : e);
				return false;
			}
			await sleep(300);
		}
	}
	return false;
}

// "Rock... Paper... Scissors... SHOOT!" - one message that edits itself
async function countdown(api, threadID, replyTo, holder) {
	const msg = await sendInfo(api, threadID, "✊ Rock...", replyTo);
	if (!msg) return;
	holder.msg = msg;
	for (const t of ["✋ Paper...", "✌️ Scissors...", "💥 SHOOT!"]) {
		await sleep(COUNTDOWN_DELAY);
		await safeEdit(api, msg.messageID, t, 1);
	}
}

// counts the credited coins up by editing a single message, then shows the real new balance
async function rewardAnimation(api, threadID, replyTo, before, after, credit, breakdown) {
	_guard();
	const tier = tierFor(after);
	const finalText = [
		"💰 ❀°• 𝑹𝒆𝒘𝒂𝒓𝒅 𝑨𝒅𝒅𝒆𝒅 •°❀ 💰",
		"♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡",
		"",
		"██████████ 100%",
		"",
		...breakdown,
		`🪙 Total credited: +${fmt(credit)}`,
		`💳 New Balance: ${shortMoney(after)} (${fmt(after)})`,
		`${tierEmoji(tier)} Tier: ${tier}`,
		"",
		"♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡",
		"✨ 𝒄𝒐𝒏𝒈𝒓𝒂𝒕𝒖𝒍𝒂𝒕𝒊𝒐𝒏𝒔 & 𝒌𝒆𝒆𝒑 𝒑𝒍𝒂𝒚𝒊𝒏𝒈~ ✨"
	].join("\n");

	const msg = await sendInfo(api, threadID, "💰 Calculating your reward...\n░░░░░░░░░░ 0%", replyTo);
	if (!msg) {
		await sendInfo(api, threadID, finalText, replyTo);
		return;
	}
	let fails = 0;
	for (let i = 1; i < COUNT_STEPS; i++) {
		await sleep(COUNT_DELAY);
		const filled = Math.round((i / COUNT_STEPS) * 10);
		const cur = Math.round((credit * i) / COUNT_STEPS);
		const ok = await safeEdit(
			api,
			msg.messageID,
			"🎰 COUNTING YOUR REWARD...\n" +
			"█".repeat(filled) + "░".repeat(10 - filled) + ` ${filled * 10}%\n\n` +
			`🪙 Reward: +${fmt(cur)}\n💳 Balance: ${fmt(before + cur)}`,
			1
		);
		if (!ok && ++fails >= 2) {
			// editing is not working, send the final message as a new message instead
			await sendInfo(api, threadID, finalText, replyTo);
			return;
		}
	}
	await sleep(COUNT_DELAY);
	const done = await safeEdit(api, msg.messageID, finalText, 3);
	if (!done) await sendInfo(api, threadID, finalText, replyTo);
}

// cancels an idle match and refunds the bet
function armTimer(game) {
	clearTimeout(game.timer);
	game.timer = setTimeout(async () => {
		if (games.get(game.uid) !== game || game.busy) return;
		games.delete(game.uid);
		global.GoatBot.onReply.delete(game.messageID);
		let text = "⏰ Rock Paper Scissors match cancelled (no reply for 2 minutes).";
		try {
			if (game.bet > 0) {
				const r = await changeMoney(game.usersData, game.uid, game.bet);
				text += `\n💸 Your bet of ${fmt(game.bet)} coins was refunded. Balance: ${fmt(r.after)}`;
			}
		} catch (e) { /* ignore */ }
		sendInfo(game.api, game.threadID, text);
	}, EXPIRE_MS);
	if (game.timer && game.timer.unref) game.timer.unref();
}

// ============================== COMMAND ==============================
module.exports = {
	config: {
		name: "rockpaperscissors",
		aliases: ["rps", "rockpaper", "rpsgame"],
		version: "1.0",
		author: "ROCKY CHOWDHURY",
		countDown: 5,
		role: 0,
		description: {
			en: "Rock Paper Scissors vs the bot - HD animated board, bets, streak jackpot"
		},
		category: "game",
		guide: {
			en: "{pn}: free play\n{pn} <bet>: play with a bet (e.g. {pn} 5000, {pn} 10k, {pn} 2m, {pn} all)\n{pn} stats: your record\n{pn} help: rules\n\nReply to the game photo with: rock / paper / scissors (or 1 / 2 / 3)"
		}
	},

	onStart: async function ({ api, message, event, args, usersData }) {
		if (!_authOK()) return message.reply(TAMPER_MSG);
		const uid = event.senderID;
		const first = (args[0] || "").toLowerCase();

		if (first === "help" || first === "rules") {
			return message.reply(
				"✊✋✌️ ROCK PAPER SCISSORS ✊✋✌️\n\n" +
				`• Best of 3 against the bot: first to ${WINS_NEEDED} round wins takes the match\n` +
				"• Start: rps  (free play)  or  rps <bet>  e.g. rps 5000 / rps 10k / rps 2m / rps all\n" +
				"• Reply to the game photo with: rock, paper or scissors (or 1, 2, 3 / r, p, s)\n" +
				"• Rock beats Scissors, Scissors beats Paper, Paper beats Rock\n" +
				"• Draws are replayed\n" +
				"• Win with a bet: you get your bet back plus the same amount (x2) 💰\n" +
				`• Flawless 2-0 win: extra ${Math.round(FLAWLESS_RATE * 100)}% of your bet as a bonus 🔥\n` +
				`• Free play win: +${fmt(FREE_WIN_REWARD)} coins\n` +
				`• Win ${STREAK_EVERY} matches in a row: JACKPOT +${fmt(STREAK_JACKPOT)} coins 🎰\n` +
				`• Bets: ${fmt(MIN_BET)} - ${fmt(MAX_BET)} coins. Quitting forfeits the bet.\n` +
				"• No reply for 2 minutes: match cancelled and bet refunded\n" +
				"• rps stats: see your record\n\n" +
				`👑 Author: ${_authorName()}`
			);
		}

		try {
			if (first === "stats" || first === "stat") {
				const s = await getStats(usersData, uid);
				const total = s.w + s.l;
				const rate = total ? Math.round((s.w / total) * 100) : 0;
				return message.reply(
					"📊 YOUR ROCK PAPER SCISSORS RECORD\n\n" +
					`🎮 Matches played: ${total}\n🏆 Wins: ${s.w}\n💔 Losses: ${s.l}\n📈 Win rate: ${rate}%\n` +
					`🔥 Current win streak: ${s.streak}\n⭐ Best win streak: ${s.best}\n\n` +
					`🎰 Win ${STREAK_EVERY} in a row for the +${fmt(STREAK_JACKPOT)} jackpot!`
				);
			}

			if (games.has(uid)) {
				return message.reply("⚠️ You already have a match running!\nReply to your game photo, or reply with: quit");
			}

			// ---- bet ----
			let bet = 0;
			if (first) {
				const balance = await readMoney(usersData, uid);
				if (first === "all") bet = Math.min(balance, MAX_BET);
				else {
					bet = parseAmount(first);
					if (bet === null) return message.reply("❌ Invalid bet!\nExamples: rps 5000 / rps 10k / rps 2m / rps all");
				}
				if (bet < MIN_BET) return message.reply(`❌ The minimum bet is ${fmt(MIN_BET)} coins.`);
				if (bet > MAX_BET) return message.reply(`❌ The maximum bet is ${fmt(MAX_BET)} coins.`);
				if (balance < bet) return message.reply(`❌ Not enough coins!\n💳 Your balance: ${fmt(balance)}\n🎲 Your bet: ${fmt(bet)}`);
				const paid = await changeMoney(usersData, uid, -bet); // bet is held until the match ends
				if (!paid.ok) return message.reply("⚠️ Could not place your bet, please try again.");
			}

			const game = {
				uid, bet, round: 1, you: 0, bot: 0, busy: false, messageID: null, timer: null,
				api, usersData, threadID: event.threadID
			};
			games.set(uid, game);

			try {
				const file = await renderMedia("pick", { uid, round: 1, prev: { you: 0, bot: 0 }, bet });
				const sent = await sendGameMedia(
					message,
					game,
					"✊✋✌️ Rock Paper Scissors ✊✋✌️\n" +
					`${bet > 0 ? `🎲 Bet: ${fmt(bet)} coins (win = x2)` : `🆓 Free play (win = +${fmt(FREE_WIN_REWARD)} coins)`}\n` +
					`🎰 Win ${STREAK_EVERY} matches in a row for a JACKPOT!\n\n` +
					"Reply to this photo with: rock, paper or scissors (or 1, 2, 3)",
					file,
					true,
					null
				);
				if (!sent) throw new Error("Could not send the game image.");
				armTimer(game);
			} catch (e) {
				// refund if the game could not even start
				games.delete(uid);
				if (bet > 0) await changeMoney(usersData, uid, bet).catch(() => { });
				throw e;
			}
		} catch (e) {
			if (e.message === "AUTHOR_TAMPERED") return message.reply(TAMPER_MSG);
			console.error("[rps] start error:", e);
			return message.reply("⚠️ Error: " + e.message);
		}
	},

	onReply: async function ({ api, message, event, Reply, usersData }) {
		if (!_authOK()) return message.reply(TAMPER_MSG);
		const uid = event.senderID;
		const game = games.get(Reply.author);
		if (!game || uid !== game.uid || Reply.messageID !== game.messageID) return;
		if (game.busy) return;

		const input = (event.body || "").trim().toLowerCase();
		const cd = { msg: null };

		try {
			// ---------------- QUIT ----------------
			if (["quit", "exit", "stop", "end", "forfeit"].includes(input)) {
				game.busy = true;
				clearTimeout(game.timer);
				games.delete(uid);
				const stats = await getStats(usersData, uid);
				stats.l++;
				stats.streak = 0;
				await saveStats(usersData, uid, stats).catch(() => { });
				const lines = [{ text: `Series ${game.you} - ${game.bot}`, size: 30 }, { text: "You forfeited the match", size: 28, color: "#ffb3c1" }];
				if (game.bet > 0) lines.push({ text: `-${fmt(game.bet)} coins`, size: 36, color: "#ff7b93" });
				const file = await renderMedia("forfeit", { uid, round: game.round, prev: { you: game.you, bot: game.bot }, bet: game.bet, lines });
				return await sendGameMedia(
					message, game,
					`🛑 You forfeited the match.${game.bet > 0 ? `\n💸 You lost your bet of ${fmt(game.bet)} coins.` : ""}\nPlay again: rps`,
					file, false, Reply.messageID
				);
			}

			const pick = parseChoice(input);
			if (pick === null) return message.reply("❌ Choose one: rock, paper or scissors (or 1, 2, 3)");

			game.busy = true;
			clearTimeout(game.timer);

			// ---------------- ROUND ----------------
			const bot = rand3();
			const result = outcome(pick, bot);
			const prev = { you: game.you, bot: game.bot };
			const next = { you: prev.you + (result === "win" ? 1 : 0), bot: prev.bot + (result === "lose" ? 1 : 0) };
			const roundNo = game.round;
			const end = next.you >= WINS_NEEDED ? "win" : next.bot >= WINS_NEEDED ? "lose" : null;

			// "Rock... Paper... Scissors... SHOOT!" (edited message) runs while the image renders
			const cdPromise = countdown(api, event.threadID, event.messageID, cd);

			// ---- settle the match if it ended ----
			let lines = [], jackpot = false, credit = 0, breakdown = [], summary = "", before = 0, after = 0;
			if (end) {
				const stats = await getStats(usersData, uid);
				if (end === "win") {
					stats.w++;
					stats.streak++;
					stats.best = Math.max(stats.best, stats.streak);
					const flawless = next.bot === 0;
					if (game.bet > 0) {
						const bonus = flawless ? Math.floor(game.bet * FLAWLESS_RATE) : 0;
						credit = game.bet * 2 + bonus;
						breakdown.push(`🎲 Bet returned: +${fmt(game.bet)}`, `🏆 Winnings: +${fmt(game.bet)}`);
						if (bonus > 0) breakdown.push(`🔥 Flawless bonus: +${fmt(bonus)}`);
					} else if (FREE_WIN_REWARD > 0) {
						credit = FREE_WIN_REWARD;
						breakdown.push(`🏆 Free play win: +${fmt(FREE_WIN_REWARD)}`);
					}
					jackpot = stats.streak % STREAK_EVERY === 0;
					if (jackpot) {
						credit += STREAK_JACKPOT;
						breakdown.push(`🎰 STREAK JACKPOT (${stats.streak} wins in a row): +${fmt(STREAK_JACKPOT)}`);
					}
					lines = [{ text: `Series ${next.you} - ${next.bot}`, size: 30 }];
					if (flawless) lines.push({ text: "FLAWLESS VICTORY!", size: 34, color: "#ffe259" });
					if (credit > 0) lines.push({ text: `+${fmt(credit)} COINS`, size: 46, color: "#7dffb0" });
					if (credit > 0) {
						const r = await changeMoney(usersData, uid, credit);
						before = r.before; after = r.after;
					}
					summary =
						`\n\n🎉 CONGRATULATIONS! 🎉\nYou beat the bot ${next.you}-${next.bot}!` +
						(flawless ? "\n🔥 Flawless victory!" : "") +
						(credit > 0 ? `\n💰 You won +${fmt(credit)} coins` : "") +
						(jackpot ? `\n🎰 JACKPOT! ${stats.streak} wins in a row!` : `\n🔥 Win streak: ${stats.streak}`);
				} else {
					stats.l++;
					stats.streak = 0;
					lines = [{ text: `Series ${next.you} - ${next.bot}`, size: 30 }, { text: "Better luck next time!", size: 28, color: "#ffd0ee" }];
					if (game.bet > 0) lines.push({ text: `-${fmt(game.bet)} coins`, size: 38, color: "#ff7b93" });
					summary =
						`\n\n😢 The bot won the match ${next.bot}-${next.you}.` +
						(game.bet > 0 ? `\n💸 You lost your bet of ${fmt(game.bet)} coins.` : "") +
						"\nPlay again: rps";
				}
				await saveStats(usersData, uid, stats).catch(() => { });
				games.delete(uid);
			}

			const file = await renderMedia("round", {
				uid, round: roundNo, bet: game.bet, you: pick, bot, result, prev, next, end, lines, jackpot
			});
			await cdPromise;

			let body =
				`🎮 Round ${roundNo}\n` +
				`${EMOJI[pick]} You: ${LABELS[pick]}   VS   ${EMOJI[bot]} Bot: ${LABELS[bot]}\n` +
				(result === "win" ? "✅ You win this round!" : result === "lose" ? "❌ Bot wins this round!" : "🤝 Draw! Play this round again.") +
				`\n📊 Score: You ${next.you} - ${next.bot} Bot`;

			if (end) body += summary;
			else body += "\n\nReply with: rock, paper or scissors (or 1, 2, 3)";

			const sent = await sendGameMedia(message, game, body, file, !end, Reply.messageID);
			if (cd.msg) Promise.resolve(message.unsend(cd.msg.messageID)).catch(() => { });
			if (!sent) throw new Error("Could not send the result image.");

			if (!end) {
				// commit the round and wait for the next move
				game.you = next.you;
				game.bot = next.bot;
				if (result !== "draw") game.round++;
				game.busy = false;
				armTimer(game);
			} else if (end === "win" && credit > 0) {
				rewardAnimation(api, event.threadID, event.messageID, before, after, credit, breakdown)
					.catch(e => console.error("[rps] reward animation:", e.message));
			}
		} catch (e) {
			game.busy = false;
			if (games.get(game.uid) === game) armTimer(game);
			if (cd.msg) Promise.resolve(message.unsend(cd.msg.messageID)).catch(() => { });
			if (e.message === "AUTHOR_TAMPERED") return message.reply(TAMPER_MSG);
			console.error("[rps] reply error:", e);
			return message.reply("⚠️ Error: " + e.message);
		}
	}
};
