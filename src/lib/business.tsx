import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
};

const STORAGE_KEY = "agendae:business";

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

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [businessId, setBusinessIdState] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["businesses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, slug, category, phone, address")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Business[];
    },
  });

  const businesses = useMemo(() => data ?? [], [data]);

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
    loading: isLoading,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  return useContext(BusinessContext);
}
