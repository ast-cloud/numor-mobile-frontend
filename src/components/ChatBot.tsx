import React, { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Keyboard, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { fetch as streamingFetch } from "expo/fetch";
import Markdown from "react-native-markdown-display";
import { Send, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BotMascot } from "@/components/BotMascot";
import { Box, Button, Icon, Input, Portal, Press, Txt } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { getToken } from "@/lib/api/authToken";
import { config } from "@/lib/config";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
}

function BouncingDots({ color }: { color: string }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(a, { toValue: -4, duration: 300, useNativeDriver: Platform.OS !== "web" }),
          Animated.timing(a, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== "web" }),
          Animated.delay(400 - i * 150),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);
  return (
    <Box className="flex-row gap-1">
      {anims.map((a, i) => (
        <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, transform: [{ translateY: a }] }} />
      ))}
    </Box>
  );
}

const ChatBot = () => {
  const { tw, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const fetchHistory = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${config.backendHost}/api/chatbot/chat/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setMessages(data.history.map((m: Message) => ({ id: m.id, content: m.content, role: m.role })));
        }
      } catch {
        // silently fail
      }
    };
    fetchHistory();
  }, [isOpen]);

  const requestClose = () => (messages.length === 0 ? setIsOpen(false) : setShowConfirm(true));

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, messages.length]);

  const handleClose = async () => {
    try {
      const token = getToken();
      await fetch(`${config.backendHost}/api/chatbot/chat/deleteHistory`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // silently fail
    }
    setMessages([]);
    setShowConfirm(false);
    setIsOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), content: input.trim(), role: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();

    try {
      const token = getToken();
      // expo/fetch supports streamed response bodies (the built-in fetch does not on native).
      const res = await streamingFetch(`${config.backendHost}/api/chatbot/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!res.body) throw new Error("No response body");

      setMessages((prev) => [...prev, { id: assistantId, content: "", role: "assistant" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        let shouldStop = false;
        let chunkText = "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          let eventType = "";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            // One frame can carry several "data:" lines (text containing line breaks).
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
          }
          const data = dataLines.join("\n");

          if (eventType === "end") {
            shouldStop = true;
            break;
          }
          if (eventType === "error") {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: data || "An error occurred." } : m)));
            shouldStop = true;
            break;
          }
          if (data && !eventType) chunkText += data;
        }

        if (chunkText) {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunkText } : m)));
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
        if (shouldStop) break;
      }
    } catch {
      setMessages((prev) => {
        const hasAssistant = prev.some((m) => m.id === assistantId);
        if (hasAssistant) {
          return prev.map((m) => (m.id === assistantId ? { ...m, content: "Something went wrong. Please try again." } : m));
        }
        return [...prev, { id: assistantId, content: "Something went wrong. Please try again.", role: "assistant" as const }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const bottom = insets.bottom + 24 + keyboardHeight;
  const panelWidth = Math.min(340, win.width - 24);
  const panelHeight = Math.min(480, win.height - bottom - insets.top - 12);

  const mdStyle = (color: string) => ({
    body: { color, fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
    paragraph: { marginTop: 0, marginBottom: 0 },
    bullet_list: { marginTop: 0, marginBottom: 0 },
    ordered_list: { marginTop: 0, marginBottom: 0 },
    strong: { fontFamily: "Inter_600SemiBold", fontWeight: undefined as never },
    code_inline: { fontSize: 12, backgroundColor: "transparent", color },
    fence: { marginVertical: 4, borderRadius: 4, padding: 8, backgroundColor: colors.muted, borderWidth: 0, color },
  });

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <Press
          onPress={() => setIsOpen(true)}
          accessibilityLabel="Open chat assistant"
          className="absolute right-6 w-12 h-12 rounded-full bg-card border-2 border-primary shadow-glow items-center justify-center"
          style={{ bottom: insets.bottom + 24 }}
        >
          <BotMascot size={22} color={colors.primary} />
        </Press>
      )}

      {/* Chat popup */}
      {isOpen && (
        <Portal>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} accessibilityLabel="Close chat" />
          <Box
            className="absolute bg-card rounded-2xl overflow-hidden border border-border/50"
            style={[{ right: Math.min(24, (win.width - panelWidth) / 2), bottom, width: panelWidth, height: panelHeight }, tw.style("shadow-xl")]}
          >
            {/* Header */}
            <Box className="flex-row items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border/50">
              <Box className="flex-row items-center gap-2">
                <Box className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                  <BotMascot size={16} color={colors.primary} />
                </Box>
                <Txt className="font-medium text-sm">Numo Knows 😎</Txt>
              </Box>
              <Press onPress={requestClose} className="p-1.5 rounded-full" activeClassName="bg-muted" accessibilityLabel="Close chat" hitSlop={8}>
                <Icon as={X} className="w-4 h-4 text-muted-foreground" />
              </Press>
            </Box>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={[tw.style("p-4 gap-3"), { flexGrow: 1 }]}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.length === 0 && (
                <Box className="flex-1 items-center justify-center">
                  <Box className="mb-3 w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                    <BotMascot size={24} color={colors.primary} />
                  </Box>
                  <Txt className="font-medium text-sm text-center">Hey there! Ready to clear some financial headspace? 👋</Txt>
                  <Box className="mt-4">
                    <BouncingDots color={`${colors.primary}80`} />
                  </Box>
                </Box>
              )}

              {messages.map((message) => (
                <Box
                  key={message.id}
                  className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                    message.role === "user" ? "self-end bg-muted rounded-br-md" : "self-start bg-secondary/50 rounded-bl-md"
                  }`}
                >
                  <Markdown style={mdStyle(message.role === "user" ? colors.foreground : colors["muted-foreground"]) as never}>{message.content}</Markdown>
                </Box>
              ))}

              {isLoading && (
                <Box className="self-start px-3 py-2 rounded-2xl rounded-bl-md bg-muted/50">
                  <Box className="py-1">
                    <BouncingDots color={`${colors["muted-foreground"]}99`} />
                  </Box>
                </Box>
              )}
            </ScrollView>

            {/* Input */}
            <Box className="p-3 border-t border-border/50 bg-secondary/30">
              <Box className="flex-row gap-2">
                <Input
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  submitBehavior="submit"
                  placeholder="Type a message..."
                  className="flex-1 w-auto bg-background/50 border-border/50 text-sm"
                  disabled={isLoading}
                />
                <Button size="icon" variant="ghost" onPress={handleSend} disabled={!input.trim() || isLoading} accessibilityLabel="Send">
                  <Icon as={Send} className={`w-4 h-4 ${!input.trim() || isLoading ? "text-muted-foreground" : "text-primary"}`} />
                </Button>
              </Box>
            </Box>

            {/* Confirmation overlay */}
            {showConfirm && (
              <Box className="absolute inset-0 bg-background/90 items-center justify-center p-6">
                <Box className="items-center gap-4">
                  <Txt className="text-sm font-medium">End this chat session?</Txt>
                  <Txt className="text-xs text-muted-foreground">Your conversation history will be deleted.</Txt>
                  <Box className="flex-row gap-2 justify-center">
                    <Button size="sm" variant="outline" onPress={() => setShowConfirm(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="destructive" onPress={handleClose}>
                      End Session
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Portal>
      )}
    </>
  );
};

export default ChatBot;
