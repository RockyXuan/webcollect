export interface CategorySearchTarget {
  sectionId: string;
  categoryId: string;
  requestId: number;
}

export type CategorySearchSelection = Omit<CategorySearchTarget, "requestId">;
