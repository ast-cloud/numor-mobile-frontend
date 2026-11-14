import React, { useRef, useState } from "react";
import { TextInput } from "react-native";
import { InputRef, useFocusRing } from "./input";
import { Box, Press, Txt } from "./primitives";

/** Six joined boxes backed by one hidden input (web: input-otp). */
export function InputOTP({ value, onChange, maxLength = 6 }: { value: string; onChange: (v: string) => void; maxLength?: number }) {
  const ref = useRef<InputRef>(null);
  const [focused, setFocused] = useState(false);
  const ring = useFocusRing();
  const activeIndex = Math.min(value.length, maxLength - 1);
  return (
    <Press activeOpacity={1} onPress={() => ref.current?.focus()} className="flex-row items-center">
      {Array.from({ length: maxLength }, (_, i) => (
        <Box
          key={i}
          className={`h-10 w-10 items-center justify-center border-y border-r border-input ${i === 0 ? "rounded-l-md border-l" : ""} ${i === maxLength - 1 ? "rounded-r-md" : ""}`}
          style={focused && i === activeIndex ? [{ zIndex: 10 }, ring] : undefined}
        >
          <Txt className="text-sm">{value[i] ?? ""}</Txt>
          {focused && i === value.length && <Box className="absolute h-4 w-px bg-foreground" />}
        </Box>
      ))}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, "").slice(0, maxLength))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
    </Press>
  );
}
