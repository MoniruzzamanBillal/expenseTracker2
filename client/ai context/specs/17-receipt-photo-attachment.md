# 17: Receipt photo attachment (attach after creation, view full-screen)

Status: 📝 Drafted — awaiting review before implementation starts. **Depends on `server/ai context/specs/13-receipt-photo-upload.md` — build/deploy that first, this UI is tested against its response shape.**

## Cross-repo context

Client side of a 2-spec feature:
- `server/ai context/specs/13-receipt-photo-upload.md` — the `receiptImageUrl`/`receiptImagePublicId` columns, Cloudinary plumbing, and `PUT`/`DELETE /transactions/receipt-image/:transactionId` endpoints this screen calls.
- **This doc** — the picker (attach/replace/remove) and full-screen viewer.

Source: `feature-plan-proposals.md` §3 ("Receipt/photo attachment on transactions"), with the user's explicit instruction: **the photo is attached after the transaction already exists, never at create time — same approach as Bike Log's own image uploads** (`bikelog_app/ai context/specs/20-image-uploads.md`, `21-image-viewer.md`), which this spec draws its component design from directly rather than re-deriving one from scratch.

## Goal

Let the user attach a receipt photo to a transaction they've already saved, replace or remove it, and tap it later to view full-screen.

## Scope

