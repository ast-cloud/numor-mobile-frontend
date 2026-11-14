import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react-native";
import { Box, Button, Icon, Input, Label, Spinner, Txt } from "@/components/ui";
import { AuthScreen, IconField } from "@/components/AuthScreen";
import { config } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";

interface InvitationData {
  email: string;
  organizationName: string;
  expiresAt: string;
}

// Opened from an invitation link: numor://accept-invitation?token=...
const AcceptInvitation = () => {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const token = typeof params.token === "string" ? params.token : "";

  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setVerifyError("Invalid invitation link");
        setVerifying(false);
        return;
      }
      try {
        const res = await fetch(`${config.backendHost}/api/auth/verifyInvitation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => ({}));
        if (json?.success) setInvitation(json.data);
        else setVerifyError(json?.message || "Invitation verification failed");
      } catch {
        setVerifyError("Network error. Please try again.");
      } finally {
        setVerifying(false);
      }
    };
    verify();
  }, [token]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!password || password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${config.backendHost}/api/auth/createSubAccount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password, phone: phone.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.success) {
        toast({ title: "Account created", description: "You can now log in." });
        router.replace("/login" as never);
      } else {
        toast({ title: "Error", description: json?.message || "Failed to create account", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const icon = (as: typeof Mail) => <Icon as={as} className="w-4 h-4 text-muted-foreground" />;

  return (
    <AuthScreen className="px-4 pt-2 pb-16">
      {verifying ? (
        <Box className="items-center justify-center py-20 gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <Txt className="text-sm text-muted-foreground">Verifying invitation...</Txt>
        </Box>
      ) : verifyError ? (
        <Box className="rounded-lg border border-border bg-card p-8 items-center gap-4">
          <Box className="w-12 h-12 rounded-full bg-destructive/10 items-center justify-center">
            <Icon as={AlertCircle} className="w-6 h-6 text-destructive" />
          </Box>
          <Txt className="font-display text-xl font-semibold text-center">Invitation Unavailable</Txt>
          <Txt className="text-sm text-muted-foreground text-center">{verifyError}</Txt>
          <Button variant="outline" onPress={() => router.replace("/login" as never)}>
            Go to Login
          </Button>
        </Box>
      ) : (
        <Box className="rounded-lg border border-border bg-card p-8 gap-6">
          <Box className="gap-2 items-center">
            <Box className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
              <Icon as={CheckCircle2} className="w-6 h-6 text-primary" />
            </Box>
            <Txt className="font-display text-2xl font-semibold text-center">Join Numor</Txt>
            <Txt className="text-sm text-muted-foreground text-center">
              You've been invited to join <Txt className="font-medium text-foreground">{invitation?.organizationName}</Txt>
            </Txt>
          </Box>

          <Box className="gap-4">
            <Box className="gap-2">
              <Label>Email</Label>
              <IconField icon={icon(Mail)}>
                <Input value={invitation?.email || ""} disabled className="pl-9" />
              </IconField>
            </Box>
            <Box className="gap-2">
              <Label>Full name *</Label>
              <IconField icon={icon(User)}>
                <Input value={name} onChangeText={setName} className="pl-9" placeholder="Jane Doe" />
              </IconField>
            </Box>
            <Box className="gap-2">
              <Label>Phone number</Label>
              <IconField icon={icon(Phone)}>
                <Input value={phone} onChangeText={setPhone} className="pl-9" placeholder="Optional" type="tel" />
              </IconField>
            </Box>
            <Box className="gap-2">
              <Label>Password *</Label>
              <IconField icon={icon(Lock)}>
                <Input type="password" value={password} onChangeText={setPassword} className="pl-9" />
              </IconField>
            </Box>
            <Box className="gap-2">
              <Label>Confirm password *</Label>
              <IconField icon={icon(Lock)}>
                <Input type="password" value={confirmPassword} onChangeText={setConfirmPassword} className="pl-9" />
              </IconField>
            </Box>
            <Button className="w-full" disabled={submitting} onPress={handleSubmit}>
              {submitting ? <Spinner className="w-4 h-4" /> : null}
              Join Numor
            </Button>
          </Box>
        </Box>
      )}
    </AuthScreen>
  );
};

export default AcceptInvitation;
