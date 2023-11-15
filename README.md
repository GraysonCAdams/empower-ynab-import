# Empower YNAB Import

This tool relays your Empower.com account data to YNAB, since Empower.com has a stable connections through Yodlee and YNAB does not. You must have an Empower account set up with your Empower accounts linked for this to work.

```
$ npm run start

> start
> node --no-warnings=ExperimentalWarning --import=./logError.js --loader ts-node/esm index.ts

Found YNAB accounts: [xxx]

Going to Empower to fetch your accounts and match to YNAB accounts by name
Pulling up Empower...
Filling login credentials...
Submitting...
Searching/waiting for OTP prompt... (will choose email)
Connecting to mail server...
Successfully connected to mail server!
Opening mailbox...
Mailbox opened
Clicking the "Email" OTP button...
Watching for new emails...
1 new email(s), scanning contents...
Found the OTP email
Discarded email now that it's cached
Submitting code...
Unchecking 'remember me'
Entering password...
Signing in...
Found accounts: xxxxxx Retirement Savings Plan - Ending in xxxx, Health Savings Account - Ending in xxxx
xxxxxx Retirement Savings Plan balance has changed by $0.00
Health Savings Account balance has changed by $679.78
Accounts updated, all done. Until next time! 👋
```

When you run this script, it:

1. Logs into YNAB (API) and fetches your accounts and last reconciled dates
2. Logs into Empower (Puppeteer) and performs the One-Time Password process automatically (uses IMAP)
3. Fetches account balances from Empower (must have the synced in Empower)
4. Converts it into zero duplicate, YNAB format and imports through YNAB API

Being zero input and stateless, this script requires your YNAB accounts to be named the same as on Empower. It will tell you what it was unable to map so you can make the adjustments... or, fork your own version of this and allow for user input.

## Required Environment Variables

You must supply the variables below. The budget ID can be found when logged into YNAB in your URL bar, and for the token you will need to create a YNAB API token. IMAP information is for the OTP flow, **and you will need to make sure email is enabled for your OTP options on your AMEX account**.

You can put this in a `.env` file or supply as environment variables normally.

`LOCAL=true` This is what determines if you are running a browser off your display or a hidden virtual one through xvfb (versus headless which is prone to detection).

```
YNAB_API_KEY=ynabapitokenhere
BUDGET_ID=123123-0b123-12a1-1a23-123b1a234a
LOCAL=true
EMPOWER_USER=EmpowerEmailAddress@Domain.com
EMPOWER_PASS=3mp0werP4ssw0rd!
IMAP_USERNAME=username@domain.com
IMAP_PASSWORD=em@ilP4ssw0rd123!
IMAP_INCOMING_HOST=imap.domain.com
IMAP_INCOMING_PORT=993
IMAP_TLS=true
```

### One more note...

Please be responsible, and don't try to run this every 5 minutes. I get that it's fun, but the last thing you want is an IP ban from Empower. Just run this once a day, like Plaid would if it would ever work. Hopefully OAuth rolls out soon.
