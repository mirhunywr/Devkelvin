console.clear();
console.log('🚀 Starting Jexploit Bot with Baileys v7.0.0-rc.9...');

const isProduction = process.env.NODE_ENV === 'production';
const isLowMemory = process.env.MEMORY_LIMIT < 512 || isProduction;

// Optimize memory usage
if (isLowMemory) {
  console.log('🚀 Running in optimized mode for cloud/low memory environment');
}

const settings = require('./settings');
const config = require('./config');

// Enhanced error handling for cloud stability
process.on("uncaughtException", (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ========== BAILEYS v7 IMPORT - UPDATED ==========
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  getContentType,
  proto,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  getAggregateVotesInPollMessage
} = require("@whiskeysockets/baileys");

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const readline = require("readline");
const fs = require('fs');
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const NodeCache = require("node-cache");
const lolcatjs = require('lolcatjs');
const util = require('util');
const axios = require('axios');
const moment = require('moment-timezone');
const FileType = require('file-type');
const PhoneNumber = require('awesome-phonenumber');

// Global variables
const more = String.fromCharCode(8206);
const readmore = more.repeat(4001);
const timezones = global.timezones || "Africa/Kampala";

// Import your existing functions
const {
  smsg,
  formatSize,
  isUrl,
  generateMessageTag,
  getBuffer,
  getSizeMedia,
  runtime,
  fetchJson,
} = require('./start/lib/myfunction');

const { detectUrls } = require('./Jex');

const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid
} = require('./start/lib/exif');

// Use system temp directory
const TMP_DIR = isProduction 
  ? path.join(os.tmpdir(), 'jexploit-bot-tmp')
  : path.join(__dirname, 'tmp');

const usePairingCode = true;

