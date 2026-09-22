import AddTransactionPage from "@/components/main/AddTransaction/AddTransactionPage";
import { TransactionTypeConst } from "@/constants/TransactionType.constant";
import AuthGuard from "@/utils/AuthGuard";
import { useLocalSearchParams } from "expo-router";

// Deep-link target for the home-screen widget's "+ Expense"/"+ Income"
// buttons (client://quick-add?type=expense|income) — see
// widgets/QuickAddWidget.tsx. Outside the (tabs) group, so it needs its own
// AuthGuard (the tabs layout's guard doesn't apply here).
export default function QuickAdd() {
  const { type } = useLocalSearchParams<{ type?: string }>();

  const initialType =
    type === TransactionTypeConst.expense
      ? TransactionTypeConst.expense
      : TransactionTypeConst.income;

  return (
    <AuthGuard>
      <AddTransactionPage initialType={initialType} />
    </AuthGuard>
  );
}
