import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const mode = process.env.PROFILE_MODE ?? "prod";
const baseURL = process.env.PROFILE_BASE_URL ?? "http://127.0.0.1:4173";
const projectRef = "qagotnmdqjoodoudcikd";
const authStorageKey = `sb-${projectRef}-auth-token`;
const userId = "10000000-0000-4000-8000-000000000001";
const businessId = "20000000-0000-4000-8000-000000000001";

const uuid = (prefix, n) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`.slice(-36);

const pad = (value) => String(value).padStart(2, "0");
const dateInSaoPaulo = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};
const today = dateInSaoPaulo();

const services = Array.from({ length: 20 }, (_, index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  business_id: businessId,
  name: `Serviço ${index + 1}`,
  active: true,
  duration_minutes: 30 + (index % 3) * 15,
  price_cents: 5000 + index * 350,
  deposit_cents: 1000,
  description: null,
  is_combo: false,
  show_price: true,
  show_duration: true,
  show_service: true,
  image_path: null,
  created_at: new Date().toISOString(),
}));

const professionals = Array.from({ length: 10 }, (_, index) => ({
  id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  business_id: businessId,
  name: `Profissional ${index + 1}`,
  role: "Especialista",
  phone: `1199999${String(index).padStart(4, "0")}`,
  email: null,
  active: true,
  working_days: [0, 1, 2, 3, 4, 5, 6],
  permissions: {},
  user_id: null,
  created_at: new Date().toISOString(),
}));

const customers = Array.from({ length: 1200 }, (_, index) => ({
  id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  business_id: businessId,
  name: `Cliente ${String(index + 1).padStart(4, "0")}`,
  phone: `1198${String(index).padStart(7, "0")}`.slice(0, 11),
  email: `cliente${index + 1}@example.com`,
  notes: index % 10 === 0 ? "Cliente recorrente" : null,
  created_at: new Date().toISOString(),
}));

const isoAt = (date, minutes) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(`${date}T${pad(hour)}:${pad(minute)}:00-03:00`).toISOString();
};

const agendaAppointments = Array.from({ length: 8 }, (_, index) => {
  const start = 8 * 60 + (index * 2 + 1) * 30;
  const service = services[index % services.length];
  const professional = professionals[index % professionals.length];
  return {
    id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    business_id: businessId,
    service_id: service.id,
    professional_id: professional.id,
    customer_id: customers[index].id,
    customer_name: customers[index].name,
    customer_phone: customers[index].phone,
    starts_at: isoAt(today, start),
    ends_at: isoAt(today, start + service.duration_minutes),
    status: index % 5 === 0 ? "confirmado" : "agendado",
    notes: null,
    deposit_cents: 1000,
    deposit_paid_at: index % 2 ? isoAt(today, 7 * 60) : null,
    services: { name: service.name, price_cents: service.price_cents },
    professionals: { name: professional.name },
  };
});

const reportAppointments = Array.from({ length: 2500 }, (_, index) => {
  const daysAgo = index % 90;
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const service = services[index % services.length];
  const professional = professionals[index % professionals.length];
  return {
    id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    starts_at: isoAt(dateKey, 8 * 60 + (index % 20) * 30),
    status: index % 11 === 0 ? "cancelado" : index % 3 === 0 ? "concluido" : "confirmado",
    service_id: service.id,
    professional_id: professional.id,
    customer_name: customers[index % customers.length].name,
    deposit_cents: 1000,
    deposit_paid_at: index % 3 ? isoAt(dateKey, 7 * 60) : null,
  };
});

const payAppointments = Array.from({ length: 1000 }, (_, index) => {
  const source = reportAppointments[index];
  return {
    id: source.id,
    customer_name: source.customer_name,
    starts_at: source.starts_at,
    deposit_cents: 1000 + (index % 5) * 500,
    deposit_paid_at: index % 3 === 0 ? null : source.starts_at,
    status: index % 17 === 0 ? "cancelado" : "agendado",
  };
});

const visits = customers.map((customer, index) => ({
  customer_id: customer.id,
  starts_at: reportAppointments[index % reportAppointments.length].starts_at,
}));

const fakeUser = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "runtime-profile@agenda.local",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Runtime Profile" },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const b64url = (value) =>
  Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const fakeJwt = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
  aud: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 86400,
  sub: userId,
  email: fakeUser.email,
  role: "authenticated",
})}.runtime-profile`;
const fakeSession = {
  access_token: fakeJwt,
  refresh_token: "runtime-profile-refresh",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  token_type: "bearer",
  user: fakeUser,
};

