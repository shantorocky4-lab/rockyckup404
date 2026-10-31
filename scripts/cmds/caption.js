/**
 * Premium Caption Generator — GoatBot Plugin
 * Author: Rocky
 *
 * NOTE: This plugin is locked to its original author credit.
 * If the "credits" field below is changed from "Rocky", the plugin
 * will refuse to run. This is intentional and by design.
 */

const AUTHOR_LOCK = "Rocky";

const fontMaps = {
	bold: {
		a: "𝗮", b: "𝗯", c: "𝗰", d: "𝗱", e: "𝗲", f: "𝗳", g: "𝗴", h: "𝗵", i: "𝗶",
		j: "𝗷", k: "𝗸", l: "𝗹", m: "𝗺", n: "𝗻", o: "𝗼", p: "𝗽", q: "𝗾", r: "𝗿",
		s: "𝘀", t: "𝘁", u: "𝘂", v: "𝘃", w: "𝘄", x: "𝘅", y: "𝘆", z: "𝘇",
		A: "𝗔", B: "𝗕", C: "𝗖", D: "𝗗", E: "𝗘", F: "𝗙", G: "𝗚", H: "𝗛", I: "𝗜",
		J: "𝗝", K: "𝗞", L: "𝗟", M: "𝗠", N: "𝗡", O: "𝗢", P: "𝗣", Q: "𝗤", R: "𝗥",
		S: "𝗦", T: "𝗧", U: "𝗨", V: "𝗩", W: "𝗪", X: "𝗫", Y: "𝗬", Z: "𝗭"
	},
	italic: {
		a: "𝘢", b: "𝘣", c: "𝘤", d: "𝘥", e: "𝘦", f: "𝘧", g: "𝘨", h: "𝘩", i: "𝘪",
		j: "𝘫", k: "𝘬", l: "𝘭", m: "𝘮", n: "𝘯", o: "𝘰", p: "𝘱", q: "𝘲", r: "𝘳",
		s: "𝘴", t: "𝘵", u: "𝘶", v: "𝘷", w: "𝘸", x: "𝘹", y: "𝘺", z: "𝘻",
		A: "𝘈", B: "𝘉", C: "𝘊", D: "𝘋", E: "𝘌", F: "𝘍", G: "𝘎", H: "𝘏", I: "𝘐",
		J: "𝘑", K: "𝘒", L: "𝘓", M: "𝘔", N: "𝘕", O: "𝘖", P: "𝘗", Q: "𝘘", R: "𝘙",
		S: "𝘚", T: "𝘛", U: "𝘜", V: "𝘝", W: "𝘞", X: "𝘟", Y: "𝘠", Z: "𝘡"
	},
	script: {
		a: "𝓪", b: "𝓫", c: "𝓬", d: "𝓭", e: "𝓮", f: "𝓯", g: "𝓰", h: "𝓱", i: "𝓲",
		j: "𝓳", k: "𝓴", l: "𝓵", m: "𝓶", n: "𝓷", o: "𝓸", p: "𝓹", q: "𝓺", r: "𝓻",
		s: "𝓼", t: "𝓽", u: "𝓾", v: "𝓿", w: "𝔀", x: "𝔁", y: "𝔂", z: "𝔃",
		A: "𝓐", B: "𝓑", C: "𝓒", D: "𝓓", E: "𝓔", F: "𝓕", G: "𝓖", H: "𝓗", I: "𝓘",
		J: "𝓙", K: "𝓚", L: "𝓛", M: "𝓜", N: "𝓝", O: "𝓞", P: "𝓟", Q: "𝓠", R: "𝓡",
		S: "𝓢", T: "𝓣", U: "𝓤", V: "𝓥", W: "𝓦", X: "𝓧", Y: "𝓨", Z: "𝓩"
	},
	doubleStruck: {
		a: "𝕒", b: "𝕓", c: "𝕔", d: "𝕕", e: "𝕖", f: "𝕗", g: "𝕘", h: "𝕙", i: "𝕚",
		j: "𝕛", k: "𝕜", l: "𝕝", m: "𝕞", n: "𝕟", o: "𝕠", p: "𝕡", q: "𝕢", r: "𝕣",
		s: "𝕤", t: "𝕥", u: "𝕦", v: "𝕧", w: "𝕨", x: "𝕩", y: "𝕪", z: "𝕫",
		A: "𝔸", B: "𝔹", C: "ℂ", D: "𝔻", E: "𝔼", F: "𝔽", G: "𝔾", H: "ℍ", I: "𝕀",
		J: "𝕁", K: "𝕂", L: "𝕃", M: "𝕄", N: "ℕ", O: "𝕆", P: "ℙ", Q: "ℚ", R: "ℝ",
		S: "𝕊", T: "𝕋", U: "𝕌", V: "𝕍", W: "𝕎", X: "𝕏", Y: "𝕐", Z: "ℤ"
	},
	monospace: {
		a: "𝚊", b: "𝚋", c: "𝚌", d: "𝚍", e: "𝚎", f: "𝚏", g: "𝚐", h: "𝚑", i: "𝚒",
		j: "𝚓", k: "𝚔", l: "𝚕", m: "𝚖", n: "𝚗", o: "𝚘", p: "𝚙", q: "𝚚", r: "𝚛",
		s: "𝚜", t: "𝚝", u: "𝚞", v: "𝚟", w: "𝚠", x: "𝚡", y: "𝚢", z: "𝚣",
		A: "𝙰", B: "𝙱", C: "𝙲", D: "𝙳", E: "𝙴", F: "𝙵", G: "𝙶", H: "𝙷", I: "𝙸",
		J: "𝙹", K: "𝙺", L: "𝙻", M: "𝙼", N: "𝙽", O: "𝙾", P: "𝙿", Q: "𝚀", R: "𝚁",
		S: "𝚂", T: "𝚃", U: "𝚄", V: "𝚅", W: "𝚆", X: "𝚇", Y: "𝚈", Z: "𝚉"
	},
	smallCaps: {
		a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ",
		j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ",
		s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
		A: "ᴀ", B: "ʙ", C: "ᴄ", D: "ᴅ", E: "ᴇ", F: "ꜰ", G: "ɢ", H: "ʜ", I: "ɪ",
		J: "ᴊ", K: "ᴋ", L: "ʟ", M: "ᴍ", N: "ɴ", O: "ᴏ", P: "ᴘ", Q: "ǫ", R: "ʀ",
		S: "s", T: "ᴛ", U: "ᴜ", V: "ᴠ", W: "ᴡ", X: "x", Y: "ʏ", Z: "ᴢ"
	}
};

