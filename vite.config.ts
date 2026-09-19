// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const auditBundle = process.env.BUNDLE_AUDIT === "1";

const bundleAuditPlugin = {
  name: "agenda-bundle-audit",
  generateBundle(_options: unknown, bundle: Record<string, any>) {
    if (!auditBundle) return;

    const chunks = Object.values(bundle)
      .filter((entry: any) => entry?.type === "chunk")
      .map((entry: any) => ({
        fileName: entry.fileName,
        bytes: Buffer.byteLength(entry.code ?? "", "utf8"),
        modules: Object.entries(entry.modules ?? {})
          .map(([id, info]: [string, any]) => ({
            id,
            renderedLength: Number(info?.renderedLength ?? 0),
          }))
          .sort((a, b) => b.renderedLength - a.renderedLength)
          .slice(0, 15),
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 12);

    console.log("\n[BUNDLE_AUDIT] Largest chunks and module contributors");
    for (const chunk of chunks) {
      console.log(`[BUNDLE_AUDIT] ${chunk.fileName} ${(chunk.bytes / 1024).toFixed(1)} KiB`);
      for (const mod of chunk.modules) {
        console.log(
          `  ${(mod.renderedLength / 1024).toFixed(1)} KiB  ${mod.id.replace(process.cwd(), ".")}`,
        );
      }
    }
  },
};

export default defineConfig({
  vite: {
    plugins: auditBundle ? [bundleAuditPlugin] : [],
    build: {
      manifest: auditBundle,
    },
    resolve: {
      alias: {
        // Compatibilidade temporária com imports existentes. O arquivo antigo
        // terminava em .client.ts e era bloqueado no build SSR; a resolução
        // nativa do Vite acontece antes da proteção do TanStack.
        "@/lib/panel1-config.client": fileURLToPath(
          new URL("./src/lib/panel1-config.storage.ts", import.meta.url),
        ),
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
