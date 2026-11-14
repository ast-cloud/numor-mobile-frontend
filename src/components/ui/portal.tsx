// Tiny portal so dialogs, menus and toasts render above every screen with plain JS views.
// Avoiding the native <Modal> keeps overlays pixel-identical on iOS and Android and lets
// toasts sit on top of open dialogs, like on the web.
import React, { useEffect, useId, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";

type Entry = { key: string; node: React.ReactNode };
let entries: Entry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setEntry(key: string, node: React.ReactNode) {
  const idx = entries.findIndex((e) => e.key === key);
  if (idx === -1) entries = [...entries, { key, node }];
  else entries = entries.map((e) => (e.key === key ? { key, node } : e));
  emit();
}

function removeEntry(key: string) {
  entries = entries.filter((e) => e.key !== key);
  emit();
}

export function Portal({ children }: { children: React.ReactNode }) {
  const key = useId();
  useEffect(() => {
    setEntry(key, children);
  });
  useEffect(() => () => removeEntry(key), [key]);
  return null;
}

export function PortalHost() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => entries,
    () => entries,
  );
  return (
    <>
      {list.map((e) => (
        <View key={e.key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {e.node}
        </View>
      ))}
    </>
  );
}
