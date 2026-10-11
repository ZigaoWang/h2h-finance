"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { submitExpensesAction, updateExpenseAction } from "@/app/(app)/expenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/cn";
import { isIsoDate } from "@/lib/dates";
import { localName } from "@/lib/i18n-names";
import { centsToDecimal, formatMoney, parseMoney } from "@/lib/money";
import { eachLimited, uploadImage, type UploadFailure } from "./upload";

const MAX_PHOTOS_PER_ITEM = 5;
const MAX_ITEMS = 20;

type Photo = { key: string; preview: string; fileId?: string; status: "uploading" | "done" | "error"; error?: UploadFailure };
type Duplicate = { reason: "exact" | "transaction" | "similar"; expenseId: number | null };
type Item = {
  key: string;
  photos: Photo[];
  amount: string;
  merchant: string;
  spentOn: string;
  // Which fields were filled from the screenshot, so the member knows to glance at them.
  auto: { amount?: boolean; merchant?: boolean; spentOn?: boolean };
  duplicate: Duplicate | null;
  // Extra details read from the screenshot, shown so the member can see what was picked up.
  paidAt?: string;
  transactionId?: string;
};
type Option = { id: number; nameEn: string; nameZh: string };

export type ExpenseFormProps = {
  categories: Option[];
  events: Option[];
  years: { startsOn: string; endsOn: string }[];
  today: string;
  edit?: {
    id: number;
    item: { amountCents: number; merchant: string; spentOn: string; fileIds: string[] };
    categoryId: number | null;
    eventId: number | null;
    description: string;
    note: string | null;
  };
};

let counter = 0;
const nextKey = () => `k${++counter}`;

