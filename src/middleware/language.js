// src/middleware/language.js
const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, '../locales');

exports.loadLanguage = async (req, res, next) => {
  try {
    const userLang = req.user?.settings?.language || 'English';
    const langCode = {
      English: 'en',
      Hausa: 'ha',
      Igbo: 'ig',
      Yoruba: 'yo'
    }[userLang] || 'en';

    const filePath = path.join(localesPath, `${langCode}.json`);
    const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    req.t = (key) => translations[key] || key; // fallback to key
    next();
  } catch (error) {
    console.error('Language middleware error:', error);
    req.t = (key) => key;
    next();
  }
};
module.exports = exports;