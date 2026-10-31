const { createCanvas } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

// ================= AUTHOR PROTECTION (multi-layer: command stops working if the author is changed) =================
const _sha = (s, a) => crypto.createHash(a || "sha256").update(String(s)).digest("hex");
const _A1 = "d8ede70b56bfd05498652fe5b39e008a2b8811f0c32a2b0cea9cb080f4b76ca5";
const _A2 = "b069e5ac34800ce56059b5e58a20b16e5eb03f47e4dc9804ea0b60e6447a6d70";
const _A3 = "7fff15848b397c10572849cf2f9327c0466ee617c5f164fa4bce01d83a12c7094b24dba46c489c3c07ea2b7a67f7c44e84f65e5d1ed7c956954c11ff75b03346";
const _A4 = "ebb3065a52e59be44566250a57241082c62c9cae522cd1e9767a5f348a446949";
const _S = "45c594d4650df53a391ef873fab7dcc6496a7d30778edcd42b7d657c27df3a97";
function _norm(f) {
	return String(f).replace(/\s+/g, "");
}
function _authorName() {
	try { return String(module.exports.config.author); } catch (e) { return ""; }
}
function _selfOK() {
	try {
		return _sha(_norm(_authOK) + _norm(_guard) + _norm(_authorName) + _norm(_selfOK) + _norm(_norm)) === _S;
	} catch (e) {
		return false;
	}
}
function _authOK() {
	try {
		const a = _authorName();
		return typeof a === "string" &&
			_sha(a) === _A1 &&
			_sha(a.split("").reverse().join("")) === _A2 &&
			_sha("cm|" + a + "|rocky", "sha512") === _A3 &&
			_sha(a.length + "#" + a.toLowerCase()) === _A4 &&
			_selfOK();
	} catch (e) {
		return false;
	}
}
function _guard() {
	if (!_authOK()) throw new Error("AUTHOR_TAMPERED");
}
const TAMPER_MSG = "🔒 ❀°• 𝑳𝒐𝒄𝒌𝒆𝒅 •°❀ 🔒\n♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡\n⚠️ The author name of this command was changed!\n💖 Restore the original author or the command will not work.";
// ====================================================================================================================

// ============================ SETTINGS (edit freely) ============================
const TILES = 25;                 // 5x5 board
const COLS = 5;
const DEFAULT_BOMBS = 3;          // default number of mines
const MIN_BOMBS = 1;
const MAX_BOMBS = 20;
const MIN_BET = 100;
const MAX_BET = 10000000;         // 10M
const HOUSE_EDGE = 0.04;          // 4% edge on the multiplier
const GOLD_BONUS = 1.25;          // hidden golden gem = payout x1.25
const MAX_PAYOUT = 1000000000;    // safety cap
const FREE_BASE = 1000;           // free play: reward = FREE_BASE * (multiplier - 1)
const MAX_PICKS_PER_REPLY = 5;
const EXPIRE_MS = 120000;         // idle this long = auto cash out (or refund if nothing found)
const PNG_SCALE = 3;              // image quality (3 = 2160 x 3000 HD)
// ================================================================================

const W = 720, H = 1000;
const TS = 112, GAP = 10, GX = 60, GY = 250;
const games = new Map(); // userID -> active game
const LINE = "♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡";
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ============================== HELPERS ==============================
const fmt = n => Number(n).toLocaleString("en-US");
const rint = n => (crypto.randomInt ? crypto.randomInt(n) : Math.floor(Math.random() * n));

function shortMoney(n) {
	const suf = ["", "K", "M", "B", "T"];
	let num = Number(n) || 0, i = 0;
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
function parseAmount(str) {
	const m = String(str || "").toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)([kmb]?)$/);
	if (!m) return null;
	return Math.floor(parseFloat(m[1]) * { "": 1, k: 1e3, m: 1e6, b: 1e9 }[m[2]]);
}

// multiplier after `gems` safe tiles with `bombs` mines (fair odds minus house edge)
function multiplier(bombs, gems) {
	if (gems <= 0) return 1;
	let m = 1;
	for (let i = 0; i < gems; i++) m *= (TILES - i) / (TILES - bombs - i);
	return m * (1 - HOUSE_EDGE);
}
function payoutOf(game) {
	const gems = game.revealed.size;
	const mult = multiplier(game.bombs, gems) * (game.goldFound ? GOLD_BONUS : 1);
	let amount;
	if (game.bet > 0) amount = Math.min(Math.floor(game.bet * mult), MAX_PAYOUT);
	else amount = gems > 0 ? Math.max(0, Math.floor(FREE_BASE * (mult - 1))) : 0;
	return { mult, amount };
}
function nextMult(game) {
	const safe = TILES - game.bombs;
	if (game.revealed.size >= safe) return null;
	return multiplier(game.bombs, game.revealed.size + 1) * (game.goldFound ? GOLD_BONUS : 1);
}

