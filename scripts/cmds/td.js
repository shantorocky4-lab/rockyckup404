/**
 * 🎀 Truth or Dare — GoatBot command (td)
 */

const truths = [
  "তোমার জীবনের সবচেয়ে বড় মিথ্যা কথা কোনটা ছিল?",
  "তুমি গোপনে কার প্রোফাইল সবচেয়ে বেশি দেখো?",
  "তোমার জীবনের সবচেয়ে লজ্জাজনক মুহূর্ত কোনটা?",
  "তুমি কি কখনো পরীক্ষায় নকল করেছ? সত্যি করে বলো!",
  "এই গ্রুপে কাকে তুমি সবচেয়ে বেশি পছন্দ করো?",
  "তোমার সবচেয়ে বড় ভয় কী?",
  "কারও মেসেজ দেখেও ইচ্ছা করে রিপ্লাই দাওনি— কার মেসেজ ছিল?",
  "তোমার ফোনের গ্যালারিতে সবচেয়ে অদ্ভুত ছবি কোনটা?",
  "জীবনে সবচেয়ে বড় ভুল সিদ্ধান্ত কী নিয়েছিলে?",
  "তোমার প্রথম ক্রাশের নামের প্রথম অক্ষর কী?",
  "তুমি কি কখনো বাসা থেকে পালানোর কথা ভেবেছ?",
  "তোমার সবচেয়ে বাজে অভ্যাস কোনটা?",
  "এই গ্রুপের কার সাথে তুমি সবচেয়ে বেশি রাগ করেছ?",
  "কখনো কাউকে ব্লক করেছ? কেন?",
  "তোমার সবচেয়ে প্রিয় মানুষ কে এবং কেন?",
  "যদি একদিনের জন্য অদৃশ্য হতে পারতে, তাহলে কী করতে?",
  "তুমি কি কখনো কারও সামনে কেঁদে ফেলেছ? কেন?",
  "তোমার ফোনে সবচেয়ে বেশি কোন অ্যাপ ব্যবহার করো?",
  "গত এক বছরে সবচেয়ে বড় মিথ্যা কাকে বলেছ?",
  "তুমি কি কখনো গোপনে কারও চ্যাট পড়েছ?",
  "তোমার সবচেয়ে বড় স্বপ্ন কী?",
  "তুমি কি এমন কোনো কাজ করেছ যেটা বাসায় জানলে বকা খেতে?",
  "জীবনে সবচেয়ে বেশি কাকে মিস করো?",
  "তোমার নিজের কোন দোষটা তুমি সবচেয়ে বেশি অপছন্দ করো?",
  "কাউকে কি কখনো ঠকিয়েছ? কীভাবে?",
  "তোমার নামে কি কোনো মজার ডাকনাম আছে? সেটা কী?",
  "এই গ্রুপে কে সবচেয়ে বেশি ফেক বলে তোমার মনে হয়?",
  "সবচেয়ে অদ্ভুত স্বপ্ন কোনটা দেখেছ যেটা এখনো মনে আছে?",
  "তুমি কি কখনো কাউকে প্রপোজ করেছ? ফলাফল কী হয়েছিল?",
  "যদি একটা সিক্রেট সবাইকে বলে দিতে হয়, কোনটা বলবে?",
  "রাত জেগে সবচেয়ে বেশি কী করো?",
  "তোমার সবচেয়ে বড় অনুশোচনা কী?",
  "তুমি কি কখনো কারও জন্য মিথ্যা বলে ফেঁসে গেছ?",
  "বন্ধুদের মধ্যে কাকে তুমি সবচেয়ে কম বিশ্বাস করো?",
  "কখনো কি কাউকে দেখে মনে মনে হিংসা করেছ? কাকে?",
  "তোমার জীবনের সবচেয়ে মজার ঘটনা কোনটা?",
  "তুমি কি এখনো কোনো ছোটবেলার অভ্যাস লুকিয়ে রেখেছ?",
  "যদি জীবনের একটা দিন ফিরে পেতে পারো, কোন দিনটা চাইবে?",
  "তুমি কি কখনো টাকা ধার নিয়ে সময়মতো ফেরত দাওনি?",
  "তোমার সবচেয়ে প্রিয় সিক্রেট জায়গা কোনটা?",
  "কাউকে দেখে প্রথম দেখাতেই কি ভালো লেগেছিল? কাকে?",
  "ফোনের লক স্ক্রিনে কী ছবি আছে? কেন রেখেছ?",
  "তুমি কি কখনো কাউকে ভুল করে মেসেজ পাঠিয়ে বিপদে পড়েছ?",
  "তোমার মতে এই গ্রুপে কে সবচেয়ে মজার মানুষ?",
  "ইনবক্সে সবচেয়ে বেশি কার সাথে কথা বলো?",
  "যদি একটা দোষ বদলাতে পারো, সেটা কোনটা হবে?",
  "কখনো কি ভুল করে অন্য কাউকে 'আই লাভ ইউ' পাঠিয়েছ?",
  "তুমি কি কখনো কারও জন্মদিন ইচ্ছা করে ভুলে গেছ?",
  "তোমার সবচেয়ে বড় সিক্রেট কী যেটা কেউ জানে না?",
  "জীবনে সবচেয়ে বেশি কষ্ট কখন পেয়েছ?",
  "কোন কাজটা করলে তুমি সবচেয়ে বেশি খুশি হও?",
  "বিয়ের জন্য মানুষের মধ্যে তুমি কোন গুণটা সবচেয়ে বেশি খোঁজো?",
  "এমন কোনো কথা আছে যেটা কাউকে বলতে চেয়েও বলতে পারোনি?",
  "তুমি কি কখনো কাউকে ইগনোর করেছ যদিও সে তোমাকে পছন্দ করত?",
  "তোমার সবচেয়ে বড় দুর্বলতা কী?"
];

