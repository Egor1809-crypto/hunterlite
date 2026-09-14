"use client";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { api } from "@/lib/api";
import { untilMoscowMidnight } from "@/lib/trainingDay";
import { DAILY_ENERGY, energyCacheKey, readEnergyBalance } from "@/lib/energyBalance";

export function EnergyStatus() {
  const userId = useAuthStore(s => s.user?.id);
  const [balance, setBalance] = useState<{userId?: string; remaining: number | null}>({remaining:null});
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let revision = 0;
    const key = energyCacheKey(userId);
    const readCache = () => {
      try { return readEnergyBalance(JSON.parse(localStorage.getItem(key) || "null")); } catch { return null; }
    };
    setBalance({userId, remaining:readCache()});
    setStale(false);
    const refresh = async () => {
      if (document.hidden) return;
      const requestedRevision = ++revision;
      // An expired cache must never be displayed as today's balance.
      setBalance({userId, remaining:readCache()});
      try {
        const result = await api.get<{energy:unknown}>("/training-map/progress");
        if (disposed || requestedRevision !== revision) return;
        const remaining = readEnergyBalance(result.energy);
        setBalance({userId, remaining});
        setStale(remaining === null);
        if (remaining !== null) { try { localStorage.setItem(key, JSON.stringify(result.energy)); } catch {} }
      } catch { if (!disposed && requestedRevision === revision) setStale(true); }
    };
    const cacheChanged = () => { revision++; const remaining = readCache(); setBalance({userId,remaining}); setStale(false); if (remaining === null) void refresh(); };
    const storageChanged = (event: StorageEvent) => { if (event.key === key || event.key === null) cacheChanged(); };
    void refresh();
    window.addEventListener("hunterlite:energy", cacheChanged);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    let midnight: number;
    const scheduleMidnight = () => { midnight = window.setTimeout(() => { void refresh(); scheduleMidnight(); }, untilMoscowMidnight() + 100); };
    scheduleMidnight();
    return () => { disposed = true; window.clearTimeout(midnight); window.removeEventListener("hunterlite:energy", cacheChanged); window.removeEventListener("storage", storageChanged); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [userId]);
  const remaining = balance.userId === userId ? balance.remaining : null;
  const percent = remaining === null ? 0 : remaining / DAILY_ENERGY * 100;
  return <div className="workspace-energy" title={stale ? "Не удалось обновить баланс. Повторим при возвращении на страницу." : "Ежедневная энергия для тестов. Обновляется в 00:00 по Москве."}>
    <Zap size={19} aria-hidden="true" />
    <div className="workspace-energy-label"><span>Энергия</span><strong>{remaining ?? "—"}<small> / {DAILY_ENERGY}</small></strong></div>
    <div className="workspace-energy-track" role={remaining === null ? undefined : "meter"} aria-label="Осталось энергии" aria-valuemin={0} aria-valuemax={DAILY_ENERGY} aria-valuenow={remaining ?? undefined} aria-valuetext={remaining === null ? undefined : `${remaining} из ${DAILY_ENERGY}${stale ? ", последние данные" : ""}`} data-loading={remaining === null}>
      <span className="workspace-energy-fill" style={{width:`${percent}%`}} />
      {remaining !== null && <span className="workspace-energy-thumb" style={{insetInlineStart:`clamp(9px, ${percent}%, calc(100% - 9px))`}} />}
    </div>
    {stale && <span className="workspace-energy-stale" aria-label="Баланс не обновлён">!</span>}
  </div>;
}