**In scope:**
- A `ReceiptImagePicker` component (single-image variant, modeled on Bike Log's `ImagePickerField.tsx`) added to `UpdateTransactionModal.tsx` — the existing "edit a transaction" surface, reached by swiping a `TransactionCard` right. Uploading/replacing/removing the photo is its **own** immediate mutation, independent of the modal's "Update Transaction" button (which still only ever saves title/amount/description/type) — there's no multipart-vs-JSON payload to reconcile this way, and it matches Bike Log's own precedent of each image action being self-contained.
- A small receipt indicator on `TransactionCard.tsx`'s normal (non-`compact`, non-`pending`) row, visible only when `receiptImageUrl` is set, opening a full-screen `ReceiptViewerModal` on tap.
- `ReceiptViewerModal` — single-image full-screen viewer (simpler than Bike Log's multi-image paging version: one receipt per transaction, no index/chevrons needed), reusing the tap-anywhere-to-dismiss fix Bike Log's spec 21 already had to debug (see Design).
- New dependency: `expo-image-picker` (not currently installed — confirmed via `package.json`; `expo-image` is already installed but has zero import sites anywhere in this app today, same gap Bike Log had before its own spec 20).

**Explicitly, permanently out of scope:**
- **`AddTransactionPage.tsx` and `SmartAdd.tsx`** — no image field at create time, per the user's own instruction. This is the entire point of the feature's shape, not an oversight to "improve" later.
- **`PendingTransactionEditModal.tsx`** (offline queue) — a queued-but-not-yet-synced transaction has no server `transactionId` to attach an image to yet; receipt attachment only becomes possible once an item has synced and become a real `TransactionCard` row. Not solved here, same class of "offline item, server-dependent feature" boundary as spec 13's client-side counterpart already draws around categories.
- **`TransactionRequestEditModal.tsx`** (Bike Log inbox items, spec 07/11) — unchanged, mirrors server spec 13's own exclusion of `TransactionRequest`.
- **Compact rows** — `MonthlyTransactionPage.tsx`'s accordion renders `TransactionCard` with `compact` set; the receipt indicator is gated on `!compact` to avoid crowding an already-dense nested row. A receipt can still be viewed/managed from the same transaction's row on Home/History (non-compact), so nothing is unreachable, just not duplicated into the denser view.
- **Multiple photos per transaction** — matches server spec 13's one-`receiptImageUrl` design; no gallery/array UI.
- `transactionQueue.ts` / `usePendingTransactions.ts` — untouched, per the offline-queue exclusion above.

## Design

### New dependency

`npx expo install expo-image-picker`. Add to `app.json`'s `plugins` array (currently just `expo-router` and `expo-splash-screen`):
```json
[
  "expo-image-picker",
  {
    "photosPermission": "Allow ExpenseTracker to access your photos to attach a receipt.",
    "cameraPermission": "Allow ExpenseTracker to access your camera to take a receipt photo."
  }
]
```
Generates the iOS `NSPhotoLibraryUsageDescription`/`NSCameraUsageDescription` strings and the equivalent Android permissions — neither exists in `app.json` today.

### New hook — `usePut`, added alongside the existing (differently-shaped) `useUpdateData`

`hooks/useApi.ts` already exports `useUpdateData(key: string[], endPoint: string)` and `apiPut` (`utils/api.ts`), but `useUpdateData` has a **fixed** `key`/`endPoint` signature — it doesn't fit a per-transaction dynamic URL (`/transactions/receipt-image/${id}`) the way `usePost`/`usePatch`'s `{url, payload}` mutation shape does. Per `known-issues.md#FETCH-2`, `useUpdateData` currently has **zero call sites** anywhere in the app — this spec does not touch or "fix" it; it adds a new `usePut`, identical in shape to `usePatch`, sitting alongside the existing hook without changing it:

```ts
export const usePut = (invalidateQueriesKeys?: string[][]) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { url: string; payload: FormData }) => apiPut(params.url, params.payload),
    onSuccess: () => {
      invalidateQueriesKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
    onError: (error) => {
      throw error;
    },
  });
};
```

`apiPut` itself needs no change — it already takes `(endPoint, payLoad)` generically, same as `apiPost`/`apiPatch`. `axiosInstance.ts`'s request interceptor already branches on `config.data instanceof FormData` to set the correct multipart boundary — no interceptor change needed, same as Bike Log's spec 20 found for its own upload work.

For removal, `useDeleteData` (`hooks/useApi.ts`) already has the right `{url}` shape and, per `client/ai context/specs/16-budgets-screen.md`, already got its first real call site there (`DELETE /budgets/:id`). This spec is its **second** call site (`DELETE /transactions/receipt-image/:id`) — worth noting only because it confirms that hook is now a proven, reusable pattern, not a one-off.

### Types — `client/types/Transaction.tyes.ts`

```ts
receiptImageUrl?: string | null;
receiptImagePublicId?: string | null;
```

### New component — `client/components/main/shared/ReceiptImagePicker.tsx`

```tsx
type TProps = {
  transactionId: string;
  value?: string | null; // receiptImageUrl
  invalidateKeys: string[][];
};

export default function ReceiptImagePicker({ transactionId, value, invalidateKeys }: TProps) {
  const C = useTheme();
  const [viewerOpen, setViewerOpen] = useState(false);
  const putMutation = usePut(invalidateKeys);
  const deleteMutation = useDeleteData(invalidateKeys);

  const handlePress = () => {
    if (value) {
      setViewerOpen(true); // tap an existing receipt to view it full-screen
      return;
    }
    openPickerActionSheet(); // no receipt yet — go straight to attach
  };

  const openPickerActionSheet = () => {
    Alert.alert("Receipt Photo", undefined, [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // takePhoto/pickFromLibrary: request the relevant ImagePicker.request*PermissionsAsync()
  // first; on denial, Toast.show({ type: "error", text1: "Permission denied" }) and stop.
  // On success: ImagePicker.launchCameraAsync / launchImageLibraryAsync
  // ({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false }),
  // then build { uri, name: asset.fileName ?? "receipt.jpg", type: asset.mimeType ?? "image/jpeg" }
  // and call upload(file).

  const upload = async (file: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    formData.append("image", file as any);
    await putMutation.mutateAsync({ url: `/transactions/receipt-image/${transactionId}`, payload: formData });
  };

  const handleRemove = () => {
    Alert.alert("Remove receipt?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () =>
          deleteMutation.mutateAsync({ url: `/transactions/receipt-image/${transactionId}` }) },
    ]);
  };

  // Renders: a bordered tile — thumbnail (expo-image, contentFit="cover") + a small
  // pencil badge (re-opens the action sheet to replace) and X badge (handleRemove) when
  // `value` is set; a dashed placeholder tile ("Add Receipt" + camera icon) when it's not.
  // A spinner overlay covers the tile while putMutation.isPending.
}
```

Action-sheet/permission/upload flow, badge layout, and the tap-target split (tap the tile to view when a value exists vs. open the action sheet when it doesn't) directly mirror Bike Log's `ImagePickerField.tsx` + the Option-A resolution from its spec 21 ("tapping a filled tile views, a pencil badge replaces") — settled decisions there, not re-litigated here.

### New component — `client/components/main/shared/ReceiptViewerModal.tsx`

```tsx
type TProps = { visible: boolean; imageUrl: string; onDismiss: () => void };
```

`Portal` + `Modal` (`react-native-paper`), full-bleed `contentContainerStyle` (`{ margin: 0, flex: 1, backgroundColor: "black" }`), `expo-image` with `contentFit="contain"`, a close `X` `IconButton` fixed top-right. **Tap-anywhere-to-dismiss**, built the way Bike Log's spec 21 already had to fix it after getting it wrong once: an outer full-screen `Pressable` with `onPress={onDismiss}` wraps a plain `View` with `pointerEvents="box-none"` holding the image — never a `Pressable` around the image itself, which would swallow the tap and leave only the `X` button working. Inheriting this straight from spec 21's own "Correction made after initial implementation" note rather than rediscovering the same bug.

No paging/index/chevrons — a receipt is a single image, unlike Bike Log's multi-photo bike-issue case that motivated those in spec 21.

### Integration — `UpdateTransactionModal.tsx`

Add `<ReceiptImagePicker transactionId={initialValue!._id} value={initialValue?.receiptImageUrl} invalidateKeys={INVALIDATE_KEYS} />` below the Description `FormField`, above `PrimaryButton`. `INVALIDATE_KEYS` reuses the same `[["daily-transaction"], ["monthly-transaction"], ["weekly-transaction"], ["yearly-transaction"]]` array this modal's own `usePatch` already invalidates, so a receipt change refreshes the same lists a title/amount edit would.

### Integration — `TransactionCard.tsx`

In the normal (non-`pending`) branch, when `!compact && transactionData?.receiptImageUrl`, render a small paperclip/receipt icon (`MaterialCommunityIcons name="paperclip"` or `"receipt"`) next to the amount, `onPress={() => setReceiptViewerOpen(true)}` opening `ReceiptViewerModal` with `imageUrl={transactionData.receiptImageUrl}`. This is a **view-only** entry point on the card — attaching/replacing/removing stays inside `UpdateTransactionModal` (reached the same way editing already is, via the right-swipe action), so there's exactly one place that owns the mutation, not two.

## Implementation notes

Files touched/added:
- `client/types/Transaction.tyes.ts` (edit — add `receiptImageUrl`/`receiptImagePublicId`)
- `client/hooks/useApi.ts` (edit — add `usePut`, `useUpdateData` left untouched)
- `client/components/main/shared/ReceiptImagePicker.tsx` (new)
- `client/components/main/shared/ReceiptViewerModal.tsx` (new)
- `client/components/main/shared/UpdateTransactionModal.tsx` (edit — mount `ReceiptImagePicker`)
- `client/components/main/shared/TransactionCard.tsx` (edit — receipt indicator + viewer, non-compact branch only)
- `app.json` (edit — `expo-image-picker` plugin entry)

## Verify when done

- [ ] `yarn lint` / `npx tsc --noEmit` pass clean.
- [ ] Editing an existing transaction (swipe → edit) shows the "Add Receipt" placeholder tile when none is attached yet.
- [ ] Tapping the placeholder shows "Take Photo / Choose from Library / Cancel"; either path uploads and the tile immediately shows the thumbnail, independent of pressing "Update Transaction."
- [ ] Re-attaching (tap the pencil badge on a filled tile) replaces the photo — old Cloudinary asset destroyed server-side, only the new thumbnail shows.
- [ ] Tapping the `X` badge confirms, then removes the receipt — tile reverts to the placeholder.
- [ ] Denying camera/library permission shows a `Toast` error, not a silent failure or crash.
- [ ] On `TransactionCard`'s normal (non-compact) row, a receipt icon appears only when that transaction has one; tapping it opens `ReceiptViewerModal` full-screen (`contentFit="contain"`, never cropped).
- [ ] Tapping the viewer's `X`, or tapping anywhere else in the modal (including on the image itself), dismisses it.
- [ ] The receipt icon does **not** appear on `compact` rows (Monthly/Weekly's nested accordion) even when the transaction has a receipt — confirms the deliberate scope boundary, not a missed case.
- [ ] `AddTransactionPage.tsx`, `SmartAdd.tsx`, and `PendingTransactionEditModal.tsx` are confirmed unchanged (diff review) — no receipt UI leaked into transaction creation or the offline queue.
- [ ] An offline-queued (pending) transaction shows no receipt affordance at all until after it syncs and becomes a normal card.
- [ ] *(Explicit caveat, matching this project's standing limitation)* If no physical device/simulator is available at implementation time, the action sheet/permission prompts/picker UI and tap-through are code-reviewed against the confirmed `expo-image-picker` API and Bike Log's already-verified equivalent, not visually confirmed — same caveat as `client/ai context/specs/10-pre-production-manual-checklist.md`.
