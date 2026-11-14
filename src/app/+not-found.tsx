import { useRouter } from "expo-router";
import { Box, Press, Txt } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Box className="flex-1 items-center justify-center bg-muted">
      <Txt className="mb-4 text-4xl font-display font-bold">404</Txt>
      <Txt className="mb-4 text-xl text-muted-foreground">Oops! Page not found</Txt>
      <Press onPress={() => router.replace("/" as never)}>
        <Txt className="text-primary underline">Return to Home</Txt>
      </Press>
    </Box>
  );
}