const decorations = [
	{ left: "『 ", right: " 』" },
	{ left: "✧⁠ ", right: " ⁠✧" },
	{ left: "꧁ ", right: " ꧂" },
	{ left: "☆ ", right: " ☆" },
	{ left: "『⋆", right: "⋆』" },
	{ left: "»» ", right: " ««" },
	{ left: "✰ ", right: " ✰" },
	{ left: "❝ ", right: " ❞" },
	{ left: "⊹⊱ ", right: " ⊰⊹" },
	{ left: "", right: "" }
];

const connectors = ["", " 🔥", " ✨", " 💯", " 🌸", " 💫", " 🌙", " ⚡", " 🖤", " 🌊", " 🦋", " 🥀"];

// Fixed, hand-written caption bank
const captionBank = [
	"Stay wild, stay free.",
	"Making memories one day at a time.",
	"Good vibes only.",
	"Chasing dreams under the same sky.",
	"Life is short, make it sweet.",
	"Not perfect, just real.",
	"Building my own kind of sunshine.",
	"Collecting moments, not things.",
	"Doing me, better than yesterday.",
	"Confidence level: selfie with no filter.",
	"Some people call it madness, I call it magic.",
	"Living my life in my own lane.",
	"Success is the best revenge.",
	"Started from the bottom, still climbing.",
	"Be a voice, not an echo.",
	"Silence speaks louder than words sometimes.",
	"Grateful for the small things.",
	"Never let yesterday take up too much of today.",
	"Work hard in silence, let success make the noise.",
	"Different roads sometimes lead to the same castle.",
	"Turning dreams into plans.",
	"Life is better when you're laughing.",
	"Be the energy you want to attract.",
	"Making my own history.",
	"Every day is a fresh start.",
	"Smile, it confuses people.",
	"Not everyone will understand your journey, that's fine.",
	"I don't chase, I attract.",
	"Focused on the goal, not the noise.",
	"Simplicity is the ultimate sophistication.",
	"Trust the timing of your life.",
	"Kindness is a language everyone understands.",
	"Dream big, work hard, stay humble.",
	"Peace begins with a smile.",
	"Own your story, it's the only one like it.",
	"Better an oops than a what if.",
	"Wander often, wonder always.",
	"Choose people who choose you back.",
	"Little by little, one travels far.",
	"Create your own sunshine on a cloudy day.",
	"Stay humble, hustle hard.",
	"The best view comes after the hardest climb.",
	"You are enough, just as you are.",
	"Positive mind, positive life.",
	"Everything happens for a reason.",
	"Keep calm and carry on.",
	"Be so busy improving yourself you have no time for anyone else.",
	"Growth is never by mere chance.",
	"Do it with passion or not at all.",
	"Happiness is homemade.",
	"Faith over fear, always."
];

