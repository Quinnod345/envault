#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGO = 'aes-256-gcm';
const EXT = '.encrypted';

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}

function encrypt(text, password) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted
  });
}

function decrypt(json, password) {
  const { salt, iv, tag, data } = JSON.parse(json);
  const key = deriveKey(password, Buffer.from(salt, 'hex'));
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getPassword() {
  const p = process.env.ENVAULT_PASSWORD;
  if (!p) {
    console.error('Error: Set ENVAULT_PASSWORD environment variable or pass --password');
    process.exit(1);
  }
  return p;
}

const args = process.argv.slice(2);
const cmd = args[0];
const pwFlag = args.indexOf('--password');
let password;
if (pwFlag !== -1) {
  password = args[pwFlag + 1];
  args.splice(pwFlag, 2);
} 

function resolvePassword() {
  return password || process.env.ENVAULT_PASSWORD || (() => {
    console.error('Error: Provide password via --password <pw> or ENVAULT_PASSWORD env var');
    process.exit(1);
  })();
}

function usage() {
  console.log(`envault - Encrypt .env files for safe git commits

Usage:
  envault lock [file]          Encrypt .env → .env.encrypted
  envault unlock [file]        Decrypt .env.encrypted → .env
  envault edit [file]          Decrypt, open in $EDITOR, re-encrypt
  envault diff [file]          Show decrypted contents without writing
  envault init                 Add .env to .gitignore, create .env.encrypted

Options:
  --password <pw>              Password (or set ENVAULT_PASSWORD)

Examples:
  ENVAULT_PASSWORD=secret envault lock
  ENVAULT_PASSWORD=secret envault unlock
  envault lock --password mysecret .env.production`);
}

const file = args[1] || '.env';
const encFile = file + EXT;

switch (cmd) {
  case 'lock': {
    const pw = resolvePassword();
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
    const content = fs.readFileSync(file, 'utf8');
    const encrypted = encrypt(content, pw);
    fs.writeFileSync(encFile, encrypted);
    console.log(`✓ Locked ${file} → ${encFile}`);
    break;
  }
  case 'unlock': {
    const pw = resolvePassword();
    if (!fs.existsSync(encFile)) {
      console.error(`File not found: ${encFile}`);
      process.exit(1);
    }
    const content = fs.readFileSync(encFile, 'utf8');
    try {
      const decrypted = decrypt(content, pw);
      fs.writeFileSync(file, decrypted);
      console.log(`✓ Unlocked ${encFile} → ${file}`);
    } catch (e) {
      console.error('Error: Wrong password or corrupted file');
      process.exit(1);
    }
    break;
  }
  case 'diff': {
    const pw = resolvePassword();
    if (!fs.existsSync(encFile)) {
      console.error(`File not found: ${encFile}`);
      process.exit(1);
    }
    try {
      const decrypted = decrypt(fs.readFileSync(encFile, 'utf8'), pw);
      console.log(decrypted);
    } catch (e) {
      console.error('Error: Wrong password or corrupted file');
      process.exit(1);
    }
    break;
  }
  case 'init': {
    // Add .env to .gitignore
    const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
    if (!gitignore.includes('.env')) {
      fs.appendFileSync('.gitignore', '\n# envault - never commit plaintext secrets\n.env\n.env.*\n!.env.encrypted\n!.env.*.encrypted\n');
      console.log('✓ Updated .gitignore');
    } else {
      console.log('✓ .gitignore already has .env entries');
    }
    console.log('Ready! Create your .env file, then run: envault lock');
    break;
  }
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    usage();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
}
