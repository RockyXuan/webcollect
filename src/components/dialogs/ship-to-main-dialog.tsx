"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Plus, CheckCircle, Check, AlertTriangle } from "lucide-react";
import { useWarehouseStore } from "@/lib/store-warehouse";
import { useAppStore } from "@/lib/store";
import type { WarehouseCategory, WarehouseCard } from "@/lib/db-warehouse";
import type { Category, CollectionSection, WebCard } from "@/lib/types";
import {
  addCard as dbAddCard,
  addCategory as dbAddCategory,
  getCards,
  getCategories,
  getSections,
  saveCategories,
  saveSections,
} from "@/lib/db";
import { cn } from "@/lib/utils";

type TargetMode = "new" | "existing" | "existing_sub";

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function useMainTargets(targetSectionId: string) {
  const sections = useAppStore((s) => s.sections);
  const activeSectionId = useAppStore((s) => s.activeSectionId);
  const allMainCategories = useAppStore((s) => s.categories);
  const mainCards = useAppStore((s) => s.cards);

  const mainCategories = useMemo(
    () => allMainCategories.filter((c) => (c.sectionId || "section-default") === targetSectionId),
    [allMainCategories, targetSectionId]
  );

  const parentMainCats = useMemo(
    () =>
      mainCategories
        .filter((c) => !c.parentId && (c.isParent || mainCategories.some((sg) => sg.parentId === c.id)))
        .sort((a, b) => a.order - b.order),
    [mainCategories]
  );

  const allMainCats = useMemo(
    () => mainCategories.filter((c) => !c.isParent).sort((a, b) => a.order - b.order),
    [mainCategories]
  );

  return { sections, activeSectionId, parentMainCats, allMainCats, mainCategories, mainCards };
}

async function createSectionWithInbox(name: string): Promise<{ section: CollectionSection; categories: Category[] }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Section name is empty");

  const sections = await getSections();
  const existing = sections.find((section) => section.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return { section: existing, categories: await getCategories() };

  const now = Date.now();
  const section: CollectionSection = {
    id: `section-${now}`,
    name: trimmed,
    order: sections.length > 0 ? Math.max(...sections.map((item) => item.order)) + 1 : 0,
    createdAt: now,
    updatedAt: now,
  };

  await saveSections([...sections, section]);

  const categories = await getCategories();
  const hasInbox = categories.some(
    (category) => category.sectionId === section.id && category.name.trim() === "\u6536\u96c6\u7bb1"
  );
  let nextCategories = categories;
  if (!hasInbox) {
    nextCategories = [
      ...categories,
      {
        id: `cat-inbox-${section.id}`,
        name: "\u6536\u96c6\u7bb1",
        icon: "inbox",
        color: "#888888",
        order: 99,
        createdAt: now,
        updatedAt: now,
        sectionId: section.id,
      },
    ];
    await saveCategories(nextCategories);
  }

  return { section, categories: nextCategories };
}

function applyCreatedSectionToStore(section: CollectionSection, categories: Category[]) {
  const state = useAppStore.getState();
  const sections = [
    ...state.sections.filter((item) => item.id !== section.id),
    section,
  ].sort((a, b) => a.order - b.order);
  useAppStore.setState({ sections, categories });
}

async function addCategoriesSafely(categories: Category[], cards: WebCard[]) {
  const existingCategories = await getCategories();
  const existingIds = new Set(existingCategories.map((category) => category.id));
  const idMap = new Map<string, string>();
  let index = 0;

  for (const category of categories) {
    const nextId = existingIds.has(category.id) ? `cat-${Date.now()}-${index++}` : category.id;
    idMap.set(category.id, nextId);
    existingIds.add(nextId);
    await dbAddCategory({
      ...category,
      id: nextId,
      parentId: category.parentId ? idMap.get(category.parentId) || category.parentId : undefined,
    });
  }

  return cards.map((card) => ({
    ...card,
    categoryId: idMap.get(card.categoryId) || card.categoryId,
  }));
}

