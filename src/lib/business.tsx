import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
        .select("id, name, slug, category, phone, address, status, monthly_fee_cents")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Business[];
    },
    staleTime: 60_000,
  });

  const businesses = useMemo(() => data ?? [], [data]);

  // O Painel 2 nunca cria negócio implicitamente. O vínculo nasce no Painel 3
  // (Master) e esta camada apenas seleciona os negócios aos quais o usuário tem acesso.
  useEffect(() => {
    if (!businesses.length) {
      setBusinessIdState(null);
      return;
    }
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    setBusinessIdState((current) => {
      if (current && businesses.some((business) => business.id === current)) return current;
      if (stored && businesses.some((business) => business.id === stored)) return stored;
      return businesses[0]!.id;
    });
  }, [businesses]);

  const setBusinessId = useCallback(
    (id: string) => {
      if (!businesses.some((business) => business.id === id)) return;
      window.localStorage.setItem(STORAGE_KEY, id);
      setBusinessIdState(id);
    },
    [businesses],
  );

  const business = useMemo(
    () => businesses.find((item) => item.id === businessId) ?? null,
    [businesses, businessId],
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["businesses"] });
  }, [queryClient]);

  const value = useMemo<BusinessState>(
    () => ({
      businesses,
      businessId,
      business,
      setBusinessId,
      loading: isLoading,
      refresh,
    }),
    [businesses, businessId, business, setBusinessId, isLoading, refresh],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  return useContext(BusinessContext);
}