export function ExpenseForm({ categories, events, years, today, edit }: ExpenseFormProps) {
  const t = useTranslations("submit");
  const locale = useLocale();
  const router = useRouter();
  const formId = useId();

  const [items, setItems] = useState<Item[]>(() =>
    edit
      ? [
          {
            key: nextKey(),
            photos: edit.item.fileIds.map((id) => ({ key: nextKey(), preview: `/api/files/${id}?size=thumb`, fileId: id, status: "done" })),
            amount: centsToDecimal(edit.item.amountCents),
            merchant: edit.item.merchant,
            spentOn: edit.item.spentOn,
            auto: {},
            duplicate: null,
          },
        ]
      : [],
  );
  const [categoryId, setCategoryId] = useState<number | null>(edit?.categoryId ?? null);
  const [eventId, setEventId] = useState<string>(edit?.eventId ? String(edit.eventId) : "");
  const [description, setDescription] = useState(edit?.description ?? "");
  const [note, setNote] = useState(edit?.note ?? "");
  const [showNote, setShowNote] = useState(!!edit?.note);
  const [showErrors, setShowErrors] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const update = (key: string, patch: (item: Item) => Partial<Item>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch(item) } : item)));

  const updatePhoto = (itemKey: string, photoKey: string, patch: Partial<Photo>) =>
    update(itemKey, (item) => ({ photos: item.photos.map((p) => (p.key === photoKey ? { ...p, ...patch } : p)) }));

  async function uploadInto(itemKey: string, photo: Photo, file: File) {
    const result = await uploadImage(file, "receipt");
    if (typeof result === "string") {
      updatePhoto(itemKey, photo.key, { status: "error", error: result });
      return;
    }
    // Only fill fields the member hasn't typed into yet.
    update(itemKey, (item) => {
      const filled: Partial<Item> = {
        photos: item.photos.map((p) => (p.key === photo.key ? { ...p, status: "done", fileId: result.id } : p)),
        duplicate: item.duplicate ?? result.duplicate,
        paidAt: item.paidAt ?? result.ocr.paidAt,
        transactionId: item.transactionId ?? result.ocr.transactionId,
        auto: { ...item.auto },
      };
      if (!item.amount && result.ocr.amountCents) {
        filled.amount = centsToDecimal(result.ocr.amountCents);
        filled.auto!.amount = true;
      }
      if (!item.merchant && result.ocr.merchant) {
        filled.merchant = result.ocr.merchant;
        filled.auto!.merchant = true;
      }
      if (result.ocr.spentOn && !item.auto.spentOn && (item.spentOn === today || !item.spentOn)) {
        filled.spentOn = result.ocr.spentOn;
        filled.auto!.spentOn = true;
      }
      return filled;
    });
  }

  function addScreenshots(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/")).slice(0, MAX_ITEMS - items.length);
    const added = images.map((file) => {
      const photo: Photo = { key: nextKey(), preview: URL.createObjectURL(file), status: "uploading" };
      const item: Item = { key: nextKey(), photos: [photo], amount: "", merchant: "", spentOn: today, auto: {}, duplicate: null };
      return { item, photo, file };
    });
    setItems((list) => [...list, ...added.map((a) => a.item)]);
    void eachLimited(added, 2, ({ item, photo, file }) => uploadInto(item.key, photo, file));
  }

  function addPhotos(itemKey: string, files: File[]) {
    const item = items.find((i) => i.key === itemKey);
    if (!item) return;
    const added = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS_PER_ITEM - item.photos.length)
      .map((file) => ({ photo: { key: nextKey(), preview: URL.createObjectURL(file), status: "uploading" as const }, file }));
    update(itemKey, (i) => ({ photos: [...i.photos, ...added.map((a) => a.photo)] }));
    void eachLimited(added, 2, ({ photo, file }) => uploadInto(itemKey, photo, file));
  }

  // Desktop convenience: paste screenshots straight from the clipboard.
  const addRef = useRef(addScreenshots);
  useEffect(() => {
    addRef.current = addScreenshots;
  });
  useEffect(() => {
    if (edit) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        addRef.current(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [edit]);

  // Don't lose a half-finished submission to an accidental back swipe.
  const dirty = !done && (edit ? false : items.length > 0 || description.length > 0);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const inYear = (date: string) => years.some((y) => y.startsOn <= date && date <= y.endsOn);

  function itemErrors(item: Item) {
    const failed = item.photos.find((p) => p.status === "error");
    return {
      photos: failed ? t(`uploadErrors.${failed.error ?? "network"}`) : item.photos.length === 0 ? t("errors.photoMissing") : null,
      amount: parseMoney(item.amount) ? null : t("errors.amount"),
      merchant: item.merchant.trim() ? null : t("errors.merchant"),
      spentOn: !isIsoDate(item.spentOn)
        ? t("errors.date")
        : item.spentOn > today
          ? t("errors.future")
          : !inYear(item.spentOn)
            ? t("errors.noYear")
            : null,
    };
  }

  const uploading = items.some((i) => i.photos.some((p) => p.status === "uploading"));
  const valid =
    items.length > 0 &&
    items.every((i) => Object.values(itemErrors(i)).every((e) => !e)) &&
    categoryId !== null &&
    description.trim().length > 0;
  const total = items.reduce((sum, i) => sum + (parseMoney(i.amount) ?? 0), 0);

  const onSaved = () => {
    setDone(true);
    router.push(edit ? `/expenses/${edit.id}` : "/expenses");
  };
  const submit = useAction(submitExpensesAction, {
    onSuccess: (ids) => {
      toast.success(t("submitted", { count: ids.length }));
      onSaved();
    },
  });
  const save = useAction(updateExpenseAction, {
    onSuccess: () => {
      toast.success(t("updated"));
      onSaved();
    },
  });
  const action = edit ? save : submit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || uploading) {
      setShowErrors(true);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const details = { categoryId: categoryId!, eventId: eventId ? Number(eventId) : null, description, note: showNote ? note : "" };
    const toInput = (i: Item) => ({ fileIds: i.photos.map((p) => p.fileId!), amount: i.amount, merchant: i.merchant, spentOn: i.spentOn });
    if (edit) save.execute(edit.id, { ...details, ...toInput(items[0]) });
    else submit.execute({ ...details, items: items.map(toInput) });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-10 pb-28">
      <section aria-labelledby={`${formId}-receipts`}>
        <h2 id={`${formId}-receipts`} className="mb-1 text-[15px] font-semibold">
          {t("receipts")}
        </h2>
        <p className="mb-4 text-sm text-muted">{edit ? t("receiptsEditHint") : t("receiptsHint")}</p>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <ItemCard
              key={item.key}
              item={item}
              index={index}
              count={items.length}
              errors={showErrors ? itemErrors(item) : null}
              onChange={(patch) => update(item.key, (i) => ({ ...patch, auto: { ...i.auto, ...Object.fromEntries(Object.keys(patch).map((k) => [k, false])) } }))}
              onRemove={edit ? undefined : () => setItems((list) => list.filter((i) => i.key !== item.key))}
              onRemovePhoto={(photoKey) => update(item.key, (i) => ({ photos: i.photos.filter((p) => p.key !== photoKey) }))}
              onAddPhotos={(files) => addPhotos(item.key, files)}
              onPreview={setPreview}
              today={today}
            />
          ))}
        </div>

        {!edit && items.length < MAX_ITEMS && <DropZone compact={items.length > 0} onFiles={addScreenshots} />}
      </section>

      <section aria-labelledby={`${formId}-details`} className="flex flex-col gap-5 border-t border-line pt-8">
        <div>
          <h2 id={`${formId}-details`} className="text-[15px] font-semibold">
            {t("details")}
          </h2>
          {items.length > 1 && <p className="mt-1 text-sm text-muted">{t("detailsShared")}</p>}
        </div>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-2">{t("category")}</legend>
          <div role="radiogroup" aria-label={t("category")} className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={categoryId === c.id}
                aria-invalid={showErrors && categoryId === null ? true : undefined}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "h-8 rounded-md border px-3 text-[13px] transition-colors",
                  categoryId === c.id ? "border-ink bg-ink font-medium text-white" : "border-line-strong bg-surface text-ink-2 hover:border-faint hover:text-ink",
                )}
              >
                {localName(locale, c.nameEn, c.nameZh)}
              </button>
            ))}
          </div>
          {showErrors && categoryId === null && <p className="mt-1.5 text-[13px] text-danger">{t("errors.category")}</p>}
        </fieldset>

        {events.length > 0 && (
          <Field label={t("event")} htmlFor={`${formId}-event`} optional={t("optional")}>
            <Select id={`${formId}-event`} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">{t("noEvent")}</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {localName(locale, ev.nameEn, ev.nameZh)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field
          label={t("description")}
          htmlFor={`${formId}-description`}
          hint={t("descriptionHint")}
          error={showErrors && !description.trim() ? t("errors.description") : undefined}
        >
          <Input
            id={`${formId}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            maxLength={200}
            aria-invalid={showErrors && !description.trim()}
          />
        </Field>

        {showNote ? (
          <Field label={t("note")} htmlFor={`${formId}-note`} hint={t("noteHint")} optional={t("optional")}>
            <Textarea id={`${formId}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} autoFocus={!edit?.note} />
          </Field>
        ) : (
          <button type="button" onClick={() => setShowNote(true)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-2 hover:text-ink">
            <Plus className="size-4" aria-hidden />
            {t("addNote")}
          </button>
        )}
      </section>

      {action.error && <Alert>{action.error}</Alert>}

      {/* Lines up with the page column: offset by the sidebar, same width and padding as <main>. */}
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:left-60">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-10">
          <div className="flex max-w-2xl items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="num text-lg leading-tight font-semibold">{formatMoney(total)}</p>
            <p className="text-[13px] text-muted">{uploading ? t("uploading") : t("itemCount", { count: items.length })}</p>
          </div>
          <Button type="submit" size="lg" pending={action.pending} disabled={items.length === 0} className="min-w-32">
            {edit ? t("save") : t("submit", { count: items.length })}
          </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!preview} onClose={() => setPreview(null)} title={t("preview")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs and private files */}
        {preview && <img src={preview.replace("?size=thumb", "")} alt="" className="max-h-[70vh] w-full rounded-md object-contain" />}
      </Dialog>
    </form>
  );
}

