import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Business = {
  id: string;
  name: string;
  slug: string;
  category: string;
  phone: string | null;
  address: string | null;
  status: string;
  monthly_fee_cents: number;
};

const STORAGE_KEY = "agendaagora:business";

type BusinessState = {
  businesses: Business[];
  business: Business | null;
  businessId: string | null;
  setBusinessId: (id: string) => void;
  loading: boolean;
  refresh: () => void;
};

const BusinessContext = createContext<BusinessState>({
  businesses: [],
  business: null,
  businessId: null,
  setBusinessId: () => {},
  loading: true,
  refresh: () => {},
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 36);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const bootstrapRef = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["businesses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, slug, category, phone, address, status, monthly_fee_cents")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Business[];
    },
  });

  const businesses = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (!user || isLoading || businesses.length > 0) return;
    if (bootstrapRef.current === user.id) return;
    bootstrapRef.current = user.id;

    void (async () => {
      const metadataName =
        typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
      const metadataPhone =
        typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone.replace(/\D/g, "") : null;
      const name = metadataName || "Meu estabelecimento";
      const base = slugify(name) || "estabelecimento";
      const slug = `${base}-${user.id.slice(0, 8)}`;

      const { error } = await supabase.from("businesses").insert({
        owner_id: user.id,
        name,
        slug,
        category: "outro",
        phone: metadataPhone,
      });

      if (error && !error.message.toLowerCase().includes("duplicate")) {
        bootstrapRef.current = null;
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["businesses", user.id] });
    })();
  }, [businesses.length, isLoading, queryClient, user]);

  useEffect(() => {
    if (!businesses.length) {
      setBusinessIdState(null);
      return;
    }
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    setBusinessIdState((current) => {
      if (current && businesses.some((b) => b.id === current)) return current;
      if (stored && businesses.some((b) => b.id === stored)) return stored;
      return businesses[0]!.id;
    });
  }, [businesses]);

  const setBusinessId = (id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    setBusinessIdState(id);
  };

  const value: BusinessState = {
    businesses,
    businessId,
    business: businesses.find((b) => b.id === businessId) ?? null,
    setBusinessId,
    loading: isLoading || (!!user && !businesses.length),
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  return useContext(BusinessContext);
}
