"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface InlineEditableTextProps {
  value: string;
  className?: string;
  editMode: boolean;
  onSave: (newValue: string) => void;
  placeholder?: string;
}

/**
 * A text span that becomes an inline editable input in edit mode.
 * - Hover cursor: text (I-beam) in edit mode, default otherwise
 * - Click to start editing, Enter/Blur to save, Escape to cancel
 * - Stop propagation on pointer events to prevent dnd-kit capture
 */
export function InlineEditableText({
  value,
  className,
  editMode,
  onSave,
  placeholder,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    if (!editMode) return;
    setEditValue(value);
    setIsEditing(true);
  }, [editMode, value]);

  const saveEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
    setEditValue("");
  }, [editValue, value, onSave]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
      e.stopPropagation();
    },
    [saveEdit, cancelEdit]
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={saveEdit}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => e.stopPropagation()}
        className={`${className} bg-transparent border-b border-primary outline-none px-0 py-0 w-auto min-w-[40px]`}
        style={{ maxWidth: "200px" }}
      />
    );
  }

  return (
    <span
      className={`${className} ${editMode ? "cursor-text hover:bg-muted/30 rounded px-0.5 -mx-0.5" : ""}`}
      onClick={editMode ? (e) => { e.stopPropagation(); startEdit(); } : undefined}
      title={editMode ? "点击编辑名称" : undefined}
    >
      {value || (editMode && placeholder ? <span className="text-muted-foreground/40 italic">{placeholder}</span> : value)}
    </span>
  );
}