// ============================== MONEY / STATS ==============================
async function readMoney(usersData, uid) {
	const ud = await usersData.get(uid);
	return Number(ud && ud.money) || 0;
}
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
	const s = (ud && ud.data && ud.data.crystalmines) || {};
	return { w: s.w || 0, l: s.l || 0, gems: s.gems || 0, golds: s.golds || 0, bestMult: s.bestMult || 0, bestWin: s.bestWin || 0 };
}
async function saveStats(usersData, uid, stats) {
	const ud = await usersData.get(uid);
	const data = (ud && ud.data) || {};
	data.crystalmines = stats;
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

// gem icon, unit space (radius ~1): brilliant-cut look with facets, glow and sparkles
function drawGem(ctx, cx, cy, u, gold) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.scale(u, u);
	ctx.lineJoin = "round";
	const pal = gold
		? { a: "#fff2a0", b: "#ffc400", c: "#a86a00", glow: "255,200,40" }
		: { a: "#e6fdff", b: "#2fd0f5", c: "#0a6aa8", glow: "64,224,255" };
	const gl = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1.7);
	gl.addColorStop(0, `rgba(${pal.glow},0.45)`); gl.addColorStop(1, `rgba(${pal.glow},0)`);
	ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 1.7, 0, Math.PI * 2); ctx.fill();

	const L = [-0.98, -0.18], R = [0.98, -0.18], TL = [-0.55, -0.72], TR = [0.55, -0.72], B = [0, 0.96];
	const ML = [-0.32, -0.18], MR = [0.32, -0.18];
	const poly = (pts, fill) => {
		ctx.beginPath();
		pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
		ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
	};
	const g = ctx.createLinearGradient(-0.9, -0.7, 0.9, 0.95);
	g.addColorStop(0, pal.a); g.addColorStop(0.5, pal.b); g.addColorStop(1, pal.c);
	poly([L, TL, TR, R, B], g);
	poly([TL, TR, MR, ML], "rgba(255,255,255,0.42)");
	poly([L, TL, ML], "rgba(255,255,255,0.20)");
	poly([TR, R, MR], "rgba(0,0,40,0.12)");
	poly([L, ML, B], "rgba(255,255,255,0.06)");
	poly([ML, MR, B], "rgba(255,255,255,0.16)");
	poly([MR, R, B], "rgba(0,0,40,0.26)");

	ctx.lineWidth = 0.045; ctx.strokeStyle = "rgba(255,255,255,0.7)";
	ctx.beginPath();
	ctx.moveTo(L[0], L[1]); ctx.lineTo(R[0], R[1]);
	ctx.moveTo(TL[0], TL[1]); ctx.lineTo(ML[0], ML[1]); ctx.lineTo(B[0], B[1]);
	ctx.moveTo(TR[0], TR[1]); ctx.lineTo(MR[0], MR[1]); ctx.lineTo(B[0], B[1]);
	ctx.moveTo(L[0], L[1]); ctx.lineTo(ML[0], ML[1]);
	ctx.moveTo(R[0], R[1]); ctx.lineTo(MR[0], MR[1]);
	ctx.stroke();
	ctx.lineWidth = 0.07; ctx.strokeStyle = "rgba(255,255,255,0.92)";
	ctx.beginPath();
	[L, TL, TR, R, B].forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
	ctx.closePath(); ctx.stroke();

	ctx.fillStyle = "#fff";
	spark(ctx, 0.42, -0.5, 0.26); ctx.fill();
	spark(ctx, -0.52, -0.38, 0.13); ctx.fill();
	ctx.restore();
}

function drawBomb(ctx, cx, cy, u) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.scale(u, u);
	ctx.lineCap = "round";
	// danger glow
	const dg = ctx.createRadialGradient(0, 0.1, 0.2, 0, 0.1, 1.6);
	dg.addColorStop(0, "rgba(255,60,60,0.35)"); dg.addColorStop(1, "rgba(255,60,60,0)");
	ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0.1, 1.6, 0, Math.PI * 2); ctx.fill();
	// fuse rope
	ctx.strokeStyle = "#7a5a30"; ctx.lineWidth = 0.15;
	ctx.beginPath(); ctx.moveTo(0.3, -0.6); ctx.quadraticCurveTo(0.55, -0.95, 0.85, -0.78); ctx.stroke();
	ctx.strokeStyle = "#d8b27a"; ctx.lineWidth = 0.08; ctx.stroke();
	// fuse flare
	const fg = ctx.createRadialGradient(0.9, -0.8, 0, 0.9, -0.8, 0.45);
	fg.addColorStop(0, "rgba(255,255,200,1)"); fg.addColorStop(0.4, "rgba(255,180,40,0.9)"); fg.addColorStop(1, "rgba(255,80,20,0)");
	ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0.9, -0.8, 0.45, 0, Math.PI * 2); ctx.fill();
	ctx.fillStyle = "#fff"; spark(ctx, 0.9, -0.8, 0.3); ctx.fill();
	// metal sphere
	const g = ctx.createRadialGradient(-0.28, -0.2, 0.05, 0, 0.12, 0.88);
	g.addColorStop(0, "#8a90ab"); g.addColorStop(0.45, "#2a2e42"); g.addColorStop(1, "#080a14");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.arc(0, 0.12, 0.72, 0, Math.PI * 2); ctx.fill();
	ctx.lineWidth = 0.05; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.stroke();
	// cool rim light
	ctx.lineWidth = 0.06; ctx.strokeStyle = "rgba(120,200,255,0.5)";
	ctx.beginPath(); ctx.arc(0, 0.12, 0.68, 0.2, 1.2); ctx.stroke();
	// cap
	const cg = ctx.createLinearGradient(-0.22, 0, 0.22, 0);
	cg.addColorStop(0, "#4a4f66"); cg.addColorStop(0.5, "#9aa1bd"); cg.addColorStop(1, "#3c4056");
	ctx.fillStyle = cg; ctx.fillRect(-0.22, -0.74, 0.44, 0.22);
	ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.22, -0.74, 0.44, 0.22);
	// specular highlights
	ctx.fillStyle = "rgba(255,255,255,0.75)";
	ctx.beginPath(); ctx.ellipse(-0.3, -0.18, 0.17, 0.09, -0.6, 0, Math.PI * 2); ctx.fill();
	ctx.fillStyle = "rgba(255,255,255,0.35)";
	ctx.beginPath(); ctx.arc(0.28, 0.45, 0.07, 0, Math.PI * 2); ctx.fill();
	ctx.restore();
}

function tilePos(i) {
	return { x: GX + (i % COLS) * (TS + GAP), y: GY + Math.floor(i / COLS) * (TS + GAP) };
}