// Template pieces — combined at random to generate near-endless fresh captions
// on top of the fixed bank above, so the pool effectively never runs out.
const openers = [
	"Living for", "Chasing", "Grateful for", "Obsessed with", "Built for",
	"Made for", "Running toward", "Falling in love with", "Здесь ради",
	"Here for", "All about", "Dreaming of", "Working toward", "Focused on",
	"Blessed with", "Thankful for", "Proud of", "Fighting for", "Standing for",
	"Believing in"
];
const middles = [
	"quiet mornings", "loud dreams", "bigger goals", "new beginnings",
	"good energy", "real connections", "small wins", "late night thoughts",
	"honest moments", "slow progress", "bold choices", "simple joys",
	"another chapter", "the little things", "second chances", "wild ideas",
	"peace of mind", "my own pace", "unshakable faith", "endless growth"
];
const closers = [
	"and nothing less.", "one day at a time.", "no matter what.",
	"and never looking back.", "with an open heart.", "every single day.",
	"and loving the process.", "without any excuses.", "and staying grateful.",
	"and trusting the journey.", "with all I've got.", "one step further.",
	"and letting go of the rest.", "and enjoying the ride."
];

function toStyledFont(text, fontName) {
	const map = fontMaps[fontName] || fontMaps.bold;
	return text.split("").map((ch) => map[ch] || ch).join("");
}

function getRandomItem(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function buildTemplateCaption() {
	return `${getRandomItem(openers)} ${getRandomItem(middles)} ${getRandomItem(closers)}`;
}

function generateCaption() {
	// ~50% fixed bank, ~50% freshly composed template sentence.
	const base = Math.random() < 0.5 ? getRandomItem(captionBank) : buildTemplateCaption();
	const emoji = getRandomItem(connectors);
	const fontNames = Object.keys(fontMaps);
	const font = getRandomItem(fontNames);
	const deco = getRandomItem(decorations);

	const styled = toStyledFont(base + emoji, font);
	return `${deco.left}${styled}${deco.right}`;
}

function isLocked() {
	return module.exports.config.credits !== AUTHOR_LOCK;
}

module.exports.config = {
	name: "caption",
	version: "2.1.0",
	hasPermssion: 0,
	credits: "Rocky",
	description: "Premium unlimited English caption generator — works with no command prefix.",
	commandCategory: "fun",
	usages: "caption [number]",
	cooldowns: 2,
	usePrefix: false // GoatBot's official no-prefix flag — keeps this as the ONLY handler, so no duplicate replies
};

// Single handler. Because usePrefix is false, GoatBot calls this directly
// whenever a message starts with "caption" — no separate onChat needed,
// which is what was causing the double reply before.
module.exports.onStart = async function ({ message, args }) {
	if (isLocked()) return;

	let count = parseInt(args[0]);
	if (!count || count < 1) count = 1;
	if (count > 20) count = 20;

	const lines = [];
	for (let i = 0; i < count; i++) lines.push(generateCaption());

	return message.reply(lines.join("\n\n"));
};
