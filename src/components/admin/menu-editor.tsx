"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addMenuItem,
  copyPreviousMenu,
  deleteMenuItem,
  updateMenuItem,
  upsertMenuDay,
} from "@/app/(app)/admin/menu/actions";
import type { ActionResult } from "@/lib/action-result";
import { ImportMenu } from "@/components/admin/import-menu";
import type { MenuSlot } from "@/lib/menu-slot";
import { MenuSection } from "@/components/menu/menu-section";
import { formatVnd } from "@/lib/money";

type Category = "main" | "side" | "veg" | "addon" | "drink";

type EditorItem = {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  priceVnd: number;
  isAvailable: boolean;
};

export type MenuEditorProps = {
  serviceDate: string;
  /** Which sitting of that date this form writes to. */
  slot: MenuSlot;
  /**
   * The other sitting's deadline, already formatted, or null when that sitting
   * has none. Shown beside the field because the rule — the party closes after
   * lunch — is otherwise only discoverable by having the save refused.
   */
  siblingCutoffLabel: string | null;
  status: "draft" | "open" | "locked";
  orderCutoffLocal: string;
  note: string;
  setPriceVnd: number;
  shipFeeVnd: number;
  requiredMain: number;
  requiredSide: number;
  requiredVeg: number;
  altSetPriceVnd: number;
  altRequiredMain: number;
  altRequiredSide: number;
  altRequiredVeg: number;
  items: EditorItem[];
  bookedItemIds: string[];
};

/**
 * How a day is priced — combo (a suất of N dishes at a fixed price) or per-dish
 * (every dish carries its own). A day is one or the other, never both.
 *
 * It is not stored: a day sells a combo exactly when it asks for at least one
 * dish, so the tab writes the required counts rather than a column of its own —
 * one source of truth, nothing that can disagree with itself.
 */
type PricingMode = "combo" | "per-dish";

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: "main", label: "Món chính" },
  { value: "side", label: "Món phụ" },
  { value: "veg", label: "Món rau" },
  { value: "addon", label: "Gọi thêm" },
  { value: "drink", label: "Đồ uống" },
];

const CATEGORY_EMOJI: Record<Category, string> = {
  main: "🥩",
  side: "🍳",
  veg: "🥬",
  addon: "🥡",
  drink: "🍹",
};

const CATEGORY_LABEL = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<Category, string>;

/**
 * The single bucket a per-dish day puts everything in. `addon` because it is
 * a paid category — the set ones force a dish's price to 0 — and the label drops
 * "Gọi thêm", which means nothing on a day with no suất to add to.
 */
const PER_DISH_BUCKET = { value: "addon" as Category, label: "Món ăn" };

/** Set dishes are covered by the suất price and never carry one of their own. */
function isSetCategory(category: Category) {
  return category === "main" || category === "side" || category === "veg";
}

/** Parses "45.000" / "45,000" / "45000" into 45000. */
function parsePrice(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
}

