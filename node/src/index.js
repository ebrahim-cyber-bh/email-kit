// Everything the kit offers, from one import:
//   import { loadConfig, createMailer, messageEmail, generateCode, createOtp, memoryStore } from './email-kit/node/src/index.js';
export { loadConfig } from './config.js';
export { createMailer } from './mailer.js';
export { messageEmail, codeEmail, escape } from './templates.js';
export { generateCode, createOtp, memoryStore } from './otp.js';
