import { Profiler, type ReactNode } from "react";

type ProfileBucket = {
  commits: number;
  mounts: number;
  updates: number;
  totalActualDuration: number;
  maxActualDuration: number;
  totalBaseDuration: number;
};

declare global {
  interface Window {
    __AA_REACT_PROFILE__?: Record<string, ProfileBucket>;
  }
}

const enabled = import.meta.env.VITE_RUNTIME_PROFILE === "1";

function recordRender(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
) {
  if (typeof window === "undefined") return;
  const store = (window.__AA_REACT_PROFILE__ ??= {});
  const bucket =
    store[id] ??
    (store[id] = {
      commits: 0,
      mounts: 0,
      updates: 0,
      totalActualDuration: 0,
      maxActualDuration: 0,
      totalBaseDuration: 0,
    });

  bucket.commits += 1;
  if (phase === "mount") bucket.mounts += 1;
  else bucket.updates += 1;
  bucket.totalActualDuration += actualDuration;
  bucket.totalBaseDuration += baseDuration;
  bucket.maxActualDuration = Math.max(bucket.maxActualDuration, actualDuration);
}

export function RuntimeProfiler({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <Profiler id={id} onRender={recordRender}>
      {children}
    </Profiler>
  );
}
