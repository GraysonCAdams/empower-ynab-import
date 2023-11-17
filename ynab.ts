import ynab, { Account as YNABAccount, SaveTransaction } from "ynab";
import dateFormat from "dateformat";
import "dotenv/config";

export interface Account extends Omit<YNABAccount, "last_reconciled_at"> {
  last_reconciled_at?: Date;
  pendingTransactions?: SaveTransaction[];
}

const apiToken = process.env.YNAB_API_KEY;
if (!apiToken) throw new Error("You must provide the YNAB API token");

const budgetId = process.env.BUDGET_ID;
if (!budgetId) throw new Error("You must provide the YNAB budget ID");

const ynabAPI = new ynab.API(apiToken);

export const ynabAmount = (amount: string) => Math.round(-parseFloat(amount) * 1000);
export const ynabDateFormat = (date: Date) => dateFormat(date, "yyyy-mm-dd");

export const fetchAccounts = async (): Promise<Account[]> => {
  const {
    data: { accounts: ynabAccounts },
  } = await ynabAPI.accounts.getAccounts(budgetId);

  const accounts: Account[] = ynabAccounts.map((ynabAccount) => ({
    ...ynabAccount,
    last_reconciled_at:
      ynabAccount.last_reconciled_at &&
      ynabAccount.last_reconciled_at.length > 0
        ? new Date(ynabAccount.last_reconciled_at)
        : undefined,
  }));

  console.log(
    `Found YNAB accounts:\n${accounts
      .map((account) => ` - ${account.name}`)
      .join("\n")}\n`
  );
  return accounts;
};

export const createTransactions = async (transactions: SaveTransaction[]) => {
  await ynabAPI.transactions.createTransactions(budgetId, {
    transactions,
  });
};