function shard(ctx, x, y, w, h, ang, alpha) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(ang);
	const g = ctx.createLinearGradient(0, 0, 0, -h);
	g.addColorStop(0, `rgba(64,224,255,${alpha})`); g.addColorStop(1, `rgba(200,250,255,${alpha * 0.25})`);
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.32, -h * 0.72); ctx.lineTo(0, -h); ctx.lineTo(w * 0.32, -h * 0.72); ctx.lineTo(w / 2, 0);
	ctx.closePath(); ctx.fill();
	ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(220,252,255,${alpha * 1.4})`; ctx.stroke();
	ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
	ctx.beginPath(); ctx.moveTo(-w * 0.1, 0); ctx.lineTo(0, -h); ctx.lineTo(-w * 0.32, -h * 0.72); ctx.closePath(); ctx.fill();
	ctx.restore();
}

function makeBackground(ps, author) {
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	ctx.scale(ps, ps);
	const rnd = mulberry32(2024);

	// deep crystal cave
	const bg = ctx.createLinearGradient(0, 0, 0, H);
	bg.addColorStop(0, "#050818"); bg.addColorStop(0.4, "#1b1060"); bg.addColorStop(0.75, "#1a1a78"); bg.addColorStop(1, "#08455f");
	ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
	const l1 = ctx.createRadialGradient(80, 220, 0, 80, 220, 460);
	l1.addColorStop(0, "rgba(255,90,200,0.32)"); l1.addColorStop(1, "rgba(255,90,200,0)");
	ctx.fillStyle = l1; ctx.fillRect(0, 0, W, H);
	const l2 = ctx.createRadialGradient(660, 820, 0, 660, 820, 460);
	l2.addColorStop(0, "rgba(64,224,255,0.34)"); l2.addColorStop(1, "rgba(64,224,255,0)");
	ctx.fillStyle = l2; ctx.fillRect(0, 0, W, H);

	// light rays from the cave roof
	ctx.save();
	ctx.translate(W / 2, -40);
	for (let i = -3; i <= 3; i++) {
		ctx.save(); ctx.rotate(i * 0.17);
		const rg = ctx.createLinearGradient(0, 0, 0, 760);
		rg.addColorStop(0, "rgba(170,235,255,0.13)"); rg.addColorStop(1, "rgba(170,235,255,0)");
		ctx.fillStyle = rg;
		ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(70, 760); ctx.lineTo(-70, 760); ctx.closePath(); ctx.fill();
		ctx.restore();
	}
	ctx.restore();

	// faint floating gems
	ctx.globalAlpha = 0.09;
	for (let i = 0; i < 14; i++) drawGem(ctx, rnd() * W, rnd() * H, 20 + rnd() * 26, i % 5 === 0);
	ctx.globalAlpha = 1;

	// crystal clusters in the corners
	for (let i = 0; i < 7; i++) shard(ctx, 10 + i * 22, H + 6, 40 + rnd() * 24, 120 + rnd() * 150, -0.5 + i * 0.12 + rnd() * 0.1, 0.30);
	for (let i = 0; i < 7; i++) shard(ctx, W - 10 - i * 22, H + 6, 40 + rnd() * 24, 120 + rnd() * 150, 0.5 - i * 0.12 - rnd() * 0.1, 0.30);
	for (let i = 0; i < 5; i++) shard(ctx, 14 + i * 26, -6, 34 + rnd() * 20, 70 + rnd() * 90, Math.PI + 0.35 - i * 0.14, 0.22);
	for (let i = 0; i < 5; i++) shard(ctx, W - 14 - i * 26, -6, 34 + rnd() * 20, 70 + rnd() * 90, Math.PI - 0.35 + i * 0.14, 0.22);

	// glowing dust
	for (let i = 0; i < 70; i++) {
		const sx = rnd() * W, sy = rnd() * H, sr = 1 + rnd() * 3, al = 0.25 + rnd() * 0.6;
		if (rnd() > 0.7) {
			const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
			sg.addColorStop(0, `rgba(190,245,255,${al})`); sg.addColorStop(1, "rgba(190,245,255,0)");
			ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr * 5, 0, Math.PI * 2); ctx.fill();
		}
		ctx.fillStyle = `rgba(255,255,255,${al})`; spark(ctx, sx, sy, sr * 1.7); ctx.fill();
	}

	// vignette
	const vg = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 780);
	vg.addColorStop(0, "rgba(0,0,20,0)"); vg.addColorStop(1, "rgba(0,0,20,0.55)");
	ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

	// title with glow
	ctx.save();
	ctx.shadowColor = "rgba(100,230,255,0.85)"; ctx.shadowBlur = 28;
	const tg = ctx.createLinearGradient(0, 28, 0, 82);
	tg.addColorStop(0, "#ffffff"); tg.addColorStop(0.6, "#bff4ff"); tg.addColorStop(1, "#5fd4f5");
	txt(ctx, "CRYSTAL MINES", W / 2, 68, 58, tg, "#0a0a4a");
	ctx.restore();
	txt(ctx, "F I N D   G E M S   •   A V O I D   M I N E S", W / 2, 100, 15, "rgba(255,255,255,0.92)");
	drawGem(ctx, 56, 52, 26, false);
	drawGem(ctx, W - 56, 52, 26, true);

	// glass board frame
	const FW = 5 * TS + 4 * GAP + 44;
	const fgl = ctx.createLinearGradient(0, GY - 22, 0, GY - 22 + FW);
	fgl.addColorStop(0, "rgba(20,12,80,0.70)"); fgl.addColorStop(1, "rgba(6,4,40,0.62)");
	ctx.fillStyle = fgl; rr(ctx, GX - 22, GY - 22, FW, FW, 30); ctx.fill();
	const hlg = ctx.createLinearGradient(0, GY - 22, 0, GY + 60);
	hlg.addColorStop(0, "rgba(255,255,255,0.16)"); hlg.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = hlg; rr(ctx, GX - 18, GY - 18, FW - 8, 80, 26); ctx.fill();
	ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(143,240,255,0.65)"; rr(ctx, GX - 22, GY - 22, FW, FW, 30); ctx.stroke();
	ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(255,255,255,0.28)"; rr(ctx, GX - 15, GY - 15, FW - 14, FW - 14, 24); ctx.stroke();
	for (const [sx, sy] of [[GX - 22, GY - 22], [GX - 22 + FW, GY - 22], [GX - 22, GY - 22 + FW], [GX - 22 + FW, GY - 22 + FW]]) {
		const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
		sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.4, "#6ff0ff"); sg.addColorStop(1, "rgba(111,240,255,0)");
		ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
	}

	txt(ctx, `© ${author}`, W / 2, 992, 13, "rgba(255,255,255,0.8)");
	return canvas;
}

function pill(ctx, x, y, w, h, label, value, vcolor) {
	ctx.save();
	ctx.shadowColor = "rgba(0,0,30,0.4)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
	const g = ctx.createLinearGradient(0, y, 0, y + h);
	g.addColorStop(0, "rgba(255,255,255,0.30)"); g.addColorStop(1, "rgba(255,255,255,0.10)");
	ctx.fillStyle = g; rr(ctx, x, y, w, h, 20); ctx.fill();
	ctx.restore();
	const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
	gl.addColorStop(0, "rgba(255,255,255,0.28)"); gl.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = gl; rr(ctx, x + 3, y + 3, w - 6, h * 0.5, 17); ctx.fill();
	ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.6)"; rr(ctx, x, y, w, h, 20); ctx.stroke();
	txt(ctx, label, x + w / 2, y + 27, 17, "rgba(255,255,255,0.88)");
	txt(ctx, String(value), x + w / 2, y + 66, 32, vcolor || "#fff", "rgba(20,0,60,0.55)");
}

function drawTile(ctx, i, g, ended) {
	const { x, y } = tilePos(i);
	const isMine = g.mines.has(i);
	const isRev = g.revealed.has(i);
	const isHit = g.hit === i;
	const isGold = g.gold === i;
	const cx = x + TS / 2, cy = y + TS / 2;
	ctx.save();

	if (isRev) {
		// opened gem tile: glowing glass with a radial light
		ctx.shadowColor = isGold ? "rgba(255,196,0,0.95)" : "rgba(64,224,255,0.95)"; ctx.shadowBlur = 26;
		const gr = ctx.createLinearGradient(0, y, 0, y + TS);
		gr.addColorStop(0, isGold ? "#7a5200" : "#0e6b82"); gr.addColorStop(1, isGold ? "#3d2800" : "#083042");
		ctx.fillStyle = gr; rr(ctx, x, y, TS, TS, 22); ctx.fill();
		ctx.shadowBlur = 0;
		const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, TS * 0.72);
		rg.addColorStop(0, isGold ? "rgba(255,226,120,0.55)" : "rgba(130,245,255,0.50)"); rg.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = rg; rr(ctx, x, y, TS, TS, 22); ctx.fill();
		const hl = ctx.createLinearGradient(0, y, 0, y + TS * 0.45);
		hl.addColorStop(0, "rgba(255,255,255,0.28)"); hl.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = hl; rr(ctx, x + 4, y + 4, TS - 8, TS * 0.45, 18); ctx.fill();
		ctx.lineWidth = 4; ctx.strokeStyle = isGold ? "#ffd43b" : "#6ff0ff"; rr(ctx, x, y, TS, TS, 22); ctx.stroke();
		drawGem(ctx, cx, cy - 2, 38, isGold);
		ctx.fillStyle = "rgba(255,255,255,0.9)";
		spark(ctx, x + 20, y + 22, 7); ctx.fill();
		spark(ctx, x + TS - 18, y + TS - 22, 5); ctx.fill();
		if (isGold) { spark(ctx, x + TS - 22, y + 24, 9); ctx.fill(); }
	} else if (ended && isMine) {
		if (isHit) { ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = 36; }
		const gr = ctx.createLinearGradient(0, y, 0, y + TS);
		gr.addColorStop(0, isHit ? "#a01818" : "#4a1238"); gr.addColorStop(1, isHit ? "#4d0a0a" : "#22081c");
		ctx.fillStyle = gr; rr(ctx, x, y, TS, TS, 22); ctx.fill();
		ctx.shadowBlur = 0;
		const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, TS * 0.7);
		rg.addColorStop(0, isHit ? "rgba(255,150,80,0.55)" : "rgba(255,90,150,0.22)"); rg.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = rg; rr(ctx, x, y, TS, TS, 22); ctx.fill();
		ctx.lineWidth = isHit ? 5 : 2; ctx.strokeStyle = isHit ? "#ff7b6b" : "rgba(255,120,170,0.5)";
		rr(ctx, x, y, TS, TS, 22); ctx.stroke();
		if (isHit) {
			ctx.fillStyle = "#ffd43b"; spark(ctx, cx, cy, 60); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
			ctx.strokeStyle = "rgba(255,230,140,0.8)"; ctx.lineWidth = 3;
			for (let k = 0; k < 8; k++) {
				const an = (Math.PI * 2 * k) / 8 + 0.3;
				ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * 46, cy + Math.sin(an) * 46); ctx.lineTo(cx + Math.cos(an) * 60, cy + Math.sin(an) * 60); ctx.stroke();
			}
		}
		ctx.globalAlpha = isHit ? 1 : 0.85;
		drawBomb(ctx, cx, cy + 2, 38);
	} else {
		// hidden tile: raised glossy crystal button
		if (ended) ctx.globalAlpha = 0.42;
		ctx.shadowColor = "rgba(0,0,30,0.55)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
		const gr = ctx.createLinearGradient(x, y, x + TS, y + TS);
		gr.addColorStop(0, "#8a6bff"); gr.addColorStop(0.55, "#4a30c8"); gr.addColorStop(1, "#271677");
		ctx.fillStyle = gr; rr(ctx, x, y, TS, TS, 22); ctx.fill();
		ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
		const bt = ctx.createLinearGradient(0, y + TS * 0.55, 0, y + TS);
		bt.addColorStop(0, "rgba(0,0,40,0)"); bt.addColorStop(1, "rgba(0,0,40,0.38)");
		ctx.fillStyle = bt; rr(ctx, x, y, TS, TS, 22); ctx.fill();
		// faint crystal facets
		ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(x + 10, y + TS - 20); ctx.lineTo(x + TS * 0.55, y + 12); ctx.moveTo(x + TS * 0.3, y + TS - 10); ctx.lineTo(x + TS - 12, y + TS * 0.35); ctx.stroke();
		// glossy top highlight
		const hl = ctx.createLinearGradient(0, y, 0, y + TS * 0.5);
		hl.addColorStop(0, "rgba(255,255,255,0.34)"); hl.addColorStop(1, "rgba(255,255,255,0.03)");
		ctx.fillStyle = hl; rr(ctx, x + 6, y + 6, TS - 12, TS / 2 - 6, 16); ctx.fill();
		ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.5)"; rr(ctx, x, y, TS, TS, 22); ctx.stroke();
		if (ended) {
			drawGem(ctx, cx, cy, 32, i === g.gold);
		} else {
			ctx.save();
			ctx.shadowColor = "rgba(160,140,255,0.9)"; ctx.shadowBlur = 14;
			txt(ctx, String(i + 1), cx, cy + 15, 44, "#fff", "rgba(20,0,80,0.65)");
			ctx.restore();
			ctx.fillStyle = "rgba(255,255,255,0.85)"; spark(ctx, x + TS - 20, y + 20, 8); ctx.fill();
		}
	}
	ctx.restore();
}

// state: "play" | "cash" | "boom" | "expire"
function drawScene(ctx, ps, bg, g, state) {
	ctx.setTransform(ps, 0, 0, ps, 0, 0);
	ctx.clearRect(0, 0, W, H);
	ctx.drawImage(bg, 0, 0, W, H);
	const ended = state !== "play";
	const safe = TILES - g.bombs;
	const info = payoutOf(g);

	pill(ctx, 40, 122, 200, 86, "BET", g.bet > 0 ? shortMoney(g.bet) : "FREE", "#ffe259");
	pill(ctx, 260, 122, 200, 86, "MINES", g.bombs, "#ff9db3");
	pill(ctx, 480, 122, 200, 86, "GEMS", `${g.revealed.size}/${safe}`, "#8ff0ff");

	for (let i = 0; i < TILES; i++) drawTile(ctx, i, g, ended);

	// footer banner
	let text, color, sub;
	if (state === "play") {
		text = `x${info.mult.toFixed(2)}  •  CASH OUT: ${fmt(info.amount)}`;
		color = "#7dffb0";
		const nm = nextMult(g);
		sub = g.revealed.size === 0 ? "Reply a tile number (1-25)  •  cash  •  quit" : (nm ? `Next gem: x${nm.toFixed(2)}  •  reply number / cash` : "");
	} else if (state === "boom") {
		text = g.bet > 0 ? `BOOM!  -${fmt(g.bet)} COINS` : "BOOM!  MINE HIT";
		color = "#ff7b93"; sub = "You hit a mine. Play again: cm";
	} else {
		text = `${state === "expire" ? "AUTO " : ""}CASHED OUT  +${fmt(info.amount)}`;
		color = "#7dffb0"; sub = `Final multiplier x${info.mult.toFixed(2)}${g.goldFound ? "  •  GOLDEN GEM BONUS!" : ""}`;
	}
	ctx.save();
	const gr = ctx.createLinearGradient(0, 876, 0, 942);
	gr.addColorStop(0, "rgba(255,255,255,0.25)"); gr.addColorStop(1, "rgba(255,255,255,0.08)");
	ctx.fillStyle = gr; rr(ctx, 50, 876, 620, 66, 33); ctx.fill();
	const fgl = ctx.createLinearGradient(0, 876, 0, 909);
	fgl.addColorStop(0, "rgba(255,255,255,0.30)"); fgl.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = fgl; rr(ctx, 56, 880, 608, 30, 26); ctx.fill();
	ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16;
	rr(ctx, 50, 876, 620, 66, 33); ctx.stroke();
	ctx.restore();
	txt(ctx, text, W / 2, 920, text.length > 26 ? 28 : 34, color, "rgba(10,0,40,0.7)");
	txt(ctx, sub, W / 2, 974, 19, "rgba(255,255,255,0.88)");
}

async function renderBoard(game, state) {
	_guard();
	const author = _authorName();
	const dir = path.join(__dirname, "cache");
	await fs.ensureDir(dir);
	const file = path.join(dir, `cm_${game.uid}_${Date.now()}.png`);
	const ps = PNG_SCALE;
	const bg = makeBackground(ps, author);
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	drawScene(ctx, ps, bg, game, state);
	await fs.writeFile(file, canvas.toBuffer("image/png"));
	return file;
}

// ============================== SEND HELPERS ==============================
function sendGameMedia(message, game, body, file, keep, prevID) {
	_guard();
	return new Promise(resolve => {
		message.reply({ body, attachment: fs.createReadStream(file) }, (err, info) => {
			fs.remove(file).catch(() => { });
			if (err || !info) return resolve(null);
			if (keep) {
				game.messageID = info.messageID;
				global.GoatBot.onReply.set(info.messageID, {
					commandName: "crystalmines",
					messageID: info.messageID,
					author: game.uid
				});
			}
			if (prevID) {
				global.GoatBot.onReply.delete(prevID);
				Promise.resolve(message.unsend(prevID)).catch(() => { });
			}
			resolve(info);
		});
	});
}
function sendInfo(api, threadID, text, replyTo) {
	return new Promise(resolve => {
		try { api.sendMessage(text, threadID, (err, info) => resolve(err ? null : info), replyTo); }
		catch (e) { resolve(null); }
	});
}

// ============================== SETTLEMENT ==============================
// kind: "boom" | "cash" | "expire"
async function settle(game, kind) {
	_guard();
	const { usersData, uid } = game;
	games.delete(uid);
	clearTimeout(game.timer);
	const stats = await getStats(usersData, uid);
	const info = payoutOf(game);
	stats.gems += game.revealed.size;
	if (game.goldFound) stats.golds++;
	let before = 0, after = 0, credit = 0;
	if (kind === "boom") {
		stats.l++;
	} else {
		credit = info.amount;
		if (game.revealed.size > 0) { stats.w++; stats.bestMult = Math.max(stats.bestMult, info.mult); }
		if (game.bet > 0) stats.bestWin = Math.max(stats.bestWin, credit - game.bet);
		if (credit > 0) {
			const r = await changeMoney(usersData, uid, credit);
			before = r.before; after = r.after;
		} else after = await readMoney(usersData, uid);
	}
	await saveStats(usersData, uid, stats).catch(() => { });
	if (kind === "boom") after = await readMoney(usersData, uid);
	return { info, credit, after, stats };
}

function armTimer(game) {
	clearTimeout(game.timer);
	game.timer = setTimeout(async () => {
		if (games.get(game.uid) !== game || game.busy) return;
		game.busy = true;
		global.GoatBot.onReply.delete(game.messageID);
		try {
			_guard();
			const gems = game.revealed.size;
			const res = await settle(game, "expire");
			let text = "⏰ ❀°• 𝑻𝒊𝒎𝒆'𝒔 𝑼𝒑! •°❀ ⏰\n" + LINE + "\n🌸 No reply for 2 minutes, so I took care of it~\n";
			if (game.bet > 0 && gems === 0) text += `💸 Your bet of ${fmt(game.bet)} coins was refunded 💕\n💳 Balance: ${fmt(res.after)}`;
			else text += `💰 Auto cashed out: +${fmt(res.credit)} coins (x${res.info.mult.toFixed(2)}) 🎀\n💳 Balance: ${fmt(res.after)}`;
			text += "\n" + LINE + "\n💎 Play again anytime: cm 💕";
			sendInfo(game.api, game.threadID, text);
		} catch (e) { console.error("[crystalmines] expire:", e.message); }
	}, EXPIRE_MS);
	if (game.timer && game.timer.unref) game.timer.unref();
}

// ============================== CUTE TEXT ==============================
const SAFE_LINES = [
	"🌸 Sparkly! Another shiny gem for you! ✨",
	"💖 Soooo lucky! The crystals love you! 💎",
	"🦋 Yay! Safe again, you're glowing! ✨",
	"🍀 Great pick, cutie! Keep going? 🥰",
	"🎀 Ooh, so shiny! Your instincts are amazing! 💫"
];
const GOLD_LINES = [
	"🌟 WOW! The legendary GOLDEN gem! You're a treasure hunter! 👑",
	"✨ A golden gem!! The cave bowed to you! 💛"
];
const BOOM_LINES = [
	"🥺 Aww, a sneaky mine! You'll find the gems next time! 💪💖",
	"🧸 Big hugs! The next cave is all yours! 🌈",
	"🌧️ Even sparkly days have a bump... try again! ☀️💕",
	"🎀 Don't be sad, cutie! One more try? 💎✨"
];
const CASH_LINES = [
	"💖 Smart and lucky! You cashed out like a pro! 👑",
	"🌸 Sooo proud of you! Treasure secured! 💎✨",
	"🦋 Sparkling profit! You're glowing today! 🥰",
	"🍀 Perfect timing, cutie! Wanna find more gems? 💫"
];

// ============================== COMMAND ==============================
module.exports = {
	config: {
		name: "crystalmines",
		aliases: ["cm", "mines", "gemmines", "crystal"],
		version: "1.0",
		author: "ROCKY CHOWDHURY",
		countDown: 5,
		role: 0,
		description: {
			en: "Crystal Mines - find gems, dodge the mines, cash out before it's too late. HD board, bets, golden gem bonus"
		},
		category: "game",
		guide: {
			en: "{pn}: free play\n{pn} <bet> [mines]: play with a bet (e.g. {pn} 5000, {pn} 10k 5, {pn} all 8)\n{pn} stats: your record\n{pn} help: rules\n\nReply to the board with tile numbers (1-25), e.g. 7 or 3 8 12. Reply cash to collect."
		}
	},

	onStart: async function ({ api, message, event, args, usersData }) {
		if (!_authOK()) return message.reply(TAMPER_MSG);
		const uid = event.senderID;
		const first = (args[0] || "").toLowerCase();

		if (first === "help" || first === "rules") {
			return message.reply(
				"💎 ❀°• 𝑪𝒓𝒚𝒔𝒕𝒂𝒍 𝑴𝒊𝒏𝒆𝒔 •°❀ 💎\n" + LINE + "\n\n" +
				"🎀 𝑯𝒐𝒘 𝒕𝒐 𝒑𝒍𝒂𝒚 🎀\n" +
				"💎 A 5x5 board hides sparkly gems and sneaky mines 💣\n" +
				`✨ Reply a tile number (1-25) to open it. Up to ${MAX_PICKS_PER_REPLY} at once: 3 8 12\n` +
				"🚀 Every gem raises your multiplier!\n" +
				"💥 Hit a mine and the bet is lost 🥺\n" +
				"💰 Reply cash anytime to collect bet × multiplier\n\n" +
				`💣 More mines = bigger multipliers (${MIN_BOMBS}-${MAX_BOMBS}, default ${DEFAULT_BOMBS})\n` +
				`🌟 One hidden GOLDEN gem = x${GOLD_BONUS} payout bonus!\n` +
				"👑 Open every safe tile = auto cash out\n" +
				`🎲 Bets: ${fmt(MIN_BET)} - ${fmt(MAX_BET)} coins\n` +
				"🚪 quit = cash out (or refund if no gem opened)\n" +
				"⏰ No reply for 2 minutes = auto cash out\n\n" +
				LINE + "\n" +
				"🌸 Free play:  cm\n" +
				"💡 With bet:  cm 5k  •  cm 10k 5  •  cm all 6\n" +
				"📊 Stats:  cm stats\n\n" +
				`👑 Author: ${_authorName()}`
			);
		}

		try {
			_guard();
			if (first === "stats" || first === "stat") {
				const s = await getStats(usersData, uid);
				const total = s.w + s.l;
				const rate = total ? Math.round((s.w / total) * 100) : 0;
				return message.reply(
					"📊 ❀°• 𝒀𝒐𝒖𝒓 𝑴𝒊𝒏𝒆𝒔 𝑹𝒆𝒄𝒐𝒓𝒅 •°❀ 📊\n" + LINE + "\n\n" +
					`🎮 Games: ${total}\n✅ Cashed out: ${s.w}\n💥 Mines hit: ${s.l}\n📈 Success rate: ${rate}%\n\n` +
					`💎 Gems found: ${s.gems}\n🌟 Golden gems: ${s.golds}\n` +
					`🚀 Best multiplier: x${(s.bestMult || 0).toFixed(2)}\n🏆 Biggest profit: ${fmt(s.bestWin)}\n\n` +
					LINE + "\n" +
					(total ? "💖 Keep digging, treasure hunter! ⛏️✨" : "🌸 No games yet... start digging! 💎")
				);
			}

			if (games.has(uid)) {
				return message.reply("⏳ Hey cutie, you already have a game running! 💎\nReply to your board, or reply: quit 💕");
			}

			// ---- bet + mines ----
			let bet = 0, bombs = DEFAULT_BOMBS;
			if (first && first !== "free") {
				const balance = await readMoney(usersData, uid);
				if (first === "all") bet = Math.min(balance, MAX_BET);
				else {
					bet = parseAmount(first);
					if (bet === null) return message.reply("🥺 Oops! That bet looks wrong~\n💡 Try: cm 5000  •  cm 10k 5  •  cm all");
				}
				if (bet < MIN_BET) return message.reply(`🥺 The minimum bet is ${fmt(MIN_BET)} coins, cutie! 💕`);
				if (bet > MAX_BET) return message.reply(`😳 Whoa! The maximum bet is ${fmt(MAX_BET)} coins! 💕`);
				if (balance < bet) return message.reply(`🥺 Not enough coins, sweetie!\n💳 Your balance: ${fmt(balance)}\n🎲 Your bet: ${fmt(bet)}`);
			}
			const bArg = args[1];
			if (bArg !== undefined) {
				bombs = parseInt(bArg, 10);
				if (!Number.isInteger(bombs) || bombs < MIN_BOMBS || bombs > MAX_BOMBS)
					return message.reply(`💣 Pick between ${MIN_BOMBS} and ${MAX_BOMBS} mines, cutie! 💕`);
			}
			if (bet > 0) {
				const paid = await changeMoney(usersData, uid, -bet);
				if (!paid.ok) return message.reply("😿 Could not place your bet, please try again~");
			}

			// ---- build the board ----
			const mines = new Set();
			while (mines.size < bombs) mines.add(rint(TILES));
			const safeList = [];
			for (let i = 0; i < TILES; i++) if (!mines.has(i)) safeList.push(i);
			const gold = safeList[rint(safeList.length)];

			const game = {
				uid, bet, bombs, mines, gold, goldFound: false,
				revealed: new Set(), hit: -1, busy: false, messageID: null, timer: null,
				api, usersData, threadID: event.threadID
			};
			games.set(uid, game);

			try {
				const file = await renderBoard(game, "play");
				const sent = await sendGameMedia(
					message, game,
					"💎 ❀°• 𝑪𝒓𝒚𝒔𝒕𝒂𝒍 𝑴𝒊𝒏𝒆𝒔 •°❀ 💎\n" + LINE + "\n" +
					`${bet > 0 ? `🎀 Bet: ${fmt(bet)} coins` : "🆓 Free play (just for fun + small rewards!)"}\n` +
					`💣 Mines: ${bombs}\n` +
					`🌟 One hidden GOLDEN gem = x${GOLD_BONUS} bonus!\n` +
					LINE + "\n" +
					"✨ Reply tile number(s) 1-25  (e.g. 7 or 3 8 12)\n" +
					"💰 Reply cash to collect  •  🚪 quit to leave\n\n" +
					"🍀 Good luck, treasure hunter! 💕",
					file, true, null
				);
				if (!sent) throw new Error("Could not send the game image.");
				armTimer(game);
			} catch (e) {
				games.delete(uid);
				if (bet > 0) await changeMoney(usersData, uid, bet).catch(() => { });
				throw e;
			}
		} catch (e) {
			if (e.message === "AUTHOR_TAMPERED") return message.reply(TAMPER_MSG);
			console.error("[crystalmines] start error:", e);
			return message.reply("😿 Oops, something went wrong: " + e.message);
		}
	},

	onReply: async function ({ api, message, event, Reply, usersData }) {
		if (!_authOK()) return message.reply(TAMPER_MSG);
		const uid = event.senderID;
		const game = games.get(Reply.author);
		if (!game || uid !== game.uid || Reply.messageID !== game.messageID) return;
		if (game.busy) return;

		const input = (event.body || "").trim().toLowerCase();
		const tokens = input.split(/[\s,]+/).filter(Boolean);
		if (!tokens.length) return;

		try {
			_guard();
			const wantsCash = ["cash", "cashout", "c", "take", "collect", "quit", "exit", "stop", "end"].includes(tokens[0]);

			// ---------------- CASH OUT / QUIT ----------------
			if (wantsCash) {
				if (game.revealed.size === 0 && !["quit", "exit", "stop", "end"].includes(tokens[0]))
					return message.reply("💎 Open at least one tile first, cutie! 🌸");
				game.busy = true;
				const gems = game.revealed.size;
				const res = await settle(game, "cash");
				const file = await renderBoard(game, "cash");
				let body;
				if (gems === 0) {
					body = "🚪 ❀°• 𝑳𝒆𝒇𝒕 𝑺𝒂𝒇𝒆𝒍𝒚 •°❀ 🚪\n" + LINE + "\n" +
						`🌸 You left the mines safely~${game.bet > 0 ? `\n💸 Your bet of ${fmt(game.bet)} coins was refunded 💕` : ""}\n` +
						LINE + "\n💎 Play again: cm 💕";
				} else {
					const profit = game.bet > 0 ? res.credit - game.bet : res.credit;
					const tier = tierFor(res.after);
					body =
						"🎉 ❀°• 𝑪𝒂𝒔𝒉𝒆𝒅 𝑶𝒖𝒕! •°❀ 🎉\n" + LINE + "\n" +
						`💎 Gems found: ${gems}\n🚀 Multiplier: x${res.info.mult.toFixed(2)}${game.goldFound ? "\n🌟 Golden gem bonus unlocked!" : ""}\n\n` +
						`💰 Credited: +${fmt(res.credit)} coins\n` +
						(game.bet > 0 ? `📈 Profit: ${profit >= 0 ? "+" : ""}${fmt(profit)}\n` : "") +
						`💳 Balance: ${shortMoney(res.after)} (${fmt(res.after)})\n` +
						`🏅 Tier: ${tierEmoji(tier)} ${tier}\n` + LINE + "\n" +
						pick(CASH_LINES) + "\n💎 Play again? cm 💕";
				}
				return await sendGameMedia(message, game, body, file, false, Reply.messageID);
			}

			// ---------------- PICK TILES ----------------
			const picks = [];
			for (const t of tokens) {
				const n = parseInt(t, 10);
				if (!/^\d+$/.test(t) || n < 1 || n > TILES)
					return message.reply("🥺 Reply with tile numbers 1-25 (e.g. 7 or 3 8 12), or: cash / quit 💕");
				if (!picks.includes(n - 1) && !game.revealed.has(n - 1)) picks.push(n - 1);
			}
			if (!picks.length) return message.reply("🌸 Those tiles are already open, cutie! Pick other numbers~ 💎");
			if (picks.length > MAX_PICKS_PER_REPLY) picks.length = MAX_PICKS_PER_REPLY;

			game.busy = true;
			clearTimeout(game.timer);

			let boom = false, goldNow = false;
			const safeTotal = TILES - game.bombs;
			for (const idx of picks) {
				if (game.mines.has(idx)) { game.hit = idx; boom = true; break; }
				game.revealed.add(idx);
				if (idx === game.gold) { game.goldFound = true; goldNow = true; }
				if (game.revealed.size >= safeTotal) break;
			}
			const cleared = !boom && game.revealed.size >= safeTotal;

			// ---- hit a mine ----
			if (boom) {
				const gems = game.revealed.size;
				const res = await settle(game, "boom");
				const file = await renderBoard(game, "boom");
				const tier = tierFor(res.after);
				const body =
					"💥 ❀°• 𝑩𝒐𝒐𝒎! •°❀ 💥\n" + LINE + "\n" +
					"💣 Oh no, you hit a mine!\n" +
					`💎 Gems found: ${gems}\n` +
					(game.bet > 0 ? `🎀 Bet lost: -${fmt(game.bet)} coins\n` : "") +
					`💳 Balance: ${shortMoney(res.after)} (${fmt(res.after)})\n` +
					`🏅 Tier: ${tierEmoji(tier)} ${tier}\n` + LINE + "\n" +
					(gems >= 3 ? "😭 You were doing so well! Next time you'll cash out in time! 💪💖" : pick(BOOM_LINES)) +
					"\n💎 Try again? cm 💕";
				return await sendGameMedia(message, game, body, file, false, Reply.messageID);
			}

			// ---- cleared the whole board ----
			if (cleared) {
				const res = await settle(game, "cash");
				const file = await renderBoard(game, "cash");
				const profit = game.bet > 0 ? res.credit - game.bet : res.credit;
				const tier = tierFor(res.after);
				const body =
					"👑 ❀°• 𝑷𝒆𝒓𝒇𝒆𝒄𝒕 𝑩𝒐𝒂𝒓𝒅! •°❀ 👑\n" + LINE + "\n" +
					"🎉 You found EVERY gem! Legendary! 🌈\n" +
					`🚀 Multiplier: x${res.info.mult.toFixed(2)}${game.goldFound ? "\n🌟 Golden gem bonus unlocked!" : ""}\n\n` +
					`💰 Credited: +${fmt(res.credit)} coins\n` +
					(game.bet > 0 ? `📈 Profit: +${fmt(profit)}\n` : "") +
					`💳 Balance: ${shortMoney(res.after)} (${fmt(res.after)})\n` +
					`🏅 Tier: ${tierEmoji(tier)} ${tier}\n` + LINE + "\n" +
					"💖 You're a true crystal queen/king! 👑✨\n💎 Play again? cm 💕";
				return await sendGameMedia(message, game, body, file, false, Reply.messageID);
			}

			// ---- still alive ----
			const info = payoutOf(game);
			const nm = nextMult(game);
			const file = await renderBoard(game, "play");
			const body =
				(goldNow ? "🌟 ❀°• 𝑮𝒐𝒍𝒅𝒆𝒏 𝑮𝒆𝒎! •°❀ 🌟\n" : "💎 ❀°• 𝑺𝒂𝒇𝒆! •°❀ 💎\n") + LINE + "\n" +
				`💎 Gems: ${game.revealed.size}/${safeTotal}  •  💣 Mines: ${game.bombs}\n` +
				`🚀 Multiplier: x${info.mult.toFixed(2)}\n` +
				`💰 Cash out now: ${fmt(info.amount)}\n` +
				(nm ? `➡️ Next gem: x${nm.toFixed(2)}\n` : "") + LINE + "\n" +
				(goldNow ? pick(GOLD_LINES) : pick(SAFE_LINES)) + "\n" +
				"✨ Reply a tile number to keep going, or: cash 💰";
			const sent = await sendGameMedia(message, game, body, file, true, Reply.messageID);
			if (!sent) throw new Error("Could not send the board image.");
			game.busy = false;
			armTimer(game);
		} catch (e) {
			game.busy = false;
			if (games.get(game.uid) === game) armTimer(game);
			if (e.message === "AUTHOR_TAMPERED") return message.reply(TAMPER_MSG);
			console.error("[crystalmines] reply error:", e);
			return message.reply("😿 Oops, something went wrong: " + e.message);
		}
	}
};
