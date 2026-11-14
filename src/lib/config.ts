// Centralized configuration from environment variables
export const config = {
  backendHost: process.env.EXPO_PUBLIC_BACKEND_HOST || "https://backend.numor.app",
} as const;
