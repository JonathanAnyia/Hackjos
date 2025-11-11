const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { loadLanguage } = require('../middleware/language');

router.put('/language', protect, loadLanguage, async (req, res) => {
  try {
    const { language } = req.body;
    const validLanguages = ['English', 'Hausa', 'Igbo', 'Yoruba'];

    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: req.t('error_generic'),
        error: 'Invalid language selected'
      });
    }

    req.user.settings.language = language;
    await req.user.save();

    res.status(200).json({
      success: true,
      message: req.t('language_updated'),
      language
    });
  } catch (error) {
    console.error('Language update error:', error);
    res.status(500).json({
      success: false,
      message: req.t('error_generic')
    });
  }
});

router.get('/greeting', protect, loadLanguage, (req, res) => {
  const greetings = {
    English: 'Hello, welcome!',
    Hausa: 'Sannu, barka da zuwa!',
    Igbo: 'Ndewo, nnọọ!',
    Yoruba: 'Ẹ n lẹ, káàbọ!'
  };

  const message = greetings[req.user.settings.language] || greetings['English'];

  res.status(200).json({
    success: true,
    message
  });
});


module.exports = router;
