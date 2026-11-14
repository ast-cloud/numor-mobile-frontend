import { useState } from "react";
import { useRouter } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { Box, Button, Icon, Input, Label, Txt } from "@/components/ui";
import { AuthScreen, IconField, OrDivider, TextLink } from "@/components/AuthScreen";
import { SocialButtons } from "@/components/SocialButtons";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setIsSubmitting(true);
    const result = await login(email, password);

    if (result.success) {
      toast({ title: "Success", description: "Login successful!" });
      // Admin and CA dashboards are not part of the app yet; everyone lands in the SME area.
      router.replace("/" as never);
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <AuthScreen className="px-4 pb-16">
      <Box className="w-full mb-8">
        <Txt className="text-2xl font-display font-bold mb-2">Welcome back</Txt>
        <Txt className="text-muted-foreground">Sign in to your account to continue</Txt>
      </Box>

      {/* Form */}
      <Box className="w-full gap-5">
        <Box className="gap-2">
          <Label>Email</Label>
          <IconField icon={<Icon as={Mail} className="w-4 h-4 text-muted-foreground" />}>
            <Input type="email" placeholder="Enter your email" value={email} onChangeText={setEmail} className="pl-10" returnKeyType="next" />
          </IconField>
        </Box>
        <Box className="gap-2">
          <Box className="flex-row items-center justify-between">
            <Label tight>Password</Label>
            <TextLink onPress={() => router.push("/forgot-password" as never)}>Forgot password?</TextLink>
          </Box>
          <IconField icon={<Icon as={Lock} className="w-4 h-4 text-muted-foreground" />}>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              className="pl-10"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </IconField>
        </Box>
        <Button variant="hero" className="w-full" disabled={isSubmitting} onPress={handleSubmit}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </Box>

      <OrDivider />

      {/* Social login */}
      <Box className="w-full">
        <SocialButtons />
        <Box className="flex-row justify-center mt-6">
          <Txt className="text-sm text-muted-foreground">Don't have an account? </Txt>
          <TextLink onPress={() => router.replace("/signup" as never)} className="text-sm text-primary font-medium">
            Sign up
          </TextLink>
        </Box>
      </Box>
    </AuthScreen>
  );
};

export default Login;
