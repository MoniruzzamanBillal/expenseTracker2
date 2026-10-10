import ErrorLogsPage from "@/components/main/ErrorLogs/ErrorLogsPage";
import AuthGuard from "@/utils/AuthGuard";

// Admin-only error-log viewer (spec 36), reached from the Settings page.
// Outside the (tabs) group, so it needs its own AuthGuard — the root layout renders a
// <Slot />, not a Stack, so the tabs layout's guard doesn't apply here.
export default function ErrorLogs() {
  return (
    <AuthGuard>
      <ErrorLogsPage />
    </AuthGuard>
  );
}