export function MenuEditor(props: MenuEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState(props.status);
  const [cutoff, setCutoff] = useState(props.orderCutoffLocal);
  const [note, setNote] = useState(props.note);
  const [setPrice, setSetPrice] = useState(String(props.setPriceVnd || ""));
  const [shipFee, setShipFee] = useState(String(props.shipFeeVnd || ""));
  const [requiredMain, setRequiredMain] = useState(String(props.requiredMain));
  const [requiredSide, setRequiredSide] = useState(String(props.requiredSide));
  const [requiredVeg, setRequiredVeg] = useState(String(props.requiredVeg));
  const [mode, setMode] = useState<PricingMode>(
    props.requiredMain + props.requiredSide + props.requiredVeg > 0 ? "combo" : "per-dish",
  );
  const isComboMode = mode === "combo";

  // The second suất is opt-in: it exists for this day only once it asks for at
  // least one dish, which is also how the server reads it back.
  const [altEnabled, setAltEnabled] = useState(
    props.altRequiredMain + props.altRequiredSide + props.altRequiredVeg > 0,
  );
  const [altSetPrice, setAltSetPrice] = useState(String(props.altSetPriceVnd || ""));
  const [altRequiredMain, setAltRequiredMain] = useState(String(props.altRequiredMain || 1));
  const [altRequiredSide, setAltRequiredSide] = useState(
    String(props.altRequiredSide || props.requiredSide),
  );
  const [altRequiredVeg, setAltRequiredVeg] = useState(
    String(props.altRequiredVeg || props.requiredVeg),
  );

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState<Category>(
    props.requiredMain + props.requiredSide + props.requiredVeg > 0 ? "main" : "addon",
  );

  const bookedItemIds = new Set(props.bookedItemIds);
  // Per-dish has no groups at all: every dish is just a dish with a price, so
  // they all go in one bucket and the category picker disappears. `addon` is
  // that bucket because it is a paid category — combo ones force a price of 0.
  const availableCategories = isComboMode ? CATEGORIES : [PER_DISH_BUCKET];
  const strandedItems = isComboMode
    ? []
    : props.items.filter((item) => isSetCategory(item.category));

  function run(action: () => Promise<ActionResult<unknown>>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  /** Switching mode moves the numbers, since the numbers *are* the mode. */
  function handleModeChange(next: PricingMode) {
    setMode(next);
    if (next === "combo") {
      // Coming back from per-dish the counts are all zero, which is not a usable
      // combo — seed the house default so the form means something.
      if (Number(requiredMain) + Number(requiredSide) + Number(requiredVeg) === 0) {
        setRequiredMain("2");
        setRequiredSide("1");
        setRequiredVeg("1");
      }
      setNewCategory("main");
    } else {
      setNewCategory("addon");
    }
  }

  function handleSaveDay() {
    run(
      () =>
        upsertMenuDay({
          serviceDate: props.serviceDate,
          slot: props.slot,
          status,
          orderCutoff: cutoff,
          note,
          // Per-dish days carry no combo at all: the counts are what the rest of
          // the app reads, so they must be zero rather than merely hidden.
          setPriceVnd: isComboMode ? (parsePrice(setPrice) ?? 0) : 0,
          shipFeeVnd: parsePrice(shipFee) ?? 0,
          requiredMain: isComboMode ? Number(requiredMain) || 0 : 0,
          requiredSide: isComboMode ? Number(requiredSide) || 0 : 0,
          requiredVeg: isComboMode ? Number(requiredVeg) || 0 : 0,
          // Switched off, the second suất is cleared rather than remembered —
          // a leftover price with no dishes would read as a suất on offer.
          altSetPriceVnd: isComboMode && altEnabled ? (parsePrice(altSetPrice) ?? 0) : 0,
          altRequiredMain: isComboMode && altEnabled ? Number(altRequiredMain) || 0 : 0,
          altRequiredSide: isComboMode && altEnabled ? Number(altRequiredSide) || 0 : 0,
          altRequiredVeg: isComboMode && altEnabled ? Number(altRequiredVeg) || 0 : 0,
        }),
      "Đã lưu ngày.",
    );
  }

  function handleAddItem() {
    const priceVnd = parsePrice(newPrice);
    if (!newName.trim()) return toast.error("Hãy đặt tên cho món ăn.");
    // Set dishes have no price of their own, so only ask for one where it counts.
    if (!isSetCategory(newCategory) && priceVnd === null) return toast.error("Hãy nhập giá.");

    run(async () => {
      const result = await addMenuItem({
        serviceDate: props.serviceDate,
        slot: props.slot,
        name: newName,
        description: newDescription,
        category: newCategory,
        priceVnd: priceVnd ?? 0,
      });
      if (result.ok) {
        setNewName("");
        setNewDescription("");
        setNewPrice("");
      }
      return result;
    }, "Đã thêm món.");
  }

  return (
    <div className="space-y-4">
      {/* The importer reads the quán's Zalo message, which is written as a suất:
          sections for món chính / phụ / rau, and a price only on "gọi thêm" and
          drinks. It cannot express a per-dish day, so it is not offered on one. */}
      {isComboMode && <ImportMenu serviceDate={props.serviceDate} slot={props.slot} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thiết lập cho ngày</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cách tính tiền</Label>
            <Tabs
              value={mode}
              onValueChange={(value) => handleModeChange(value as PricingMode)}
            >
              <TabsList>
                <TabsTrigger value="combo">Theo suất</TabsTrigger>
                <TabsTrigger value="per-dish">Theo món</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-muted-foreground text-xs">
              {isComboMode
                ? "Mỗi người chọn đủ số món để thành một suất, giá cố định. Gọi thêm và đồ uống tính riêng."
                : "Không có suất — mỗi món một giá, đặt bao nhiêu phần cũng được."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status">Trạng thái</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as typeof status)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Nháp — không ai thấy</SelectItem>
                  <SelectItem value="open">Mở — mọi người đặt được</SelectItem>
                  <SelectItem value="locked">Đã chốt — đã gửi đơn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cutoff">Hạn đặt món (giờ Việt Nam)</Label>
              <Input
                id="cutoff"
                type="datetime-local"
                value={cutoff}
                onChange={(event) => setCutoff(event.target.value)}
              />
              {props.siblingCutoffLabel && (
                <p className="text-muted-foreground text-xs">
                  {props.slot === "afternoon"
                    ? `Phải muộn hơn hạn bữa trưa: ${props.siblingCutoffLabel}`
                    : `Phải sớm hơn hạn tiệc chiều: ${props.siblingCutoffLabel}`}
                </p>
              )}
            </div>
          </div>

          <div
            className={`grid gap-4 ${
              isComboMode ? "sm:grid-cols-[150px_150px_1fr]" : "sm:grid-cols-[150px_1fr]"
            }`}
          >
            {isComboMode && (
              <div className="space-y-1.5">
                <Label htmlFor="set-price">Giá suất (VND)</Label>
                <Input
                  id="set-price"
                  inputMode="numeric"
                  value={setPrice}
                  placeholder="50000"
                  onChange={(event) => setSetPrice(event.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ship-fee">Phí ship (VND)</Label>
              <Input
                id="ship-fee"
                inputMode="numeric"
                value={shipFee}
                placeholder="30000"
                onChange={(event) => setShipFee(event.target.value)}
              />
            </div>

            {isComboMode && (
              <div className="space-y-1.5">
                <Label>Một suất gồm</Label>
                <RequiredCounts
                  main={[requiredMain, setRequiredMain]}
                  side={[requiredSide, setRequiredSide]}
                  veg={[requiredVeg, setRequiredVeg]}
                />
              </div>
            )}
          </div>

          {/* A day may sell a second, usually cheaper, suất — the same meal with
              fewer món chính. The diner never picks a tier by name: the number of
              dishes they take decides which one they are on, so the two must ask
              for different amounts. */}
          <div className={`space-y-3 rounded-lg border border-dashed p-3 ${isComboMode ? "" : "hidden"}`}>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={altEnabled}
                onCheckedChange={(checked) => setAltEnabled(checked === true)}
              />
              Có suất thứ hai (ví dụ suất ít món chính hơn, rẻ hơn)
            </label>

            {altEnabled && (
              <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="alt-set-price">Giá suất 2 (VND)</Label>
                  <Input
                    id="alt-set-price"
                    inputMode="numeric"
                    value={altSetPrice}
                    placeholder="40000"
                    onChange={(event) => setAltSetPrice(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Suất 2 gồm</Label>
                  <RequiredCounts
                    main={[altRequiredMain, setAltRequiredMain]}
                    side={[altRequiredSide, setAltRequiredSide]}
                    veg={[altRequiredVeg, setAltRequiredVeg]}
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-muted-foreground text-xs">
            Phí ship là phí của cả đơn, chia đều cho những người đặt hôm đó. Khi bạn chuyển ngày
            sang <span className="text-foreground font-medium">Đã chốt</span>, số người chia được
            khoá lại để hoá đơn không đổi nữa.
          </p>
          {isComboMode && (
            <p className="text-muted-foreground text-xs">
              Đổi số lượng món ở đây sẽ tính lại suất của những người đã chọn món cho ngày
              này. Khi có hai suất, người đặt chọn suất nào là do số món họ chọn quyết định,
              nên hai suất phải khác nhau về số món.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="note">Ghi chú (không bắt buộc)</Label>
            <Input
              id="note"
              value={note}
              placeholder="ví dụ: Hôm nay đặt ở Cơm Tấm Ba Ghiền"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveDay} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Lưu ngày
            </Button>
            {props.items.length === 0 && (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(
                    () =>
                      copyPreviousMenu({
                        serviceDate: props.serviceDate,
                        slot: props.slot,
                      }),
                    "Đã sao chép thực đơn trước đó.",
                  )
                }
              >
                <Copy className="size-4" />
                Sao chép thực đơn trước
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Món ăn{" "}
            <span className="text-muted-foreground font-normal">({props.items.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isComboMode &&
            props.items.map((item) => (
              <ItemEditor
                key={item.id}
                item={item}
                categories={availableCategories}
                isBooked={bookedItemIds.has(item.id)}
                disabled={isPending}
                onSave={(values) =>
                  run(
                    () => updateMenuItem({ menuItemId: item.id, ...values }),
                    "Đã cập nhật món.",
                  )
                }
                onDelete={() => run(() => deleteMenuItem({ menuItemId: item.id }), "Đã xoá món.")}
              />
            ))}

          {isComboMode &&
            CATEGORIES.map((category) => {
            const items = props.items.filter((item) => item.category === category.value);
            if (items.length === 0) return null;
            return (
              <MenuSection
                key={category.value}
                emoji={CATEGORY_EMOJI[category.value]}
                label={category.label}
                summary={
                  <span className="text-muted-foreground">{items.length} món</span>
                }
              >
                {items.map((item) => (
                  <ItemEditor
                    key={item.id}
                    item={item}
                    categories={availableCategories}
                    isBooked={bookedItemIds.has(item.id)}
                    disabled={isPending}
                    onSave={(values) =>
                      run(
                        () => updateMenuItem({ menuItemId: item.id, ...values }),
                        "Đã cập nhật món.",
                      )
                    }
                    onDelete={() =>
                      run(() => deleteMenuItem({ menuItemId: item.id }), "Đã xoá món.")
                    }
                  />
                ))}
              </MenuSection>
            );
          })}

          {strandedItems.length > 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {strandedItems.length} món đang nằm trong nhóm suất (món chính / phụ / rau).
              Ngày tính tiền theo món thì những món này không hiện với người đặt — hãy chuyển
              sang <span className="font-medium">Món ăn</span> hoặc xoá đi.
            </p>
          )}

          {props.items.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Chưa có món nào. Thêm món đầu tiên ở bên dưới.
            </p>
          )}

          <div className="bg-muted/40 space-y-3 rounded-lg border border-dashed p-3">
            <div
              className={`grid gap-3 ${
                isComboMode ? "sm:grid-cols-[1fr_150px_140px]" : "sm:grid-cols-[1fr_140px]"
              }`}
            >
              <div className="space-y-1.5">
                <Label htmlFor="new-name">Món mới</Label>
                <Input
                  id="new-name"
                  value={newName}
                  placeholder="Cơm gà xối mỡ"
                  onChange={(event) => setNewName(event.target.value)}
                />
              </div>
              {isComboMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="new-category">Nhóm món</Label>
                  <Select
                    value={newCategory}
                    onValueChange={(value) => setNewCategory((value ?? "main") as Category)}
                  >
                    <SelectTrigger id="new-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-price">Giá (VND)</Label>
                <Input
                  id="new-price"
                  inputMode="numeric"
                  value={isSetCategory(newCategory) ? "" : newPrice}
                  disabled={isSetCategory(newCategory)}
                  placeholder={isSetCategory(newCategory) ? "Theo suất" : "25000"}
                  onChange={(event) => setNewPrice(event.target.value)}
                />
              </div>
            </div>
            <Textarea
              value={newDescription}
              placeholder="Mô tả (không bắt buộc)"
              rows={2}
              onChange={(event) => setNewDescription(event.target.value)}
            />
            <Button onClick={handleAddItem} disabled={isPending} size="sm">
              <Plus className="size-4" />
              Thêm món
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** The three "một suất gồm" boxes — món chính / phụ / rau. */
function RequiredCounts({
  main,
  side,
  veg,
}: {
  main: readonly [string, (value: string) => void];
  side: readonly [string, (value: string) => void];
  veg: readonly [string, (value: string) => void];
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(
        [
          ["Món chính", main],
          ["Món phụ", side],
          ["Món rau", veg],
        ] as const
      ).map(([label, [value, setValue]]) => (
        <div key={label} className="space-y-1">
          <Input
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
          />
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
      ))}
    </div>
  );
}

function ItemEditor({
  item,
  categories,
  isBooked,
  disabled,
  onSave,
  onDelete,
}: {
  item: EditorItem;
  categories: Array<{ value: Category; label: string }>;
  isBooked: boolean;
  disabled: boolean;
  onSave: (values: {
    name: string;
    description: string;
    category: Category;
    priceVnd: number;
    isAvailable: boolean;
  }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [category, setCategory] = useState<Category>(item.category);
  const [price, setPrice] = useState(String(item.priceVnd));
  const [isAvailable, setIsAvailable] = useState(item.isAvailable);

  const isSet = isSetCategory(category);
  // A dish sitting in a bucket this mode does not offer still has to show its own
  // category, or the only way to move it out would be to delete it. When that
  // leaves a single option — the normal à-la-carte case — there is nothing to
  // pick and the control is just noise.
  const options = categories.some((option) => option.value === item.category)
    ? categories
    : [...categories, { value: item.category, label: CATEGORY_LABEL[item.category] }];
  const showCategory = options.length > 1;

  const isDirty =
    name !== item.name ||
    description !== (item.description ?? "") ||
    category !== item.category ||
    (!isSet && Number(price.replace(/[^\d]/g, "")) !== item.priceVnd) ||
    isAvailable !== item.isAvailable;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div
        className={`grid gap-3 ${
          showCategory ? "sm:grid-cols-[1fr_150px_140px]" : "sm:grid-cols-[1fr_140px]"
        }`}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} />
        {showCategory && (
          <Select
            value={category}
            onValueChange={(value) => setCategory((value ?? category) as Category)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          inputMode="numeric"
          value={isSet ? "" : price}
          disabled={isSet}
          placeholder={isSet ? "Theo suất" : "25000"}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>
      <Input
        value={description}
        placeholder="Mô tả (không bắt buộc)"
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isAvailable}
            onCheckedChange={(checked) => setIsAvailable(checked === true)}
          />
          Còn món
        </label>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">
            {isSet ? CATEGORY_LABEL[category] : formatVnd(item.priceVnd)}
          </span>
          <Button
            size="sm"
            variant={isDirty ? "default" : "ghost"}
            disabled={disabled || !isDirty}
            onClick={() => {
              const priceVnd = isSet ? 0 : Number(price.replace(/[^\d]/g, ""));
              if (!name.trim()) return toast.error("Hãy đặt tên cho món ăn.");
              if (!Number.isFinite(priceVnd)) return toast.error("Giá không hợp lệ.");
              onSave({ name, description, category, priceVnd, isAvailable });
            }}
          >
            Lưu
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive size-9"
            disabled={disabled || isBooked}
            title={isBooked ? "Đã có người đặt — hãy đánh dấu hết món thay vì xoá" : "Xoá món"}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
