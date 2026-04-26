"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  editable?: boolean; // whether inline editing is allowed (typically editMode)
  /** Single click to edit instead of double click */
  singleClickEdit?: boolean;
  placeholder?: string;
}

/**
 * Inline-editable text component.
 * - In non-edit mode: displays text normally
 * - In edit mode (editable=true):
 *   - Cursor becomes I-beam on hover
 *   - Double-click (or single-click if singleClickEdit) enters inline editing
 *   - Press Enter or blur to confirm
 *   - Press Escape to cancel
 */
export function EditableText({
  value,
  onChange,
  className = "",
  editable = false,
  singleClickEdit = false,
  placeholder = "点击编辑",
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleStartEdit = useCallback(() => {
    if (!editable) return;
    setEditValue(value);
    setIsEditing(true);
  }, [editable, value]);

  const handleConfirm = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    }
    setIsEditing(false);
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        setEditValue(value);
        setIsEditing(false);
      }
    },
    [handleConfirm, value]
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleConfirm}
        onKeyDown={handleKeyDown}
        className={`${className} bg-transparent outline-none ring-1 ring-primary/50 rounded px-0.5`}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={`${className} ${editable ? "cursor-text hover:bg-muted/30 rounded px-0.5" : ""}`}
      onDoubleClick={editable ? handleStartEdit : undefined}
      onClick={editable && singleClickEdit ? handleStartEdit : undefined}
      title={editable ? "双击编辑名称" : undefined}
    >
      {value || (editable ? placeholder : "")}
    </span>
  );
}
