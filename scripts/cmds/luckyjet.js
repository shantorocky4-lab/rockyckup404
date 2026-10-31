const { createCanvas } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

// If gifencoder is installed the bot sends an animated GIF, otherwise an HD photo (PNG)
// install: npm i gifencoder
let GIFEncoder = null;
try { GIFEncoder = require("gifencoder"); } catch (e) { GIFEncoder = null; }

// ============================ SETTINGS (edit freely) ============================
const MIN_BET = 100;
const MAX_BET = 10000000;        // 10M
const MIN_MULT = 1.1;            // lowest target you can pick
const MAX_MULT = 100;            // highest target you can pick
const HOUSE_EDGE = 0.04;         // 4% edge (win chance = 96% / target)
const MAX_CRASH = 1000;          // plane can never fly higher than this
const MAX_PAYOUT = 1000000000;   // safety cap on a single payout
const ANIMATION = true;          // false = HD photo only (no GIF)
const GIF_SCALE = 0.9;           // GIF size (1 = 720x720, bigger = sharper but slower)
const GIF_QUALITY = 8;           // lower = better quality (but slower)
const PNG_SCALE = 3;             // HD photo quality (3 = 2160x2160)
const FLIGHT_FRAMES = 36;        // frames of the flight part of the animation
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

const W = 720, H = 720;
const PX0 = 80, PX1 = 650, PY0 = 598, PY1 = 268; // plot area (bottom-left / top-right)
const busy = new Set();          // users currently flying

// ============================== HELPERS ==============================
const fmt = n => Number(n).toLocaleString("en-US");
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
function parseMult(str) {
	const m = String(str || "").toLowerCase().replace(/x$/, "").match(/^(\d+(?:\.\d+)?)$/);
	if (!m) return null;
	return Math.round(parseFloat(m[1]) * 100) / 100;
}
const fx = n => Number(n).toFixed(2);

