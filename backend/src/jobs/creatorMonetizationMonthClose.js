const logger = require('../utils/logger');

const DAY_MS = 24 * 60 * 60 * 1000;

const runClose = async () => {
  const { closeElapsedMonths } = require('../services/creatorMonetizationService');
  await closeElapsedMonths();
};

const startCreatorMonetizationJob = () => {
  const tick = () => {
    runClose().catch((error) => {
      logger.error('Creator monetization month close failed:', error);
    });
  };
  setTimeout(tick, 15 * 1000);
  setInterval(tick, DAY_MS);
  logger.info('Creator monetization month-close job scheduled (daily, Asia/Kolkata).');
};

module.exports = { startCreatorMonetizationJob };
