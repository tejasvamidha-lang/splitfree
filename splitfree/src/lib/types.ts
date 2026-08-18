export const CATEGORY_OPTIONS = [
  "Food",
  "Travel",
  "Utilities",
  "Groceries",
  "General",
] as const;

export type Category = (typeof CATEGORY_OPTIONS)[number];

export type Profile = {
  id: string;
  full_name: string;
  email?: string;
  avatar_url: string | null;
};

export type Group = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
};

export type Expense = {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  category: Category;
  is_settlement: boolean;
  created_at: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
};

export type ExpenseWithSplits = Expense & {
  splits: ExpenseSplit[];
};