function DropZone({ compact, onFiles }: { compact: boolean; onFiles: (files: File[]) => void }) {
  const t = useTranslations("submit");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(compact && "mt-3")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {compact ? (
        <Button variant="secondary" className="w-full border-dashed" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-4" aria-hidden />
          {t("addMore")}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full items-center gap-4 rounded-lg border border-dashed px-5 py-6 text-left transition-colors",
            dragging ? "border-ink bg-subtle" : "border-line-strong hover:border-faint hover:bg-subtle/60",
          )}
        >
          <ImagePlus className="size-6 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t("addScreenshots")}</span>
            <span className="mt-0.5 block text-[13px] text-muted">{t("addScreenshotsHint")}</span>
          </span>
          <span className="hidden h-8 shrink-0 items-center rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium sm:inline-flex">
            {t("choose")}
          </span>
        </button>
      )}
    </div>
  );
}

function ItemCard({
  item,
  index,
  count,
  errors,
  onChange,
  onRemove,
  onRemovePhoto,
  onAddPhotos,
  onPreview,
  today,
}: {
  item: Item;
  index: number;
  count: number;
  errors: Record<"photos" | "amount" | "merchant" | "spentOn", string | null> | null;
  onChange: (patch: Partial<Pick<Item, "amount" | "merchant" | "spentOn">>) => void;
  onRemove?: () => void;
  onRemovePhoto: (key: string) => void;
  onAddPhotos: (files: File[]) => void;
  onPreview: (src: string) => void;
  today: string;
}) {
  const t = useTranslations("submit");
  const id = useId();
  const photoInput = useRef<HTMLInputElement>(null);
  const reading = item.photos.some((p) => p.status === "uploading") && !item.amount;
  const autoFilled = item.auto.amount || item.auto.merchant || item.auto.spentOn;

  return (
    <article className="rounded-lg border border-line bg-surface p-4" aria-label={t("itemLabel", { number: index + 1 })}>
      <div className="flex gap-4">
        <div className="flex w-16 shrink-0 flex-col gap-2 sm:w-20">
          {item.photos.map((photo) => (
            <div key={photo.key} className="group relative">
              <button
                type="button"
                onClick={() => onPreview(photo.preview)}
                className="block aspect-[3/4] w-full overflow-hidden rounded-md border border-line bg-subtle"
                aria-label={t("preview")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs and private files */}
                <img src={photo.preview} alt="" className={cn("size-full object-cover object-top", photo.status === "uploading" && "opacity-60")} />
              </button>
              {photo.status === "uploading" && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Spinner className="size-5 text-ink" />
                </span>
              )}
              {photo.status === "error" && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md bg-danger px-1 py-0.5 text-center text-[10px] font-medium text-white">
                  {t("failed")}
                </span>
              )}
              {item.photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemovePhoto(photo.key)}
                  aria-label={t("removePhoto")}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-sm hover:text-ink"
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </div>
          ))}
          {item.photos.length < MAX_PHOTOS_PER_ITEM && (
            <>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  onAddPhotos(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="flex h-8 items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-xs text-muted hover:border-faint hover:text-ink"
              >
                <Plus className="size-3.5" aria-hidden />
                {t("photo")}
              </button>
            </>
          )}
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[150px_minmax(0,1fr)_160px] sm:gap-x-3">
          <div className="flex items-start justify-between gap-2 sm:col-span-3">
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <span className="font-medium text-ink">{count > 1 ? t("itemLabel", { number: index + 1 }) : t("payment")}</span>
              {autoFilled && (
                <span className="inline-flex items-center gap-1">
                  · <Check className="size-3.5 text-paid" aria-hidden />
                  {t("autoFilled")}
                </span>
              )}
            </p>
            {onRemove && (
              <button type="button" onClick={onRemove} aria-label={t("removeItem")} className="-m-1.5 rounded-md p-1.5 text-faint hover:bg-subtle hover:text-ink">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <Field label={t("amount")} htmlFor={`${id}-amount`} error={errors?.amount}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">¥</span>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                autoComplete="off"
                value={item.amount}
                onChange={(e) => onChange({ amount: e.target.value })}
                placeholder={reading ? t("reading") : "0.00"}
                aria-invalid={!!errors?.amount}
                className="num pl-7 font-medium"
              />
            </div>
          </Field>
          <Field label={t("merchant")} htmlFor={`${id}-merchant`} error={errors?.merchant}>
            <Input
              id={`${id}-merchant`}
              value={item.merchant}
              onChange={(e) => onChange({ merchant: e.target.value })}
              placeholder={reading ? t("reading") : t("merchantPlaceholder")}
              maxLength={80}
              aria-invalid={!!errors?.merchant}
            />
          </Field>
          <Field label={t("date")} htmlFor={`${id}-date`} error={errors?.spentOn}>
            <Input id={`${id}-date`} type="date" max={today} value={item.spentOn} onChange={(e) => onChange({ spentOn: e.target.value })} aria-invalid={!!errors?.spentOn} />
          </Field>
        </div>
      </div>

      {(item.paidAt || item.transactionId) && (
        <p className="mt-3 truncate border-t border-line pt-3 text-xs text-muted">
          {[item.paidAt && t("paidAt", { time: item.paidAt }), item.transactionId && t("transactionNo", { id: item.transactionId })].filter(Boolean).join(" · ")}
        </p>
      )}
      {item.duplicate && (
        <Alert tone="warning" className="mt-3" title={t(`duplicate.${item.duplicate.reason}`)}>
          {item.duplicate.expenseId ? t("duplicateOwn", { id: item.duplicate.expenseId }) : t("duplicateHint")}
        </Alert>
      )}
      {errors?.photos && <Alert className="mt-3">{errors.photos}</Alert>}
    </article>
  );
}
