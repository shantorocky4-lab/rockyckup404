const { createCanvas } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

// If gifencoder is installed the bot sends animated GIFs, otherwise HD photos (PNG)
// install: npm i gifencoder
let GIFEncoder = null;
try { GIFEncoder = require("gifencoder"); } catch (e) { GIFEncoder = null; }

// ============================ SETTINGS (edit freely) ============================
const ROWS = 6;
const COLS = 6;
const TYPES = 6;                // 6 different animals
const MAX_MOVES = 20;           // total moves per game
const TARGET_SCORE = 800;       // reach this score to WIN instantly
const WIN_REWARD = 1000000;     // coins for every win (1M)
const JACKPOT_MAX_MOVES = 12;   // win using this many moves or fewer = JACKPOT
const JACKPOT_BONUS = 5000000;  // extra coins for a fast win (5M)
const ANIMATION = true;         // false = HD photo only (no GIF)
const GIF_SCALE = 0.75;         // GIF size (bigger = slower)
const GIF_QUALITY = 15;         // lower number = better quality (but slower)
const PNG_SCALE = 2;            // HD photo quality (2 = 1440x1960)
const COUNT_STEPS = 10;         // how many times the reward message is edited
const COUNT_DELAY = 800;        // delay between edits (ms)
const LOADING_EDIT = true;      // show an edited loading message on every move
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
// =========================================================================================

const W = 720, H = 980;
const X0 = 70, Y0 = 285, S = 100, R = 40;

// bubble color [light, dark] (each animal has its own color)
const COLORS = [
	["#ffd49a", "#f08a1c"], // cat   - orange
	["#aef5c4", "#1fae5a"], // panda - green
	["#ffc9dd", "#ee4f8c"], // rabbit- pink
	["#bde0ff", "#2f7df0"], // penguin- blue
	["#fff3ad", "#f2b705"], // lion  - yellow
	["#e5ceff", "#8a4de0"]  // koala - purple
];
const CONFETTI = ["#ffe259", "#ff6b81", "#43e97b", "#4fc3f7", "#d17cff", "#ffffff", "#ffa502"];
const LETTERS = ["A", "B", "C", "D", "E", "F"];

// ============================== HELPERS ==============================
const rand = n => Math.floor(Math.random() * n);
const copyBoard = b => b.map(r => r.slice());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => Number(n).toLocaleString("en-US");

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

// ============================== GAME LOGIC ==============================
function createBoard() {
	let board;
	do {
		board = [];
		for (let r = 0; r < ROWS; r++) {
			board[r] = [];
			for (let c = 0; c < COLS; c++) {
				let t;
				do {
					t = rand(TYPES);
				} while (
					(c >= 2 && board[r][c - 1] === t && board[r][c - 2] === t) ||
					(r >= 2 && board[r - 1][c] === t && board[r - 2][c] === t)
				);
				board[r][c] = t;
			}
		}
	} while (!hasMove(board));
	return board;
}

function findMatches(board) {
	const set = new Set();
	for (let r = 0; r < ROWS; r++) {
		let run = 1;
		for (let c = 1; c <= COLS; c++) {
			if (c < COLS && board[r][c] !== null && board[r][c] === board[r][c - 1]) run++;
			else {
				if (run >= 3) for (let k = 1; k <= run; k++) set.add(`${r},${c - k}`);
				run = 1;
			}
		}
	}
	for (let c = 0; c < COLS; c++) {
		let run = 1;
		for (let r = 1; r <= ROWS; r++) {
			if (r < ROWS && board[r][c] !== null && board[r][c] === board[r - 1][c]) run++;
			else {
				if (run >= 3) for (let k = 1; k <= run; k++) set.add(`${r - k},${c}`);
				run = 1;
			}
		}
	}
	return set;
}

function swap(board, r1, c1, r2, c2) {
	const t = board[r1][c1];
	board[r1][c1] = board[r2][c2];
	board[r2][c2] = t;
}

function hasMove(board) {
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			for (const [dr, dc] of [[0, 1], [1, 0]]) {
				const r2 = r + dr, c2 = c + dc;
				if (r2 >= ROWS || c2 >= COLS) continue;
				swap(board, r, c, r2, c2);
				const ok = findMatches(board).size > 0;
				swap(board, r, c, r2, c2);
				if (ok) return true;
			}
		}
	}
	return false;
}

// remove matches -> gravity -> refill -> repeat (cascades). Steps are saved for the animation
function resolveBoard(board) {
	let total = 0, combo = 0, cleared = 0;
	const steps = [];
	while (true) {
		const matches = findMatches(board);
		if (matches.size === 0) break;
		combo++;
		cleared += matches.size;
		const gain = matches.size * 10 * combo + Math.max(0, matches.size - 3) * 10;
		total += gain;

		const before = copyBoard(board);
		const cells = [...matches].map(k => k.split(",").map(Number));
		const maxRow = {};
		for (const [r, c] of cells) {
			board[r][c] = null;
			maxRow[c] = Math.max(maxRow[c] === undefined ? -1 : maxRow[c], r);
		}
		const changed = new Set();
		for (const c in maxRow) for (let r = 0; r <= maxRow[c]; r++) changed.add(`${r},${c}`);

		for (let c = 0; c < COLS; c++) {
			let write = ROWS - 1;
			for (let r = ROWS - 1; r >= 0; r--) {
				if (board[r][c] !== null) {
					board[write][c] = board[r][c];
					if (write !== r) board[r][c] = null;
					write--;
				}
			}
			for (let r = write; r >= 0; r--) board[r][c] = rand(TYPES);
		}
		steps.push({ before, cells, changed, after: copyBoard(board), gain, combo });
	}
	return { total, combo, cleared, steps };
}

