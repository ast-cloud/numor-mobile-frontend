// Profile picture and company logo pickers.
// The website crops in its own dialog; in the app the system photo editor does the
// cropping, then the image is scaled to at most 1024px and uploaded to the same endpoints.
import { useState } from "react";
import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { Building2, Trash2, Upload } from "lucide-react-native";
import { Box, Button, Icon, Spinner, Txt } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { deleteOrganizationLogo, deleteProfilePhoto, uploadOrganizationLogo, uploadProfilePhoto } from "@/lib/api/user";
import { pickImage } from "@/lib/pickImage";

const MAX = 1024;

async function pickAndPrepare(square: boolean, format: "jpeg" | "png"): Promise<string | null> {
  const picked = await pickImage("library", { crop: true, aspect: square ? [1, 1] : undefined });
  if (!picked) return null;
  const result = await ImageManipulator.manipulateAsync(picked.uri, [{ resize: { width: MAX } }], {
    compress: 0.9,
    format: format === "png" ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

function UploadControls({
  hasImage,
  busy,
  removing,
  disabled,
  onPick,
  onRemove,
}: {
  hasImage: boolean;
  busy: boolean;
  removing: boolean;
  disabled?: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Box className="items-start gap-1">
      <Button variant="outline" size="sm" className="h-5 px-1.5" textClassName="text-[10px] leading-[14px]" onPress={onPick} disabled={disabled || busy}>
        {busy ? <Spinner className="w-2 h-2 mr-0.5" /> : <Icon as={Upload} className="w-2 h-2 mr-0.5" />}
        {busy ? "Uploading..." : hasImage ? "Change" : "Upload"}
      </Button>
      {hasImage && (
        <Button variant="ghost" size="sm" className="h-5 px-1.5" textClassName="text-[10px] leading-[14px]" color={colors.destructive} onPress={onRemove} disabled={disabled || removing}>
          {removing ? <Spinner className="w-2 h-2 mr-0.5" /> : <Icon as={Trash2} className="w-2 h-2 mr-0.5" />}
          {removing ? "Removing..." : "Remove"}
        </Button>
      )}
      <Txt className="text-[10px] leading-[15px] text-muted-foreground/70">JPG, PNG · Max 2MB</Txt>
    </Box>
  );
}

export function ProfilePictureUpload({
  currentImage,
  fallbackInitials,
  onImageChange,
  disabled = false,
}: {
  currentImage: string | null;
  fallbackInitials: string;
  onImageChange: (image: string | null) => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handlePick = async () => {
    try {
      const uri = await pickAndPrepare(true, "jpeg");
      if (!uri) return;
      setBusy(true);
      const photoUrl = await uploadProfilePhoto(uri);
      onImageChange(photoUrl);
      toast({ title: "Profile picture updated", description: "Your photo has been uploaded successfully." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the image. Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const success = await deleteProfilePhoto();
      if (success) {
        onImageChange(null);
        toast({ title: "Profile picture removed" });
      } else {
        toast({ title: "Failed to remove", description: "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to remove", description: "Could not delete the photo.", variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Box className="flex-row items-center gap-4 py-3">
      <Box className="w-20 h-20 rounded-full border-2 border-border overflow-hidden items-center justify-center bg-primary/10">
        {currentImage ? <Image source={{ uri: currentImage }} style={{ width: 80, height: 80 }} /> : <Txt className="text-lg font-semibold text-primary">{fallbackInitials}</Txt>}
      </Box>
      <UploadControls hasImage={!!currentImage} busy={busy} removing={isRemoving} disabled={disabled} onPick={handlePick} onRemove={handleRemove} />
    </Box>
  );
}

export function CompanyLogoUpload({ currentLogo, onLogoChange, disabled = false }: { currentLogo: string | null; onLogoChange: (image: string | null) => void; disabled?: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handlePick = async () => {
    try {
      const uri = await pickAndPrepare(false, "png");
      if (!uri) return;
      setBusy(true);
      const logoUrl = await uploadOrganizationLogo(uri);
      onLogoChange(logoUrl);
      toast({ title: "Logo updated", description: "Your company logo has been uploaded successfully." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the image. Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const success = await deleteOrganizationLogo();
      if (success) {
        onLogoChange(null);
        toast({ title: "Logo removed" });
      } else {
        toast({ title: "Failed to remove", description: "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to remove", description: "Could not delete the logo.", variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Box className="flex-row items-center gap-4 py-3">
      <Box className="w-24 h-24 border-2 border-dashed border-border rounded-lg items-center justify-center bg-muted/30 overflow-hidden">
        {currentLogo ? <Image source={{ uri: currentLogo }} style={{ width: 92, height: 92 }} resizeMode="contain" /> : <Icon as={Building2} className="w-10 h-10 text-muted-foreground/50" />}
      </Box>
      <UploadControls hasImage={!!currentLogo} busy={busy} removing={isRemoving} disabled={disabled} onPick={handlePick} onRemove={handleRemove} />
    </Box>
  );
}