// provably simple crash point: P(crash >= m) = (1 - edge) / m
function rollCrash() {
	const r = crypto.randomBytes(6).readUIntBE(0, 6) / 281474976710656; // [0,1)
	const c = Math.floor(((1 - HOUSE_EDGE) / (1 - r)) * 100) / 100;
	return Math.max(1, Math.min(MAX_CRASH, c));
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
	const s = (ud && ud.data && ud.data.luckyjet) || {};
	return { w: s.w || 0, l: s.l || 0, best: s.best || 0, bestWin: s.bestWin || 0, streak: s.streak || 0, bestStreak: s.bestStreak || 0 };
}
async function saveStats(usersData, uid, stats) {
	const ud = await usersData.get(uid);
	const data = (ud && ud.data) || {};
	data.luckyjet = stats;
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

// curve: p in [0,1] -> screen position
function curvePos(p) {
	return { x: PX0 + p * (PX1 - PX0), y: PY0 - (PY0 - PY1) * Math.pow(p, 1.5) };
}
function curveAngle(p) {
	const dx = PX1 - PX0;
	const dy = -(PY0 - PY1) * 1.5 * Math.sqrt(Math.max(p, 0.02));
	return Math.atan2(dy, dx);
}

function drawPlane(ctx, x, y, u, ang, flick) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(ang);
	ctx.scale(u, u);
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	const OUT = "rgba(70,10,30,0.75)";

	// soft warm aura
	const aura = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 2.3);
	aura.addColorStop(0, "rgba(255,210,130,0.38)"); aura.addColorStop(1, "rgba(255,210,130,0)");
	ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, Math.PI * 2); ctx.fill();

	// layered afterburner flame
	const fl = 0.85 + (flick % 3) * 0.22;
	let fg = ctx.createLinearGradient(-3.1 * fl, 0, -0.9, 0);
	fg.addColorStop(0, "rgba(255,60,0,0)"); fg.addColorStop(0.45, "rgba(255,120,20,0.85)"); fg.addColorStop(1, "rgba(255,215,100,1)");
	ctx.fillStyle = fg;
	ctx.beginPath(); ctx.moveTo(-0.88, -0.23); ctx.quadraticCurveTo(-1.9 * fl, -0.13, -3.1 * fl, 0); ctx.quadraticCurveTo(-1.9 * fl, 0.13, -0.88, 0.23); ctx.closePath(); ctx.fill();
	fg = ctx.createLinearGradient(-2 * fl, 0, -0.9, 0);
	fg.addColorStop(0, "rgba(255,255,255,0)"); fg.addColorStop(1, "rgba(255,255,255,0.95)");
	ctx.fillStyle = fg;
	ctx.beginPath(); ctx.moveTo(-0.88, -0.11); ctx.lineTo(-2 * fl, 0); ctx.lineTo(-0.88, 0.11); ctx.closePath(); ctx.fill();

	// far wing (darker, behind body)
	let g = ctx.createLinearGradient(0, -0.8, 0, 0);
	g.addColorStop(0, "#8e1f33"); g.addColorStop(1, "#c1303f");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.moveTo(-0.02, -0.06); ctx.lineTo(-0.52, -0.82); ctx.lineTo(-0.16, -0.82); ctx.lineTo(0.38, -0.06); ctx.closePath(); ctx.fill();
	ctx.lineWidth = 0.035; ctx.strokeStyle = OUT; ctx.stroke();

	// tail fin + stabilizer
	g = ctx.createLinearGradient(-1.2, -0.65, -0.5, -0.05);
	g.addColorStop(0, "#ff6b78"); g.addColorStop(1, "#c1272d");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.moveTo(-0.98, -0.08); ctx.lineTo(-1.24, -0.68); ctx.lineTo(-0.76, -0.68); ctx.lineTo(-0.5, -0.08); ctx.closePath(); ctx.fill();
	ctx.lineWidth = 0.035; ctx.strokeStyle = OUT; ctx.stroke();
	ctx.fillStyle = "#e8e8f5";
	ctx.beginPath(); ctx.moveTo(-0.95, 0.04); ctx.lineTo(-1.2, 0.34); ctx.lineTo(-0.85, 0.34); ctx.lineTo(-0.6, 0.04); ctx.closePath(); ctx.fill();
	ctx.stroke();

	// fuselage
	g = ctx.createLinearGradient(0, -0.36, 0, 0.36);
	g.addColorStop(0, "#ffffff"); g.addColorStop(0.55, "#dfe8fb"); g.addColorStop(1, "#9fb2dc");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.ellipse(0, 0, 1.08, 0.35, 0, 0, Math.PI * 2); ctx.fill();
	ctx.lineWidth = 0.045; ctx.strokeStyle = "#6f86bd"; ctx.stroke();
	// glossy top highlight
	ctx.fillStyle = "rgba(255,255,255,0.75)";
	ctx.beginPath(); ctx.ellipse(-0.1, -0.2, 0.7, 0.07, 0, 0, Math.PI * 2); ctx.fill();

	// red nose cone
	g = ctx.createLinearGradient(0.6, -0.3, 1.1, 0.3);
	g.addColorStop(0, "#ff6b78"); g.addColorStop(1, "#b81d2c");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.moveTo(0.78, -0.33); ctx.quadraticCurveTo(1.12, -0.2, 1.1, 0); ctx.quadraticCurveTo(1.12, 0.2, 0.78, 0.33); ctx.closePath(); ctx.fill();
	ctx.lineWidth = 0.035; ctx.strokeStyle = OUT; ctx.stroke();

	// racing stripe
	g = ctx.createLinearGradient(-0.9, 0, 0.8, 0);
	g.addColorStop(0, "#c1272d"); g.addColorStop(1, "#ff5e6c");
	ctx.fillStyle = g; ctx.fillRect(-0.82, 0.07, 1.6, 0.08);

	// cockpit canopy
	g = ctx.createLinearGradient(0.2, -0.3, 0.6, 0);
	g.addColorStop(0, "#b8ecff"); g.addColorStop(1, "#1d86c9");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.ellipse(0.46, -0.1, 0.23, 0.15, -0.15, 0, Math.PI * 2); ctx.fill();
	ctx.lineWidth = 0.035; ctx.strokeStyle = "#245c8f"; ctx.stroke();
	ctx.fillStyle = "rgba(255,255,255,0.85)";
	ctx.beginPath(); ctx.ellipse(0.4, -0.16, 0.09, 0.04, -0.3, 0, Math.PI * 2); ctx.fill();
	// cabin windows
	for (const wx of [0.1, -0.15, -0.4]) {
		ctx.fillStyle = "#3aa6e0"; ctx.beginPath(); ctx.arc(wx, -0.08, 0.075, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(wx - 0.025, -0.105, 0.025, 0, Math.PI * 2); ctx.fill();
	}

	// near wing + engine pod
	g = ctx.createLinearGradient(0, 0.1, 0, 0.9);
	g.addColorStop(0, "#ff6b78"); g.addColorStop(1, "#b81d2c");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.moveTo(-0.1, 0.1); ctx.lineTo(-0.62, 0.86); ctx.lineTo(-0.2, 0.86); ctx.lineTo(0.42, 0.1); ctx.closePath(); ctx.fill();
	ctx.lineWidth = 0.04; ctx.strokeStyle = OUT; ctx.stroke();
	ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 0.035;
	ctx.beginPath(); ctx.moveTo(0.35, 0.13); ctx.lineTo(-0.1, 0.78); ctx.stroke();
	g = ctx.createLinearGradient(0, 0.4, 0, 0.62);
	g.addColorStop(0, "#f2f4fb"); g.addColorStop(1, "#8d98b5");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.ellipse(-0.12, 0.5, 0.3, 0.1, -0.2, 0, Math.PI * 2); ctx.fill();
	ctx.lineWidth = 0.03; ctx.strokeStyle = "#5b6788"; ctx.stroke();
	ctx.restore();
}

function drawCoin(ctx, x, y, r, spin) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(Math.max(0.25, Math.abs(Math.cos(spin))), 1);
	const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
	g.addColorStop(0, "#fff6a8"); g.addColorStop(0.6, "#ffc400"); g.addColorStop(1, "#b8860b");
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
	ctx.lineWidth = 2; ctx.strokeStyle = "#8a5a00"; ctx.stroke();
	ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();
	txt(ctx, "$", 0, r * 0.4, r * 1.1, "#8a5a00");
	ctx.restore();
}

const confetti = (() => {
	const rnd = mulberry32(31);
	const cols = ["#ffe259", "#ff6b81", "#43e97b", "#4fc3f7", "#d17cff", "#ffffff", "#ffa502"];
	return Array.from({ length: 70 }, () => ({
		x: rnd() * W, y: rnd() * H, vy: 14 + rnd() * 14, ph: rnd() * 6,
		w: 7 + rnd() * 7, h: 12 + rnd() * 9, rot: rnd() * 6, vr: 0.15 + rnd() * 0.3,
		c: cols[Math.floor(rnd() * cols.length)]
	}));
})();
const coins = (() => {
	const rnd = mulberry32(77);
	return Array.from({ length: 22 }, () => ({ x: rnd() * W, y: rnd() * H, vy: 16 + rnd() * 12, ph: rnd() * 6, r: 13 + rnd() * 9 }));
})();

