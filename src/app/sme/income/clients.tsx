import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { ArrowLeft, ChevronDown, Mail, MapPin, Pencil, Phone, Plus, Receipt, Save, Trash2, User, Users, X } from "lucide-react-native";
import { DashboardScreen } from "@/components/DashboardScreen";
import { EditableField } from "@/components/EditableField";
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
  Press,
  Spinner,
  Txt,
} from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { createClient, deleteClient, fetchClients, updateClient, type ClientData } from "@/lib/api/clients";
import { INDIAN_STATES } from "@/lib/constants";
import { SELLER_COUNTRY_OPTIONS } from "@/lib/countries";
import { getTaxLabel, getTaxSystem } from "@/lib/taxSystem";

export interface Client {
  id: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  email: string;
  phone: string;
  taxId: string;
}

const mapClientData = (c: ClientData): Client => ({
  id: c.id,
  name: c.name || "",
  streetAddress: c.streetAddress || "",
  city: c.city || "",
  state: c.state || "",
  zipCode: c.zipCode || "",
  country: c.country || "",
  email: c.email || "",
  phone: c.phone || "",
  taxId: c.taxId || "",
});

interface ClientCardProps {
  client: Client;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onUpdate: (field: keyof Client, value: string) => void;
  isNew?: boolean;
  readOnly?: boolean;
}

