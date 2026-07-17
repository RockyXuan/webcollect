import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadOnlySiteIcon } from "@/components/mindmap/read-only-site-icon";
import type { WebCard } from "@/lib/types";

const card: WebCard = {
  id: "offline-card",
  url: "https://offline-icons.invalid/page",
  title: "Offline Site",
  shortDesc: "",
  fullDesc: "",
  note: "",
  abbreviation: "OS",
  imageUrl: "https://offline-icons.invalid/favicon.png",
  categoryId: "group-offline",
  order: 0,
  createdAt: 1,
  updatedAt: 1,
};

describe("read-only mindmap site icon", () => {
  it("shows the letter fallback immediately and only fades the image in after load", () => {
    const { container } = render(<ReadOnlySiteIcon card={card} className="test-icon" />);
    expect(container.querySelector(".wc-mindmap-icon-fallback-text")).toHaveTextContent("OS");
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).not.toHaveClass("is-loaded");
    fireEvent.load(image as HTMLImageElement);
    expect(image).toHaveClass("is-loaded");
  });

  it("keeps the fallback visible while every favicon candidate fails", () => {
    const { container } = render(<ReadOnlySiteIcon card={card} className="test-icon" />);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const image = container.querySelector("img");
      if (!image) break;
      fireEvent.error(image);
    }
    expect(container.querySelector(".wc-mindmap-icon-fallback-text")).toHaveTextContent("OS");
    expect(container.querySelector("img.is-loaded")).toBeNull();
  });

  it("resets candidate and loaded state when the card changes", () => {
    const { container, rerender } = render(<ReadOnlySiteIcon card={card} className="test-icon" />);
    const firstImage = container.querySelector("img") as HTMLImageElement;
    fireEvent.load(firstImage);
    expect(firstImage).toHaveClass("is-loaded");

    const replacement = {
      ...card,
      id: "replacement-card",
      imageUrl: "https://replacement-icons.invalid/favicon.png",
      abbreviation: "RS",
    };
    rerender(<ReadOnlySiteIcon card={replacement} className="test-icon" />);
    expect(container.querySelector(".wc-mindmap-icon-fallback-text")).toHaveTextContent("RS");
    expect(container.querySelector("img")).not.toHaveClass("is-loaded");
    expect(container.querySelector("img")).toHaveAttribute("src", replacement.imageUrl);
  });
});
