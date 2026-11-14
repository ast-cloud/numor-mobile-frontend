import { useState } from "react";
import { useRouter } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { Box, Button, Icon, Input, InputOTP, Label, Txt } from "@/components/ui";
import { AuthScreen, IconField, TextLink } from "@/components/AuthScreen";
import { useToast } from "@/hooks/use-toast";
import { forgotPassword, resetPassword, verifyResetCode } from "@/lib/api/auth";

type Step = "email" | "verify" | "reset";

const ForgotPassword = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailSubmit = async () => {
    if (!email) return;
    setIsSubmitting(true);
    try {
      const data = await forgotPassword(email);
      if (data.success) {
        toast({ title: "Success", description: "Verification code sent to your email" });
        setStep("verify");
      } else {
        toast({ title: "Error", description: data.message || "Failed to send code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleVerifySubmit = async () => {
    if (code.length !== 6) return;
    setIsSubmitting(true);
    try {
      const data = await verifyResetCode(email, code);
      if (data.success) {
        toast({ title: "Success", description: "Code verified" });
        setStep("reset");
      } else {
        toast({ title: "Error", description: data.message || "Invalid code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleResetSubmit = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await resetPassword(email, code, newPassword);
      if (data.success) {
        toast({ title: "Success", description: "Password reset successfully" });
        router.replace("/login" as never);
      } else {
        toast({ title: "Error", description: data.message || "Failed to reset password", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <AuthScreen center className="px-4">
      {step === "email" && (
        <>
          <Box className="mb-8">
            <Txt className="text-2xl font-display font-bold mb-2">Forgot password?</Txt>
            <Txt className="text-muted-foreground">Enter your email and we'll send you a verification code</Txt>
          </Box>
          <Box className="gap-5">
            <Box className="gap-2">
              <Label>Email</Label>
              <IconField icon={<Icon as={Mail} className="w-4 h-4 text-muted-foreground" />}>
                <Input type="email" placeholder="Enter your email" value={email} onChangeText={setEmail} className="pl-10" onSubmitEditing={handleEmailSubmit} />
              </IconField>
            </Box>
            <Button variant="hero" className="w-full" disabled={isSubmitting} onPress={handleEmailSubmit}>
              {isSubmitting ? "Sending..." : "Send verification code"}
            </Button>
          </Box>
        </>
      )}

      {step === "verify" && (
        <>
          <Box className="mb-8">
            <Txt className="text-2xl font-display font-bold mb-2">Enter verification code</Txt>
            <Txt className="text-muted-foreground">We sent a 6-digit code to {email}</Txt>
          </Box>
          <Box className="gap-5">
            <Box className="flex-row justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} />
            </Box>
            <Button variant="hero" className="w-full" disabled={isSubmitting || code.length !== 6} onPress={handleVerifySubmit}>
              {isSubmitting ? "Verifying..." : "Verify code"}
            </Button>
          </Box>
        </>
      )}

      {step === "reset" && (
        <>
          <Box className="mb-8">
            <Txt className="text-2xl font-display font-bold mb-2">Set new password</Txt>
            <Txt className="text-muted-foreground">Enter your new password below</Txt>
          </Box>
          <Box className="gap-5">
            <Box className="gap-2">
              <Label>New Password</Label>
              <IconField icon={<Icon as={Lock} className="w-4 h-4 text-muted-foreground" />}>
                <Input type="password" placeholder="Enter new password" value={newPassword} onChangeText={setNewPassword} className="pl-10" />
              </IconField>
            </Box>
            <Box className="gap-2">
              <Label>Confirm Password</Label>
              <IconField icon={<Icon as={Lock} className="w-4 h-4 text-muted-foreground" />}>
                <Input type="password" placeholder="Re-enter new password" value={confirmPassword} onChangeText={setConfirmPassword} className="pl-10" />
              </IconField>
            </Box>
            {!!newPassword && !!confirmPassword && newPassword !== confirmPassword && (
              <Txt className="text-sm text-destructive">Passwords do not match</Txt>
            )}
            <Button variant="hero" className="w-full" disabled={isSubmitting || !newPassword || newPassword !== confirmPassword} onPress={handleResetSubmit}>
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
          </Box>
        </>
      )}

      <Box className="flex-row justify-center mt-6">
        <Txt className="text-sm text-muted-foreground">Remember your password? </Txt>
        <TextLink onPress={() => router.replace("/login" as never)} className="text-sm text-primary font-medium">
          Sign in
        </TextLink>
      </Box>
    </AuthScreen>
  );
};

export default ForgotPassword;