function makeBackground(ps, author) {
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	ctx.scale(ps, ps);
	const rnd = mulberry32(4242);

	// deep sunset sky
	const sky = ctx.createLinearGradient(0, 0, 0, H);
	sky.addColorStop(0, "#040821");
	sky.addColorStop(0.35, "#1d1066");
	sky.addColorStop(0.65, "#6a1b8f");
	sky.addColorStop(0.88, "#d42a6a");
	sky.addColorStop(1, "#ff8a4c");
	ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

	// horizon sun glow + cyan rim light
	const sun = ctx.createRadialGradient(140, 700, 0, 140, 700, 480);
	sun.addColorStop(0, "rgba(255,200,90,0.55)"); sun.addColorStop(0.5, "rgba(255,120,80,0.18)"); sun.addColorStop(1, "rgba(255,120,80,0)");
	ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
	const rim = ctx.createRadialGradient(620, 230, 0, 620, 230, 420);
	rim.addColorStop(0, "rgba(64,224,255,0.28)"); rim.addColorStop(1, "rgba(64,224,255,0)");
	ctx.fillStyle = rim; ctx.fillRect(0, 0, W, H);

	// soft light beams
	ctx.save();
	ctx.translate(620, 60);
	for (let i = 0; i < 5; i++) {
		ctx.rotate(0.22);
		const bm = ctx.createLinearGradient(0, 0, 0, 520);
		bm.addColorStop(0, "rgba(160,230,255,0.10)"); bm.addColorStop(1, "rgba(160,230,255,0)");
		ctx.fillStyle = bm;
		ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(46, 520); ctx.lineTo(-46, 520); ctx.closePath(); ctx.fill();
	}
	ctx.restore();

	// glowing moon
	const mg = ctx.createRadialGradient(618, 62, 6, 618, 62, 70);
	mg.addColorStop(0, "rgba(255,255,240,0.95)"); mg.addColorStop(0.35, "rgba(255,245,200,0.35)"); mg.addColorStop(1, "rgba(255,245,200,0)");
	ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(618, 62, 70, 0, Math.PI * 2); ctx.fill();

	// twinkling stars (some with glow)
	for (let i = 0; i < 90; i++) {
		const sx = rnd() * W, sy = rnd() * 440, sr = 1 + rnd() * 3.6, al = 0.3 + rnd() * 0.65;
		if (rnd() > 0.82) {
			const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
			sg.addColorStop(0, `rgba(255,255,255,${al})`); sg.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr * 5, 0, Math.PI * 2); ctx.fill();
		}
		ctx.fillStyle = `rgba(255,255,255,${al})`;
		spark(ctx, sx, sy, sr * 1.6); ctx.fill();
	}

	// layered soft clouds
	for (let layer = 0; layer < 2; layer++) {
		for (let i = 0; i < 6; i++) {
			const cx = rnd() * W, cy = 250 + rnd() * 400, r0 = (layer ? 36 : 56) + rnd() * 40;
			const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r0 * 1.6);
			cg.addColorStop(0, `rgba(255,220,240,${layer ? 0.10 : 0.07})`); cg.addColorStop(1, "rgba(255,220,240,0)");
			ctx.fillStyle = cg;
			ctx.beginPath(); ctx.ellipse(cx, cy, r0 * 1.7, r0 * 0.7, 0, 0, Math.PI * 2); ctx.fill();
		}
	}

	// city skyline silhouette at the bottom
	ctx.fillStyle = "rgba(14,4,40,0.88)";
	let bx = 0;
	while (bx < W) {
		const bw = 22 + rnd() * 34, bh = 14 + rnd() * 34;
		ctx.fillRect(bx, H - bh, bw, bh);
		ctx.fillStyle = "rgba(255,214,120,0.55)";
		for (let wy = H - bh + 5; wy < H - 4; wy += 9) {
			for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) if (rnd() > 0.6) ctx.fillRect(wx, wy, 3, 4);
		}
		ctx.fillStyle = "rgba(14,4,40,0.88)";
		bx += bw + 2;
	}

	// glass plot panel
	const pg = ctx.createLinearGradient(0, 236, 0, 616);
	pg.addColorStop(0, "rgba(14,8,60,0.62)"); pg.addColorStop(1, "rgba(6,2,32,0.52)");
	ctx.fillStyle = pg;
	rr(ctx, 30, 236, W - 60, 380, 28); ctx.fill();
	const hl = ctx.createLinearGradient(0, 236, 0, 300);
	hl.addColorStop(0, "rgba(255,255,255,0.14)"); hl.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = hl; rr(ctx, 34, 240, W - 68, 70, 24); ctx.fill();
	ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.45)";
	rr(ctx, 30, 236, W - 60, 380, 28); ctx.stroke();
	ctx.lineWidth = 1; ctx.strokeStyle = "rgba(143,240,255,0.25)";
	rr(ctx, 36, 242, W - 72, 368, 24); ctx.stroke();

	// grid
	ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.09)";
	for (let i = 0; i <= 5; i++) {
		const y = PY1 + ((PY0 - PY1) * i) / 5;
		ctx.beginPath(); ctx.moveTo(PX0 - 20, y); ctx.lineTo(PX1 + 10, y); ctx.stroke();
	}
	for (let i = 0; i <= 6; i++) {
		const x = PX0 + ((PX1 - PX0) * i) / 6;
		ctx.beginPath(); ctx.moveTo(x, PY1 - 10); ctx.lineTo(x, PY0 + 6); ctx.stroke();
	}
	ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineCap = "round";
	ctx.beginPath(); ctx.moveTo(PX0 - 20, PY0); ctx.lineTo(PX1 + 10, PY0); ctx.stroke();
	ctx.beginPath(); ctx.moveTo(PX0, PY1 - 10); ctx.lineTo(PX0, PY0 + 6); ctx.stroke();

	// title with glow
	ctx.save();
	ctx.shadowColor = "rgba(255,190,90,0.75)"; ctx.shadowBlur = 26;
	const tg = ctx.createLinearGradient(0, 28, 0, 82);
	tg.addColorStop(0, "#ffffff"); tg.addColorStop(0.55, "#ffe9b0"); tg.addColorStop(1, "#ffb347");
	txt(ctx, "LUCKY JET", W / 2, 68, 60, tg, "#3a0a5e");
	ctx.restore();
	ctx.fillStyle = "#fff"; spark(ctx, 66, 50, 15); ctx.fill(); spark(ctx, W - 66, 50, 15); ctx.fill();
	ctx.fillStyle = "rgba(255,226,140,0.9)"; spark(ctx, 96, 76, 7); ctx.fill(); spark(ctx, W - 96, 76, 7); ctx.fill();

	txt(ctx, `© ${author}`, W / 2, 714, 14, "rgba(255,255,255,0.8)");
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
	txt(ctx, label, x + w / 2, y + 26, 17, "rgba(255,255,255,0.88)");
	txt(ctx, String(value), x + w / 2, y + 62, 31, vcolor || "#fff", "rgba(20,0,60,0.55)");
}

