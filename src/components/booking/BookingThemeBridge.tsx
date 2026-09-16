import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Appearance = {
  page_text?: string;
  service_background?: string;
  service_text?: string;
  service_border?: string;
  service_hover_background?: string;
  service_hover_text?: string;
  service_hover_border?: string;
  modal_background?: string;
  modal_text?: string;
  modal_active_background?: string;
  modal_active_text?: string;
  modal_border?: string;
  agenda_background?: string;
  agenda_text?: string;
  agenda_border?: string;
};

type Preferences = {
  greeting?: string;
};

const colorPattern = /^#[0-9a-fA-F]{6}$/;
const safeColor = (value: unknown, fallback: string) =>
  typeof value === "string" && colorPattern.test(value) ? value : fallback;

export function BookingThemeBridge() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!pathname.startsWith("/agendar/")) return;
    const slug = decodeURIComponent(pathname.slice("/agendar/".length).split("/")[0] ?? "");
    if (!slug) return;

    let cancelled = false;
    let greetingElement: HTMLParagraphElement | null = null;
    const root = document.documentElement;
    const body = document.body;
    const style = document.createElement("style");
    style.dataset.bookingTheme = "true";
    document.head.appendChild(style);
    body.dataset.bookingTheme = "true";

    const variableNames = [
      "--foreground",
      "--card",
      "--card-foreground",
      "--border",
      "--input",
      "--muted",
      "--muted-foreground",
      "--popover",
      "--popover-foreground",
    ];
    const previous = new Map(variableNames.map((name) => [name, root.style.getPropertyValue(name)]));

    void (async () => {
      const { data } = await (supabase.from("businesses") as any)
        .select("booking_appearance, booking_preferences")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;

      const appearance = (data?.booking_appearance ?? {}) as Appearance;
      const preferences = (data?.booking_preferences ?? {}) as Preferences;
      const pageText = safeColor(appearance.page_text, "#f3f4f6");
      const serviceBackground = safeColor(appearance.service_background, "#0b0d0f");
      const serviceText = safeColor(appearance.service_text, pageText);
      const serviceBorder = safeColor(appearance.service_border, "#2a2d32");
      const serviceHoverBackground = safeColor(appearance.service_hover_background, "#101828");
      const serviceHoverText = safeColor(appearance.service_hover_text, "#ffffff");
      const serviceHoverBorder = safeColor(appearance.service_hover_border, "#1677ff");
      const modalBackground = safeColor(appearance.modal_background, "#0b0d0f");
      const modalText = safeColor(appearance.modal_text, pageText);
      const modalActiveBackground = safeColor(appearance.modal_active_background, "#10294a");
      const modalActiveText = safeColor(appearance.modal_active_text, "#5da8ff");
      const modalBorder = safeColor(appearance.modal_border, "#2a2d32");
      const agendaBackground = safeColor(appearance.agenda_background, "#0b0d0f");
      const agendaText = safeColor(appearance.agenda_text, pageText);
      const agendaBorder = safeColor(appearance.agenda_border, serviceBorder);

      root.style.setProperty("--foreground", pageText);
      root.style.setProperty("--card", serviceBackground);
      root.style.setProperty("--card-foreground", serviceText);
      root.style.setProperty("--border", serviceBorder);
      root.style.setProperty("--input", serviceBorder);
      root.style.setProperty("--muted", agendaBackground);
      root.style.setProperty("--muted-foreground", agendaText);
      root.style.setProperty("--popover", modalBackground);
      root.style.setProperty("--popover-foreground", modalText);

      const greeting = preferences.greeting?.trim();
      const main = document.querySelector("main");
      const logoArea = main?.firstElementChild;
      if (greeting && main && logoArea) {
        greetingElement = document.createElement("p");
        greetingElement.dataset.bookingGreeting = "true";
        greetingElement.textContent = greeting;
        greetingElement.style.textAlign = "center";
        greetingElement.style.margin = "-0.25rem auto 1.5rem";
        greetingElement.style.fontSize = "0.95rem";
        greetingElement.style.fontWeight = "600";
        greetingElement.style.color = pageText;
        greetingElement.style.opacity = "0.9";
        logoArea.insertAdjacentElement("afterend", greetingElement);
      }

      style.textContent = `
        body[data-booking-theme="true"] main button.rounded-lg.border:hover {
          background:${serviceHoverBackground} !important;
          color:${serviceHoverText} !important;
          border-color:${serviceHoverBorder} !important;
        }
        body[data-booking-theme="true"] [role="dialog"] {
          background:${modalBackground} !important;
          color:${modalText} !important;
          border-color:${modalBorder} !important;
        }
        body[data-booking-theme="true"] [role="dialog"] button.border {
          background:${agendaBackground};
          border-color:${agendaBorder};
          color:${agendaText};
        }
        body[data-booking-theme="true"] [role="dialog"] button[class*="bg-primary"] {
          background:${modalActiveBackground} !important;
          color:${modalActiveText} !important;
          border-color:${modalActiveText} !important;
        }
      `;
    })();

    return () => {
      cancelled = true;
      greetingElement?.remove();
      style.remove();
      delete body.dataset.bookingTheme;
      for (const [name, value] of previous) {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      }
    };
  }, [pathname]);

  return null;
}
