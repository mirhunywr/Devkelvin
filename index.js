// ========== IMPORTANT: Ye file ko .mjs extension se save karein ya package.json mein "type": "module" set karein ==========

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage, getContentType, proto, delay, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createInterface } from 'readline';
import chalk from 'chalk';
import _ from 'lodash';
import NodeCache from 'node-cache';
import util from 'util';
import axios from 'axios';
import moment from 'moment-timezone';
import { Image, Webp } from 'node-webpmux';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';

// ES Modules ke liye __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ========== Aap ka original configuration waisa hi ==========
const isProduction = process.env.NODE_ENV === 'production';
const isLowMemory = process.env.MEMORY_LIMIT < 512 || isProduction;
const usePairingCode = true;

const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const timezones = global.timezones || "Africa/Kampala";
const botname = "Jexploit-Bot";
const wm = "Powered by Kelvin Tech 🇺🇬";

// Optimize memory usage - original code
if (isLowMemory) {
  console.log('🚀 Running in optimized mode for cloud/low memory environment');
}

// Enhanced error handling - original code
process.on("uncaughtException", (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ========== UTILITY FUNCTIONS - Updated for v7 ==========
const question = (text) => {
  const rl = createInterface({
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// V7 IMPORTANT: decodeJid function ko update karein LID support ke liye
function decodeJid(jid) {
  if (!jid) return jid;
  
  // Agar pehle se hi @ hai (LID ya normal JID)
  if (jid.includes('@')) {
    // LID format (@lid) handle karein
    if (jid.endsWith('@lid')) {
      return jid;
    }
    // Normal JID format
    return jid;
  }
  
  // Agar sirf number hai
  if (/^\d+$/.test(jid)) {
    return jid + '@s.whatsapp.net';
  }
  
  return jid;
}

// Buffer function - updated for ESM
async function getBuffer(url, options = {}) {
  try {
    const response = await axios({
      url,
      responseType: 'arraybuffer',
      ...options
    });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Buffer fetch error:', error.message);
    return null;
  }
}

// ========== MEDIA FUNCTIONS (WebP) - Updated for ESM ==========
async function imageToWebp(buffer) {
  try {
    const img = new Image();
    await img.load(buffer);
    const webp = new Webp();
    await webp.setImage(img);
    return await webp.save();
  } catch (error) {
    console.error('Image to WebP error:', error);
    return buffer;
  }
}

async function writeExifImg(buffer, metadata) {
  try {
    const { packname = botname, author = wm } = metadata;
    const img = new Image();
    await img.load(buffer);
    
    const exif = {
      "sticker-pack-id": "Jexploit-Bot",
      "sticker-pack-name": packname,
      "sticker-pack-publisher": author,
      "android-app-store-link": "https://github.com/kelvinojie",
      "ios-app-store-link": "https://github.com/kelvinojie"
    };
    
    const json = JSON.stringify(exif);
    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00]);
    const jsonBuffer = Buffer.from(json, 'utf8');
    const exifBuffer = Buffer.concat([exifAttr, jsonBuffer]);
    
    const webp = new Webp();
    await webp.setImage(img);
    await webp.exif = exifBuffer;
    
    return await webp.save();
  } catch (error) {
    console.error('Write Exif error:', error);
    return await imageToWebp(buffer);
  }
}

// ========== TEMP DIRECTORY - Aap ka original logic ==========
const TMP_DIR = isProduction 
  ? path.join(tmpdir(), 'vinic-bot-tmp')
  : path.join(__dirname, 'tmp');

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
          // Ignore file errors
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

// ========== SESSION LOADING - Updated for v7 ==========
const sessionDir = path.join(__dirname, 'sessions');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

// V7 CHANGE: MEGA session loading ka logic aap ka original rahega
async function loadSession() {
  try {
    if (!settings.SESSION_ID) {
      console.log('No SESSION_ID provided - QR login will be generated');
      return null;
    }

    console.log('[ ⏳ ] Downloading creds data...');
    console.log('[ 🆔️ ] Downloading MEGA.nz session...');
    
    // Aap ka original MEGA logic yahi rahega
    const megaFileId = settings.SESSION_ID.startsWith('Jexploit~') 
      ? settings.SESSION_ID.replace("Jexploit~", "") 
      : settings.SESSION_ID;
    
    // Yahan aap ka MEGA download logic aayega
    // ...
    
    return JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  } catch (error) {
    console.error('❌ Error loading session:', error.message);
    return null;
  }
}

// ========== MAIN BOT START FUNCTION - UPDATED FOR V7 ==========
async function clientstart() {
  // Session load karein
  const creds = await loadSession();
  
  // V7 IMPORTANT: useMultiFileAuthState ka syntax
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
  
  // ========== V7 SOCKET CONFIGURATION - OPTIMIZED FOR SPEED ==========
  const conn = makeWASocket({
    // Aap ke original settings
    printQRInTerminal: !usePairingCode,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000, // Reduced for faster connection
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 25000,
    maxRetries: 5,
    generateHighQualityLinkPreview: false,
    linkPreviewImageThumbnailWidth: 64,
    
    version: waVersion,
    
    // V7 CHANGE: Browsers object use karein
    browser: Browsers.ubuntu('Chrome'),
    
    // Performance ke liye minimal logging
    logger: pino({ level: 'silent' }),
    
    // V7 IMPORTANT: Auth state simple rakhain
    auth: state,
    
    // V7 PERFORMANCE OPTIONS
    fireInitQueries: false,
    emitOwnEvents: true,
    defaultCongestionControl: 1,
    
    // V7 NEW: Transaction optimizations
    transactionOpts: {
      maxCommitRetries: 2,
      delayBeforeRetry: 1000
    },
    
    // V7 NEW: getMessage cache (optional for speed)
    getMessage: async (key) => {
      return null; // Aap ka store logic yahan aayega
    }
  });
  
  // V7 UPDATE: decodeJid function assign karein
  conn.decodeJid = decodeJid;
  
  // V7 IMPORTANT: LID mapping event handle karein
  conn.ev.on('lid-mapping.update', (mappings) => {
    console.log('[LID UPDATE] New mappings:', mappings.length);
    // Aap ke original store mein save karein
    if (!global.lidMapping) global.lidMapping = new Map();
    mappings.forEach(mapping => {
      global.lidMapping.set(mapping.lid, mapping.pn);
      global.lidMapping.set(mapping.pn, mapping.lid);
    });
  });
  
  // ========== AAP KE ORIGINAL EVENT HANDLERS ==========
  // Yeh sab waisa hi rahega, bas internal functions update ho gaye hain
  
  // Store binding
  const { makeInMemoryStore } = await import('./start/lib/store/index.js');
  const store = makeInMemoryStore({
    logger: pino().child({ level: 'silent', stream: 'store' })
  });
  store.bind(conn.ev);
  
  // messages.upsert handler - Aap ka original logic
  conn.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      // Aap ka purana logic yahan aayega
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      
      // ... aap ka baki ka logic ...
      
    } catch (err) {
      console.log(chalk.yellow.bold("[ ERROR ] messages.upsert :\n") + chalk.redBright(util.format(err)));
    }
  });
  
  // contacts.update handler
  conn.ev.on('contacts.update', update => {
    for (let contact of update) {
      let id = conn.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });
  
  // group-participants.update handler - Aap ka original logic
  conn.ev.on('group-participants.update', async (anu) => {
    try {
      // Aap ka welcome, goodbye, admin events ka logic yahan aayega
      // ...
    } catch (error) {
      console.error('Error in group-participants.update:', error);
    }
  });
  
  // call handler - Aap ka anticall logic
  conn.ev.on('call', async (callData) => {
    try {
      // Aap ka anticall logic yahan aayega
      // ...
    } catch (error) {
      console.error(chalk.red('[ANTICALL ERROR]'), error);
    }
  });
  
  // ========== AAP KE ORIGINAL HELPER FUNCTIONS ==========
  // Yeh functions waisa hi rahein ge, bas ESM compatible banaye hain
  
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
  
  conn.getName = async (jid, withoutContact = false) => {
    let id = conn.decodeJid(jid);
    withoutContact = conn.withoutContact || withoutContact;
    let v;
    
    if (id.endsWith("@g.us")) {
      return new Promise(async (resolve) => {
        try {
          v = store.contacts[id] || {};
          if (!(v.name || v.subject)) v = await conn.groupMetadata(id) || {};
          resolve(v.name || v.subject || id.split('@')[0]);
        } catch (e) {
          resolve(id.split('@')[0]);
        }
      });
    } else {
      // V7 UPDATE: LID handle karein
      if (id.endsWith('@lid')) {
        try {
          // LID se phone number nikalain
          if (global.lidMapping && global.lidMapping.has(id)) {
            const phoneNumber = global.lidMapping.get(id);
            id = phoneNumber || id;
          }
        } catch (e) {
          // Ignore error
        }
      }
      
      v = id === "0@s.whatsapp.net"
        ? { id, name: "WhatsApp" }
        : id === conn.decodeJid(conn.user.id)
        ? conn.user
        : store.contacts[id] || {};
      
      return (
        (withoutContact ? "" : v.name) ||
        v.subject ||
        v.verifiedName ||
        id.split('@')[0]
      );
    }
  };
  
  // ========== CONNECTION UPDATE HANDLER ==========
  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log(chalk.yellow('QR Code generated, scan with WhatsApp'));
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
      }
    }
  });
  
  // Credentials update
  conn.ev.on('creds.update', saveCreds);
  
  // Maintenance schedules
  setInterval(cleanupTmpFiles, 30 * 60 * 1000);
  setInterval(() => {
    monitorResources();
  }, 10 * 60 * 1000);
  
  console.log(chalk.green('✨ Jexploit Bot v7.0.0-rc.9 is running!'));
  return conn;
}

// Memory monitoring function
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

// Start the bot
clientstart().catch(console.error);