// moving speed streaks inside the plot while the jet flies
function drawSpeed(ctx, o) {
	if (o.state !== "fly") return;
	const f = o.f || 0;
	ctx.save();
	rr(ctx, 40, 246, W - 80, 360, 22); ctx.clip();
	ctx.lineCap = "round";
	for (let i = 0; i < 16; i++) {
		const sp = 16 + (i % 5) * 8;
		const x = ((((i * 137 - f * sp) % (W + 160)) + (W + 160)) % (W + 160)) - 80;
		const y = 262 + ((i * 83) % 330);
		const len = 40 + (i % 4) * 32;
		ctx.strokeStyle = `rgba(255,255,255,${0.05 + (i % 4) * 0.03})`;
		ctx.lineWidth = 2 + (i % 3);
		ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
	}
	ctx.restore();
}

// smoke puffs + glowing sparks behind the jet
function drawTrail(ctx, pEnd, f) {
	for (let k = 7; k >= 1; k--) {
		const pp = pEnd - k * 0.028;
		if (pp <= 0) continue;
		const c = curvePos(pp);
		const r = 7 + k * 3.2;
		const a = Math.max(0, 0.26 - k * 0.032);
		const gr = ctx.createRadialGradient(c.x, c.y + 6, 0, c.x, c.y + 6, r);
		gr.addColorStop(0, `rgba(255,235,220,${a})`); gr.addColorStop(1, "rgba(255,235,220,0)");
		ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y + 6, r, 0, Math.PI * 2); ctx.fill();
	}
	for (let k = 1; k <= 9; k++) {
		const pp = pEnd - k * 0.011;
		if (pp <= 0) continue;
		const c = curvePos(pp);
		const off = Math.sin(f * 1.7 + k * 2.3) * 7;
		const a = Math.max(0, 0.95 - k * 0.1);
		ctx.fillStyle = k % 2 ? `rgba(255,214,100,${a})` : `rgba(255,255,255,${a})`;
		spark(ctx, c.x - k * 1.5, c.y + off, 5 - k * 0.3); ctx.fill();
	}
}

