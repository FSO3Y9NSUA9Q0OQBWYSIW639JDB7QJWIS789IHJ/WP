const fs = require("fs");
const readline = require("readline");
const pino = require("pino");
const NodeCache = require("node-cache");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askNumber() {
  return new Promise(resolve => {
    rl.question("Enter your number (with country code): ", input => {
      const cleanPhone = input.replace(/[^0-9]/g, "");
      if (cleanPhone.length < 11) {
        console.log("❌ Invalid number! Try again.");
        process.exit(1);
      }
      resolve(cleanPhone);
    });
  });
}

async function startWhatsAppSession(cleanPhone) {
  const sessionPath = `./sessions/${cleanPhone}`;
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const msgRetryCounterCache = new NodeCache();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.windows('Firefox'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    msgRetryCounterCache,
  });

  sock.ev.on("creds.update", saveCreds);

  const requestPairing = async () => {
    if (!sock.authState || sock.authState.creds.registered) {
      console.log("✅ Already registered.");
      return;
    }
    try {
      const code = await sock.requestPairingCode(cleanPhone);
      console.log(`📌 Pairing Code: ${code}`);
    } catch (err) {
      console.log(`⚠️ Error requesting code: ${err.message}`);
    }
  };

  // Initial call + loop every 5 seconds
  setInterval(requestPairing, 5000);
}

(async () => {
  const phone = await askNumber();
  rl.close();
  startWhatsAppSession(phone);
})();