function parseMove(text) {
	const s = String(text || "").toLowerCase().replace(/[\s,\-_>]+/g, "");
	let m = s.match(/^([a-f])([1-6])([a-f])([1-6])$/);
	if (m) return { r1: +m[2] - 1, c1: m[1].charCodeAt(0) - 97, r2: +m[4] - 1, c2: m[3].charCodeAt(0) - 97 };
	m = s.match(/^([a-f])([1-6])(right|left|up|down|r|l|u|d)$/);
	if (m) {
		const r1 = +m[2] - 1, c1 = m[1].charCodeAt(0) - 97;
		const d = m[3][0];
		const dr = d === "u" ? -1 : d === "d" ? 1 : 0;
		const dc = d === "l" ? -1 : d === "r" ? 1 : 0;
		return { r1, c1, r2: r1 + dr, c2: c1 + dc };
	}
	return null;
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

function paw(ctx, x, y, s, rot) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rot);
	ctx.beginPath();
	ctx.ellipse(0, s * 0.35, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
	ctx.fill();
	for (const [dx, dy] of [[-0.62, -0.2], [-0.22, -0.62], [0.22, -0.62], [0.62, -0.2]]) {
		ctx.beginPath();
		ctx.ellipse(dx * s, dy * s, s * 0.2, s * 0.27, dx * 0.5, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

// ---------- animal face helpers (unit space: face radius ~ 1) ----------
function outline(ctx) {
	ctx.lineWidth = 0.05;
	ctx.strokeStyle = "rgba(70,35,25,0.38)";
	ctx.stroke();
}
function circ(ctx, x, y, r, fill, stroke) {
	ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fillStyle = fill; ctx.fill();
	if (stroke) outline(ctx);
}
function ell(ctx, x, y, rx, ry, rot, fill, stroke) {
	ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
	ctx.fillStyle = fill; ctx.fill();
	if (stroke) outline(ctx);
}
function poly(ctx, pts, fill, stroke) {
	ctx.beginPath();
	pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
	ctx.closePath();
	ctx.fillStyle = fill; ctx.fill();
	if (stroke) outline(ctx);
}
function eye(ctx, x, y, s) {
	circ(ctx, x, y, s, "#2a2230");
	circ(ctx, x - s * 0.3, y - s * 0.35, s * 0.38, "#ffffff");
	circ(ctx, x + s * 0.35, y + s * 0.3, s * 0.18, "#ffffff");
}
function blush(ctx, x, y) {
	ell(ctx, x, y, 0.17, 0.1, 0, "rgba(255,105,140,0.5)");
}
function mouthW(ctx, y, col) {
	ctx.strokeStyle = col || "#6b3f2a";
	ctx.lineWidth = 0.05;
	for (const dx of [-0.08, 0.08]) {
		ctx.beginPath();
		ctx.arc(dx, y, 0.08, 0.05 * Math.PI, 0.95 * Math.PI);
		ctx.stroke();
	}
}

function drawAnimal(ctx, type, cx, cy, u) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.scale(u, u);
	ctx.lineCap = "round";
	ctx.lineJoin = "round";

	if (type === 0) {
		// ---------- CAT ----------
		for (const s of [-1, 1]) {
			poly(ctx, [[s * 0.95, -0.1], [s * 0.82, -1.12], [s * 0.18, -0.82]], "#ff9f43", true);
			poly(ctx, [[s * 0.8, -0.3], [s * 0.74, -0.88], [s * 0.38, -0.74]], "#ffb3c1");
		}
		ell(ctx, 0, 0.05, 1, 0.88, 0, "#fff3e3", true);
		ctx.strokeStyle = "#ff9f43";
		ctx.lineWidth = 0.1;
		for (const [x, y2] of [[-0.2, -0.55], [0, -0.45], [0.2, -0.55]]) {
			ctx.beginPath(); ctx.moveTo(x, -0.82); ctx.lineTo(x, y2); ctx.stroke();
		}
		eye(ctx, -0.4, 0, 0.13);
		eye(ctx, 0.4, 0, 0.13);
		poly(ctx, [[-0.09, 0.17], [0.09, 0.17], [0, 0.28]], "#ff7aa2");
		mouthW(ctx, 0.3);
		ctx.strokeStyle = "rgba(90,60,40,0.55)";
		ctx.lineWidth = 0.035;
		for (const s of [-1, 1]) {
			for (const dy of [-0.05, 0.09]) {
				ctx.beginPath(); ctx.moveTo(s * 0.6, 0.22 + dy); ctx.lineTo(s * 1.06, 0.14 + dy * 2); ctx.stroke();
			}
		}
		blush(ctx, -0.62, 0.3);
		blush(ctx, 0.62, 0.3);
	} else if (type === 1) {
		// ---------- PANDA ----------
		circ(ctx, -0.78, -0.74, 0.34, "#2f3640");
		circ(ctx, 0.78, -0.74, 0.34, "#2f3640");
		circ(ctx, 0, 0.05, 0.98, "#ffffff", true);
		for (const s of [-1, 1]) {
			ell(ctx, s * 0.4, -0.02, 0.24, 0.3, s * 0.45, "#2f3640");
			circ(ctx, s * 0.4, -0.04, 0.1, "#ffffff");
			circ(ctx, s * 0.4, -0.03, 0.055, "#1b1b1b");
			circ(ctx, s * 0.38, -0.07, 0.02, "#ffffff");
		}
		ell(ctx, 0, 0.25, 0.15, 0.1, 0, "#2f3640");
		ctx.strokeStyle = "#2f3640";
		ctx.lineWidth = 0.05;
		ctx.beginPath(); ctx.moveTo(0, 0.33); ctx.lineTo(0, 0.4); ctx.stroke();
		mouthW(ctx, 0.4, "#2f3640");
		blush(ctx, -0.68, 0.32);
		blush(ctx, 0.68, 0.32);
	} else if (type === 2) {
		// ---------- RABBIT ----------
		for (const s of [-1, 1]) {
			ell(ctx, s * 0.4, -0.95, 0.24, 0.56, s * 0.14, "#ffffff", true);
			ell(ctx, s * 0.4, -0.92, 0.12, 0.4, s * 0.14, "#ffb3cb");
		}
		ell(ctx, 0, 0.1, 0.98, 0.86, 0, "#ffffff", true);
		eye(ctx, -0.38, 0.02, 0.13);
		eye(ctx, 0.38, 0.02, 0.13);
		ell(ctx, 0, 0.2, 0.09, 0.06, 0, "#ff7aa2");
		mouthW(ctx, 0.3, "#8a5a5a");
		ctx.fillStyle = "#fff";
		ctx.fillRect(-0.07, 0.38, 0.14, 0.15);
		ctx.lineWidth = 0.03;
		ctx.strokeStyle = "rgba(90,60,60,0.5)";
		ctx.strokeRect(-0.07, 0.38, 0.14, 0.15);
		blush(ctx, -0.64, 0.28);
		blush(ctx, 0.64, 0.28);
	} else if (type === 3) {
		// ---------- PENGUIN ----------
		circ(ctx, 0, 0, 1.0, "#2f3b52", true);
		ell(ctx, -0.3, 0.05, 0.5, 0.56, 0, "#ffffff");
		ell(ctx, 0.3, 0.05, 0.5, 0.56, 0, "#ffffff");
		ell(ctx, 0, 0.42, 0.66, 0.4, 0, "#ffffff");
		eye(ctx, -0.32, 0.0, 0.12);
		eye(ctx, 0.32, 0.0, 0.12);
		ell(ctx, 0, 0.26, 0.2, 0.11, 0, "#ff9f1a", true);
		ell(ctx, 0, 0.36, 0.14, 0.06, 0, "#f07c00");
		blush(ctx, -0.62, 0.28);
		blush(ctx, 0.62, 0.28);
		poly(ctx, [[-0.08, -0.98], [0, -1.22], [0.08, -0.98]], "#2f3b52");
	} else if (type === 4) {
		// ---------- LION ----------
		for (let i = 0; i < 12; i++) {
			const a = (i * Math.PI) / 6;
			circ(ctx, Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0.3, i % 2 ? "#c0560a" : "#e8892b");
		}
		circ(ctx, 0, 0, 1.0, "#d9731a");
		circ(ctx, -0.62, -0.68, 0.22, "#ffe0a3", true);
		circ(ctx, 0.62, -0.68, 0.22, "#ffe0a3", true);
		circ(ctx, -0.62, -0.68, 0.11, "#ffb3a0");
		circ(ctx, 0.62, -0.68, 0.11, "#ffb3a0");
		circ(ctx, 0, 0.08, 0.8, "#ffe0a3", true);
		ell(ctx, 0, 0.34, 0.38, 0.27, 0, "#fff7e6");
		eye(ctx, -0.33, -0.02, 0.12);
		eye(ctx, 0.33, -0.02, 0.12);
		poly(ctx, [[-0.1, 0.18], [0.1, 0.18], [0, 0.3]], "#8d4b2a");
		ctx.strokeStyle = "#8d4b2a";
		ctx.lineWidth = 0.045;
		ctx.beginPath(); ctx.moveTo(0, 0.3); ctx.lineTo(0, 0.38); ctx.stroke();
		mouthW(ctx, 0.38, "#8d4b2a");
		blush(ctx, -0.55, 0.26);
		blush(ctx, 0.55, 0.26);
	} else {
		// ---------- KOALA ----------
		circ(ctx, -0.82, -0.55, 0.44, "#aeb3c2", true);
		circ(ctx, 0.82, -0.55, 0.44, "#aeb3c2", true);
		circ(ctx, -0.82, -0.55, 0.25, "#f6d3df");
		circ(ctx, 0.82, -0.55, 0.25, "#f6d3df");
		ell(ctx, 0, 0.05, 0.98, 0.9, 0, "#c9cdd8", true);
		eye(ctx, -0.38, -0.04, 0.11);
		eye(ctx, 0.38, -0.04, 0.11);
		ell(ctx, 0, 0.16, 0.2, 0.3, 0, "#3b3f4a");
		ell(ctx, -0.06, 0.04, 0.05, 0.08, 0.4, "rgba(255,255,255,0.55)");
		ctx.strokeStyle = "#5a5f6e";
		ctx.lineWidth = 0.045;
		ctx.beginPath(); ctx.moveTo(-0.12, 0.52); ctx.quadraticCurveTo(0, 0.6, 0.12, 0.52); ctx.stroke();
		blush(ctx, -0.64, 0.3);
		blush(ctx, 0.64, 0.3);
	}
	ctx.restore();
}

// animal + glossy bubble
function drawCandy(ctx, type, cx, cy, r, alpha) {
	const [light, dark] = COLORS[type];
	ctx.save();
	ctx.globalAlpha = alpha === undefined ? 1 : Math.max(0, alpha);

	// bubble
	ctx.save();
	ctx.shadowColor = dark;
	ctx.shadowBlur = 16;
	ctx.shadowOffsetY = 5;
	const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.08, cx, cy, r * 1.15);
	g.addColorStop(0, light);
	g.addColorStop(0.6, dark);
	g.addColorStop(1, "rgba(0,0,0,0.45)");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
	ctx.restore();

	// bottom bounce light
	ctx.save();
	ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
	const g2 = ctx.createRadialGradient(cx, cy + r * 1.05, 0, cx, cy + r * 1.05, r * 1.1);
	g2.addColorStop(0, "rgba(255,255,255,0.4)");
	g2.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = g2;
	ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
	ctx.restore();

	// rim
	ctx.lineWidth = 3;
	ctx.strokeStyle = "rgba(255,255,255,0.75)";
	ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

	// animal
	drawAnimal(ctx, type, cx, cy + r * 0.06, r * 0.72);

	// bubble shine (upore)
	ctx.fillStyle = "rgba(255,255,255,0.5)";
	ctx.beginPath();
	ctx.ellipse(cx - r * 0.5, cy - r * 0.62, r * 0.26, r * 0.12, -0.7, 0, Math.PI * 2);
	ctx.fill();
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

// ---------- static background (title, board, labels, watermark) ----------
function makeBackground(ps, author) {
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	ctx.scale(ps, ps);
	const rnd = mulberry32(2024);

	const bg = ctx.createLinearGradient(0, 0, W, H);
	bg.addColorStop(0, "#ff6fa5");
	bg.addColorStop(0.45, "#a23cf0");
	bg.addColorStop(1, "#2f55f5");
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);

	const l1 = ctx.createRadialGradient(150, 120, 0, 150, 120, 380);
	l1.addColorStop(0, "rgba(255,255,255,0.28)");
	l1.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = l1; ctx.fillRect(0, 0, W, H);
	const l2 = ctx.createRadialGradient(600, 850, 0, 600, 850, 380);
	l2.addColorStop(0, "rgba(120,255,240,0.22)");
	l2.addColorStop(1, "rgba(120,255,240,0)");
	ctx.fillStyle = l2; ctx.fillRect(0, 0, W, H);

	for (let i = 0; i < 24; i++) {
		const x = rnd() * W, y = rnd() * H, r = 8 + rnd() * 38;
		const bg2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
		bg2.addColorStop(0, "rgba(255,255,255,0.20)");
		bg2.addColorStop(1, "rgba(255,255,255,0.03)");
		ctx.fillStyle = bg2;
		ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
	}
	// paw prints
	ctx.fillStyle = "rgba(255,255,255,0.11)";
	for (let i = 0; i < 16; i++) paw(ctx, rnd() * W, rnd() * H, 20 + rnd() * 20, rnd() * 6.28);
	// sparkles
	for (let i = 0; i < 22; i++) {
		ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.5})`;
		spark(ctx, rnd() * W, rnd() * H, 4 + rnd() * 9);
		ctx.fill();
	}

	// title
	ctx.save();
	ctx.shadowColor = "rgba(60,0,90,0.55)";
	ctx.shadowBlur = 14;
	ctx.shadowOffsetY = 6;
	const tg = ctx.createLinearGradient(0, 20, 0, 70);
	tg.addColorStop(0, "#ffffff");
	tg.addColorStop(1, "#ffd0ee");
	txt(ctx, "CANDY CRUSH", W / 2, 66, 58, tg, "#7a1aa8");
	ctx.restore();
	txt(ctx, "A N I M A L   E D I T I O N", W / 2, 92, 17, "rgba(255,255,255,0.92)");
	ctx.fillStyle = "rgba(255,255,255,0.9)";
	spark(ctx, 54, 44, 15); ctx.fill();
	spark(ctx, W - 54, 44, 15); ctx.fill();

	// board panel
	ctx.save();
	ctx.shadowColor = "rgba(20,0,60,0.5)";
	ctx.shadowBlur = 30;
	ctx.shadowOffsetY = 10;
	const pg = ctx.createLinearGradient(0, Y0, 0, Y0 + ROWS * S);
	pg.addColorStop(0, "rgba(40,10,90,0.55)");
	pg.addColorStop(1, "rgba(20,5,60,0.7)");
	ctx.fillStyle = pg;
	rr(ctx, X0 - 14, Y0 - 14, COLS * S + 28, ROWS * S + 28, 28);
	ctx.fill();
	ctx.restore();
	ctx.lineWidth = 3;
	ctx.strokeStyle = "rgba(255,255,255,0.45)";
	rr(ctx, X0 - 14, Y0 - 14, COLS * S + 28, ROWS * S + 28, 28);
	ctx.stroke();

	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const x = X0 + c * S, y = Y0 + r * S;
			const tgd = ctx.createLinearGradient(x, y, x, y + S);
			const a = (r + c) % 2 === 0 ? 0.20 : 0.11;
			tgd.addColorStop(0, `rgba(255,255,255,${a + 0.05})`);
			tgd.addColorStop(1, `rgba(255,255,255,${a - 0.04})`);
			ctx.fillStyle = tgd;
			rr(ctx, x + 4, y + 4, S - 8, S - 8, 18);
			ctx.fill();
		}
	}

	ctx.fillStyle = "#fff";
	ctx.font = "bold 26px Arial, sans-serif";
	ctx.textAlign = "center";
	for (let c = 0; c < COLS; c++) ctx.fillText(LETTERS[c], X0 + c * S + S / 2, Y0 - 26);
	for (let r = 0; r < ROWS; r++) ctx.fillText(String(r + 1), 36, Y0 + r * S + S / 2 + 9);

	// footer + watermark (author name comes from config, so changing it breaks the security check)
	ctx.fillStyle = "rgba(20,5,60,0.35)";
	rr(ctx, 60, 910, W - 120, 44, 22);
	ctx.fill();
	txt(ctx, "Reply:  B3 C3  •  B3 right  •  quit", W / 2, 940, 23, "#fff");
	txt(ctx, `© ${author}`, W / 2, 972, 15, "rgba(255,255,255,0.75)");
	return canvas;
}

function pill(ctx, x, y, w, h, label, value) {
	ctx.save();
	ctx.shadowColor = "rgba(30,0,70,0.35)";
	ctx.shadowBlur = 12;
	ctx.shadowOffsetY = 4;
	const g = ctx.createLinearGradient(0, y, 0, y + h);
	g.addColorStop(0, "rgba(255,255,255,0.34)");
	g.addColorStop(1, "rgba(255,255,255,0.12)");
	ctx.fillStyle = g;
	rr(ctx, x, y, w, h, 20);
	ctx.fill();
	ctx.restore();
	ctx.lineWidth = 2;
	ctx.strokeStyle = "rgba(255,255,255,0.5)";
	rr(ctx, x, y, w, h, 20);
	ctx.stroke();
	txt(ctx, label, x + w / 2, y + 25, 17, "rgba(255,255,255,0.85)");
	txt(ctx, String(value), x + w / 2, y + 57, 34, "#fff", "rgba(60,0,100,0.45)");
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

function cellCenter(r, c) {
	return [X0 + c * S + S / 2, Y0 + r * S + S / 2];
}

function easeOutBack(t) {
	const c1 = 1.70158, c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ---------- draw a single frame ----------
function drawScene(ctx, ps, bg, o) {
	ctx.setTransform(ps, 0, 0, ps, 0, 0);
	ctx.clearRect(0, 0, W, H);
	ctx.drawImage(bg, 0, 0, W, H);

	pill(ctx, 40, 108, 200, 76, "SCORE", o.score);
	pill(ctx, 260, 108, 200, 76, "MOVES", o.moves);
	pill(ctx, 480, 108, 200, 76, "TARGET", TARGET_SCORE);

	// progress bar
	const ratio = Math.min(o.score / TARGET_SCORE, 1);
	ctx.fillStyle = "rgba(20,0,60,0.35)";
	rr(ctx, 40, 204, 640, 26, 13);
	ctx.fill();
	if (ratio > 0) {
		const pg = ctx.createLinearGradient(40, 0, 680, 0);
		pg.addColorStop(0, "#ffe259");
		pg.addColorStop(1, "#43e97b");
		ctx.fillStyle = pg;
		rr(ctx, 40, 204, Math.max(26, 640 * ratio), 26, 13);
		ctx.fill();
		ctx.fillStyle = "rgba(255,255,255,0.4)";
		rr(ctx, 48, 208, Math.max(10, 640 * ratio - 16), 6, 3);
		ctx.fill();
	}
	ctx.fillStyle = ratio >= 1 ? "#ffe259" : "rgba(255,255,255,0.55)";
	ctx.save();
	ctx.shadowColor = ratio >= 1 ? "#ffd000" : "transparent";
	ctx.shadowBlur = 14;
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const a = (Math.PI / 5) * i - Math.PI / 2;
		const rad = i % 2 === 0 ? 20 : 9;
		const x = 680 + Math.cos(a) * rad, y = 217 + Math.sin(a) * rad;
		i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	const popSet = o.pop ? new Set(o.pop.cells.map(([r, c]) => `${r},${c}`)) : null;
	const swapKeys = o.swap ? new Set([`${o.swap.r1},${o.swap.c1}`, `${o.swap.r2},${o.swap.c2}`]) : null;

	if (o.highlight) {
		for (const [r, c] of o.highlight) {
			const x = X0 + c * S, y = Y0 + r * S;
			ctx.save();
			ctx.shadowColor = "#fff";
			ctx.shadowBlur = 22;
			ctx.lineWidth = 4;
			ctx.strokeStyle = "rgba(255,255,255,0.95)";
			rr(ctx, x + 5, y + 5, S - 10, S - 10, 18);
			ctx.stroke();
			ctx.restore();
		}
	}

	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const key = `${r},${c}`;
			if (swapKeys && swapKeys.has(key)) continue;
			const [cx, cy] = cellCenter(r, c);
			const type = o.board[r][c];
			if (popSet && popSet.has(key)) {
				const p = o.pop.p;
				const sc = p < 0.3 ? 1 + (p / 0.3) * 0.25 : 1.25 * (1 - (p - 0.3) / 0.7);
				drawCandy(ctx, type, cx, cy, R * Math.max(sc, 0.01), 1 - Math.max(0, (p - 0.55) / 0.45));
			} else if (o.appear && o.appear.cells.has(key)) {
				const e = easeOutBack(o.appear.p);
				drawCandy(ctx, type, cx, cy - (1 - Math.min(e, 1)) * 70, R * Math.max(Math.min(e, 1.05), 0.01), Math.min(1, o.appear.p * 2));
			} else {
				drawCandy(ctx, type, cx, cy, R, 1);
			}
		}
	}

	if (o.swap) {
		const { r1, c1, r2, c2, t } = o.swap;
		const [ax, ay] = cellCenter(r1, c1);
		const [bx, by] = cellCenter(r2, c2);
		const e = t * t * (3 - 2 * t);
		drawCandy(ctx, o.board[r1][c1], ax + (bx - ax) * e, ay + (by - ay) * e, R * 1.05, 1);
		drawCandy(ctx, o.board[r2][c2], bx + (ax - bx) * e, by + (ay - by) * e, R * 1.05, 1);
	}

	if (o.pop) {
		const p = o.pop.p;
		let sr = 0, sc2 = 0;
		for (const [r, c] of o.pop.cells) {
			const [cx, cy] = cellCenter(r, c);
			const type = o.board[r][c];
			sr += r; sc2 += c;
			ctx.save();
			ctx.globalAlpha = 1 - p;
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 4 * (1 - p) + 1;
			ctx.beginPath(); ctx.arc(cx, cy, 20 + p * 42, 0, Math.PI * 2); ctx.stroke();
			ctx.fillStyle = COLORS[type][0];
			for (let i = 0; i < 8; i++) {
				const a = (Math.PI / 4) * i + (r + c) * 0.7;
				const d = 12 + p * 58;
				ctx.beginPath();
				ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(0.1, (1 - p) * 7), 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.fillStyle = "#fff";
			spark(ctx, cx, cy, (1 - p) * 26);
			ctx.fill();
			ctx.restore();
		}
		const n = o.pop.cells.length;
		ctx.save();
		ctx.globalAlpha = 1 - p * 0.35;
		txt(ctx, `+${o.pop.gain}`, X0 + (sc2 / n) * S + S / 2, Y0 + (sr / n) * S + S / 2 - p * 45, 46, "#ffe259", "#6a1b00");
		ctx.restore();
		if (o.pop.combo >= 2) {
			const e = Math.min(1, p * 2.2);
			ctx.save();
			ctx.translate(W / 2, Y0 + (ROWS * S) / 2);
			const k = 0.6 + 0.4 * easeOutBack(e);
			ctx.scale(k, k);
			ctx.rotate(-0.06);
			txt(ctx, `COMBO x${o.pop.combo}!`, 0, 0, 78, "#fff36b", "#c2185b");
			ctx.restore();
		}
	}

	if (o.banner) {
		ctx.save();
		ctx.fillStyle = "rgba(20,0,60,0.55)";
		rr(ctx, X0 - 14, Y0 + 230, COLS * S + 28, 140, 24);
		ctx.fill();
		txt(ctx, o.banner, W / 2, Y0 + 318, 52, "#fff36b", "#c2185b");
		ctx.restore();
	}

	if (o.status) {
		ctx.fillStyle = "rgba(15,0,45,0.7)";
		rr(ctx, X0 - 14, Y0 - 14, COLS * S + 28, ROWS * S + 28, 28);
		ctx.fill();
		const f = o.confettiF || 0;
		const mx = W / 2;
		if (o.status === "win") {
			ctx.save();
			ctx.translate(mx, Y0 + 140);
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
			const jp = !!o.jackpot;
			drawTrophy(ctx, mx, Y0 + 120 + Math.sin(f * 0.5) * 6, 1.05);
			const pulse = 1 + Math.sin(f * 0.7) * 0.05;
			ctx.save();
			ctx.translate(mx, Y0 + 280);
			ctx.scale(pulse, pulse);
			txt(ctx, "YOU WIN!", 0, 0, 88, "#ffe259", "#8a3b00");
			ctx.restore();
			let ty = Y0 + 345;
			if (jp) {
				const jp2 = 1 + Math.sin(f * 1.1) * 0.08;
				ctx.save();
				ctx.translate(mx, ty + 18);
				ctx.scale(jp2, jp2);
				txt(ctx, "JACKPOT!", 0, 0, 62, f % 2 ? "#ff4fd8" : "#fff36b", "#4a0a5a");
				ctx.restore();
				ty += 62;
			}
			txt(ctx, `Score: ${o.score}  |  Moves used: ${o.movesUsed}`, mx, ty + 12, 30, "#fff", "rgba(40,0,80,0.6)");
			if (o.reward) txt(ctx, `+${fmt(o.reward)} COINS`, mx, ty + 66, 46, "#7dffb0", "rgba(0,60,20,0.7)");
			// dancing animals
			for (let i = 0; i < TYPES; i++) {
				const px = X0 + i * S + S / 2, py = Y0 + 552;
				drawCandy(ctx, i, px, py - Math.abs(Math.sin(f * 0.6 + i * 0.9)) * 24, 32, 1);
			}
		} else {
			txt(ctx, "GAME OVER", mx, Y0 + 250, 92, "#ff7b93", "#5a0020");
			txt(ctx, `Final Score: ${o.score}`, mx, Y0 + 330, 40, "#fff", "rgba(40,0,80,0.6)");
			txt(ctx, `Target was ${TARGET_SCORE}`, mx, Y0 + 385, 28, "rgba(255,255,255,0.8)");
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

// ---------- animation frame list ----------
function moveFrames(state, d, ps, bg) {
	const frames = [];
	const mk = (o, delay) => frames.push({ delay, draw: ctx => drawScene(ctx, ps, bg, o) });
	let score = d.scoreBefore;
	const moves = state.moves;
	const { r1, c1, r2, c2 } = d.mv;

	for (const t of [0.3, 0.65, 1]) mk({ board: d.startBoard, score, moves, swap: { r1, c1, r2, c2, t } }, 45);

	let lastAfter = null;
	for (const st of d.steps) {
		mk({ board: st.before, score, moves, highlight: st.cells }, 130);
		for (const p of [0.2, 0.4, 0.6, 0.8, 1]) {
			mk({ board: st.before, score, moves, pop: { cells: st.cells, p, gain: st.gain, combo: st.combo } }, 50);
		}
		score += st.gain;
		for (const p of [0.35, 0.7, 1]) {
			mk({ board: st.after, score, moves, appear: { cells: st.changed, p } }, 55);
		}
		lastAfter = st.after;
	}
	if (d.shuffled && lastAfter) mk({ board: lastAfter, score, moves, banner: "NO MOVES - SHUFFLE!" }, 900);
	mk({ board: state.board, score: state.score, moves }, 3000);
	return frames;
}

function winFrames(state, d, ps, bg) {
	const frames = [];
	for (let f = 0; f < 24; f++) {
		frames.push({
			delay: 70,
			draw: ctx => drawScene(ctx, ps, bg, {
				board: state.board, score: state.score, moves: state.moves, status: "win", reward: d.reward,
				jackpot: d.jackpot, movesUsed: d.movesUsed, confettiF: f
			})
		});
	}
	return frames;
}

async function encodeGif(file, ps, frames, onProgress) {
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
	for (let i = 0; i < frames.length; i++) {
		frames[i].draw(ctx);
		enc.setDelay(frames[i].delay);
		enc.addFrame(ctx);
		if (onProgress) { try { onProgress((i + 1) / frames.length); } catch (e) { /* ignore */ } }
		await new Promise(r => setImmediate(r));
	}
	enc.finish();
	await done;
}

// mode: "static" | "move" | "win"
async function renderMedia(state, mode, d, onProgress) {
	_guard();
	d = d || {};
	const author = _authorName();
	const dir = path.join(__dirname, "cache");
	await fs.ensureDir(dir);
	const base = path.join(dir, `candy_${state.author}_${Date.now()}`);

	if (ANIMATION && GIFEncoder && (mode === "move" || mode === "win")) {
		try {
			const ps = GIF_SCALE;
			const bg = makeBackground(ps, author);
			const frames = mode === "move" ? moveFrames(state, d, ps, bg) : winFrames(state, d, ps, bg);
			const file = base + ".gif";
			await encodeGif(file, ps, frames, onProgress);
			return file;
		} catch (e) {
			console.error("[candycrush] GIF error, falling back to PNG:", e.message);
		}
	}

	const ps = PNG_SCALE;
	const bg = makeBackground(ps, author);
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	drawScene(ctx, ps, bg, {
		board: state.board,
		score: state.score,
		moves: state.moves,
		status: d.status,
		reward: d.reward,
		jackpot: d.jackpot,
		movesUsed: d.movesUsed,
		confettiF: d.status === "win" ? 3 : undefined
	});
	const file = base + ".png";
	await fs.writeFile(file, canvas.toBuffer("image/png"));
	return file;
}

// ============================== SEND / EDIT HELPERS ==============================
function sendMedia(message, state, body, file, keepGame, prevID) {
	_guard();
	return new Promise(resolve => {
		message.reply({ body, attachment: fs.createReadStream(file) }, (err, info) => {
			fs.remove(file).catch(() => { });
			if (err || !info) return resolve(null);
			if (keepGame) {
				global.GoatBot.onReply.set(info.messageID, {
					commandName: "candycrush",
					messageID: info.messageID,
					author: state.author,
					board: state.board,
					score: state.score,
					moves: state.moves
				});
			}
			// unsend the old board so it looks like the board was edited
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
				console.log("[candycrush] editMessage failed:", e && e.message ? e.message : e);
				return false;
			}
			await sleep(300);
		}
	}
	return false;
}

// edits a loading message while the animation renders
function makeProgress(api, info) {
	let busy = false, last = -1;
	return pct => {
		if (!info) return;
		const step = Math.floor(pct * 4);
		if (step <= last || busy) return;
		last = step;
		busy = true;
		const f = Math.round(pct * 10);
		safeEdit(api, info.messageID, `🐾 Crushing animals...\n${"█".repeat(f)}${"░".repeat(10 - f)} ${f * 10}%`, 1)
			.then(() => { busy = false; });
	};
}

// add coins to the balance and verify by reading the database again
async function addMoney(usersData, uid, amount) {
	_guard();
	const readMoney = async () => {
		const ud = await usersData.get(uid);
		return Number(ud && ud.money) || 0;
	};
	const before = await readMoney();
	const target = before + amount;
	await usersData.set(uid, { money: target });
	let after = await readMoney();
	if (after !== target) {
		try { await usersData.set(uid, target, "money"); } catch (e) { /* ignore */ }
		after = await readMoney();
	}
	return { before, after };
}

async function saveBest(usersData, uid, score) {
	const ud = await usersData.get(uid);
	const data = (ud && ud.data) || {};
	const best = Number(data.candycrushBest) || 0;
	if (score > best) {
		data.candycrushBest = score;
		await usersData.set(uid, { data });
		return true;
	}
	return false;
}

// Counts the reward up by editing a single message, then shows the real new balance
async function rewardAnimation(api, threadID, replyTo, before, after, info) {
	_guard();
	const { reward, jackpotBonus, movesUsed } = info;
	const tier = tierFor(after);
	const lines = [
		"💰 ❀°• 𝑹𝒆𝒘𝒂𝒓𝒅 𝑨𝒅𝒅𝒆𝒅 •°❀ 💰",
		"♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡",
		"",
		"██████████ 100%",
		"",
		`🏆 Win Reward: +${shortMoney(WIN_REWARD)}`
	];
	if (jackpotBonus > 0) lines.push(`🎰 Jackpot Bonus: +${shortMoney(jackpotBonus)} (won in ${movesUsed} moves!)`);
	lines.push(
		`🪙 Total: +${fmt(reward)}`,
		`💳 New Balance: ${shortMoney(after)} (${fmt(after)})`,
		`${tierEmoji(tier)} Tier: ${tier}`,
		"",
		"♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡",
		"✨ 𝒄𝒐𝒏𝒈𝒓𝒂𝒕𝒖𝒍𝒂𝒕𝒊𝒐𝒏𝒔 & 𝒌𝒆𝒆𝒑 𝒑𝒍𝒂𝒚𝒊𝒏𝒈~ ✨"
	);
	const finalText = lines.join("\n");

	const msg = await sendInfo(api, threadID, "💰 Calculating your reward...\n░░░░░░░░░░ 0%", replyTo);
	if (!msg) {
		await sendInfo(api, threadID, finalText, replyTo);
		return;
	}

	let fails = 0;
	for (let i = 1; i < COUNT_STEPS; i++) {
		await sleep(COUNT_DELAY);
		const filled = Math.round((i / COUNT_STEPS) * 10);
		const cur = Math.round((reward * i) / COUNT_STEPS);
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

// ============================== COMMAND ==============================
module.exports = {
	config: {
		name: "candycrush",
		aliases: ["candy", "cc"],
		version: "4.0",
		author: "ROCKY CHOWDHURY",
		countDown: 5,
		role: 0,
		description: {
			en: "Animal Candy Crush - HD animated board, win coins and a fast-win jackpot"
		},
		category: "game",
		guide: {
			en: "{pn}: start a new game\n{pn} help: show the rules\n\nReply to the board with: B3 C3 (swap) / B3 right / quit"
		}
	},

	onStart: async function ({ message, event, args }) {
		if (!_authOK()) return message.reply(TAMPER_MSG);
		const uid = event.senderID;

		if (args[0] === "help" || args[0] === "rules") {
			return message.reply(
				"🐾 ANIMAL CANDY CRUSH 🐾\n\n" +
				"• Match 3 or more of the same animal to crush them\n" +
				"• Reply to the bot's photo with: B3 C3 (swap two neighboring animals)\n" +
				"• Or use a direction: B3 right / B3 left / B3 up / B3 down\n" +
				"• Columns = A-F, Rows = 1-6\n" +
				`• Reach ${TARGET_SCORE} points within ${MAX_MOVES} moves to WIN instantly 🏆\n` +
				"• Chain reactions (combos) give extra points 🔥\n" +
				`• Win and get +${fmt(WIN_REWARD)} coins added to your balance 💰\n` +
				`• JACKPOT 🎰: win in ${JACKPOT_MAX_MOVES} moves or fewer for an extra +${fmt(JACKPOT_BONUS)} coins!\n` +
				"• Reply with: quit to end the game\n\n" +
				`👑 Author: ${_authorName()}`
			);
		}

		try {
			const state = { author: uid, board: createBoard(), score: 0, moves: MAX_MOVES };
			const file = await renderMedia(state, "static");
			return await sendMedia(
				message,
				state,
				`🐾 Animal Candy Crush started! 🐾\n🎯 Target: ${TARGET_SCORE} | 🕹 Moves: ${MAX_MOVES}\n🎰 Win in ${JACKPOT_MAX_MOVES} moves or fewer to hit the JACKPOT!\n\nReply to this photo with: B3 C3`,
				file,
				true,
				null
			);
		} catch (e) {
			if (e.message === "AUTHOR_TAMPERED") return message.reply(TAMPER_MSG);
			console.error("[candycrush] start error:", e);
			return message.reply("⚠️ Error: " + e.message);
		}
	},

	onReply: async function ({ api, message, event, Reply, usersData }) {
		if (!_authOK()) return message.reply(TAMPER_MSG);
		const uid = event.senderID;
		if (uid !== Reply.author) return;

		const input = (event.body || "").trim().toLowerCase();
		const state = { author: Reply.author, board: Reply.board, score: Reply.score, moves: Reply.moves };
		let loading = null;

		try {
			if (["quit", "exit", "stop", "end"].includes(input)) {
				const file = await renderMedia(state, "static", { status: "lose" });
				return await sendMedia(message, state, `🛑 You quit the game. Final score: ${state.score}`, file, false, Reply.messageID);
			}

			const mv = parseMove(input);
			if (!mv) return message.reply("❌ Invalid format!\nExample: B3 C3 or B3 right\n(Columns A-F, Rows 1-6)");

			const { r1, c1, r2, c2 } = mv;
			const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
			if (!inside(r1, c1) || !inside(r2, c2)) return message.reply("❌ That move goes outside the board!");
			if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return message.reply("❌ You can only swap neighboring animals!");

			const startBoard = copyBoard(state.board);
			swap(state.board, r1, c1, r2, c2);
			if (findMatches(state.board).size === 0) {
				swap(state.board, r1, c1, r2, c2);
				return message.reply("🙅 That swap makes no match, try another move. (No move was used)");
			}

			const scoreBefore = state.score;
			state.moves--;
			const res = resolveBoard(state.board);
			state.score += res.total;

			let note = `✅ ${LETTERS[c1]}${r1 + 1} ↔ ${LETTERS[c2]}${r2 + 1}\n💥 ${res.cleared} animals crushed | +${res.total} points`;
			if (res.combo > 1) note += ` | 🔥 Combo x${res.combo}`;

			const won = state.score >= TARGET_SCORE;
			const lost = !won && state.moves <= 0;

			// ---------------- WIN ----------------
			if (won) {
				const movesUsed = MAX_MOVES - state.moves;
				const jackpot = movesUsed <= JACKPOT_MAX_MOVES;
				const jackpotBonus = jackpot ? JACKPOT_BONUS : 0;
				const reward = WIN_REWARD + jackpotBonus;

				// 1) add the coins first (saved to the database and verified)
				const { before, after } = await addMoney(usersData, uid, reward);
				const isBest = await saveBest(usersData, uid, state.score).catch(() => false);

				let end =
					`${note}\n\n🎉 CONGRATULATIONS! 🎉\n` +
					`You won Animal Candy Crush in ${movesUsed} moves with ${fmt(state.score)} points!\n` +
					`💰 Win reward: +${fmt(WIN_REWARD)} coins`;
				if (jackpot) end += `\n🎰 JACKPOT! Fast-win bonus: +${fmt(JACKPOT_BONUS)} coins!`;
				if (isBest) end += `\n🏅 New best score: ${fmt(state.score)}`;

				const file = await renderMedia(state, "win", { status: "win", reward, jackpot, movesUsed });
				await sendMedia(message, state, end, file, false, Reply.messageID);

				// 2) edited message counts the coins up and shows the new balance
				rewardAnimation(api, event.threadID, event.messageID, before, after, { reward, jackpotBonus, movesUsed })
					.catch(e => console.error("[candycrush] reward animation:", e.message));
				return;
			}

			// ---------------- LOSE ----------------
			if (lost) {
				const isBest = await saveBest(usersData, uid, state.score).catch(() => false);
				let end = `${note}\n\n😢 Out of moves! You scored ${state.score}/${TARGET_SCORE}.\nBetter luck next time! Type: candycrush`;
				if (isBest) end += `\n🏅 New best score: ${fmt(state.score)}`;
				const file = await renderMedia(state, "static", { status: "lose" });
				return await sendMedia(message, state, end, file, false, Reply.messageID);
			}

			// ---------------- GAME CONTINUES ----------------
			let shuffled = false;
			if (!hasMove(state.board)) {
				state.board = createBoard();
				shuffled = true;
				note += "\n🔀 No moves were left, the board was shuffled!";
			}
			note += `\n\n🎯 ${state.score}/${TARGET_SCORE} | 🕹 Moves left: ${state.moves}`;

			if (LOADING_EDIT) loading = await sendInfo(api, event.threadID, "🐾 Crushing animals...\n░░░░░░░░░░ 0%", event.messageID);
			const progress = makeProgress(api, loading);

			const file = await renderMedia(state, "move", { startBoard, mv, steps: res.steps, scoreBefore, shuffled }, progress);
			const sent = await sendMedia(message, state, note, file, true, Reply.messageID);
			if (loading) Promise.resolve(message.unsend(loading.messageID)).catch(() => { });
			return sent;
		} catch (e) {
			if (loading) Promise.resolve(message.unsend(loading.messageID)).catch(() => { });
			if (e.message === "AUTHOR_TAMPERED") return message.reply(TAMPER_MSG);
			console.error("[candycrush] reply error:", e);
			return message.reply("⚠️ Error: " + e.message);
		}
	}
};