function responseForTable(table, select) {
  switch (table) {
    case "user_roles":
      return [{ role: "owner" }];
    case "businesses":
      return [{
        id: businessId,
        name: "Runtime Performance Studio",
        slug: "runtime-performance-studio",
        category: "barbearia",
        phone: "11999999999",
        address: null,
        status: "ativo",
        monthly_fee_cents: 10000,
        whatsapp_status: "desconectado",
      }];
    case "profiles":
      return [{ id: userId, full_name: "Runtime Profile", email: fakeUser.email }];
    case "subscription_payments":
      return [];
    case "services":
      return services;
    case "professionals":
      return professionals;
    case "service_professionals":
      return [];
    case "business_hours":
      return [{ starts_at: "08:00:00", ends_at: "20:00:00" }];
    case "time_blocks":
      return [];
    case "customers":
      return customers;
    case "appointments":
      if (select.includes("customer_id,starts_at")) return visits;
      if (
        select.includes("service_id") &&
        select.includes("professional_id") &&
        select.includes("deposit_cents")
      ) return reportAppointments;
      if (
        select.includes("deposit_cents") &&
        select.includes("deposit_paid_at") &&
        !select.includes("service_id")
      ) return payAppointments;
      if (select.includes("services(") || select.startsWith("*")) return agendaAppointments;
      return agendaAppointments;
    default:
      return [];
  }
}

