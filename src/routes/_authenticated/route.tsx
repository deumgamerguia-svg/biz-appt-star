import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BusinessProvider } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { RuntimeProfiler } from "@/lib/runtime-profiler";

type AppRole = "owner" | "super_admin" | null;

export const Route = createFileRoute("/_authenticated")({
  component: ProfiledAuthenticatedLayout,
});

function ProfiledAuthenticatedLayout() {
  return (
    <RuntimeProfiler id="AuthenticatedLayout">
      <AuthenticatedLayout />
    </RuntimeProfiler>
  );
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [role, setRole] = useState<AppRole>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    let active = true;
    setRoleLoading(true);

    void (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!active) return;

      if (error) {
        setRole(null);
        setRoleLoading(false);
        return;
      }

      const roles = (data ?? []).map((row) => row.role);
      const nextRole: AppRole = roles.includes("super_admin")
        ? "super_admin"
        : roles.includes("owner")
          ? "owner"
          : null;

      setRole(nextRole);
      setRoleLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (loading || roleLoading || !user) return;

    const isMasterRoute = pathname === "/master" || pathname.startsWith("/master/");
    const isOwnerRoute = pathname === "/painel" || pathname.startsWith("/painel/");

    if (isMasterRoute && role !== "super_admin") {
      void navigate({ to: role === "owner" ? "/painel" : "/auth" });
      return;
    }

    if (isOwnerRoute && role !== "owner") {
      void navigate({ to: role === "super_admin" ? "/master" : "/auth" });
    }
  }, [loading, roleLoading, user, role, pathname, navigate]);

  if (loading || roleLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const isOwnerRoute = pathname === "/painel" || pathname.startsWith("/painel/");

  if (isOwnerRoute && role === "owner") {
    return (
      <BusinessProvider>
        <Outlet />
      </BusinessProvider>
    );
  }

  return <Outlet />;
}
