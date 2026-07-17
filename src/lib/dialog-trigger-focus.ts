export function restoreDialogTriggerFocus(trigger: HTMLButtonElement | null): void {
  if (!trigger) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!trigger.isConnected || trigger.disabled) return;
      trigger.focus({ preventScroll: true });
    });
  });
}
