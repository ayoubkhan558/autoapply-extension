// Use CHROMIUM_PATH when supplied; otherwise use Playwright's managed Chromium.
const { chromium } = require('playwright');
function launchOptions() {
  return {
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox']
  };
}
module.exports = { chromium, launchOptions };
