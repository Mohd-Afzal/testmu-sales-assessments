/**
 * config.js — frontend configuration.
 * The two REPLACE_ values are filled in AFTER you complete the Google setup
 * (see README "Setup" section). A Google OAuth Client ID and an Apps Script URL
 * are not secrets — they are safe to commit and ship to the browser.
 *
 * Keep ALLOWED_DOMAINS / ADMIN_EMAILS in sync with apps-script/Code.gs
 * (the server is the source of truth; these copies only drive the UI).
 */
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: "808454153378-h38tubutk1ddc141fo5ig04ba9bd0qeg.apps.googleusercontent.com",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwMj3SWTI3BSU9aGISBXD8Dt7OHYDpKFNMGDpKDROGd5FgNJ4bkRW716kMziMq9xIQp/exec",

  ALLOWED_DOMAINS: ["testmuai.com", "lambdatest.com"],

  ADMIN_EMAILS: [
    "afsal@lambdatest.com",
    "mehulg@lambdatest.com",
    "harshitp@lambdatest.com",
    "mudits@lambdatest.com",
    "ruehanh@testmu.ai",
    "saahilm@lambdatest.com",
    "jitendergoswami@lambdatest.com",
  ],

  DESIGNATIONS: ["AM", "AE", "BDR", "SDR", "CSA", "PreSales"],

  MANAGERS: [
    "Mohammed Afsal",
    "Mehul",
    "Harshit Paul",
    "Mudit Singh",
    "Ruehan Hamid",
    "Saahil Menoki",
    "Jitender Goswami (Jerry)",
  ],

  PASS_THRESHOLD: 80,
  MAX_ATTEMPTS: 2,
};