async function addCardsSafely(cards: WebCard[], skipDuplicates: boolean) {
  const existingCards = await getCards();
  const existingIds = new Set(existingCards.map((card) => card.id));
  const knownUrls = new Set(existingCards.map((card) => normalizeUrl(card.url)).filter(Boolean));
  let added = 0;
  let skipped = 0;

  for (const card of cards) {
    const key = normalizeUrl(card.url);
    if (skipDuplicates && key && knownUrls.has(key)) {
      skipped += 1;
      continue;
    }

    const nextCard = existingIds.has(card.id)
      ? { ...card, id: `card-${Date.now()}-${added}` }
      : card;
    await dbAddCard(nextCard);
    existingIds.add(nextCard.id);
    if (key) knownUrls.add(key);
    added += 1;
  }

  return { added, skipped };
}

function getDuplicateCount(cards: WarehouseCard[], mainCards: WebCard[]): number {
  const knownUrls = new Set(mainCards.map((card) => normalizeUrl(card.url)).filter(Boolean));
  return cards.filter((card) => knownUrls.has(normalizeUrl(card.url))).length;
}

function SectionSelector({
  sections,
  targetSectionId,
  setTargetSectionId,
  onCreateSection,
}: {
  sections: CollectionSection[];
  targetSectionId: string;
  setTargetSectionId: (id: string) => void;
  onCreateSection: (name: string) => Promise<void>;
}) {
  const [newSectionName, setNewSectionName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await onCreateSection(trimmed);
      setNewSectionName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">{"\u76ee\u6807\u5206\u9879"}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sections.map((section) => {
          const selected = targetSectionId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setTargetSectionId(section.id)}
              className={cn(
                "flex min-h-10 items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <span className="truncate">{section.name}</span>
              {selected && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={newSectionName}
          onChange={(event) => setNewSectionName(event.target.value)}
          placeholder="\u5728\u4ed3\u5e93\u4e2d\u65b0\u5efa\u5206\u9879"
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleCreate();
          }}
        />
        <Button type="button" variant="outline" onClick={handleCreate} disabled={creating || !newSectionName.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          {"\u65b0\u5efa"}
        </Button>
      </div>
    </div>
  );
}

function TargetSelector({
  targetMode,
  setTargetMode,
  selectedMainCatId,
  setSelectedMainCatId,
  parentMainCats,
  allMainCats,
  allowExistingSubGroup,
}: {
  targetMode: TargetMode;
  setTargetMode: (m: TargetMode) => void;
  selectedMainCatId: string;
  setSelectedMainCatId: (id: string) => void;
  parentMainCats: Category[];
  allMainCats: Category[];
  allowExistingSubGroup?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">{"\u53d1\u9001\u5230"}</div>
      <div className="grid gap-2">
        <button
          className={cn(
            "w-full rounded-md border p-3 text-left transition-colors",
            targetMode === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
          onClick={() => setTargetMode("new")}
        >
          <div className="flex items-center gap-2 mb-1">
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">{"\u65b0\u5efa\u5206\u7c7b/\u5206\u7ec4"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{"\u5728\u9009\u4e2d\u7684\u5206\u9879\u91cc\u521b\u5efa\u65b0\u7684\u4e3b\u9875\u5206\u7c7b\u6216\u5206\u7ec4"}</p>
        </button>

        {parentMainCats.length > 0 && (
          <button
            className={cn(
              "w-full rounded-md border p-3 text-left transition-colors",
              targetMode === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
            onClick={() => setTargetMode("existing")}
          >
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4" />
              <span className="text-sm font-medium">{"\u5408\u5e76\u5230\u5df2\u6709\u5206\u7c7b\u4e0b"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{"\u628a\u4ed3\u5e93\u5206\u7ec4\u4f5c\u4e3a\u5b50\u5206\u7ec4\u653e\u8fdb\u5df2\u6709\u5206\u7c7b"}</p>
          </button>
        )}

        {allowExistingSubGroup && allMainCats.length > 0 && (
          <button
            className={cn(
              "w-full rounded-md border p-3 text-left transition-colors",
              targetMode === "existing_sub" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
            onClick={() => setTargetMode("existing_sub")}
          >
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4" />
              <span className="text-sm font-medium">{"\u653e\u5165\u5df2\u6709\u5206\u7ec4"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{"\u628a\u5355\u4e2a\u7f51\u9875\u76f4\u63a5\u6dfb\u52a0\u5230\u5df2\u6709\u5206\u7ec4"}</p>
          </button>
        )}
      </div>

      {targetMode === "existing" && (
        <div className="grid grid-cols-1 gap-1 pl-1 sm:grid-cols-2">
          {parentMainCats.map((cat) => (
            <button
              key={cat.id}
              className={cn(
                "flex items-center gap-2 rounded-md p-2 text-left text-sm transition-colors",
                selectedMainCatId === cat.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
              onClick={() => setSelectedMainCatId(cat.id)}
            >
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
              <span className="truncate">{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {targetMode === "existing_sub" && (
        <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto pl-1 sm:grid-cols-2">
          {allMainCats.map((cat) => (
            <button
              key={cat.id}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-md p-2 text-left text-sm transition-colors",
                selectedMainCatId === cat.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
              onClick={() => setSelectedMainCatId(cat.id)}
            >
              <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cat.color }} />
              <span className="truncate">
                {cat.parentId ? `${parentMainCats.find((p) => p.id === cat.parentId)?.name || ""}/` : ""}
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateNotice({
  duplicateCount,
  totalCount,
  skipDuplicates,
  setSkipDuplicates,
}: {
  duplicateCount: number;
  totalCount: number;
  skipDuplicates: boolean;
  setSkipDuplicates: (value: boolean) => void;
}) {
  if (duplicateCount === 0) return null;

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        {`\u68c0\u6d4b\u5230 ${duplicateCount}/${totalCount} \u4e2a\u7f51\u9875\u5df2\u5728\u4e3b\u9875\u6216\u5176\u4ed6\u5206\u9879\u4e2d\u5b58\u5728`}
      </div>
      <label className="flex items-center gap-2 text-red-700">
        <input
          type="checkbox"
          checked={skipDuplicates}
          onChange={(event) => setSkipDuplicates(event.target.checked)}
          className="h-3.5 w-3.5 accent-primary"
        />
        {"\u53d1\u9001\u65f6\u8df3\u8fc7\u91cd\u590d\u7f51\u9875\u3002\u53d6\u6d88\u52fe\u9009\u5219\u5141\u8bb8\u91cd\u590d\u53d1\u9001\u3002"}
      </label>
    </div>
  );
}

interface ShipToMainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseCategory: WarehouseCategory;
  subGroups: WarehouseCategory[];
  allCards: WarehouseCard[];
}

export function ShipToMainDialog({
  open,
  onOpenChange,
  warehouseCategory,
  subGroups,
  allCards,
}: ShipToMainDialogProps) {
  const { shipToMain } = useWarehouseStore();
  const { loadData: loadMainData } = useAppStore();
  const [targetSectionId, setTargetSectionId] = useState("");
  const { sections, activeSectionId, parentMainCats, mainCategories, mainCards } = useMainTargets(targetSectionId);

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("new");
  const [selectedMainCatId, setSelectedMainCatId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [shipResult, setShipResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    if (open) setTargetSectionId(activeSectionId || sections[0]?.id || "section-default");
  }, [open, activeSectionId, sections]);

  useEffect(() => {
    setSelectedMainCatId("");
  }, [targetSectionId, targetMode]);

  const cardCount = useMemo(() => {
    const catIds = [warehouseCategory.id, ...subGroups.map((sg) => sg.id)];
    return allCards.filter((c) => catIds.includes(c.categoryId)).length;
  }, [warehouseCategory, subGroups, allCards]);

  const shipCards = useMemo(() => {
    const catIds = [warehouseCategory.id, ...subGroups.map((sg) => sg.id)];
    return allCards.filter((card) => catIds.includes(card.categoryId));
  }, [warehouseCategory.id, subGroups, allCards]);

  const duplicateCount = useMemo(() => getDuplicateCount(shipCards, mainCards), [shipCards, mainCards]);

  const handleCreateSection = useCallback(async (name: string) => {
    const result = await createSectionWithInbox(name);
    applyCreatedSectionToStore(result.section, result.categories);
    setTargetSectionId(result.section.id);
  }, []);

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      let mainCatId: string;

      if (targetMode === "existing" && selectedMainCatId) {
        mainCatId = selectedMainCatId;
      } else {
        const newCatId = `cat-${Date.now()}`;
        await dbAddCategory({
          id: newCatId,
          name: warehouseCategory.name,
          icon: warehouseCategory.icon,
          color: warehouseCategory.color,
          order: mainCategories.length,
          createdAt: Date.now(),
          sectionId: targetSectionId,
          isParent: true,
        });
        mainCatId = newCatId;
      }

      const result = await shipToMain(warehouseCategory.id, mainCatId);
      const mappedCards = await addCategoriesSafely(
        result.categories.filter((cat) => cat.id !== mainCatId).map((cat) => ({ ...cat, sectionId: targetSectionId })),
        result.cards
      );
      const added = await addCardsSafely(mappedCards, skipDuplicates);

      await loadMainData();
      setShipResult(added);
      setShipped(true);
    } catch (err) {
      console.error("Ship failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseCategory, mainCategories, targetSectionId, shipToMain, skipDuplicates, loadMainData]);

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setShipped(false);
      setShipping(false);
      setTargetMode("new");
      setSelectedMainCatId("");
      setSkipDuplicates(true);
      setShipResult(null);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            {"\u53d1\u8d27\u5230\u4e3b\u9875"}
          </DialogTitle>
          <DialogDescription>{"\u5c06\u4ed3\u5e93\u4e2d\u7684\u5206\u7c7b\u53ca\u5176\u6240\u6709\u4e66\u7b7e\u53d1\u9001\u5230\u4e3b\u9875\u6307\u5b9a\u5206\u9879"}</DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-md bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: warehouseCategory.color }} />
                <span className="font-medium text-foreground">{warehouseCategory.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {`\u5305\u542b ${subGroups.length} \u4e2a\u5206\u7ec4\uff0c${cardCount} \u4e2a\u4e66\u7b7e`}
              </div>
            </div>
            <DuplicateNotice duplicateCount={duplicateCount} totalCount={shipCards.length} skipDuplicates={skipDuplicates} setSkipDuplicates={setSkipDuplicates} />
            <SectionSelector sections={sections} targetSectionId={targetSectionId} setTargetSectionId={setTargetSectionId} onCreateSection={handleCreateSection} />
            <TargetSelector targetMode={targetMode} setTargetMode={setTargetMode} selectedMainCatId={selectedMainCatId} setSelectedMainCatId={setSelectedMainCatId} parentMainCats={parentMainCats} allMainCats={[]} />
          </div>
        ) : (
          <SuccessContent added={shipResult?.added ?? cardCount} skipped={shipResult?.skipped ?? 0} />
        )}

        <ShipFooter shipped={shipped} shipping={shipping} disabled={!targetSectionId || (targetMode === "existing" && !selectedMainCatId)} onClose={() => handleClose(false)} onShip={handleShip} />
      </DialogContent>
    </Dialog>
  );
}

interface ShipToMainSubGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseSubGroup: WarehouseCategory;
  cards: WarehouseCard[];
}

export function ShipToMainSubGroupDialog({ open, onOpenChange, warehouseSubGroup, cards }: ShipToMainSubGroupDialogProps) {
  const { shipSubGroupToMain } = useWarehouseStore();
  const { loadData: loadMainData } = useAppStore();
  const [targetSectionId, setTargetSectionId] = useState("");
  const { sections, activeSectionId, parentMainCats, mainCategories, mainCards } = useMainTargets(targetSectionId);

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("new");
  const [selectedMainCatId, setSelectedMainCatId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [shipResult, setShipResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    if (open) setTargetSectionId(activeSectionId || sections[0]?.id || "section-default");
  }, [open, activeSectionId, sections]);

  useEffect(() => {
    setSelectedMainCatId("");
  }, [targetSectionId, targetMode]);

  const duplicateCount = useMemo(() => getDuplicateCount(cards, mainCards), [cards, mainCards]);

  const handleCreateSection = useCallback(async (name: string) => {
    const result = await createSectionWithInbox(name);
    applyCreatedSectionToStore(result.section, result.categories);
    setTargetSectionId(result.section.id);
  }, []);

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      let parentId = selectedMainCatId;
      if (!(targetMode === "existing" && selectedMainCatId)) {
        parentId = `cat-${Date.now()}`;
        await dbAddCategory({
          id: parentId,
          name: warehouseSubGroup.name,
          icon: warehouseSubGroup.icon,
          color: warehouseSubGroup.color,
          order: mainCategories.length,
          createdAt: Date.now(),
          sectionId: targetSectionId,
          isParent: true,
        });
      }

      const result = await shipSubGroupToMain(warehouseSubGroup.id, parentId);
      const mappedCards = await addCategoriesSafely([{ ...result.category, sectionId: targetSectionId }], result.cards);
      const added = await addCardsSafely(mappedCards, skipDuplicates);

      await loadMainData();
      setShipResult(added);
      setShipped(true);
    } catch (err) {
      console.error("Ship sub-group failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseSubGroup, mainCategories, targetSectionId, shipSubGroupToMain, skipDuplicates, loadMainData]);

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setShipped(false);
      setShipping(false);
      setTargetMode("new");
      setSelectedMainCatId("");
      setSkipDuplicates(true);
      setShipResult(null);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            {"\u53d1\u9001\u5206\u7ec4\u5230\u4e3b\u9875"}
          </DialogTitle>
          <DialogDescription>{`\u5c06\u4ed3\u5e93\u4e2d\u7684\u5206\u7ec4\u53ca\u5176 ${cards.length} \u4e2a\u4e66\u7b7e\u53d1\u9001\u5230\u4e3b\u9875\u6307\u5b9a\u5206\u9879`}</DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-md bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: warehouseSubGroup.color }} />
                <span className="font-medium text-foreground">{warehouseSubGroup.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">{cards.length} {"\u4e2a\u4e66\u7b7e"}</div>
            </div>
            <DuplicateNotice duplicateCount={duplicateCount} totalCount={cards.length} skipDuplicates={skipDuplicates} setSkipDuplicates={setSkipDuplicates} />
            <SectionSelector sections={sections} targetSectionId={targetSectionId} setTargetSectionId={setTargetSectionId} onCreateSection={handleCreateSection} />
            <TargetSelector targetMode={targetMode} setTargetMode={setTargetMode} selectedMainCatId={selectedMainCatId} setSelectedMainCatId={setSelectedMainCatId} parentMainCats={parentMainCats} allMainCats={[]} />
          </div>
        ) : (
          <SuccessContent added={shipResult?.added ?? cards.length} skipped={shipResult?.skipped ?? 0} />
        )}

        <ShipFooter shipped={shipped} shipping={shipping} disabled={!targetSectionId || (targetMode === "existing" && !selectedMainCatId)} onClose={() => handleClose(false)} onShip={handleShip} />
      </DialogContent>
    </Dialog>
  );
}

interface ShipToMainCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseCard: WarehouseCard;
}

export function ShipToMainCardDialog({ open, onOpenChange, warehouseCard }: ShipToMainCardDialogProps) {
  const { shipCardToMain } = useWarehouseStore();
  const { loadData: loadMainData } = useAppStore();
  const [targetSectionId, setTargetSectionId] = useState("");
  const { sections, activeSectionId, parentMainCats, allMainCats, mainCategories, mainCards } = useMainTargets(targetSectionId);

  const [shipping, setShipping] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("existing_sub");
  const [selectedMainCatId, setSelectedMainCatId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [shipResult, setShipResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    if (open) setTargetSectionId(activeSectionId || sections[0]?.id || "section-default");
  }, [open, activeSectionId, sections]);

  useEffect(() => {
    setSelectedMainCatId("");
  }, [targetSectionId, targetMode]);

  const duplicateCount = useMemo(() => getDuplicateCount([warehouseCard], mainCards), [warehouseCard, mainCards]);

  const handleCreateSection = useCallback(async (name: string) => {
    const result = await createSectionWithInbox(name);
    applyCreatedSectionToStore(result.section, result.categories);
    setTargetSectionId(result.section.id);
  }, []);

  const handleShip = useCallback(async () => {
    setShipping(true);
    try {
      let targetCategoryId = selectedMainCatId;
      if (targetMode === "existing" && selectedMainCatId) {
        targetCategoryId = `cat-${Date.now()}`;
        await dbAddCategory({
          id: targetCategoryId,
          name: warehouseCard.title,
          icon: "BookMarked",
          color: "#888888",
          order: mainCategories.filter((c) => c.parentId === selectedMainCatId).length,
          createdAt: Date.now(),
          sectionId: targetSectionId,
          parentId: selectedMainCatId,
        });
      } else if (targetMode === "new" || !selectedMainCatId) {
        targetCategoryId = `cat-${Date.now()}`;
        await dbAddCategory({
          id: targetCategoryId,
          name: warehouseCard.title,
          icon: "BookMarked",
          color: "#888888",
          order: mainCategories.length,
          createdAt: Date.now(),
          sectionId: targetSectionId,
        });
      }

      const mainCard = await shipCardToMain(warehouseCard.id, targetCategoryId);
      const added = await addCardsSafely([{ ...mainCard, categoryId: targetCategoryId }], skipDuplicates);

      await loadMainData();
      setShipResult(added);
      setShipped(true);
    } catch (err) {
      console.error("Ship card failed:", err);
    } finally {
      setShipping(false);
    }
  }, [targetMode, selectedMainCatId, warehouseCard, mainCategories, targetSectionId, shipCardToMain, skipDuplicates, loadMainData]);

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setShipped(false);
      setShipping(false);
      setTargetMode("existing_sub");
      setSelectedMainCatId("");
      setSkipDuplicates(true);
      setShipResult(null);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Send className="h-5 w-5" />
            {"\u53d1\u9001\u4e66\u7b7e\u5230\u4e3b\u9875"}
          </DialogTitle>
          <DialogDescription>{`\u5c06\u201c${warehouseCard.title}\u201d\u53d1\u9001\u5230\u4e3b\u9875\u6307\u5b9a\u5206\u9879`}</DialogDescription>
        </DialogHeader>

        {!shipped ? (
          <div className="space-y-4 py-4">
            <DuplicateNotice duplicateCount={duplicateCount} totalCount={1} skipDuplicates={skipDuplicates} setSkipDuplicates={setSkipDuplicates} />
            <SectionSelector sections={sections} targetSectionId={targetSectionId} setTargetSectionId={setTargetSectionId} onCreateSection={handleCreateSection} />
            <TargetSelector targetMode={targetMode} setTargetMode={setTargetMode} selectedMainCatId={selectedMainCatId} setSelectedMainCatId={setSelectedMainCatId} parentMainCats={parentMainCats} allMainCats={allMainCats} allowExistingSubGroup />
          </div>
        ) : (
          <SuccessContent added={shipResult?.added ?? 1} skipped={shipResult?.skipped ?? 0} />
        )}

        <ShipFooter shipped={shipped} shipping={shipping} disabled={!targetSectionId || (targetMode === "existing" && !selectedMainCatId) || (targetMode === "existing_sub" && !selectedMainCatId)} onClose={() => handleClose(false)} onShip={handleShip} />
      </DialogContent>
    </Dialog>
  );
}

function SuccessContent({ added, skipped }: { added: number; skipped: number }) {
  return (
    <div className="space-y-4 py-8 text-center">
      <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
      <div>
        <p className="text-lg font-serif font-semibold text-foreground">{"\u53d1\u9001\u6210\u529f"}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {`\u5df2\u6dfb\u52a0 ${added} \u4e2a\u4e66\u7b7e${skipped > 0 ? `\uff0c\u8df3\u8fc7 ${skipped} \u4e2a\u91cd\u590d\u9879` : ""}`}
        </p>
      </div>
    </div>
  );
}

function ShipFooter({
  shipped,
  shipping,
  disabled,
  onClose,
  onShip,
}: {
  shipped: boolean;
  shipping: boolean;
  disabled: boolean;
  onClose: () => void;
  onShip: () => void;
}) {
  return (
    <DialogFooter>
      {!shipped ? (
        <>
          <Button variant="outline" onClick={onClose}>
            {"\u53d6\u6d88"}
          </Button>
          <Button onClick={onShip} disabled={shipping || disabled}>
            {shipping ? (
              <>
                <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
                {"\u53d1\u9001\u4e2d..."}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                {"\u786e\u8ba4\u53d1\u9001"}
              </>
            )}
          </Button>
        </>
      ) : (
        <Button onClick={onClose}>{"\u5b8c\u6210"}</Button>
      )}
    </DialogFooter>
  );
}