const question = (text) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(text, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// ========== SESSION HANDLING - UPDATED FOR v7 ==========
const sessionDir = path.join(__dirname, 'sessions');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

async function loadSession() {
  try {
    if (!settings.SESSION_ID) {
      console.log('No SESSION_ID provided - QR login will be generated');
      return null;
    }

    console.log('[ ⏳ ] Downloading creds data...');
    console.log('[ 🆔️ ] Downloading MEGA.nz session...');
    
    const megaFileId = settings.SESSION_ID.startsWith('Jexploit~') 
      ? settings.SESSION_ID.replace("Jexploit~", "") 
      : settings.SESSION_ID;

    // Note: MEGA download logic aap ka waisa hi rahega
    // Yahan temporary ke liye simple implementation
    console.log('[ ⚠️ ] MEGA session logic requires megajs implementation');
    return null;
    
  } catch (error) {
    console.error('❌ Error loading session:', error.message);
    console.log('Will generate QR code instead');
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanupTmpFiles() {
  try {
    if (fs.existsSync(TMP_DIR)) {
      const files = fs.readdirSync(TMP_DIR);
      let deletedCount = 0;
      files.forEach(file => {
        try {
          const filePath = path.join(TMP_DIR, file);
          const stats = fs.statSync(filePath);
          const maxAge = isProduction ? 30 * 60 * 1000 : 60 * 60 * 1000;
          if (Date.now() - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (e) {
          // Ignore errors
        }
      });
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} temporary files`);
      }
    }
  } catch (error) {
    console.log('Cleanup error:', error.message);
  }
}

function monitorResources() {
  if (isLowMemory) {
    const used = process.memoryUsage();
    const memoryUsage = {
      rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(used.external / 1024 / 1024 * 100) / 100
    };
    
    if (memoryUsage.heapUsed > 150) {
      console.warn('⚠️ High memory usage:', memoryUsage);
      if (global.gc) {
        global.gc();
        console.log('🗑️ Garbage collection triggered');
      }
    }
  }
}

// ========== BOT START FUNCTION - UPDATED FOR v7 ==========
async function clientstart() {
  // Load session if available
  const creds = await loadSession();
  
  // Use multi-file auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  
  // Fetch latest version
  let waVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    waVersion = version;
    console.log("[JEXPLOIT] Connecting to WhatsApp ⏳️...");
  } catch (error) {
    console.log(chalk.yellow(`[⚠️] Using stable fallback version`));
    waVersion = [2, 3000, 1017546695];
  }

  // ========== CREATE SOCKET WITH v7 CONFIG ==========
  const conn = makeWASocket({
    // Connection settings
    printQRInTerminal: !usePairingCode,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000, // Reduced for faster connection
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 25000,
    maxRetries: 5,
    
    // Performance optimizations
    generateHighQualityLinkPreview: false,
    linkPreviewImageThumbnailWidth: 64,
    
    // Version
    version: waVersion,
    
    // Browser - v7 compatible format
    browser: Browsers.ubuntu('Chrome'),
    
    // Minimal logging
    logger: pino({ level: 'silent' }),
    
    // Auth state
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    
    // v7 specific options
    fireInitQueries: false,
    emitOwnEvents: true,
    defaultCongestionControl: 1,
    
    // Performance options
    transactionOpts: {
      maxCommitRetries: 2,
      delayBeforeRetry: 1000
    }
  });

  // ========== DECODE JID FUNCTION - UPDATED FOR LID SUPPORT ==========
  conn.decodeJid = (jid) => {
    if (!jid) return jid;
    
    // Agar pehle se hi JID format mein hai
    if (jid.includes('@')) {
      return jid;
    }
    
    // Agar sirf number hai
    if (/^\d+$/.test(jid)) {
      return jid + '@s.whatsapp.net';
    }
    
    return jid;
  };

  // Store for contacts and messages
  const { makeInMemoryStore } = require("./start/lib/store/");
  const store = makeInMemoryStore({
    logger: pino().child({ level: 'silent', stream: 'store' })
  });
  store.bind(conn.ev);

  // ========== MESSAGE HANDLER ==========
  conn.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      
      // Handle ephemeral messages
      mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') 
        ? mek.message.ephemeralMessage.message 
        : mek.message;

      // Status broadcast handling
      if (mek.key && mek.key.remoteJid === 'status@broadcast') {
        if (mek.message?.reactionMessage || mek.message?.protocolMessage) {
          return;
        }
        
        // Auto-view status
        try {
          await conn.readMessages([mek.key]);
        } catch (viewError) {
          console.error('Error viewing status:', viewError);
        }
        
        // Auto-react to status
        try {
          const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
          const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
          
          await conn.sendMessage(mek.key.remoteJid, {
            react: {
              text: randomReaction,
              key: mek.key
            }
          });
        } catch (reactError) {
          console.error('Error reacting to status:', reactError);
        }
        
        return;
      }

      if (!conn.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
      
      let m = smsg(conn, mek, store);
      
      // Load your command handler
      if (!isLowMemory) {
        require("./start/kevin")(conn, m, chatUpdate, mek, store);
      }
      
    } catch (err) {
      console.log(chalk.yellow.bold("[ ERROR ] messages.upsert :\n") + chalk.redBright(util.format(err)));
    }
  });

  // ========== CONTACTS UPDATE ==========
  conn.ev.on('contacts.update', update => {
    for (let contact of update) {
      let id = conn.decodeJid(contact.id);
      if (store && store.contacts) {
        store.contacts[id] = { id, name: contact.notify };
      }
    }
  });

  // ========== GROUP PARTICIPANTS UPDATE ==========
  conn.ev.on('group-participants.update', async (anu) => {
    try {
      const botNumber = await conn.decodeJid(conn.user?.id);
      
      // Welcome feature
      const welcomeEnabled = true; // Aap ke settings se lein
      const admineventEnabled = true; // Aap ke settings se lein
      
      if (welcomeEnabled) {
        try {
          const groupMetadata = await conn.groupMetadata(anu.id);
          const participants = anu.participants;
          
          for (const participant of participants) {
            let ppUrl;
            try {
              ppUrl = await conn.profilePictureUrl(participant, 'image');
            } catch {
              ppUrl = 'https://i.ibb.co/RBx5SQC/avatar-group-large-v2.png?q=60';
            }
            
            const userId = conn.decodeJid(participant);
            const name = await conn.getName(participant) || userId.split('@')[0];
            
            if (anu.action === 'add') {
              const memberCount = groupMetadata.participants.length;
              await conn.sendMessage(anu.id, {
                image: { url: ppUrl },
                caption: `
*${config.botname || 'Jexploit'} welcome* @${userId.split('@')[0]}  

*Group Name: ${groupMetadata.subject}*

*You're our ${memberCount}th member!*

*Join time: ${moment.tz(timezones).format('HH:mm:ss')}, ${moment.tz(timezones).format('DD/MM/YYYY')}*

*Enjoy your stay!*

> ${config.wm || 'Powered by Kelvin Tech'}`,
                mentions: [participant]
              });
              console.log(`✅ Welcome message sent for ${name}`);
              
            } else if (anu.action === 'remove') {
              const memberCount = groupMetadata.participants.length;
              await conn.sendMessage(anu.id, {
                image: { url: ppUrl },
                caption: `
*👋 Goodbye* 😪 @${userId.split('@')[0]}

*Left at: ${moment.tz(timezones).format('HH:mm:ss')}, ${moment.tz(timezones).format('DD/MM/YYYY')}*

*We're now ${memberCount} members*.

> ${config.wm || 'Powered by Kelvin Tech'}`,
                mentions: [participant]
              });
              console.log(`✅ Goodbye message sent for ${name}`);
            }
          }
        } catch (err) {
          console.error('Error in welcome feature:', err);
        }
      }
      
    } catch (error) {
      console.error('Error in group-participants.update:', error);
    }
  });

  // ========== CALL HANDLER ==========
  conn.ev.on('call', async (callData) => {
    try {
      const anticallSetting = 'decline'; // Aap ke settings se lein
      
      if (!anticallSetting || anticallSetting === 'off') {
        console.log(chalk.gray('[ANTICALL] Disabled'));
        return;
      }
      
      for (let call of callData) {
        const from = call.from;
        const callId = call.id;
        
        console.log(chalk.yellow(`[ANTICALL] Call from: ${from}`));
        
        // Reject call
        try {
          if (typeof conn.rejectCall === 'function') {
            await conn.rejectCall(callId, from);
            console.log(chalk.green(`[ANTICALL] Call rejected from: ${from}`));
            
            // Send message to caller
            await conn.sendMessage(from, {
              text: `🚫 *Call Declined*\n\n` +
                    `I'm ${config.botname || 'Jexploit Bot'}, a WhatsApp bot.\n` +
                    `I cannot receive calls.\n\n` +
                    `> ${config.wm || 'Powered by Kelvin Tech'}`
            });
          }
        } catch (rejectError) {
          console.error(chalk.red('[ANTICALL] Failed to reject call:'), rejectError);
        }
      }
    } catch (error) {
      console.error(chalk.red('[ANTICALL ERROR]'), error);
    }
  });

  // ========== CONNECTION UPDATE HANDLER ==========
  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log(chalk.yellow('📱 Scan QR code with WhatsApp'));
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(chalk.red(`Connection closed. Reconnecting: ${shouldReconnect}`));
      
      if (shouldReconnect) {
        await sleep(5000);
        clientstart();
      }
    } else if (connection === 'open') {
      console.log(chalk.green('✅ Connected to WhatsApp!'));
      
      // Pairing code logic
      if (!creds && !conn.user?.id && usePairingCode) {
        const phoneNumber = await question(chalk.greenBright(`Thanks for choosing Jexploit-bot. Please provide your number start with 256xxx:\n`));
        const code = await conn.requestPairingCode(phoneNumber.trim());
        console.log(chalk.cyan(`Code: ${code}`));
        console.log(chalk.cyan(`Jexploit: Please use this code to connect your WhatsApp account.`));
      }
    }
  });

  // ========== CREDENTIALS UPDATE ==========
  conn.ev.on('creds.update', saveCreds);

  // ========== HELPER FUNCTIONS ==========
  
  // Send image as sticker
  conn.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    let buff;
    try {
      buff = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split`,`[1], 'base64')
        : /^https?:\/\//.test(path)
        ? await getBuffer(path)
        : fs.existsSync(path)
        ? fs.readFileSync(path)
        : Buffer.alloc(0);
    } catch (e) {
      console.error('Error getting buffer:', e);
      buff = Buffer.alloc(0);
    }

    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifImg(buff, options);
    } else {
      buffer = await imageToWebp(buff);
    }

    await conn.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
    return buffer;
  };

  // Get name function
  conn.getName = async (jid, withoutContact = false) => {
    let id = conn.decodeJid(jid);
    withoutContact = conn.withoutContact || withoutContact;
    let v;
    
    if (id.endsWith("@g.us")) {
      return new Promise(async (resolve) => {
        try {
          v = store.contacts[id] || {};
          if (!(v.name || v.subject)) v = await conn.groupMetadata(id) || {};
          resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
        } catch (e) {
          resolve(PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
        }
      });
    } else {
      v = id === "0@s.whatsapp.net"
        ? { id, name: "WhatsApp" }
        : id === conn.decodeJid(conn.user.id)
        ? conn.user
        : store.contacts[id] || {};
      
      return (
        (withoutContact ? "" : v.name) ||
        v.subject ||
        v.verifiedName ||
        PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international")
      );
    }
  };

  // Send text with mentions
  conn.sendTextWithMentions = async (jid, text, quoted, options = {}) => {
    const mentionedJid = [...text.matchAll(/@(\d{0,16})/g)].map(
      (v) => v[1] + "@s.whatsapp.net"
    );
    return conn.sendMessage(jid, {
      text: text,
      contextInfo: { mentionedJid: mentionedJid },
      ...options
    }, { quoted });
  };

  // Download media message
  conn.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    let quoted = message.msg ? message.msg : message;
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];

    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    let type = await FileType.fromBuffer(buffer);
    let trueFileName = attachExtension ? (filename + "." + (type ? type.ext : 'bin')) : filename;
    let savePath = path.join(__dirname, 'tmp', trueFileName);
    
    if (!fs.existsSync(path.join(__dirname, 'tmp'))) {
      fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });
    }
    
    await fs.writeFileSync(savePath, buffer);
    return savePath;
  };

  // Get file
  conn.getFile = async (PATH, returnAsFilename) => {
    let res, filename;
    const data = Buffer.isBuffer(PATH) 
      ? PATH 
      : /^data:.*?\/.*?;base64,/i.test(PATH) 
      ? Buffer.from(PATH.split`, `[1], 'base64') 
      : /^https?:\/\//.test(PATH) 
      ? (res = await axios.get(PATH, { responseType: 'arraybuffer' }), Buffer.from(res.data))
      : fs.existsSync(PATH) 
      ? (filename = PATH, fs.readFileSync(PATH)) 
      : typeof PATH === 'string' 
      ? PATH 
      : Buffer.alloc(0);

    if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');
    
    const type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' };
    
    if (returnAsFilename && !filename) {
      filename = path.join(__dirname, './tmp/' + new Date() * 1 + '.' + type.ext);
      await fs.promises.writeFile(filename, data);
    }
    
    return { res, filename, ...type, data };
  };

  // Serialize message
  conn.serializeM = (m) => smsg(conn, m, store);

  // Create temp folder
  function createTmpFolder() {
    const folderName = "tmp";
    const folderPath = path.join(__dirname, folderName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
  }
  
  createTmpFolder();

  // Junk cleaner
  setInterval(() => {
    let directoryPath = path.join(__dirname, 'tmp');
    if (fs.existsSync(directoryPath)) {
      fs.readdir(directoryPath, async function (err, files) {
        var filteredArray = await files.filter(item =>
          item.endsWith("gif") ||
          item.endsWith("png") || 
          item.endsWith("mp3") ||
          item.endsWith("mp4") || 
          item.endsWith("opus") || 
          item.endsWith("jpg") ||
          item.endsWith("webp") ||
          item.endsWith("webm") ||
          item.endsWith("zip") 
        )
        if(filteredArray.length > 0){
          let teks =`Detected ${filteredArray.length} junk files,\nJunk files have been deleted🚮`
          conn.sendMessage(conn.user.id, {text : teks })
          setInterval(() => {
            if(filteredArray.length == 0) return console.log("Junk files cleared")
            filteredArray.forEach(function (file) {
              let sampah = fs.existsSync(path.join(directoryPath, file))
              if(sampah) fs.unlinkSync(path.join(directoryPath, file))
            })
          }, 15_000)
        }
      });
    }
  }, 30_000)

  // Set prefix
  conn.prefa = settings.prefa || '!';
  conn.public = config.autoviewstatus || true;

  // Maintenance schedules
  setInterval(cleanupTmpFiles, 30 * 60 * 1000);
  setInterval(monitorResources, 10 * 60 * 1000);

  console.log(chalk.green('✨ Jexploit Bot v7 is running successfully!'));
  console.log(chalk.cyan(`📊 Memory mode: ${isLowMemory ? 'Optimized' : 'Normal'}`));
  console.log(chalk.cyan(`🌐 Timezone: ${timezones}`));
  
  return conn;
}

// Start the bot
clientstart().catch(console.error);

// Auto restart on file changes
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
