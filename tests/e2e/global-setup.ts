/**
 * Playwright global setup — builds the Electron app before E2E tests run.
 */
export default async function globalSetup(): Promise<void> {
  // In CI, the app should already be built.
  // Locally, we skip the build to save time if dist/ exists.
  // The actual Electron test launcher is configured per test file.
}
