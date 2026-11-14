import { useState } from "react";
import { useRouter } from "expo-router";
import { CheckCircle } from "lucide-react-native";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Box,
  Button,
  Icon,
  InputOTP,
  Spinner,
  Txt,
} from "@/components/ui";
import { TextLink } from "@/components/AuthScreen";
import { useToast } from "@/hooks/use-toast";
import { config } from "@/lib/config";

interface EmailVerificationProps {
  email: string;
  isVerified: boolean;
  onVerified: () => void;
  onOtpStep?: (inOtp: boolean) => void;
  onAlreadyRegistered?: (data: any) => void;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const EmailVerification = ({ email, isVerified, onVerified, onOtpStep, onAlreadyRegistered }: EmailVerificationProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "otp" | "verified">(isVerified ? "verified" : "idle");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState("");
  const [showAlreadyRegistered, setShowAlreadyRegistered] = useState(false);

  const handleSendOtp = async () => {
    setIsSending(true);
    try {
      const res = await fetch(`${config.backendHost}/api/auth/verifyEmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("otp");
        onOtpStep?.(true);
        toast({ title: "OTP Sent", description: "Verification code sent to your email." });
      } else if (data.result?.message === "Email is already registered") {
        if (onAlreadyRegistered) onAlreadyRegistered(data.result);
        else setShowAlreadyRegistered(true);
      } else {
        throw new Error(data.result?.message || data.message || "Failed to send OTP");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to send verification code.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`${config.backendHost}/api/auth/verifyEmailOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("verified");
        onVerified();
        toast({ title: "Verified", description: "Email verified successfully!" });
      } else {
        throw new Error(data.message || "Invalid OTP");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Verification failed.", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  if (step === "verified" || isVerified) {
    return (
      <Box className="flex-row items-center gap-1.5 mt-1">
        <Icon as={CheckCircle} className="w-3.5 h-3.5 text-green-600" />
        <Txt className="text-xs text-green-600">Email verified</Txt>
      </Box>
    );
  }

  return (
    <Box className="gap-3">
      {step === "idle" && (
        <Box className="flex-row justify-end mt-1">
          <Button variant="outline" size="sm" className="h-7 px-3" textClassName="text-xs" disabled={!isValidEmail(email) || isSending} onPress={handleSendOtp}>
            {isSending ? <Spinner className="w-3 h-3" /> : null}
            Verify email
          </Button>
        </Box>
      )}

      {step === "otp" && (
        <Box className="gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <Txt className="text-xs text-muted-foreground">Enter the 6-digit code sent to your email</Txt>
          <Box className="flex-row items-center gap-3">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} />
            <Button size="sm" className="h-8" disabled={otp.length !== 6 || isVerifying} onPress={handleVerifyOtp}>
              {isVerifying ? <Spinner className="w-3 h-3" /> : null}
              Verify
            </Button>
          </Box>
          <Box className="flex-row items-center gap-3">
            <TextLink onPress={() => !isSending && handleSendOtp()}>Resend code</TextLink>
            <TextLink
              className="text-xs text-muted-foreground"
              onPress={() => {
                setStep("idle");
                setOtp("");
                onOtpStep?.(false);
              }}
            >
              Change email
            </TextLink>
          </Box>
        </Box>
      )}

      <AlertDialog open={showAlreadyRegistered} onOpenChange={setShowAlreadyRegistered} className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Email Already Registered</AlertDialogTitle>
          <AlertDialogDescription>This email is already registered with us. Please log in instead.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={() => setShowAlreadyRegistered(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onPress={() => {
              setShowAlreadyRegistered(false);
              router.replace("/login" as never);
            }}
          >
            Go to Login
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </Box>
  );
};

export default EmailVerification;
