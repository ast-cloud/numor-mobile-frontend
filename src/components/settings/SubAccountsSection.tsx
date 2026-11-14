// Team & Permissions (organisation owners only): members, invitations and their module access.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform } from "react-native";
import { AlertTriangle, Clock, Pencil, Plus, RefreshCw, Send, Trash2 } from "lucide-react-native";
import { Badge, Box, Button, Card, CardContent, Checkbox, Dialog, DialogFooter, DialogHeader, DialogTitle, Icon, Input, Label, Spinner, Tabs, TabsContent, TabsList, TabsTrigger, Txt } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { createSubAccount, deleteSubAccount, listInvitations, listSubAccounts, updateSubAccountPermissions, type Invitation, type SubAccount } from "@/lib/api/subAccounts";
import type { ModuleKey, ModulePermissions } from "@/lib/authStore";
import { MODULE_KEYS, MODULE_LABELS, defaultPermissions } from "@/lib/permissions";
import { ConfirmDelete, SectionHeader, SectionLoader } from "./shared";

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
};

const applyToggle = (prev: ModulePermissions, module: ModuleKey, action: "read" | "write", value: boolean): ModulePermissions => {
  const next = { ...prev, [module]: { ...prev[module] } };
  next[module][action] = value;
  if (action === "write" && value) next[module].read = true;
  if (action === "read" && !value) next[module].write = false;
  return next;
};

function PermissionsTable({ permissions, onToggle }: { permissions: ModulePermissions; onToggle: (m: ModuleKey, a: "read" | "write", v: boolean) => void }) {
  return (
    <Box className="border border-border rounded-md overflow-hidden">
      <Box className="flex-row px-3 py-2 bg-muted">
        <Txt className="flex-1 text-xs font-medium">Module</Txt>
        <Txt className="flex-1 text-xs font-medium text-center">Read</Txt>
        <Txt className="flex-1 text-xs font-medium text-center">Write</Txt>
      </Box>
      {MODULE_KEYS.map((m) => (
        <Box key={m} className="flex-row px-3 py-2 items-center border-t border-border">
          <Txt className="flex-1 text-sm">{MODULE_LABELS[m]}</Txt>
          <Box className="flex-1 items-center">
            <Checkbox checked={permissions[m].read} onCheckedChange={(v) => onToggle(m, "read", v)} />
          </Box>
          <Box className="flex-1 items-center">
            <Checkbox checked={permissions[m].write} onCheckedChange={(v) => onToggle(m, "write", v)} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

const PermissionBadges = ({ permissions }: { permissions?: ModulePermissions | null }) => (
  <Box className="flex-row flex-wrap gap-1 mt-1.5">
    {MODULE_KEYS.map((m) => {
      const p = permissions?.[m];
      const label = p?.write ? "RW" : p?.read ? "R" : "—";
      return (
        <Badge key={m} variant="secondary" textClassName="text-[10px] leading-4 font-normal">
          {`${MODULE_LABELS[m]}: ${label}`}
        </Badge>
      );
    })}
  </Box>
);

function PaperPlane() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }).start();
  }, [t]);
  return (
    <Animated.View
      style={{
        opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-20, 90] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [10, -70] }) }],
      }}
    >
      <Icon as={Send} className="w-12 h-12 text-primary" strokeWidth={1.75} />
    </Animated.View>
  );
}

function AddSubAccountDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<ModulePermissions>(defaultPermissions());

  const reset = () => {
    setEmail("");
    setPermissions(defaultPermissions());
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({ title: "Missing fields", description: "Email is required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await createSubAccount({ email: email.trim(), permissions });
      setSent(true);
      setTimeout(() => {
        toast({ title: "Invitation sent", description: `A link has been sent to ${email} to set their password.` });
        reset();
        setSent(false);
        setOpen(false);
        onCreated();
      }, 1400);
    } catch (e) {
      toast({ title: "Failed to create", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" className="h-8" textClassName="text-xs" onPress={() => setOpen(true)}>
        <Icon as={Plus} className="w-3.5 h-3.5 mr-1.5" />
        Add Sub-Account
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (loading || sent) return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add Sub-Account</DialogTitle>
        </DialogHeader>

        <Box className="gap-4 pt-2">
          <Box className="gap-3">
            <Box className="gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChangeText={setEmail} placeholder="employee@example.com" />
            </Box>
            <Txt className="text-xs text-muted-foreground">A link will be emailed to the user so they can set their own password.</Txt>
          </Box>

          <Box className="gap-2">
            <Label>Permissions</Label>
            <PermissionsTable permissions={permissions} onToggle={(m, a, v) => setPermissions((prev) => applyToggle(prev, m, a, v))} />
            <Txt className="text-xs text-muted-foreground">Enabling Write automatically enables Read.</Txt>
          </Box>
        </Box>

        <DialogFooter>
          <Button variant="outline" className="mt-2" onPress={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onPress={handleSubmit} disabled={loading}>
            {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Send Invite
          </Button>
        </DialogFooter>

        {sent && (
          <Box className="absolute inset-0 items-center justify-center bg-background/95">
            <PaperPlane />
            <Txt className="mt-6 text-sm font-medium">Invitation sent!</Txt>
          </Box>
        )}
      </Dialog>
    </>
  );
}

function EditSubAccountPermissionsDialog({ subAccount, onClose, onSaved, onDelete }: { subAccount: SubAccount | null; onClose: () => void; onSaved: () => void; onDelete?: (sa: SubAccount) => void }) {
  const { toast } = useToast();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<ModulePermissions | null>(null);

  useEffect(() => {
    setPermissions(subAccount?.permissions ?? null);
  }, [subAccount]);

  const handleSave = async () => {
    if (!subAccount || !permissions) return;
    setLoading(true);
    try {
      await updateSubAccountPermissions(subAccount.id, permissions);
      toast({ title: "Permissions updated" });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Failed to update", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setPermissions(null);
    onClose();
  };

  return (
    <Dialog open={!!subAccount} onOpenChange={(o) => !o && close()}>
      <DialogHeader>
        <DialogTitle>Manage Member — {subAccount?.name}</DialogTitle>
      </DialogHeader>

      {permissions && <PermissionsTable permissions={permissions} onToggle={(m, a, v) => setPermissions((prev) => (prev ? applyToggle(prev, m, a, v) : prev))} />}

      <Box className="gap-2">
        <Box className="flex-row items-center gap-1.5">
          {onDelete && subAccount && (
            <Button size="sm" variant="ghost" color={colors.destructive} onPress={() => onDelete(subAccount)}>
              <Icon as={Trash2} className="w-3.5 h-3.5 mr-1" />
              Delete
            </Button>
          )}
        </Box>
        <Box className="flex-row items-center gap-2">
          <Button variant="outline" onPress={close} disabled={loading}>
            Cancel
          </Button>
          <Button onPress={handleSave} disabled={loading}>
            {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Save
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

const SubAccountsSection = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SubAccount | null>(null);
  const [deleting, setDeleting] = useState<SubAccount | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [tab, setTab] = useState("members");

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listSubAccounts());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      setInvitations(await listInvitations());
    } catch {
      setInvitations([]);
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    load();
    loadInvites();
  }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSubAccount(deleting.id);
      toast({ title: "Sub-account deleted" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: "Failed to delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const handleResend = async (inv: Invitation) => {
    setResendingId(inv.id);
    try {
      await createSubAccount({ email: inv.email, permissions: inv.permissions });
      toast({ title: "Invitation resent", description: `A new invite has been sent to ${inv.email}.` });
      loadInvites();
    } catch (e) {
      toast({ title: "Failed to resend", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <Card>
      <SectionHeader
        title="Team & Permissions"
        description="Invite employees and control what they can access."
        action={
          <AddSubAccountDialog
            onCreated={() => {
              load();
              loadInvites();
            }}
          />
        }
      />
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">
              Invitations
              {invitations.length > 0 && (
                <Box className="ml-0.5 h-4 px-1.5 rounded-full bg-secondary items-center justify-center">
                  <Txt className="text-[10px] leading-4 font-semibold text-secondary-foreground">{invitations.length}</Txt>
                </Box>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            {loading ? (
              <SectionLoader className="py-8" size="w-5 h-5" />
            ) : items.length === 0 ? (
              <Txt className="text-sm text-muted-foreground py-6 text-center">No sub-accounts yet. Click "Add Sub-Account" to create one.</Txt>
            ) : (
              <Box className="border border-border rounded-md">
                {items.map((sa, i) => (
                  <Box key={sa.id} className={`p-3 gap-2 ${i > 0 ? "border-t border-border" : ""}`}>
                    <Box>
                      <Box className="flex-row items-center gap-2">
                        <Txt numberOfLines={1} className="font-medium text-sm flex-shrink">
                          {sa.name}
                        </Txt>
                        {sa.isDisabled && (
                          <Badge variant="outline" className="self-auto" textClassName="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </Box>
                      <Txt numberOfLines={1} className="text-xs text-muted-foreground">
                        {sa.email}
                      </Txt>
                      <PermissionBadges permissions={sa.permissions} />
                    </Box>
                    <Box className="flex-row items-center gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 px-0" onPress={() => setEditing(sa)} accessibilityLabel="Manage member">
                        <Icon as={Pencil} className="w-3.5 h-3.5" />
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </TabsContent>

          <TabsContent value="invitations" className="mt-4">
            {loadingInvites ? (
              <SectionLoader className="py-8" size="w-5 h-5" />
            ) : invitations.length === 0 ? (
              <Txt className="text-sm text-muted-foreground py-6 text-center">No pending invitations.</Txt>
            ) : (
              <Box className="border border-border rounded-md">
                {invitations.map((inv, i) => (
                  <Box key={inv.id} className={`p-3 gap-2 ${i > 0 ? "border-t border-border" : ""}`}>
                    <Box>
                      <Txt numberOfLines={1} className="font-medium text-sm">
                        {inv.email}
                      </Txt>
                      <Txt className="text-xs text-muted-foreground">
                        Sent {formatDate(inv.createdAt)} · {inv.isExpired ? "Expired" : "Expires"} {formatDate(inv.expiresAt)}
                      </Txt>
                      <PermissionBadges permissions={inv.permissions} />
                    </Box>
                    <Box className="flex-row items-center gap-1.5">
                      <Badge variant={inv.isExpired ? "destructive" : "secondary"} className="self-auto gap-1 px-1.5 py-0" textClassName="text-[9px] leading-4">
                        <Icon as={inv.isExpired ? AlertTriangle : Clock} className="w-2.5 h-2.5" />
                        {inv.isExpired ? "Expired" : "Pending"}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-7 w-7 px-0" onPress={() => handleResend(inv)} disabled={resendingId === inv.id} accessibilityLabel="Resend invitation">
                        {resendingId === inv.id ? <Spinner className="w-3 h-3" /> : <Icon as={RefreshCw} className="w-3 h-3" />}
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <EditSubAccountPermissionsDialog
        subAccount={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
        onDelete={(sa) => {
          setEditing(null);
          setDeleting(sa);
        }}
      />

      <ConfirmDelete
        open={!!deleting}
        title="Delete sub-account?"
        description={`${deleting?.email ?? ""} will no longer be able to log in. This cannot be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </Card>
  );
};

export default SubAccountsSection;