const dares = [
  "গ্রুপে একটা ভয়েস মেসেজ দিয়ে ১০ সেকেন্ড গান গেয়ে শোনাও! 🎤",
  "তোমার সবচেয়ে বাজে সেলফিটা গ্রুপে পাঠাও! 🤳",
  "গ্রুপের যেকোনো একজনকে 'আই লাভ ইউ' বলে মেসেজ দাও! 😂",
  "পরবর্তী ১০ মিনিট শুধু ইমোজি দিয়ে কথা বলো! 😜",
  "নিজের নিকনেম ১ ঘণ্টার জন্য 'আমি একটা গাধা' রাখো! 🫏",
  "একটা মজার জোকস বলো, সবাইকে হাসাতে না পারলে আবার বলো! 🤣",
  "ভয়েস মেসেজে মুরগির মতো ডাকো! 🐔",
  "গ্রুপের একজনকে ফোন দিয়ে বলো 'আমি তোমার ফ্যান!' 📞",
  "তোমার ফোনের শেষ ছবিটা গ্রুপে শেয়ার করো! 📷",
  "ভয়েস মেসেজে একটা ডায়ালগ ইমোশন দিয়ে বলো! 🎭",
  "পরবর্তী ৫ মিনিট প্রতিটা মেসেজের শেষে '😎' দিয়ে লেখো!",
  "গ্রুপের সবার নাম দিয়ে একটা মজার কবিতা লেখো! ✍️",
  "তোমার প্রোফাইল পিকচার ১ ঘণ্টার জন্য একটা কার্টুন ছবি দিয়ে বদলাও! 🧸",
  "নাচের একটা ভিডিও বানিয়ে গ্রুপে পাঠাও! 💃",
  "ভয়েস মেসেজে ১ থেকে ২০ পর্যন্ত উল্টো গুনে শোনাও, ভুল করলে আবার! 🔢",
  "গ্রুপের যে কাউকে একটা কমপ্লিমেন্ট দাও যেটা শুনে সে লজ্জা পায়! 😳",
  "একটা অদ্ভুত প্রাণীর শব্দ নকল করে ভয়েস মেসেজ দাও! 🦁",
  "নিজের সবচেয়ে প্রিয় গানের দুই লাইন গ্রুপে লিখে দাও! 🎶",
  "পরবর্তী ১০ মিনিট সবার মেসেজে '👍' রিয়্যাক্ট দিতে থাকো!",
  "একটা মজার ছবি আঁকো এবং গ্রুপে পাঠাও! 🎨",
  "তোমার ফোনের চার্জ কত পার্সেন্ট এখন? স্ক্রিনশট দাও! 🔋",
  "গ্রুপের একজনকে বেছে নিয়ে তার একটা ভালো গুণ বলো! 🌟",
  "ইংরেজিতে ১ মিনিট নিজের পরিচয় দাও ভয়েস মেসেজে! 🇬🇧",
  "ভয়েস মেসেজে 'আমি সবচেয়ে সুন্দর' ৩ বার বলো! 😎",
  "গ্রুপে একটা ছোট গল্প বানিয়ে শোনাও যেখানে তুমি হিরো! 🦸",
  "পাশে যে আছে তাকে একটা হাগ দাও এবং ছবি তুলো (সম্মতি নিয়ে)! 🤗",
  "নিজের একটা টিক-টক স্টাইল ভিডিও বানাও! 🎬",
  "পরবর্তী ৩ মিনিট শুধু প্রশ্ন দিয়ে কথা বলো, উত্তর দিলে হেরে গেলে!",
  "ফোনের কন্টাক্ট থেকে র‍্যান্ডম একজনকে 'হ্যালো সুন্দরী/সুন্দর' মেসেজ দাও! 😆",
  "গ্রুপে তোমার সবচেয়ে পুরনো ছবিটা শেয়ার করো! 📸",
  "ভয়েস মেসেজে একটা ভিলেনের মতো হাসি দাও! 😈",
  "বাংলা না বলে শুধু ইংরেজিতে পরবর্তী ৫ মিনিট কথা বলো! 🗣️",
  "তোমার সবচেয়ে বড় ভক্তকে একটা শুভেচ্ছা মেসেজ পাঠাও! 💌",
  "একটা ধাঁধা বানিয়ে গ্রুপে জিজ্ঞেস করো! 🧩",
  "ফোনের ক্যামেরা অন করে তোমার চারপাশের সবচেয়ে অদ্ভুত জিনিসটা দেখাও! 🔍",
  "গ্রুপের সবার জন্য একটা করে ইমোজি বেছে দাও! 😀😎🤩",
  "ভয়েস মেসেজে একটা রোবটের মতো কথা বলো! 🤖",
  "১ মিনিটের মধ্যে ৫টা ফলের নাম বলো, ভুল হলে আবার! 🍎",
  "গ্রুপে 'আমি আজ থেকে ভালো ছেলে/মেয়ে' লিখে প্রতিজ্ঞা করো! 🙏",
  "তোমার প্রিয় সিনেমার একটা ডায়ালগ ভয়েসে বলো! 🎥",
  "তোমার নামের প্রতিটা অক্ষর দিয়ে একটা করে মজার শব্দ বানাও! 🔤",
  "গ্রুপের একজনকে মজার একটা ডাকনাম দাও যেটা সবাই ১ ঘণ্টা ব্যবহার করবে! 🏷️",
  "চোখ বন্ধ করে নিজের নাম কাগজে লিখে সেই ছবি পাঠাও! ✍️",
  "ভয়েস মেসেজে একটা বিজ্ঞাপনের মতো করে নিজেকে বিক্রি করো! 📢",
  "পরবর্তী ১০ মিনিট সবার মেসেজের উত্তরে 'জি স্যার' বলো! 🫡",
  "পানি না খেয়ে ১ মিনিটে ৫টা কঠিন শব্দ বলো (জিভ-পাকানো)! 👅",
  "গ্রুপে তোমার সবচেয়ে অদ্ভুত খাবারের কম্বিনেশন শেয়ার করো! 🍛",
  "তোমার হাতের লেখা দিয়ে 'I am the best' লিখে ছবি পাঠাও! 😄",
  "একটা ছোট্ট ভিডিও করে সবাইকে গুড মর্নিং/নাইট উইশ করো! 🌙",
  "ফোনের ব্রাউজারে সর্বশেষ কী সার্চ করেছিলে সেটা বলো! 🔎",
  "গ্রুপে ৩টা সত্যি আর ১টা মিথ্যা বলো, সবাই ধরুক কোনটা মিথ্যা! 🕵️",
  "ভয়েস মেসেজে বিড়ালের মতো মিউ মিউ করো ১০ সেকেন্ড! 🐱",
  "পরবর্তী ১৫ মিনিট কোনো ফোন ঘাঁটবে না, ফিরে এসে জানাও! ⏳"
];

