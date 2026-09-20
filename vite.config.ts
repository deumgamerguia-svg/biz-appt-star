// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const auditBundle = process.env['BUNDLE_AUDIT'] === "1";

const bundleAuditPlugin = {
  name: "agenda-bundle-audit",
  generateBundle(_options: unknown, bundle: Record<string, any>) {
    if (!auditBundle) return;

    const emittedChunks = Object.values(bundle).filter((entry: any) => entry?.type === "chunk") as any[];
    const emittedAssets = Object.values(bundle).filter((entry: any) => entry?.type === "asset") as any[];

    const chunks = emittedChunks
      .map((entry: any) => ({
        fileName: entry.fileName,
        bytes: Buffer.byteLength(entry.code ?? "", "utf8"),
        gzipBytes: gzipSync(entry.code ?? "").byteLength,
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
      console.log(
        `[BUNDLE_AUDIT] ${chunk.fileName} ${(chunk.bytes / 1024).toFixed(1)} KiB gzip ${(chunk.gzipBytes / 1024).toFixed(1)} KiB`,
      );
      for (const mod of chunk.modules) {
        console.log(
          `  ${(mod.renderedLength / 1024).toFixed(1)} KiB  ${mod.id.replace(process.cwd(), ".")}`,
        );
      }
    }

    const byFile = new Map(emittedChunks.map((chunk: any) => [chunk.fileName, chunk]));
    const closureFor = (root: any) => {
      const visited = new Set<string>();
      const visit = (fileName: string) => {
        if (visited.has(fileName)) return;
        visited.add(fileName);
        const chunk: any = byFile.get(fileName);
        for (const dep of chunk?.imports ?? []) visit(dep);
      };
      visit(root.fileName);
      const selected = [...visited].map((name) => byFile.get(name)).filter(Boolean);
      return {
        files: selected.length,
        bytes: selected.reduce((sum: number, chunk: any) => sum + Buffer.byteLength(chunk.code ?? "", "utf8"), 0),
        gzipBytes: selected.reduce((sum: number, chunk: any) => sum + gzipSync(chunk.code ?? "").byteLength, 0),
      };
    };

    const reportClosure = (label: string, predicate: (chunk: any) => boolean) => {
      const root = emittedChunks.find(predicate);
      if (!root) return;
      const result = closureFor(root);
      console.log(
        `[BUNDLE_AUDIT_SUMMARY] ${label}: ${result.files} JS files, ${(result.bytes / 1024).toFixed(1)} KiB raw, ${(result.gzipBytes / 1024).toFixed(1)} KiB gzip`,
      );
    };

    reportClosure("client-entry", (chunk: any) => chunk.isEntry);
    const hasModule = (chunk: any, suffix: string) =>
      String(chunk.facadeModuleId ?? "").endsWith(suffix) ||
      Object.keys(chunk.modules ?? {}).some((id) => id.endsWith(suffix));

    reportClosure("route-auth", (chunk: any) => hasModule(chunk, "/src/routes/auth.tsx"));
    reportClosure("route-panel", (chunk: any) => hasModule(chunk, "/src/routes/_authenticated/painel.index.tsx"));
    reportClosure("route-public-booking", (chunk: any) => hasModule(chunk, "/src/routes/agendar.$slug.tsx"));

    const cssAssets = emittedAssets.filter((asset: any) => String(asset.fileName).endsWith(".css"));
    const cssRaw = cssAssets.reduce((sum: number, asset: any) => {
      const source = typeof asset.source === "string" ? asset.source : Buffer.from(asset.source ?? []);
      return sum + Buffer.byteLength(source);
    }, 0);
    const cssGzip = cssAssets.reduce((sum: number, asset: any) => {
      const source = typeof asset.source === "string" ? asset.source : Buffer.from(asset.source ?? []);
      return sum + gzipSync(source).byteLength;
    }, 0);
    console.log(
      `[BUNDLE_AUDIT_SUMMARY] emitted-css: ${cssAssets.length} files, ${(cssRaw / 1024).toFixed(1)} KiB raw, ${(cssGzip / 1024).toFixed(1)} KiB gzip`,
    );
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