// o: { m, p, target, bet, state: fly|boom|win|lose, f, crash, credit }
function drawScene(ctx, ps, bg, o) {
	ctx.setTransform(ps, 0, 0, ps, 0, 0);
	ctx.clearRect(0, 0, W, H);
	ctx.drawImage(bg, 0, 0, W, H);

	pill(ctx, 36, 100, 200, 84, "BET", shortMoney(o.bet), "#ffe259");
	pill(ctx, 260, 100, 200, 84, "TARGET", `x${fx(o.target)}`, "#8ff0ff");
	pill(ctx, 484, 100, 200, 84, "PAYOUT", shortMoney(Math.min(Math.floor(o.bet * o.target), MAX_PAYOUT)), "#7dffb0");

	// target line
	ctx.save();
	ctx.setLineDash([12, 9]);
	ctx.lineWidth = 3; ctx.strokeStyle = "rgba(125,255,176,0.8)";
	ctx.beginPath(); ctx.moveTo(PX0 - 20, PY1); ctx.lineTo(PX1 + 10, PY1); ctx.stroke();
	ctx.restore();
	txt(ctx, `TARGET x${fx(o.target)}`, PX0 + 6, PY1 - 12, 17, "#7dffb0", "rgba(10,0,40,0.6)", "left");
	txt(ctx, "x1.00", PX0 + 6, PY0 - 10, 15, "rgba(255,255,255,0.65)", null, "left");

	drawSpeed(ctx, o);

	// curve
	const steps = 90;
	const pEnd = Math.max(0.0001, o.p);
	ctx.beginPath();
	ctx.moveTo(PX0, PY0);
	for (let i = 1; i <= steps; i++) { const c = curvePos((pEnd * i) / steps); ctx.lineTo(c.x, c.y); }
	const endPt = curvePos(pEnd);
	ctx.lineTo(endPt.x, PY0); ctx.closePath();
	const fg = ctx.createLinearGradient(0, PY1, 0, PY0);
	fg.addColorStop(0, "rgba(255,130,90,0.55)"); fg.addColorStop(0.5, "rgba(255,90,120,0.22)"); fg.addColorStop(1, "rgba(255,90,120,0.02)");
	ctx.fillStyle = fg; ctx.fill();

	const tracePath = () => {
		ctx.beginPath(); ctx.moveTo(PX0, PY0);
		for (let i = 1; i <= steps; i++) { const c = curvePos((pEnd * i) / steps); ctx.lineTo(c.x, c.y); }
	};
	const lg = ctx.createLinearGradient(PX0, 0, Math.max(PX0 + 1, endPt.x), 0);
	lg.addColorStop(0, "#ff5f7e"); lg.addColorStop(0.55, "#ffb26b"); lg.addColorStop(1, "#fff3b0");
	ctx.save();
	ctx.lineCap = "round"; ctx.lineJoin = "round";
	ctx.shadowColor = "rgba(255,120,60,0.9)"; ctx.shadowBlur = 30;
	ctx.lineWidth = 16; ctx.strokeStyle = "rgba(255,110,70,0.28)"; tracePath(); ctx.stroke();
	ctx.shadowBlur = 14;
	ctx.lineWidth = 8; ctx.strokeStyle = lg; tracePath(); ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.lineWidth = 2.6; ctx.strokeStyle = "rgba(255,255,255,0.92)"; tracePath(); ctx.stroke();
	ctx.restore();

	// big multiplier
	const mcol = o.state === "boom" || o.state === "lose" ? "#ff7b93" : o.state === "win" ? "#7dffb0" : "#ffffff";
	ctx.save();
	ctx.shadowColor = mcol; ctx.shadowBlur = 24;
	txt(ctx, `x${fx(o.m)}`, 300, 372, o.m >= 100 ? 96 : 112, mcol, "rgba(10,0,40,0.65)");
	ctx.restore();

	const f = o.f || 0;
	// plane / explosion
	if (o.state === "boom" || o.state === "lose") {
		if (o.state === "boom") {
			const r = 18 + f * 15;
			const a = Math.max(0, 1 - f / 9);
			const eg = ctx.createRadialGradient(endPt.x, endPt.y, 0, endPt.x, endPt.y, r);
			eg.addColorStop(0, `rgba(255,255,220,${a})`);
			eg.addColorStop(0.35, `rgba(255,190,40,${a})`);
			eg.addColorStop(0.7, `rgba(255,70,30,${a * 0.8})`);
			eg.addColorStop(1, "rgba(255,70,30,0)");
			ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(endPt.x, endPt.y, r, 0, Math.PI * 2); ctx.fill();
			ctx.save();
			ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,255,255,${a * 0.8})`;
			ctx.beginPath(); ctx.arc(endPt.x, endPt.y, r * 1.3, 0, Math.PI * 2); ctx.stroke();
			ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,160,60,${a * 0.7})`;
			ctx.beginPath(); ctx.arc(endPt.x, endPt.y, r * 0.85, 0, Math.PI * 2); ctx.stroke();
			ctx.fillStyle = `rgba(60,40,60,${a * 0.35})`;
			ctx.beginPath(); ctx.arc(endPt.x - r * 0.5, endPt.y - r * 0.4, r * 0.55, 0, Math.PI * 2); ctx.arc(endPt.x + r * 0.55, endPt.y - r * 0.2, r * 0.45, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
			ctx.strokeStyle = `rgba(255,220,120,${a})`; ctx.lineWidth = 4; ctx.lineCap = "round";
			for (let i = 0; i < 12; i++) {
				const an = (Math.PI * 2 * i) / 12 + 0.3;
				ctx.beginPath();
				ctx.moveTo(endPt.x + Math.cos(an) * r * 0.5, endPt.y + Math.sin(an) * r * 0.5);
				ctx.lineTo(endPt.x + Math.cos(an) * r * 1.15, endPt.y + Math.sin(an) * r * 1.15);
				ctx.stroke();
			}
			// debris
			ctx.fillStyle = `rgba(230,57,70,${a})`;
			for (let i = 0; i < 6; i++) {
				const an = (Math.PI * 2 * i) / 6 + 0.7;
				ctx.fillRect(endPt.x + Math.cos(an) * r * 1.0 - 4, endPt.y + Math.sin(an) * r * 1.0 + f * 3 - 4, 8, 8);
			}
		} else {
			// smoke puff where it crashed
			ctx.fillStyle = "rgba(255,255,255,0.18)";
			ctx.beginPath(); ctx.arc(endPt.x, endPt.y, 38, 0, Math.PI * 2); ctx.arc(endPt.x - 22, endPt.y + 10, 26, 0, Math.PI * 2); ctx.arc(endPt.x + 24, endPt.y + 8, 24, 0, Math.PI * 2); ctx.fill();
			txt(ctx, "💥", endPt.x, endPt.y + 14, 42, "#fff");
		}
	} else {
		const bob = o.state === "fly" ? Math.sin(f * 0.9) * 3 : Math.sin(f * 0.6) * 5;
		if (o.state === "win") {
			ctx.save(); ctx.translate(endPt.x, endPt.y); ctx.rotate(f * 0.12);
			for (let i = 0; i < 10; i++) {
				ctx.rotate((Math.PI * 2) / 10);
				const rg = ctx.createLinearGradient(0, 0, 160, 0);
				rg.addColorStop(0, "rgba(255,226,89,0.38)"); rg.addColorStop(1, "rgba(255,226,89,0)");
				ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(160, -17); ctx.lineTo(160, 17); ctx.closePath(); ctx.fill();
			}
			ctx.restore();
		}
		drawTrail(ctx, pEnd, f);
		drawPlane(ctx, endPt.x, endPt.y + bob, 42, curveAngle(pEnd), f);
		if (o.state === "win") {
			ctx.save();
			ctx.shadowColor = "#7dffb0"; ctx.shadowBlur = 20;
			ctx.strokeStyle = "rgba(125,255,176,0.85)"; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.arc(endPt.x, endPt.y, 52 + (f % 6) * 6, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		}
	}

	// footer banner
	let text, color;
	if (o.state === "fly") { text = "FLYING... HOLD ON!"; color = "#ffffff"; }
	else if (o.state === "boom" || o.state === "lose") { text = `CRASHED AT x${fx(o.crash)}`; color = "#ff7b93"; }
	else { text = `CASHED OUT AT x${fx(o.target)}`; color = "#7dffb0"; }
	ctx.save();
	const gr = ctx.createLinearGradient(0, 636, 0, 696);
	gr.addColorStop(0, "rgba(255,255,255,0.25)"); gr.addColorStop(1, "rgba(255,255,255,0.08)");
	ctx.fillStyle = gr; rr(ctx, 90, 636, 540, 62, 31); ctx.fill();
	ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16;
	rr(ctx, 90, 636, 540, 62, 31); ctx.stroke();
	ctx.restore();
	txt(ctx, text, W / 2, 678, 32, color, "rgba(10,0,40,0.7)");

	// result overlay (final frames)
	if (o.result) {
		const win = o.result === "win";
		ctx.save();
		ctx.fillStyle = "rgba(12,0,40,0.55)";
		rr(ctx, 130, 262, 460, 150, 26); ctx.fill();
		ctx.lineWidth = 3; ctx.strokeStyle = win ? "#7dffb0" : "#ff7b93";
		rr(ctx, 130, 262, 460, 150, 26); ctx.stroke();
		ctx.restore();
		txt(ctx, win ? "YOU WIN!" : "YOU LOST", W / 2, 330, 58, win ? "#ffe259" : "#ff7b93", win ? "#8a3b00" : "#5a0020");
		txt(ctx, win ? `+${fmt(o.credit)} COINS` : `-${fmt(o.bet)} COINS`, W / 2, 384, 36, win ? "#7dffb0" : "#ffb3c1", "rgba(10,0,40,0.7)");
	}

	if (o.celebrate !== undefined) {
		const cf = o.celebrate;
		for (const p of confetti) {
			const y = ((p.y + p.vy * cf) % (H + 60)) - 30;
			const x = p.x + Math.sin(cf * 0.4 + p.ph) * 14;
			ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.vr * cf);
			ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
		}
		for (const c of coins) {
			const y = ((c.y + c.vy * cf) % (H + 80)) - 40;
			drawCoin(ctx, c.x + Math.sin(cf * 0.3 + c.ph) * 10, y, c.r, cf * 0.5 + c.ph);
		}
	}
}