const _crypto = require("crypto");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lastUsed = new Map();
const pending = new Map(); // task card messageID -> timeout timer

const LINE = "♡┈┈┈┈┈┈┈┈┈┈┈┈♡";

// ---- 💰 Reward / Penalty / Time (এখান থেকে বদলাতে পারবে) ----
const REWARD = 1_000_000; // সময়ের মধ্যে reply দিলে পাবে
const PENALTY = 1_000_000; // reply না দিলে কাটা যাবে (balance এর বেশি কাটবে না)
const TASK_TIMEOUT = 2 * 60 * 1000; // 2 minutes

// ================== 🔒 PROTECTION (এই অংশ বদলালে কমান্ড কাজ করবে না) ==================
const _SALT = "rk#9fQ2!vLx7";
const _AUTH_HASH = "ca0127ca8898e700708cf32fe30a66c5eb0237fefff4aa2126f67dec81bdd689";
const _GUARD_HASH = "67b8ad91500b85033822616c665d47233a1e2da90b6659192b5ad2847f5c664f";

function _hashOf(s) {
  return _crypto.createHash("sha256").update(String(s)).digest("hex");
}

function _verifyAuthor(a) {
  return typeof a === "string" && _hashOf(a + _SALT) === _AUTH_HASH;
}

function _integrity() {
  const material =
    [_hashOf, _verifyAuthor, _integrity]
      .map((f) => f.toString().replace(/\s+/g, ""))
      .join("|") +
    _AUTH_HASH +
    _SALT;
  return _hashOf(material) === _GUARD_HASH;
}