async function installMocks(context) {
  await context.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
      window.__AA_LONG_TASKS__ = [];
      window.__AA_LONG_FRAMES__ = [];
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__AA_LONG_TASKS__.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              attribution: Array.from(entry.attribution ?? []).map((item) => ({
                name: item.name,
                entryType: item.entryType,
                containerType: item.containerType,
                containerName: item.containerName,
                containerId: item.containerId,
                containerSrc: item.containerSrc,
              })),
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {}
      try {
        const frameObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__AA_LONG_FRAMES__.push({
              startTime: entry.startTime,
              duration: entry.duration,
              blockingDuration: entry.blockingDuration ?? 0,
              renderStart: entry.renderStart ?? 0,
              styleAndLayoutStart: entry.styleAndLayoutStart ?? 0,
              scripts: Array.from(entry.scripts ?? []).map((script) => ({
                duration: script.duration ?? 0,
                pauseDuration: script.pauseDuration ?? 0,
                forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration ?? 0,
                sourceURL: script.sourceURL ?? "",
                sourceFunctionName: script.sourceFunctionName ?? "",
                invoker: script.invoker ?? "",
              })),
            });
          }
        });
        frameObserver.observe({ type: "long-animation-frame", buffered: true });
      } catch {}
    },
    { key: authStorageKey, session: fakeSession },
  );

  await context.route(`https://qagotnmdqjoodoudcikd.supabase.co/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS,HEAD",
        },
      });
      return;
    }

    if (url.pathname.includes("/auth/v1/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeUser) });
      return;
    }

    if (url.pathname.includes("/auth/v1/token")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession) });
      return;
    }

    const match = url.pathname.match(/\/rest\/v1\/([^/]+)/);
    if (!match) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }

    const table = match[1];
    const select = url.searchParams.get("select") ?? "";
    const data = responseForTable(table, select);
    const accept = request.headers()["accept"] ?? "";
    const wantsObject = accept.includes("application/vnd.pgrst.object+json");
    const body = wantsObject ? JSON.stringify(data[0] ?? null) : JSON.stringify(data);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "content-range": data.length ? `0-${data.length - 1}/${data.length}` : "*/0",
        "range-unit": "items",
      },
      body: request.method() === "HEAD" ? "" : body,
    });
  });
}

async function settle(page, ms = 120) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))),
      ),
  );
  if (ms) await page.waitForTimeout(ms);
}

async function readLongTasks(page, startTime) {
  return page.evaluate((start) => {
    const entries = (window.__AA_LONG_TASKS__ ?? []).filter((entry) => entry.startTime >= start);
    return {
      count: entries.length,
      maxMs: entries.length ? Math.max(...entries.map((entry) => entry.duration)) : 0,
      totalMs: entries.reduce((sum, entry) => sum + entry.duration, 0),
      entries: entries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8)
        .map((entry) => ({
          startTime: Number(entry.startTime.toFixed(2)),
          duration: Number(entry.duration.toFixed(2)),
          attribution: entry.attribution,
        })),
    };
  }, startTime);
}

async function readLongFrames(page, startTime) {
  return page.evaluate((start) => {
    const entries = (window.__AA_LONG_FRAMES__ ?? []).filter((entry) => entry.startTime >= start);
    const scripts = new Map();
    for (const entry of entries) {
      for (const script of entry.scripts ?? []) {
        const key = `${script.sourceFunctionName || "(anonymous)"} @ ${script.sourceURL || "(inline)"}`;
        const current = scripts.get(key) ?? {
          frame: key,
          duration: 0,
          forcedStyleAndLayoutDuration: 0,
          invokers: new Set(),
        };
        current.duration += script.duration ?? 0;
        current.forcedStyleAndLayoutDuration += script.forcedStyleAndLayoutDuration ?? 0;
        if (script.invoker) current.invokers.add(script.invoker);
        scripts.set(key, current);
      }
    }
    return {
      count: entries.length,
      maxMs: entries.length ? Math.max(...entries.map((entry) => entry.duration)) : 0,
      maxBlockingMs: entries.length
        ? Math.max(...entries.map((entry) => entry.blockingDuration ?? 0))
        : 0,
      topScripts: [...scripts.values()]
        .map((item) => ({
          frame: item.frame,
          duration: Number(item.duration.toFixed(2)),
          forcedStyleAndLayoutDuration: Number(item.forcedStyleAndLayoutDuration.toFixed(2)),
          invokers: [...item.invokers].slice(0, 3),
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
      entries: entries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 6)
        .map((entry) => ({
          startTime: Number(entry.startTime.toFixed(2)),
          duration: Number(entry.duration.toFixed(2)),
          blockingDuration: Number((entry.blockingDuration ?? 0).toFixed(2)),
          scriptCount: entry.scripts?.length ?? 0,
        })),
    };
  }, startTime);
}

async function measureProd(page, cdp, label, action) {
  console.log(`[RUNTIME_PROFILE_STEP] start ${label}`);
  const startTime = await page.evaluate(() => performance.now());
  const metricsBefore = await cdp.send("Performance.getMetrics");
  const before = Object.fromEntries(metricsBefore.metrics.map((metric) => [metric.name, metric.value]));
  const wallStart = performance.now();
  await action();
  await settle(page);
  const wallMs = performance.now() - wallStart;
  const metricsAfter = await cdp.send("Performance.getMetrics");
  const after = Object.fromEntries(metricsAfter.metrics.map((metric) => [metric.name, metric.value]));
  const longTasks = await readLongTasks(page, startTime);
  const longFrames = await readLongFrames(page, startTime);
  const domNodes = await page.evaluate(() => document.querySelectorAll("*").length);
  const result = {
    label,
    wallMs: Number(wallMs.toFixed(2)),
    domNodes,
    longTasks,
    longFrames,
    scriptDurationMs: Number((((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1000).toFixed(2)),
    taskDurationMs: Number((((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000).toFixed(2)),
    layoutDurationMs: Number((((after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0)) * 1000).toFixed(2)),
    recalcStyleDurationMs: Number((((after.RecalcStyleDuration ?? 0) - (before.RecalcStyleDuration ?? 0)) * 1000).toFixed(2)),
  };
  console.log(`[RUNTIME_PROFILE_STEP] done ${label} ${result.wallMs}ms`);
  return result;
}

async function takeReact(page, label) {
  console.log(`[RUNTIME_PROFILE_STEP] react ${label}`);
  await settle(page, 80);
  const profile = await page.evaluate(() => structuredClone(window.__AA_REACT_PROFILE__ ?? {}));
  const domNodes = await page.evaluate(() => document.querySelectorAll("*").length);
  return { label, domNodes, profile };
}

async function resetReact(page) {
  await page.evaluate(() => {
    window.__AA_REACT_PROFILE__ = {};
  });
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installMocks(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  const results = [];

  const waitAgenda = async () => {
    await page.locator('input[type="date"]').waitFor({ state: "attached", timeout: 15000 });
    await page.getByText("Disponível", { exact: true }).first().waitFor({ state: "attached", timeout: 15000 });
    await settle(page, 180);
  };
  const waitClientes = async () => {
    await page.getByPlaceholder("Buscar cliente pelo nome").waitFor({ state: "attached", timeout: 15000 });
    await page.getByText("Total de clientes:", { exact: false }).waitFor({ state: "visible", timeout: 15000 });
  };
  const waitAsPay = async () => {
    await page.getByText("Sua carteira", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  };
  const waitRelatorio = async () => {
    await page.getByText("Atendimentos por dia", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  };

  if (mode === "prod") {
    results.push(
      await measureProd(page, cdp, "dashboard-open", async () => {
        await page.goto(`${baseURL}/painel`, { waitUntil: "domcontentloaded" });
        await waitAgenda();
      }),
    );

    results.push(
      await measureProd(page, cdp, "agenda-modal-open", async () => {
        await page.locator('button').filter({ hasText: "Disponível" }).first().evaluate((element) => element.click());
        await page.getByRole("heading", { name: "Agendar horário" }).waitFor();
      }),
    );
    await page.getByRole("button", { name: "Cancelar" }).click();
    await settle(page);

    results.push(
      await measureProd(page, cdp, "agenda-date-change", async () => {
        await page.getByRole("button", { name: "Próximo dia" }).click();
        await page.waitForTimeout(80);
      }),
    );

    results.push(
      await measureProd(page, cdp, "menu-clientes", async () => {
        await page.locator('aside a[href="/painel/clientes"]').click();
        await waitClientes();
      }),
    );

    results.push(
      await measureProd(page, cdp, "clientes-search", async () => {
        await page.getByPlaceholder("Buscar cliente pelo nome").fill("Cliente 1199");
        await page.getByText("Cliente 1199", { exact: true }).waitFor();
      }),
    );

    results.push(
      await measureProd(page, cdp, "menu-agenda-return", async () => {
        await page.locator('aside a[href="/painel"]').first().click();
        await waitAgenda();
      }),
    );

    results.push(
      await measureProd(page, cdp, "menu-financeiro-as-pay", async () => {
        await page.locator('aside a[href="/painel/as-pay"]').click();
        await waitAsPay();
      }),
    );

    results.push(
      await measureProd(page, cdp, "menu-relatorio", async () => {
        await page.locator('aside a[href="/painel/relatorio"]').click();
        await waitRelatorio();
      }),
    );
  } else {
    await page.goto(`${baseURL}/painel`, { waitUntil: "domcontentloaded" });
    await waitAgenda();
    results.push(await takeReact(page, "dashboard-open"));

    await resetReact(page);
    await page.locator('button').filter({ hasText: "Disponível" }).first().evaluate((element) => element.click());
    await page.getByRole("heading", { name: "Agendar horário" }).waitFor();
    results.push(await takeReact(page, "agenda-modal-open"));
    await page.getByRole("button", { name: "Cancelar" }).click();
    await settle(page);

    await resetReact(page);
    await page.getByRole("button", { name: "Próximo dia" }).click();
    await page.waitForTimeout(80);
    results.push(await takeReact(page, "agenda-date-change"));

    await resetReact(page);
    await page.locator('aside a[href="/painel/clientes"]').click();
    await waitClientes();
    results.push(await takeReact(page, "menu-clientes"));

    await resetReact(page);
    await page.getByPlaceholder("Buscar cliente pelo nome").fill("Cliente 1199");
    await page.getByText("Cliente 1199", { exact: true }).waitFor();
    results.push(await takeReact(page, "clientes-search"));

    await resetReact(page);
    await page.locator('aside a[href="/painel"]').first().click();
    await waitAgenda();
    results.push(await takeReact(page, "menu-agenda-return"));

    await resetReact(page);
    await page.locator('aside a[href="/painel/as-pay"]').click();
    await waitAsPay();
    results.push(await takeReact(page, "menu-financeiro-as-pay"));

    await resetReact(page);
    await page.locator('aside a[href="/painel/relatorio"]').click();
    await waitRelatorio();
    results.push(await takeReact(page, "menu-relatorio"));
  }

  await browser.close();
  await mkdir("runtime-profile-results", { recursive: true });
  const output = { mode, generatedAt: new Date().toISOString(), results };
  await writeFile(`runtime-profile-results/${mode}.json`, JSON.stringify(output, null, 2));
  console.log(`[RUNTIME_PROFILE_MODE] ${mode}`);
  for (const result of results) {
    console.log(`[RUNTIME_PROFILE] ${JSON.stringify(result)}`);
  }
}

run().catch((error) => {
  console.error("[RUNTIME_PROFILE_ERROR]", error);
  process.exit(1);
});
