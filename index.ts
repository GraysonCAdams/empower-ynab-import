import "dotenv/config";
import { fetchAccounts as fetchEmpowerAccounts } from "./empower.js";
import { createTransactions, fetchAccounts, ynabDateFormat } from "./ynab.js";
import { SaveTransaction } from "ynab";

(async () => {
  try {
    const ynabAccounts = await fetchAccounts();

    console.log(
      "Going to Empower to fetch your accounts and match to YNAB accounts by name"
    );

    const empowerAccounts = await fetchEmpowerAccounts();
    if (empowerAccounts.length == 0)
      throw new Error("Something has gone awry.");

    const transactions: SaveTransaction[] = [];

    for (const empowerAccount of empowerAccounts) {
      const ynabAccount = ynabAccounts.find(
        (ynabAccount) =>
          ynabAccount.name.toLowerCase() === empowerAccount.name?.toLowerCase()
      );

      if (!ynabAccount) {
        console.warn(
          `There is no YNAB account named "${empowerAccount.name}". Rename appropriate YNAB account to link.`
        );
        continue;
      }

      const newBalance = empowerAccount.balance!;
      const oldBalance = ynabAccount.balance / 1000;

      const difference = newBalance - oldBalance;
      const dollarAmount = difference.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });

      console.log(`${ynabAccount.name} balance has changed by ${dollarAmount}`);

      if (difference === 0) continue;

      transactions.push({
        account_id: ynabAccount.id,
        date: ynabDateFormat(new Date()),
        amount: Math.round(difference * 1000),
        payee_name: "Balance Adjustment",
        cleared: "reconciled",
        approved: true,
      });
    }

    if (transactions.length > 0) await createTransactions(transactions);

    console.log("Accounts updated, all done. Until next time! 👋");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
})();
