import { ShieldOff } from "lucide-react-native";
import { DashboardScreen } from "@/components/DashboardScreen";
import { Box, Card, Icon, Txt } from "@/components/ui";

const NoAccess = () => (
  <DashboardScreen>
    <Box className="min-h-[60%] flex-1 items-center justify-center">
      <Card className="p-8 max-w-md items-center gap-3">
        <Icon as={ShieldOff} className="w-10 h-10 text-muted-foreground" />
        <Txt className="font-display text-xl font-semibold text-center">No modules available</Txt>
        <Txt className="text-sm text-muted-foreground text-center">
          Your account doesn't have access to any module yet. Please contact your organization owner to grant permissions.
        </Txt>
      </Card>
    </Box>
  </DashboardScreen>
);

export default NoAccess;