// ---------- frames ----------
function buildFrames(d, ps, bg) {
	const frames = [];
	const lose = d.crash < d.target;
	const F = lose ? d.crash : d.target;          // multiplier the plane flies to
	const S = d.target;                            // axis scale (target is always the top line)
	const lnS = Math.log(S);
	const lnF = Math.log(F);
	const base = { bet: d.bet, target: d.target, crash: d.crash };
	const mk = (o, delay) => frames.push({ delay, draw: ctx => drawScene(ctx, ps, bg, Object.assign({}, base, o)) });

	for (let i = 0; i <= FLIGHT_FRAMES; i++) {
		const q = i / FLIGHT_FRAMES;
		const m = Math.exp(lnF * q);
		const p = lnF === 0 ? 0 : (lnF / lnS) * q;
		mk({ m, p, state: "fly", f: i }, i === FLIGHT_FRAMES ? 160 : 70);
	}
	const pF = lnF === 0 ? 0 : lnF / lnS;
	if (lose) {
		for (let k = 0; k < 9; k++) mk({ m: F, p: pF, state: "boom", f: k }, 70);
		mk({ m: F, p: pF, state: "lose", f: 0, result: "lose" }, 3500);
	} else {
		for (let k = 0; k < 16; k++) mk({ m: F, p: pF, state: "win", f: k, celebrate: k, result: k > 3 ? "win" : undefined, credit: d.credit }, 80);
		mk({ m: F, p: pF, state: "win", f: 16, celebrate: 16, result: "win", credit: d.credit }, 3500);
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
	enc.setRepeat(-1);                 // play once, stay on last frame
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

async function renderMedia(d) {
	_guard();
	const author = _authorName();
	const dir = path.join(__dirname, "cache");
	await fs.ensureDir(dir);
	const base = path.join(dir, `jet_${d.uid}_${Date.now()}`);

	if (ANIMATION && GIFEncoder) {
		try {
			const ps = GIF_SCALE;
			const bg = makeBackground(ps, author);
			const file = base + ".gif";
			const frames = buildFrames(d, ps, bg);
			await encodeGif(file, ps, frames);
			const wait = frames.slice(0, -1).reduce((s, f) => s + f.delay, 0);
			return { file, wait };
		} catch (e) {
			console.error("[luckyjet] GIF error, falling back to PNG:", e.message);
		}
	}
	// HD photo of the final state
	const ps = PNG_SCALE;
	const bg = makeBackground(ps, author);
	const canvas = createCanvas(Math.round(W * ps), Math.round(H * ps));
	const ctx = canvas.getContext("2d");
	const lose = d.crash < d.target;
	const F = lose ? d.crash : d.target;
	const p = Math.log(F) === 0 ? 0 : Math.log(F) / Math.log(d.target);
	drawScene(ctx, ps, bg, {
		bet: d.bet, target: d.target, crash: d.crash, m: F, p,
		state: lose ? "lose" : "win", f: 2, result: lose ? "lose" : "win", credit: d.credit,
		celebrate: lose ? undefined : 3
	});
	const file = base + ".png";
	await fs.writeFile(file, canvas.toBuffer("image/png"));
	return { file, wait: 0 };
}

function sendMedia(message, body, file) {
	return new Promise(resolve => {
		message.reply({ body, attachment: fs.createReadStream(file) }, (err, info) => {
			fs.remove(file).catch(() => { });
			resolve(err || !info ? null : info);
		});
	});
}

// edits the text of the message that carries the animation (retries a few times)
async function safeEdit(api, messageID, text, retries) {
	retries = retries === undefined ? 3 : retries;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			await api.editMessage(text, messageID);
			return true;
		} catch (e) {
			if (attempt === retries) {
				console.log("[luckyjet] editMessage failed:", e && e.message ? e.message : e);
				return false;
			}
			await sleep(400);
		}
	}
	return false;
}

