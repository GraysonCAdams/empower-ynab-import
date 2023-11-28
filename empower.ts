import { load } from "cheerio";
import puppeteer from "puppeteer-extra";
import { Email, EmailScanner } from "./email.js";
import { sleep, timeout } from "./utils.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import "dotenv/config";
// @ts-ignore
import Xvfb from "xvfb";

interface Account {
  name?: string;
  balance?: number;
}

const getAccounts = (accountsData: any): Account[] => {
  const accounts = accountsData.spData.accounts.filter(
    (a: any) =>
      a.accountTypeGroup === "RETIREMENT" || a.accountTypeGroup === "INVESTMENT"
  );
  console.log(
    `Found accounts: ${accounts.map((account: any) => account.name).join(", ")}`
  );
  return accounts;
};

export async function fetchAccounts(): Promise<Account[]> {
  let accounts: Account[] = [];

  const virtualDisplay = process.env.LOCAL !== "true";

  const username = process.env.EMPOWER_USER;
  const password = process.env.EMPOWER_PASS;
  if (!username || !password)
    throw new Error(
      "You must provide Empower user and password to fetch data."
    );

  puppeteer.use(StealthPlugin());
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--start-fullscreen",
  ];

  let xvfb;
  if (virtualDisplay) {
    xvfb = new Xvfb({
      silent: true,
      xvfb_args: ["-screen", "0", "1280x720x24", "-ac"],
    });

    xvfb.start((err: Error) => {
      if (err) console.error(err);
    });
  }

  const browser = await puppeteer.launch({
    headless: false, // for SS bug: https://developer.chrome.com/articles/new-headless/
    // defaultViewport: null, //otherwise it defaults to 800x600
    args,
  });

  try {
    const page = await browser.newPage();
    page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0"
    );

    console.log("Pulling up Empower...");
    await page.goto("https://home.personalcapital.com/page/login/goHome");

    console.log("Filling login credentials...");
    await page.type('#form-email input[name="username"]', username);

    await sleep(5000);

    console.log("Submitting...");
    await page.click('#form-email button[name="continue"]');

    console.log("Searching/waiting for OTP prompt... (will choose email)");
    const emailOptionBtnSelector =
      'li[class="js-challenge-request--email-me"] button';
    await page.waitForSelector(emailOptionBtnSelector);

    const mailbox = new EmailScanner();
    try {
      await mailbox.connect();

      console.log('Clicking the "Email" OTP button...');
      await sleep(5000);
      await page.screenshot({
        path: "screenshot.png",
      });
      await page.click(emailOptionBtnSelector);

      const waitForEmail = mailbox.waitForEmail(
        (email: Email) => email.subject === "Register A New Computer"
      );

      const email = await Promise.race([timeout(60000, false), waitForEmail]);
      if (!email)
        throw new Error("OTP email was not received within 60 seconds");

      let code: string | undefined;
      const $ = load(email.body);
      const text = $("body").text();
      const textSplit = text.split("4-Digit Authorization Code: ", 2);
      if (textSplit.length == 2) {
        const codeString = textSplit[1];
        const codeMatches = codeString.match(/[0-9]+/g) || [];
        const potentialCode = codeMatches[0];
        if (potentialCode && potentialCode.length === 4) code = potentialCode;
      }

      if (!code) throw new Error("OTP code could not be extracted from email");

      await page.type('input[name="code"]', code);

      console.log("Submitting code...");
      await page.click('#form-challengeResponse-email button[type="submit"]');
    } catch (e) {
      console.error(e);
      console.error("Failed to perform OTP process, maybe it wasn't needed?");
      mailbox.disconnect();
    }

    await sleep(2000);

    const passwordSelector = 'input[name="passwd"]';
    await page.waitForSelector(passwordSelector);

    console.log("Unchecking 'remember me'");
    await page.click("input[id='rememberMe']");
    await page.$eval('input[id="rememberMe"]', (checkbox) => {
      checkbox.checked = false;
      checkbox.value = "false";
    });
    console.log("Entering password...");
    await page.type(passwordSelector, password);

    const accountsPageRes = new Promise<any[]>((resolve, reject) => {
      page.on("response", async (response) => {
        const url = response.url();

        // Check if the URL matches the one you are interested in
        if (
          url === "https://home.personalcapital.com/api/newaccount/getAccounts2"
        ) {
          let empowerAccounts = [];
          try {
            const jsonData = await response.json();
            empowerAccounts = getAccounts(jsonData);
            if (empowerAccounts.length > 0) resolve(empowerAccounts);
          } catch (error) {
            reject([]);
          }
        }
      });
    });

    await sleep(2000);
    console.log("Signing in...");
    // @ts-ignore
    await page.focus(passwordSelector);
    await page.keyboard.press("Enter");

    try {
      const race = await Promise.race([accountsPageRes, timeout(15000, false)]);
      if (Array.isArray(race)) accounts = race;
    } catch (e) {
      throw new Error("Failed to fetch the account data");
    }

    if (!accounts || accounts.length === 0)
      throw new Error(
        "Failed to find any retirement/investment Empower accounts"
      );

    await browser.close();

    accounts = accounts.map((a) => ({
      name: a.name?.split(" - Ending in")[0],
      balance: a.balance,
    }));
  } catch (e) {
    console.error(e);
  } finally {
    if (browser.connected) await browser.close();
  }

  if (virtualDisplay && xvfb) xvfb.stop();
  return accounts;
}