function _alive() {
  return _verifyAuthor(_command.config.author) && _integrity();
}
// ====================================================================================

function shortMoney(n) {
  const suf = ["", "K", "M", "B", "T", "QA", "QI"];
  let num = Number(n) || 0;
  let i = 0;
  while (Math.abs(num) >= 1000 && i < suf.length - 1) {
    num /= 1000;
    i++;
  }
  return `${Number(num.toFixed(2))}${suf[i]}`;
}

const FRAMES = {
  truth: ["💭  𝒕𝒉𝒊𝒏𝒌𝒊𝒏𝒈...", "🎀  𝒑𝒊𝒄𝒌𝒊𝒏𝒈...", "💙  𝒓𝒆𝒂𝒅𝒚~"],
  dare: ["🔥  𝒄𝒉𝒐𝒐𝒔𝒊𝒏𝒈...", "🎯  𝒂𝒊𝒎𝒊𝒏𝒈...", "❤️‍🔥  𝒓𝒆𝒂𝒅𝒚~"],
  random: ["🪙  𝒇𝒍𝒊𝒑𝒑𝒊𝒏𝒈...", "🎲  𝒓𝒐𝒍𝒍𝒊𝒏𝒈...", "✨  𝒓𝒆𝒂𝒅𝒚~"]
};

function pickRandom(list, key) {
  let index;
  let tries = 0;
  do {
    index = Math.floor(Math.random() * list.length);
    tries++;
  } while (lastUsed.get(key) === index && tries < 5);
  lastUsed.set(key, index);
  return { text: list[index], number: index + 1 };
}

function parseChoice(input) {
  const t = (input || "").toLowerCase().trim();
  if (["1", "truth", "t", "সত্য"].includes(t)) return "truth";
  if (["2", "dare", "d", "সাহস"].includes(t)) return "dare";
  if (["3", "random", "r", "rand"].includes(t)) return "random";
  if (["0", "stop", "end", "exit", "cancel"].includes(t)) return "stop";
  return null;
}

function frameText(frame) {
  return `🎀 ❀°• 𝑻𝒓𝒖𝒕𝒉 𝒐𝒓 𝑫𝒂𝒓𝒆 •°❀ 🎀\n\n${frame}`;
}

