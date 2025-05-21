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

async function requestCodeLoop(phone) {
  const sessionPath = `./sessions/${phone}`;

  const run = async () => {
    try {
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

      // Try to request pairing code
      try {
        const code = await sock.requestPairingCode(phone);
        console.log(`📌 Pairing Code: ${code}`);
      } catch (err) {
        console.log(`⚠️ Error requesting code: ${err.message}`);
      }

      // Wait 5 seconds
      await new Promise(res => setTimeout(res, 5000));

      // Delete session folder
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ Deleted session folder for ${phone}`);
      }

    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }

    // Repeat again
    run();
  };

  run();
}

// Start
(async () => {
  const phone = await askNumber();
  rl.close();
  requestCodeLoop(phone);
})();
