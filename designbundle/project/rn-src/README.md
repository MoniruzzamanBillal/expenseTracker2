# xpns — React Native source

## Quick start

```bash
npx expo install @expo-google-fonts/inter expo-font
npx expo install @react-native-async-storage/async-storage
npx expo install @tanstack/react-query axios
```

Set your base URL in `rn-src/lib/api.ts`.

## Wrapping your root layout

```tsx
// app/_layout.tsx
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../rn-src/theme';

const qc = new QueryClient();

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  if (!loaded) return null;
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

## File map

| File | Purpose |
|---|---|
| `lib/api.ts` | Axios instance + JWT interceptor |
| `lib/auth.ts` | login / register / logout → AsyncStorage |
| `lib/transactions.ts` | All transaction API calls + exact types |
| `theme/` | colors, typography, spacing, ThemeContext, paper theme |
| `components/TransactionItem.tsx` | Single row |
| `components/DayBucketSection.tsx` | Section header (date + subtotals) + nested rows |
| `components/BalanceCard.tsx` | Big balance + income/expense pills |
| `components/TypeToggle.tsx` | Income ↔ Expense toggle |
| `components/PrimaryButton.tsx` | Accent-outlined CTA |
| `components/FormField.tsx` | Labelled input + error + password toggle |
| `components/EmptyState.tsx` | Empty list placeholder |
| `screens/LoginScreen.tsx` | POST /api/auth/login |
| `screens/RegisterScreen.tsx` | POST /api/auth/register |
| `screens/HomeScreen.tsx` | GET daily-transaction |
| `screens/AddTransactionScreen.tsx` | POST new-transaction |
| `screens/SmartAddScreen.tsx` | POST manage-money → editable drafts → POST many-transaction |
| `screens/HistoryScreen.tsx` | GET yearly-transaction |
| `screens/MonthlyScreen.tsx` | GET monthly-transaction?targetMonth=N |
| `screens/WeeklyScreen.tsx` | GET weekly-transaction |
| `navigation/AppTabs.tsx` | Copy to app/(app)/_layout.tsx |

## API notes

- All responses: `{ success, message, data, token? }` — `unwrap()` in `lib/api.ts` handles the envelope
- Transaction IDs are `_id` (not `id`)
- Monthly `targetMonth` is 1-indexed (Jan=1)
- Yearly `yearSummary[].month` is 0-indexed (Jan=0)
- Weekly — server owns the Fri–Thu window, no client-side navigation needed
- Smart Add: `manage-money` returns unsaved drafts (no `_id`); save via `many-transaction`
- Delete is a PATCH soft-delete on `delete-transaction/:id`
