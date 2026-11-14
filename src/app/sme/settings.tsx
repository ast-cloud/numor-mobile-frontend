// Settings. State and save logic are the web frontend's SMESettings page, unchanged;
// the layout is rebuilt with native views in the web's single-column mobile arrangement.
import { useState, useEffect, useCallback } from "react";
import { Building2, FileText, LucideIcon, Mail, MapPin, Pencil, Phone, Save, Upload, User, X } from "lucide-react-native";
import { DashboardScreen } from "@/components/DashboardScreen";
import { CompanyLogoUpload, ProfilePictureUpload } from "@/components/settings/ImageUploads";
import { InvoiceCustomFieldsSection, InvoiceUnitsSection, PaymentAccountsSection } from "@/components/settings/InvoiceSections";
import { SectionHeader, SectionLoader } from "@/components/settings/shared";
import SubAccountsSection from "@/components/settings/SubAccountsSection";
import { Box, Button, Card, CardContent, Icon, Input, InputProps, Select, Spinner, Txt } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { fetchInvoiceUnits, InvoiceUnits } from "@/lib/api/invoiceUnits";
import { fetchPaymentAccounts, PaymentAccount } from "@/lib/api/paymentAccounts";
import { fetchCurrentOrganization, updateOrganization, fetchCurrentUser, updateUserProfile, fetchProfilePhoto, fetchOrganizationLogo } from "@/lib/api/user";
import { INDIAN_STATES } from "@/lib/constants";
import { COUNTRIES } from "@/lib/countries";

const SettingLabel = ({ icon, children }: { icon?: LucideIcon; children: React.ReactNode }) => (
  <Box className="flex-row items-center gap-2">
    {icon && <Icon as={icon} className="w-4 h-4 text-muted-foreground" />}
    <Txt className={`text-sm font-medium ${icon ? "leading-[14px]" : "leading-6"}`}>{children}</Txt>
  </Box>
);

/** Label + input while editing, label + read-only value otherwise. */
function SettingField({
  label,
  icon,
  value,
  editing,
  onChange,
  options,
  selectPlaceholder,
  muted,
  ...input
}: {
  label: string;
  icon?: LucideIcon;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
  options?: string[];
  selectPlaceholder?: string;
  muted?: boolean;
} & Omit<InputProps, "value" | "onChange" | "onChangeText">) {
  return (
    <Box className="gap-2">
      <SettingLabel icon={icon}>{label}</SettingLabel>
      {editing && onChange ? (
        options ? (
          <Select value={value} onValueChange={onChange} options={options} placeholder={selectPlaceholder} />
        ) : (
          <Input value={value} onChangeText={onChange} {...input} />
        )
      ) : (
        <Box className="py-2 px-3 bg-muted/50 rounded-md">
          <Txt className={`text-sm ${muted ? "text-muted-foreground" : ""}`}>{value || "Not set"}</Txt>
        </Box>
      )}
    </Box>
  );
}

function EditActions({ editing, canEdit, saving, onEdit, onCancel, onSave }: { editing: boolean; canEdit: boolean; saving: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void }) {
  if (!editing) {
    return canEdit ? (
      <Button variant="outline" size="sm" className="h-7 px-2.5" textClassName="text-xs" onPress={onEdit}>
        <Icon as={Pencil} className="w-3 h-3 mr-1.5" />
        Edit
      </Button>
    ) : null;
  }
  return (
    <Box className="flex-row gap-2">
      <Button variant="outline" size="sm" className="h-7 px-2.5" textClassName="text-xs" onPress={onCancel}>
        <Icon as={X} className="w-3 h-3 mr-1.5" />
        Cancel
      </Button>
      <Button size="sm" className="h-7 px-2.5" textClassName="text-xs" onPress={onSave} disabled={saving}>
        {saving ? <Spinner className="w-3 h-3 mr-1.5" /> : <Icon as={Save} className="w-3 h-3 mr-1.5" />}
        {saving ? "Saving..." : "Save"}
      </Button>
    </Box>
  );
}