// ============================== CUTE TEXT ==============================
const LINE = "♡┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈♡";
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const WIN_LINES = [
	"💖 Wowww! You're on fire today! 🔥✨",
	"🌸 Lucky star shining on you! ⭐💕",
	"🎀 The sky loves you! Soooo proud! 🥰",
	"🍀 Magic touch! The jet bowed to you! 👑✨",
	"🦋 Pure luck, pure sparkle! Keep glowing! 💫"
];
const LOSE_LINES = [
	"🥺 Aww, so unlucky! But you'll get it next time! 💪💖",
	"🌧️ Even clouds pass... your sunny flight is coming! ☀️🌈",
	"🎀 Don't be sad, cutie! One more flight? 🛫💕",
	"🍀 The jet was shy this time... try again! 🤗✨",
	"🧸 Hugs! Your lucky flight is just around the corner! 💞"
];
const NEAR_LINES = [
	"😭 SO CLOSE! The jet was almost there! One more try?! 🥹🔥",
	"🫣 Argh! Just a tiny bit short! Next flight is yours! 💖",
	"✨ SO near!! Luck is knocking on your door! 🚪💕"
];
const TAKEOFF_LINES = [
	"🛫 Jet is flying... fingers crossed! 🤞💕",
	"🛫 Hold tight, cutie! Lucky wind is coming! 🌬️✨",
	"🛫 Up, up and away... pray for the sky! 🙏🌈",
	"🛫 Engines roaring! Please be lucky! 🍀💖"
];

function streakText(n) {
	if (n >= 7) return `🌈👑 LEGENDARY streak: ${n} wins in a row!! 🔥🔥`;
	if (n >= 5) return `🔥🔥 Unstoppable streak: ${n} wins in a row! 💎`;
	if (n >= 3) return `🔥 Hot streak: ${n} wins in a row! ✨`;
	if (n >= 2) return `✨ Win streak: ${n} 💕`;
	return `🌟 Win streak: ${n}`;
}

