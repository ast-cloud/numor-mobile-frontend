import { Redirect } from "expo-router";
import { getToken } from "@/lib/api/authToken";
import { useAuth } from "@/hooks/use-auth";
import { FullScreenLoader } from "@/components/ui";
import { firstAllowedRoute } from "@/lib/permissions";

// The website's "/" is the marketing landing page. The app opens straight into the
// product: the dashboard when signed in, otherwise the login screen.
export default function Index() {
  const { user, isLoading, isSubAccount } = useAuth();
  if (!getToken()) return <Redirect href="/login" />;
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={(isSubAccount ? firstAllowedRoute(user.permissions) : "/sme/dashboard") as never} />;
}