const SMESettings = () => {
  const { user, isOrgOwner, can } = useAuth();
  const { toast } = useToast();
  const canReadSettings = can("organizationSettings", "read");
  const canWriteSettings = can("organizationSettings", "write");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [customFields, setCustomFields] = useState<{
    id: string;
    name: string;
    predefinedValues: string[];
  }[]>([]);
  const [invoiceUnits, setInvoiceUnits] = useState<InvoiceUnits>({
    systemUnits: [],
    customUnits: [],
    activeUnits: [],
  });
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoadingPaymentAccounts, setIsLoadingPaymentAccounts] = useState(true);
  const [originalCompanyData, setOriginalCompanyData] = useState({
    name: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    taxId: "",
    email: "",
    phone: "",
  });
  
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
  });
  const [originalProfileData, setOriginalProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await fetchCurrentUser();
        const data = {
          name: userData.name || user?.name || "",
          email: userData.email || user?.email || "",
          phone: userData.phone || "",
        };
        setProfileData(data);
        setOriginalProfileData(data);
      } catch {
        // fallback to auth context
      }
    };
    loadUser();
  }, [user]);

  useEffect(() => {
    fetchProfilePhoto().then((url) => {
      if (url) setProfilePicture(url);
    });
  }, []);

  const [companyData, setCompanyData] = useState({
    name: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    taxId: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const org = await fetchCurrentOrganization();
        const orgData = {
          name: org.name || "",
          streetAddress: org.streetAddress || "",
          city: org.city || "",
          state: org.state || "",
          zipCode: org.zipCode || "",
          country: org.country || "",
          taxId: org.taxId || "",
          email: org.email || "",
          phone: org.phone || "",
        };
        setCompanyData(orgData);
        setOriginalCompanyData(orgData);
        setCustomFields(
          Array.isArray(org.customFieldDefinitions)
            ? org.customFieldDefinitions.map((f: any) => ({
                id: f.id ?? "",
                name: f.name ?? "",
                predefinedValues: Array.isArray(f.predefinedValues)
                  ? f.predefinedValues
                  : [],
              }))
            : []
        );
        fetchOrganizationLogo().then((url) => {
          if (url) setCompanyLogo(url);
        });
      } catch {
        toast({
          title: "Failed to load organization",
          description: "Could not fetch your company details.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingOrg(false);
      }
    };
    loadOrganization();
  }, [toast]);

  const refetchCustomFields = useCallback(async () => {
    try {
      const org = await fetchCurrentOrganization();
      setCustomFields(
        Array.isArray(org.customFieldDefinitions)
          ? org.customFieldDefinitions.map((f: any) => ({
              id: f.id ?? "",
              name: f.name ?? "",
              predefinedValues: Array.isArray(f.predefinedValues)
                ? f.predefinedValues
                : [],
            }))
          : []
      );
    } catch {
      toast({
        title: "Failed to refresh custom fields",
        description: "Could not reload custom fields.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    const loadInvoiceUnits = async () => {
      try {
        const data = await fetchInvoiceUnits();
        setInvoiceUnits(data);
      } catch {
        toast({
          title: "Failed to load invoice units",
          description: "Could not fetch your invoice item units.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingUnits(false);
      }
    };
    loadInvoiceUnits();
  }, [toast]);

  const refetchInvoiceUnits = useCallback(async () => {
    try {
      const data = await fetchInvoiceUnits();
      setInvoiceUnits(data);
    } catch {
      toast({
        title: "Failed to refresh invoice units",
        description: "Could not reload invoice item units.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const refetchPaymentAccounts = useCallback(async () => {
    try {
      setPaymentAccounts(await fetchPaymentAccounts());
    } catch {
      toast({
        title: "Failed to refresh payment details",
        description: "Could not reload your saved payment details.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    const loadPaymentAccounts = async () => {
      try {
        setPaymentAccounts(await fetchPaymentAccounts());
      } catch {
        toast({
          title: "Failed to load payment details",
          description: "Could not fetch your saved payment details.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingPaymentAccounts(false);
      }
    };
    loadPaymentAccounts();
  }, [toast]);





  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateUserProfile({ name: profileData.name, phone: profileData.phone });
      setOriginalProfileData({ ...profileData });
      setIsEditingProfile(false);
      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
      });
    } catch {
      toast({
        title: "Failed to save",
        description: "Could not update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelProfile = () => {
    setProfileData({ ...originalProfileData });
    setIsEditingProfile(false);
  };

  const [isSavingCompany, setIsSavingCompany] = useState(false);

  const handleSaveCompany = async () => {
    setIsSavingCompany(true);
    try {
      await updateOrganization(companyData);
      setOriginalCompanyData({ ...companyData });
      setIsEditingCompany(false);
      toast({
        title: "Company details saved",
        description: "Your company information has been updated successfully.",
      });
    } catch {
      toast({
        title: "Failed to save",
        description: "Could not update company details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleCancelCompany = () => {
    setCompanyData({ ...originalCompanyData });
    setIsEditingCompany(false);
  };

  return (
    <DashboardScreen>
      <Box className="gap-8">
        <Box>
          <Txt className="text-3xl font-display font-bold tracking-tight">Settings</Txt>
          <Txt className="text-muted-foreground mt-2 text-lg">Manage your account and preferences.</Txt>
        </Box>

        {/* Profile Information */}
        <Card>
          <SectionHeader
            title="Profile Information"
            description="Your personal details"
            action={
              <EditActions editing={isEditingProfile} canEdit={canWriteSettings} saving={isSavingProfile} onEdit={() => setIsEditingProfile(true)} onCancel={handleCancelProfile} onSave={handleSaveProfile} />
            }
          />
          <CardContent className="gap-6">
            <Box className="gap-2">
              <SettingLabel icon={User}>Profile Picture</SettingLabel>
              <ProfilePictureUpload
                currentImage={profilePicture}
                fallbackInitials={
                  profileData.name
                    ? profileData.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "U"
                }
                onImageChange={setProfilePicture}
              />
            </Box>

            <Box className="gap-6">
              <SettingField label="Full Name" icon={User} value={profileData.name} editing={isEditingProfile} onChange={(v) => setProfileData({ ...profileData, name: v })} placeholder="Enter your name" />
              <SettingField label="Primary Email" icon={Mail} value={profileData.email} editing={false} muted />
              <SettingField label="Phone Number" icon={Phone} value={profileData.phone} editing={isEditingProfile} onChange={(v) => setProfileData({ ...profileData, phone: v })} placeholder="Enter your phone number" type="tel" />
            </Box>
          </CardContent>
        </Card>

        {/* Company Details */}
        {canReadSettings && (
          <Card>
            <SectionHeader
              title="Company Details"
              description="Your business information for invoices and documents"
              action={
                <EditActions editing={isEditingCompany} canEdit={canWriteSettings} saving={isSavingCompany} onEdit={() => setIsEditingCompany(true)} onCancel={handleCancelCompany} onSave={handleSaveCompany} />
              }
            />
            <CardContent className="gap-6">
              {isLoadingOrg ? (
                <SectionLoader />
              ) : (
                <>
                  <Box className="gap-3">
                    <SettingLabel icon={Upload}>Company Logo</SettingLabel>
                    <CompanyLogoUpload currentLogo={companyLogo} onLogoChange={setCompanyLogo} />
                  </Box>

                  <Box className="gap-6">
                    <SettingField label="Company Name" icon={Building2} value={companyData.name} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, name: v })} placeholder="Enter company name" />
                    <SettingField label="Tax ID / GST Number" icon={FileText} value={companyData.taxId} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, taxId: v })} placeholder="Enter tax ID" />
                    <SettingField label="Company Email" icon={Mail} value={companyData.email} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, email: v })} placeholder="Enter company email" type="email" />
                    <SettingField label="Phone Number" icon={Phone} value={companyData.phone} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, phone: v })} placeholder="Enter phone number" type="tel" />
                  </Box>

                  <Box className="gap-4 p-4 border border-border rounded-lg bg-muted/20">
                    <Box className="flex-row items-center gap-2">
                      <Icon as={MapPin} className="w-4 h-4 text-muted-foreground" />
                      <Txt className="text-sm font-medium text-muted-foreground">Business Address</Txt>
                    </Box>
                    <Box className="gap-4">
                      <SettingField label="Street Address" value={companyData.streetAddress} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, streetAddress: v })} placeholder="Enter street address" />
                      <SettingField label="City" value={companyData.city} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, city: v })} placeholder="Enter city" />
                      <SettingField
                        label="State / Province"
                        value={companyData.state}
                        editing={isEditingCompany}
                        onChange={(v) => setCompanyData({ ...companyData, state: v })}
                        placeholder="Enter state"
                        options={companyData.country === "India" ? INDIAN_STATES : undefined}
                        selectPlaceholder="Select state"
                      />
                      <SettingField label="ZIP / Postal Code" value={companyData.zipCode} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, zipCode: v })} placeholder="Enter ZIP code" />
                      <SettingField label="Country" value={companyData.country} editing={isEditingCompany} onChange={(v) => setCompanyData({ ...companyData, country: v })} options={COUNTRIES} selectPlaceholder="Select country" />
                    </Box>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {canReadSettings && <InvoiceCustomFieldsSection fields={customFields} onRefetch={refetchCustomFields} isLoading={isLoadingOrg} />}
        {canReadSettings && <InvoiceUnitsSection units={invoiceUnits} onRefetch={refetchInvoiceUnits} isLoading={isLoadingUnits} />}
        {canReadSettings && <PaymentAccountsSection accounts={paymentAccounts} onRefetch={refetchPaymentAccounts} isLoading={isLoadingPaymentAccounts} />}

        {/* Team & Permissions (org owners only) */}
        {isOrgOwner && <SubAccountsSection />}
      </Box>
    </DashboardScreen>
  );
};

export default SMESettings;