function menuText(name) {
  return (
    `🎀 ❀°• 𝑻𝒓𝒖𝒕𝒉 𝒐𝒓 𝑫𝒂𝒓𝒆 •°❀ 🎀\n` +
    `${LINE}\n\n` +
    `💌 𝒉𝒆𝒚 ${name}~\n\n` +
    `1️⃣  𝑻𝒓𝒖𝒕𝒉 💙\n` +
    `2️⃣  𝑫𝒂𝒓𝒆 🔥\n` +
    `3️⃣  𝑹𝒂𝒏𝒅𝒐𝒎 🎲\n\n` +
    `${LINE}\n` +
    `💬 𝒓𝒆𝒑𝒍𝒚 𝒘𝒊𝒕𝒉 1, 2 𝒐𝒓 3\n` +
    `🛑 0 𝒕𝒐 𝒔𝒕𝒐𝒑`
  );
}

function cardText(type, name, item) {
  const isTruth = type === "truth";
  return (
    `${isTruth ? "💙" : "🔥"} ❀°• ${isTruth ? "𝑻𝒓𝒖𝒕𝒉" : "𝑫𝒂𝒓𝒆"} •°❀ ${isTruth ? "💙" : "🔥"}\n` +
    `${LINE}\n\n` +
    `🌸 ${name}  •  #${item.number}\n\n` +
    `💌 ${item.text}\n\n` +
    `${LINE}\n` +
    `⏳ 𝒓𝒆𝒑𝒍𝒚 𝒘𝒊𝒕𝒉𝒊𝒏 ${TASK_TIMEOUT / 60000} 𝒎𝒊𝒏  →  +${shortMoney(REWARD)} 💰\n` +
    `😿 𝒏𝒐 𝒓𝒆𝒑𝒍𝒚  →  -${shortMoney(PENALTY)} 💸`
  );
}

function resultText(ans, name, item, cut, balance) {
  if (ans === "done") {
    return (
      `🎉 ❀°• 𝑪𝒐𝒎𝒑𝒍𝒆𝒕𝒆𝒅 •°❀ 🎉\n` +
      `${LINE}\n\n` +
      `🌸 ${name}  •  #${item.number}\n` +
      `✨ 𝒘𝒆𝒍𝒍 𝒅𝒐𝒏𝒆~\n\n` +
      `💰 +${shortMoney(REWARD)}\n` +
      `💲 𝒃𝒂𝒍𝒂𝒏𝒄𝒆: ${shortMoney(balance)}\n\n` +
      `${LINE}`
    );
  }
  return (
    `⏰ ❀°• 𝑻𝒊𝒎𝒆 𝑼𝒑 •°❀ ⏰\n` +
    `${LINE}\n\n` +
    `🌸 ${name}  •  #${item.number}\n` +
    `🥺 𝒏𝒐 𝒓𝒆𝒑𝒍𝒚 𝒊𝒏 ${TASK_TIMEOUT / 60000} 𝒎𝒊𝒏~\n\n` +
    `💸 -${shortMoney(cut)}\n` +
    `💲 𝒃𝒂𝒍𝒂𝒏𝒄𝒆: ${shortMoney(balance)}\n\n` +
    `${LINE}`
  );
}

function playAgainText(name) {
  return (
    `🎀 ❀°• 𝑷𝒍𝒂𝒚 𝑨𝒈𝒂𝒊𝒏? •°❀ 🎀\n` +
    `${LINE}\n\n` +
    `💌 ${name}, 𝒘𝒂𝒏𝒏𝒂 𝒑𝒍𝒂𝒚 𝒎𝒐𝒓𝒆?\n\n` +
    `1️⃣  𝑻𝒓𝒖𝒕𝒉 💙\n` +
    `2️⃣  𝑫𝒂𝒓𝒆 🔥\n` +
    `3️⃣  𝑹𝒂𝒏𝒅𝒐𝒎 🎲\n\n` +
    `${LINE}\n` +
    `💬 𝒓𝒆𝒑𝒍𝒚 𝒘𝒊𝒕𝒉 1, 2 𝒐𝒓 3\n` +
    `🛑 0 𝒕𝒐 𝒔𝒕𝒐𝒑`
  );
}