const ClientCard = ({ client, isEditing, onEdit, onSave, onCancel, onDelete, onUpdate, isNew, readOnly }: ClientCardProps) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(isEditing);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (isEditing && !isOpen) setIsOpen(true);

  const incomplete =
    !client.name.trim() || !client.email.trim() || !client.streetAddress.trim() || !client.city.trim() || !client.state.trim() || !client.zipCode.trim() || !client.country.trim();

  return (
    <Box className="border border-border rounded-lg overflow-hidden">
      {/* Collapsed header - always visible */}
      <Box className="flex-row items-center justify-between p-4">
        <Press className="flex-1 flex-row items-center gap-3" activeOpacity={1} onPress={() => setIsOpen(!isOpen)}>
          <Box style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}>
            <Icon as={ChevronDown} className="w-4 h-4 text-muted-foreground" />
          </Box>
          <Box className="flex-1">
            <Txt numberOfLines={1} className="font-display font-medium">
              {client.name || "New Client"}
            </Txt>
            <Txt numberOfLines={1} className="text-sm text-muted-foreground">
              {client.email || "No email"}
            </Txt>
          </Box>
        </Press>
        <Box className="flex-row gap-2 ml-3">
          {!readOnly &&
            (isEditing ? (
              <>
                <Button size="sm" className="h-7" textClassName="text-xs" onPress={onSave} disabled={incomplete}>
                  <Icon as={Save} className="w-3 h-3 mr-1.5" />
                  Save
                </Button>
                <Button variant="outline" size="sm" className="h-7" textClassName="text-xs" onPress={onCancel}>
                  <Icon as={X} className="w-3 h-3 mr-1.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="icon" className="h-7 w-7" onPress={onEdit} accessibilityLabel="Edit client">
                <Icon as={Pencil} className="w-3 h-3" />
              </Button>
            ))}
          {!readOnly && !isNew && (
            <Button variant="ghost" size="sm" className="h-7" color={colors.destructive} onPress={() => setConfirmDelete(true)} accessibilityLabel="Delete client">
              <Icon as={Trash2} className="w-3 h-3" />
            </Button>
          )}
        </Box>
      </Box>

      {/* Expandable content */}
      {isOpen && (
        <Box className="px-4 pb-4 border-t border-border">
          <Box className="gap-4 pt-4">
            <EditableField label="Name *" icon={User} value={client.name} editing={isEditing} onChange={(v) => onUpdate("name", v)} placeholder="Client name" />
            <EditableField label="Email *" icon={Mail} value={client.email} editing={isEditing} onChange={(v) => onUpdate("email", v)} placeholder="Client email" type="email" />
            <EditableField label="Phone" icon={Phone} value={client.phone} editing={isEditing} onChange={(v) => onUpdate("phone", v)} placeholder="Client phone" type="tel" />

            <Box className="gap-4 p-4 border border-border rounded-lg bg-muted/20">
              <Box className="flex-row items-center gap-2">
                <Icon as={MapPin} className="w-4 h-4 text-muted-foreground" />
                <Txt className="text-sm font-medium text-muted-foreground">Client Address</Txt>
              </Box>
              <Box className="gap-4">
                <EditableField label="Street Address *" value={client.streetAddress} editing={isEditing} onChange={(v) => onUpdate("streetAddress", v)} placeholder="e.g. 123 Business Street, Suite 100" />
                <EditableField label="City *" value={client.city} editing={isEditing} onChange={(v) => onUpdate("city", v)} placeholder="e.g. Dubai" />
                <EditableField
                  label="State / Province *"
                  value={client.state}
                  editing={isEditing}
                  onChange={(v) => onUpdate("state", v)}
                  placeholder="e.g. Dubai"
                  options={client.country === "India" ? INDIAN_STATES : undefined}
                  selectPlaceholder="Select state"
                />
                <EditableField label="ZIP / Postal Code *" value={client.zipCode} editing={isEditing} onChange={(v) => onUpdate("zipCode", v)} placeholder="e.g. 00000" />
                <EditableField label="Country *" value={client.country} editing={isEditing} onChange={(v) => onUpdate("country", v)} options={SELLER_COUNTRY_OPTIONS} selectPlaceholder="Select country" />
              </Box>
              <EditableField label={getTaxLabel(client.country)} icon={Receipt} value={client.taxId} editing={isEditing} onChange={(v) => onUpdate("taxId", v)} placeholder="Enter tax identification number" />
            </Box>
          </Box>
        </Box>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete client</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete {client.name || "this client"}? This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={() => setConfirmDelete(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onPress={() => {
              setConfirmDelete(false);
              onDelete();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </Box>
  );
};

const Clients = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { can } = useAuth();
  const canWrite = can("income", "write");
  const [clients, setClients] = useState<Client[]>([]);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const backupRef = useRef<Client | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await fetchClients();
        setClients(data.map(mapClientData));
      } catch {
        toast({ title: "Error loading clients", description: "Could not fetch clients from the server.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadClients();
  }, [toast]);

  const handleAddClient = () => {
    const newClient: Client = { id: randomUUID(), name: "", streetAddress: "", city: "", state: "", zipCode: "", country: "", email: "", phone: "", taxId: "" };
    setClients([newClient, ...clients]);
    backupRef.current = { ...newClient };
    setEditingClientId(newClient.id);
    setNewClientId(newClient.id);
  };

  const handleEditClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (client) backupRef.current = { ...client };
    setEditingClientId(id);
  };

  const handleUpdateClient = (id: string, field: keyof Client, value: string) => setClients(clients.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  const handleSaveClient = async (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;

    const requiredFields: { key: keyof Client; label: string }[] = [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "streetAddress", label: "Street Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "zipCode", label: "Zip Code" },
      { key: "country", label: "Country" },
    ];
    const missing = requiredFields.find((f) => !client[f.key].trim());
    if (missing) {
      toast({ title: `${missing.label} required`, description: `Please enter ${missing.label.toLowerCase()}.`, variant: "destructive" });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(client.email.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    const isNewClient = backupRef.current && !backupRef.current.name.trim();
    const payload = {
      email: client.email || null,
      phone: client.phone || null,
      streetAddress: client.streetAddress || null,
      city: client.city || null,
      state: client.state || null,
      zipCode: client.zipCode || null,
      country: client.country || null,
      taxId: client.taxId || null,
      taxSystem: getTaxSystem(client.country) || null,
    };
    try {
      if (isNewClient) {
        const created = await createClient({ name: client.name, ...payload });
        setClients((prev) => prev.map((c) => (c.id === id ? mapClientData(created) : c)));
        toast({ title: "Client created", description: "New client has been added." });
      } else {
        await updateClient(id, { name: client.name || null, ...payload } as never);
        toast({ title: "Client saved", description: "Client information has been updated." });
      }
      setEditingClientId(null);
      setNewClientId(null);
      backupRef.current = null;
    } catch {
      toast({ title: "Save failed", description: isNewClient ? "Could not create client." : "Could not update client. Please try again.", variant: "destructive" });
    }
  };

  const handleCancelEdit = (id: string) => {
    if (backupRef.current) {
      if (!backupRef.current.name.trim()) setClients(clients.filter((c) => c.id !== id));
      else setClients(clients.map((c) => (c.id === id ? { ...backupRef.current! } : c)));
    }
    backupRef.current = null;
    setEditingClientId(null);
    setNewClientId(null);
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await deleteClient(id);
      setClients(clients.filter((c) => c.id !== id));
      toast({ title: "Client removed", description: "Client has been removed from your list." });
    } catch {
      toast({ title: "Delete failed", description: "Could not delete client. Please try again.", variant: "destructive" });
    }
  };

  return (
    <DashboardScreen module="income">
      <Box className="gap-6">
        <Button variant="ghost" size="sm" onPress={() => router.replace("/sme/income" as never)} className="mb-2 self-start">
          <Icon as={ArrowLeft} className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Box className="flex-row items-center justify-between">
          <Box className="flex-1">
            <Txt className="text-3xl font-display font-bold">Clients</Txt>
            <Txt className="text-muted-foreground mt-1">Manage your client information for invoices.</Txt>
          </Box>
          {canWrite && (
            <Button variant="outline" size="sm" onPress={handleAddClient}>
              <Icon as={Plus} className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          )}
        </Box>

        <Box className="bg-card rounded-lg border border-border p-6">
          {isLoading ? (
            <Box className="items-center py-12">
              <Box className="mb-3 opacity-50">
                <Spinner className="w-8 h-8 text-muted-foreground" />
              </Box>
              <Txt className="text-muted-foreground">Loading clients...</Txt>
            </Box>
          ) : clients.length === 0 ? (
            <Box className="items-center py-12">
              <Box className="mb-3 opacity-50">
                <Icon as={Users} className="w-12 h-12 text-muted-foreground" />
              </Box>
              <Txt className="text-muted-foreground">No clients added yet</Txt>
              <Txt className="text-sm text-muted-foreground">Click "Add Client" to get started</Txt>
            </Box>
          ) : (
            <Box className="gap-4">
              {clients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  isEditing={editingClientId === client.id}
                  onEdit={() => handleEditClient(client.id)}
                  onSave={() => handleSaveClient(client.id)}
                  onCancel={() => handleCancelEdit(client.id)}
                  onDelete={() => handleDeleteClient(client.id)}
                  onUpdate={(field, value) => handleUpdateClient(client.id, field, value)}
                  isNew={newClientId === client.id}
                  readOnly={!canWrite}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </DashboardScreen>
  );
};

export default Clients;
