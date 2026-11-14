import { useState } from "react";
import { useRouter } from "expo-router";
import { Lock, Mail, User } from "lucide-react-native";
import { Box, Button, Icon, Input, Label, Txt } from "@/components/ui";
import { AuthScreen, IconField, OrDivider, TextLink } from "@/components/AuthScreen";
import { SocialButtons } from "@/components/SocialButtons";
import EmailVerification from "@/components/EmailVerification";
import { register } from "@/lib/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailDisabled, setEmailDisabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: string) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.password) return;
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register(formData.name, formData.email, formData.password, "SME_USER");
      if (result.error) throw new Error(result.error);

      toast({ title: "Success", description: "Account created successfully!" });
      // The web app reloads the user when the dashboard mounts; do the same before navigating.
      await refreshUser();
      router.replace("/" as never);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen className="px-4 pb-16">
      <Box className="w-full mb-8">
        <Txt className="text-2xl font-display font-bold mb-2">Create your account</Txt>
        <Txt className="text-muted-foreground">Get started with Numor in minutes</Txt>
      </Box>

      <Box className="w-full gap-4">
        <Box className="gap-2">
          <Label>Full Name</Label>
          <IconField icon={<Icon as={User} className="w-4 h-4 text-muted-foreground" />}>
            <Input placeholder="Enter your full name" value={formData.name} onChangeText={handleChange("name")} className="pl-10" autoComplete="name" />
          </IconField>
        </Box>
        <Box className="gap-2">
          <Label>Email</Label>
          <IconField icon={<Icon as={Mail} className="w-4 h-4 text-muted-foreground" />}>
            <Input
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChangeText={(v) => {
                handleChange("email")(v);
                setEmailVerified(false);
              }}
              className="pl-10"
              disabled={emailDisabled}
            />
          </IconField>
          <EmailVerification
            email={formData.email}
            isVerified={emailVerified}
            onVerified={() => setEmailVerified(true)}
            onOtpStep={(inOtp) => setEmailDisabled(inOtp)}
          />
        </Box>
        <Box className="gap-2">
          <Label>Password</Label>
          <IconField icon={<Icon as={Lock} className="w-4 h-4 text-muted-foreground" />}>
            <Input disabled={!emailVerified} type="password" placeholder="Create a password" value={formData.password} onChangeText={handleChange("password")} className="pl-10" />
          </IconField>
        </Box>
        <Box className="gap-2">
          <Label>Confirm Password</Label>
          <IconField icon={<Icon as={Lock} className="w-4 h-4 text-muted-foreground" />}>
            <Input
              disabled={!emailVerified}
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={handleChange("confirmPassword")}
              className="pl-10"
            />
          </IconField>
        </Box>
        <Txt className="text-xs text-muted-foreground">
          By signing up, you agree to our <Txt className="text-primary">Terms of Service</Txt> and <Txt className="text-primary">Privacy Policy</Txt>
        </Txt>
        <Button variant="hero" className="w-full" disabled={isSubmitting || !emailVerified} onPress={handleSubmit}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </Box>

      <OrDivider />

      <Box className="w-full">
        <SocialButtons />
        <Box className="flex-row justify-center mt-6">
          <Txt className="text-sm text-muted-foreground">Already have an account? </Txt>
          <TextLink onPress={() => router.replace("/login" as never)} className="text-sm text-primary font-medium">
            Sign in
          </TextLink>
        </Box>
      </Box>
    </AuthScreen>
  );
};

export default Signup;