// ---- helpers ----
function sendMsg(api, event, text) {
  return new Promise((resolve, reject) => {
    api.sendMessage(
      text,
      event.threadID,
      (err, info) => {
        if (!err) return resolve(info);
        // reply করা মেসেজ না পেলে সাধারণ মেসেজ হিসেবে আবার চেষ্টা
        api.sendMessage(text, event.threadID, (err2, info2) =>
          err2 ? reject(err2) : resolve(info2)
        );
      },
      event.messageID
    );
  });
}

async function safeEdit(api, messageID, text, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await api.editMessage(text, messageID);
      return true;
    } catch (e) {
      if (attempt === retries) {
        console.log("editMessage failed after retries:", e);
        return false;
      }
      await delay(300);
    }
  }
  return false;
}

// td লেখার পর প্রথমে একটা ছোট মেসেজ যায়, সেটা delete হয়, তারপর আসল editing মেসেজ আসে
async function introThenDelete(api, event) {
  try {
    const info = await sendMsg(api, event, "🎀 𝒍𝒐𝒂𝒅𝒊𝒏𝒈~ 💫");
    await delay(700);
    await api.unsendMessage(info.messageID);
  } catch (e) {
    console.log("intro message failed:", e);
  }
}

function registerReply(info, event, commandName, extra = {}) {
  global.GoatBot.onReply.set(info.messageID, {
    commandName,
    messageID: info.messageID,
    threadID: event.threadID,
    stage: "menu",
    ...extra
  });
}

async function play(choice, { api, event, usersData, commandName }) {
  if (!_alive()) return;

  const name = (await usersData.getName(event.senderID)) || "Player";

  let type = choice;
  if (choice === "random") type = Math.random() < 0.5 ? "truth" : "dare";

  const list = type === "truth" ? truths : dares;
  const item = pickRandom(list, `${event.threadID}_${type}`);
  const frames = FRAMES[choice];

  // first "animation" frame
  const sent = await sendMsg(api, event, frameText(frames[0]));

  // edit through the remaining frames
  for (let i = 1; i < frames.length; i++) {
    await delay(500);
    await safeEdit(api, sent.messageID, frameText(frames[i]));
  }
  await delay(500);

  // final card
  const text = cardText(type, name, item);
  let cardID = sent.messageID;
  const ok = await safeEdit(api, cardID, text);
  if (!ok) {
    const info = await sendMsg(api, event, text);
    cardID = info.messageID;
  }

  const data = {
    stage: "task",
    playerID: event.senderID,
    name,
    item,
    triggerID: event.messageID
  };
  registerReply({ messageID: cardID }, event, commandName, data);

  // ⏳ ২ মিনিটের মধ্যে reply না দিলে balance কাটা যাবে
  const timer = setTimeout(async () => {
    if (!pending.has(cardID)) return; // আগেই reply পেয়ে গেছে
    pending.delete(cardID);
    global.GoatBot.onReply.delete(cardID);
    try {
      await settle(
        "timeout",
        { ...data, messageID: cardID, threadID: event.threadID },
        {
          api,
          event: { threadID: event.threadID, messageID: event.messageID },
          usersData,
          commandName
        }
      );
    } catch (e) {
      console.log("[td] timeout settle failed:", e);
    }
  }, TASK_TIMEOUT);
  pending.set(cardID, timer);
}

// reply পেলে (done) বা সময় শেষ হলে (timeout): balance update → card delete → result → "play again"
async function settle(ans, Reply, { api, event, usersData, commandName }) {
  if (!_alive()) return;

  const playerID = String(Reply.playerID);
  const userData = (await usersData.get(playerID)) || {};
  const balance = Number(userData.money) || 0;

  let cut = 0;
  let newBalance;
  if (ans === "done") {
    newBalance = balance + REWARD;
  } else {
    cut = Math.min(balance, PENALTY);
    newBalance = balance - cut;
  }

  // ---- balance save (দুইভাবে চেষ্টা করবে যাতে মিস না হয়) ----
  try {
    const update = { money: newBalance };
    if (userData.data) update.data = userData.data;
    await usersData.set(playerID, update);

    const check = (await usersData.get(playerID)) || {};
    if (Number(check.money) !== newBalance) {
      await usersData.set(playerID, newBalance, "money");
    }
  } catch (e) {
    console.log("[td] balance update failed:", e);
  }

  const finalData = (await usersData.get(playerID)) || {};
  const shownBalance = Number(finalData.money);
  const text = resultText(
    ans,
    Reply.name,
    Reply.item,
    cut,
    Number.isFinite(shownBalance) ? shownBalance : newBalance
  );

  // ---- আগের task card delete, তারপর নতুন result মেসেজ ----
  let deleted = false;
  try {
    await api.unsendMessage(Reply.messageID);
    deleted = true;
  } catch (e) {
    console.log("[td] unsend card failed:", e);
  }

  if (deleted) {
    await sendMsg(api, event, text);
  } else {
    const ok = await safeEdit(api, Reply.messageID, text);
    if (!ok) await sendMsg(api, event, text);
  }

  await delay(600);
  const info = await sendMsg(api, event, playAgainText(Reply.name));
  registerReply(info, event, commandName);
}

