// Loads the generated Prisma client inside the runtime image to verify
// `prisma generate` produced output into the image's node_modules. If
// the output is missing (the multi-stage Docker bug where `pnpm deploy
// --prod` creates fresh node_modules that never re-ran postinstall), the
// import throws synchronously and this script exits 1 — failing CI
// before flyctl deploy is ever invoked.
import("../dist/db/prisma.js")
  .then(() => {
    console.log("[smoke] prisma client loaded");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[smoke] prisma client failed to load:", error);
    process.exit(1);
  });