// ============================== COMMAND ==============================
module.exports = {
	config: {
		name: "luckyjet",
		aliases: ["jet", "plane", "crash", "aviator", "lj"],
		version: "1.0",
		author: "ROCKY CHOWDHURY",
		countDown: 6,
		role: 0,
		description: {
			en: "Lucky Jet - casino plane game. Pick a bet and a target multiplier; if the jet reaches it you win bet x target, if it crashes first you lose the bet"
		},
		category: "game",
		guide: {
			en: "{pn} <bet> <multiplier>: e.g. {pn} 5000 2.5, {pn} 10k 3, {pn} all 1.5\n{pn} stats: your record\n{pn} help: rules"
		}
	},

	onStart: async function ({ api, message, event, args, usersData }) {
		if (!_authOK()) return message.reply(TAMPER_MSG);
		const uid = event.senderID;
		const first = (args[0] || "").toLowerCase();

		if (!first || first === "help" || first === "rules") {
			return message.reply(
				"✈️ ❀°• 𝑳𝒖𝒄𝒌𝒚 𝑱𝒆𝒕 •°❀ ✈️\n" + LINE + "\n\n" +
				"🎀 𝑯𝒐𝒘 𝒕𝒐 𝒑𝒍𝒂𝒚 🎀\n" +
				"💰 Pick a BET and a TARGET (x) 🎯\n" +
				"🛫 Then the jet takes off and flies higher & higher!\n\n" +
				"🏆 Jet reaches your target = you WIN bet × target 💎\n" +
				"   (bet 1,000 on x3 = you get 3,000 coins 🤑)\n" +
				"💥 Jet crashes before your target = bet is lost 🥺\n\n" +
				"🍀 Small target = safer, big target = bigger prize!\n" +
				`🎯 Target range: x${MIN_MULT} - x${MAX_MULT}\n` +
				`🍀 Win chance: x2 = ${Math.round(((1 - HOUSE_EDGE) / 2) * 100)}%  •  x5 = ${Math.round(((1 - HOUSE_EDGE) / 5) * 100)}%  •  x10 = ${Math.round(((1 - HOUSE_EDGE) / 10) * 100)}%\n` +
				`🎲 Bets: ${fmt(MIN_BET)} - ${fmt(MAX_BET)} coins\n\n` +
				LINE + "\n" +
				"🌸 Play:  jet <bet> <x>\n" +
				"💡 Try:  jet 5000 2.5  •  jet 10k 3  •  jet all 1.5\n" +
				"📊 Stats:  jet stats\n\n" +
				`👑 Author: ${_authorName()}`
			);
		}

		try {
			if (first === "stats" || first === "stat") {
				const s = await getStats(usersData, uid);
				const total = s.w + s.l;
				const rate = total ? Math.round((s.w / total) * 100) : 0;
				return message.reply(
					"📊 ❀°• 𝒀𝒐𝒖𝒓 𝑱𝒆𝒕 𝑹𝒆𝒄𝒐𝒓𝒅 •°❀ 📊\n" + LINE + "\n\n" +
					`🎮 Flights: ${total}\n🏆 Wins: ${s.w}\n💥 Crashes: ${s.l}\n📈 Win rate: ${rate}%\n\n` +
					`🚀 Highest target hit: x${fx(s.best)}\n💰 Biggest profit: ${fmt(s.bestWin)}\n` +
					`🔥 Current streak: ${s.streak}\n⭐ Best streak: ${s.bestStreak}\n\n` +
					LINE + "\n" +
					(total ? "💖 Keep flying, champion! ✈️✨" : "🌸 No flights yet... take off now! 🛫")
				);
			}

			if (busy.has(uid)) return message.reply("⏳ Hey cutie, your jet is still in the sky! 🛫\nWait for it to land first~ 💕");

			// ---- bet ----
			const balance = await readMoney(usersData, uid);
			let bet;
			if (first === "all") bet = Math.min(balance, MAX_BET);
			else {
				bet = parseAmount(first);
				if (bet === null) return message.reply("🥺 Oops! That bet looks wrong~\n💡 Try: jet 5000 2.5  •  jet 10k 3  •  jet all 1.5");
			}
			if (bet < MIN_BET) return message.reply(`🥺 The minimum bet is ${fmt(MIN_BET)} coins, cutie! 💕`);
			if (bet > MAX_BET) return message.reply(`😳 Whoa! The maximum bet is ${fmt(MAX_BET)} coins! 💕`);
			if (balance < bet) return message.reply(`🥺 Not enough coins, sweetie!\n💳 Your balance: ${fmt(balance)}\n🎲 Your bet: ${fmt(bet)}`);

			// ---- target multiplier ----
			if (args[1] === undefined) return message.reply("🎯 Tell me your target (x) too, cutie! 💕\n💡 Example: jet 5000 2.5\n   (bet 5000, target x2.5)");
			const target = parseMult(args[1]);
			if (target === null) return message.reply("🥺 That target looks wrong~\n💡 Try: jet 5000 2.5  •  jet 10k 3x");
			if (target < MIN_MULT || target > MAX_MULT) return message.reply(`🎯 Pick a target between x${MIN_MULT} and x${MAX_MULT}, cutie! 💕`);

			busy.add(uid);
			let placed = false;
			try {
				const paid = await changeMoney(usersData, uid, -bet);
				if (!paid.ok) return message.reply("😿 Could not place your bet, please try again~");
				placed = true;

				const crash = rollCrash();
				const win = crash >= target;
				const credit = win ? Math.min(Math.floor(bet * target), MAX_PAYOUT) : 0;

				const media = await renderMedia({ uid, bet, target, crash, credit });
				const chance = Math.min(99, ((1 - HOUSE_EDGE) / target) * 100);
				const sent = await sendMedia(
					message,
					"✈️ ❀°• 𝑳𝒖𝒄𝒌𝒚 𝑱𝒆𝒕 •°❀ ✈️\n" + LINE + "\n" +
					`🎀 Bet: ${fmt(bet)} coins\n` +
					`🎯 Target: x${fx(target)}\n` +
					`💎 Possible win: ${fmt(Math.min(Math.floor(bet * target), MAX_PAYOUT))}\n` +
					`🍀 Win chance: ${chance.toFixed(chance < 10 ? 1 : 0)}%\n` +
					LINE + "\n" + pick(TAKEOFF_LINES),
					media.file
				);
				if (!sent) throw new Error("Could not send the animation.");
				placed = false; // bet is settled below

				const stats = await getStats(usersData, uid);
				let after;
				if (win) {
					const r = await changeMoney(usersData, uid, credit);
					after = r.after;
					stats.w++; stats.streak++;
					stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
					stats.best = Math.max(stats.best, target);
					stats.bestWin = Math.max(stats.bestWin, credit - bet);
				} else {
					after = await readMoney(usersData, uid);
					stats.l++; stats.streak = 0;
				}
				await saveStats(usersData, uid, stats).catch(() => { });

				const tier = tierFor(after);
				let result;
				if (win) {
					result =
						"🎉 ❀°• 𝒀𝒐𝒖 𝑾𝒊𝒏! •°❀ 🎉\n" + LINE + "\n" +
						`✈️ Jet flew up to: x${fx(crash)}\n` +
						`🎯 Your target: x${fx(target)} ✅\n\n` +
						`🎀 Bet: ${fmt(bet)}\n` +
						`💰 You won: +${fmt(credit)} coins\n` +
						`📈 Profit: +${fmt(credit - bet)}\n\n` +
						`💳 Balance: ${shortMoney(after)} (${fmt(after)})\n` +
						`🏅 Tier: ${tierEmoji(tier)} ${tier}\n` +
						`${streakText(stats.streak)}\n` + LINE + "\n" +
						pick(WIN_LINES) + "\n🛫 Fly again? jet <bet> <x> 💕";
				} else {
					const near = crash >= target * 0.8;
					result =
						"💥 ❀°• 𝑱𝒆𝒕 𝑪𝒓𝒂𝒔𝒉𝒆𝒅 •°❀ 💥\n" + LINE + "\n" +
						`✈️ Crashed at: x${fx(crash)}\n` +
						`🎯 Your target: x${fx(target)} ❌\n\n` +
						`🎀 Bet lost: -${fmt(bet)} coins\n` +
						`💳 Balance: ${shortMoney(after)} (${fmt(after)})\n` +
						`🏅 Tier: ${tierEmoji(tier)} ${tier}\n` + LINE + "\n" +
						(near ? pick(NEAR_LINES) : pick(LOSE_LINES)) + "\n🛫 Try again? jet <bet> <x> 💕";
				}

				// wait until the animation finishes (no spoilers), then edit the same message's text
				if (media.wait > 0) await sleep(media.wait);
				const edited = await safeEdit(api, sent.messageID, result, 3);
				if (!edited) return message.reply(result); // fallback if editing is not possible
			} catch (e) {
				if (placed) await changeMoney(usersData, uid, bet).catch(() => { }); // refund if the round never played
				throw e;
			} finally {
				busy.delete(uid);
			}
		} catch (e) {
			if (e.message === "AUTHOR_TAMPERED") return message.reply(TAMPER_MSG);
			console.error("[luckyjet] error:", e);
			return message.reply("😿 Oops, something went wrong: " + e.message);
		}
	}
};