const _command = {
  config: {
    name: "td",
    aliases: ["truthdare", "truthordare"],
    version: "3.0.0",
    author: "Rocky",
    countDown: 3,
    role: 0,
    description: {
      en: "Cute Truth or Dare game with lots of truths and dares"
    },
    category: "game",
    guide: {
      en: "{pn} → Game menu\n{pn} truth → Random truth\n{pn} dare → Random dare\n{pn} random → Truth or Dare randomly"
    }
  },

  onStart: async function ({ api, message, event, args, usersData }) {
    if (!_alive()) return;

    const commandName = _command.config.name;
    const choice = parseChoice(args[0]);

    if (choice === "stop") {
      return message.reply("🌸 𝒈𝒂𝒎𝒆 𝒆𝒏𝒅𝒆𝒅~ 𝒕𝒚𝒑𝒆 td 𝒕𝒐 𝒑𝒍𝒂𝒚 𝒂𝒈𝒂𝒊𝒏 🎀");
    }

    await introThenDelete(api, event);

    if (choice) {
      return play(choice, { api, event, usersData, commandName });
    }

    const name = (await usersData.getName(event.senderID)) || "Player";
    const info = await sendMsg(api, event, menuText(name));
    registerReply(info, event, commandName);
  },

  onReply: async function ({ api, message, event, Reply, usersData }) {
    if (!_alive()) return;

    const commandName = _command.config.name;

    // ---- task card: ২ মিনিটের মধ্যে যেকোনো reply দিলেই balance পাবে ----
    if (Reply.stage === "task") {
      if (String(event.senderID) !== String(Reply.playerID)) return; // শুধু যে task পেয়েছে সে-ই
      if (!pending.has(Reply.messageID)) return; // সময় শেষ / আগেই নেওয়া হয়ে গেছে

      clearTimeout(pending.get(Reply.messageID));
      pending.delete(Reply.messageID);
      global.GoatBot.onReply.delete(Reply.messageID);

      return settle("done", Reply, { api, event, usersData, commandName });
    }

    // ---- menu / play again ----
    const choice = parseChoice(event.body);
    if (!choice) return;

    global.GoatBot.onReply.delete(Reply.messageID);

    if (choice === "stop") {
      return message.reply("🌸 𝒈𝒂𝒎𝒆 𝒆𝒏𝒅𝒆𝒅~ 𝒕𝒚𝒑𝒆 td 𝒕𝒐 𝒑𝒍𝒂𝒚 𝒂𝒈𝒂𝒊𝒏 🎀");
    }

    return play(choice, { api, event, usersData, commandName });
  }
};

// author বা protection বদলানো হলে এই লক-মডিউল লোড হবে, গেম চলবে না
const _locked = {
  config: _command.config,
  onStart: async function ({ message }) {
    return message.reply("⛔ 𝒕𝒉𝒊𝒔 𝒇𝒊𝒍𝒆 𝒘𝒂𝒔 𝒎𝒐𝒅𝒊𝒇𝒊𝒆𝒅 ~ 𝒂𝒖𝒕𝒉𝒐𝒓 𝒄𝒉𝒆𝒄𝒌 𝒇𝒂𝒊𝒍𝒆𝒅");
  },
  onReply: async function () {}
};

module.exports = _alive() ? _command : _locked;
