import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { API_BASE } from "../utils/api";

function formatHKD(n) {
  return `HK$${Number(n).toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function useCountdown(closesAt) {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    if (!closesAt) return;
    const tick = () => {
      const diff = new Date(closesAt) - Date.now();
      if (diff <= 0) { setTimeLeft({ closed: true }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ closed: false, d, h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closesAt]);
  return timeLeft;
}

function CountdownBadge({ closesAt, hero = false }) {
  const t = useCountdown(closesAt);
  if (!t) return null;
  if (t.closed) {
    if (hero) return <span className="text-white font-mono">Closed</span>;
    return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Auction closed</span>;
  }
  const parts = [];
  if (t.d > 0) parts.push(`${t.d}d`);
  parts.push(`${String(t.h).padStart(2, "0")}h`);
  parts.push(`${String(t.m).padStart(2, "0")}m`);
  parts.push(`${String(t.s).padStart(2, "0")}s`);
  if (hero) return <span className="font-mono">{parts.join(" ")}</span>;
  return (
    <span className="text-xs font-mono font-bold text-[#1E3A6E] bg-[#1E3A6E]/8 px-2 py-1 rounded-full">
      ⏱ {parts.join(" ")}
    </span>
  );
}

function isClosed(item) {
  if (!item.closesAt) return false;
  return new Date(item.closesAt) <= new Date();
}

function isOpen(item) {
  const now = new Date();
  if (item.opensAt && new Date(item.opensAt) > now) return false;
  if (item.closesAt && new Date(item.closesAt) <= now) return false;
  return true;
}

function BidForm({ item, onBidPlaced }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const minBid = item.topBid
    ? parseFloat(item.topBid.amount) + parseFloat(item.minIncrement)
    : parseFloat(item.startingPrice);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email."); return; }
    if (isNaN(amt) || amt < minBid) { setError(`Minimum bid is ${formatHKD(minBid)}.`); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/auction/${item.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidderName: name.trim(), bidderEmail: email.trim(), amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Bid failed. Please try again."); return; }
      setSuccess(true);
      setName(""); setEmail(""); setAmount("");
      onBidPlaced?.(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <p className="text-emerald-700 font-semibold text-sm">Your bid was placed!</p>
        <p className="text-emerald-600 text-xs mt-1">You'll be contacted if you win.</p>
        <button onClick={() => setSuccess(false)} className="mt-2 text-xs text-emerald-600 underline">Place another bid</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
          className="col-span-2 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#1E3A6E] transition-colors"
        />
        <input
          type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
          className="col-span-2 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#1E3A6E] transition-colors"
        />
        <input
          type="number" placeholder={`Min HK$${Math.round(minBid)}`} value={amount} onChange={e => setAmount(e.target.value)} min={minBid} step="1"
          className="col-span-2 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:border-[#1E3A6E] transition-colors"
        />
      </div>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full py-2.5 bg-[#1E3A6E] text-white text-sm font-bold rounded-lg hover:bg-[#16305D] transition-colors disabled:opacity-60"
      >
        {loading ? "Placing bid…" : `Place Bid (min ${formatHKD(minBid)})`}
      </button>
    </form>
  );
}

function ItemCard({ item, onBidPlaced }) {
  const closed = isClosed(item);
  const open = isOpen(item);
  const topBid = item.topBid;

  return (
    <div className="bg-white rounded-2xl border border-[#E5D5BC] shadow-sm overflow-hidden flex flex-col">
      {item.imageUrl && (
        <div className="h-48 bg-gray-100 overflow-hidden shrink-0">
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}
      {!item.imageUrl && (
        <div className="h-32 bg-[#1E3A6E]/5 flex items-center justify-center shrink-0">
          <svg className="w-10 h-10 text-[#1E3A6E]/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-gray-900 text-base leading-snug flex-1">{item.title}</h3>
          {item.closesAt && <CountdownBadge closesAt={item.closesAt} />}
        </div>

        {item.description && (
          <p className="text-sm text-gray-600 leading-relaxed mb-4 flex-1">{item.description}</p>
        )}

        <div className="border-t border-gray-100 pt-4 mt-auto">
          {topBid ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Current Bid</p>
                <p className="text-2xl font-extrabold text-[#1E3A6E]">{formatHKD(topBid.amount)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Current leading bid</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Next min:</p>
                <p className="text-sm font-bold text-gray-700">{formatHKD(parseFloat(topBid.amount) + parseFloat(item.minIncrement))}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Opening Bid</p>
              <p className="text-2xl font-extrabold text-[#1E3A6E]">{formatHKD(item.startingPrice)}</p>
              <p className="text-xs text-gray-400 mt-0.5">No bids yet — be the first!</p>
            </div>
          )}
        </div>

        {closed && (
          <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-semibold text-gray-500">Auction closed</p>
            {topBid && <p className="text-xs text-gray-400 mt-0.5">Winning bid: {formatHKD(topBid.amount)}</p>}
          </div>
        )}

        {!closed && open && <BidForm item={item} onBidPlaced={onBidPlaced} />}

        {!closed && !open && item.opensAt && new Date(item.opensAt) > new Date() && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-amber-700 font-semibold">Opens {new Date(item.opensAt).toLocaleDateString("en-HK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Auction() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const sseRef = useRef(null);

  const fetchAuction = useCallback(() => {
    fetch(`${API_BASE}/api/public/auction`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAuction();
  }, [fetchAuction]);

  useEffect(() => {
    const url = `${API_BASE}/api/public/auction/stream`;
    let es;
    let retryTimeout;
    const connect = () => {
      es = new EventSource(url);
      sseRef.current = es;
      es.addEventListener("bid", (e) => {
        try {
          const { itemId, bid } = JSON.parse(e.data);
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              items: prev.items.map(item =>
                item.id === itemId ? { ...item, topBid: bid } : item
              ),
            };
          });
        } catch { /* ignore */ }
      });
      es.onerror = () => {
        es.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      if (es) es.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1E3A6E] font-semibold">Loading auction…</div>
      </div>
    );
  }

  if (!data || !data.isLive) {
    return (
      <div>
        <div className="bg-[#1E3A6E] text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
              Rotterdam 2026
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Silent Auction</h1>
            <p className="text-[#BFD9F5] text-lg max-w-2xl">Our silent auction is coming soon. Check back shortly.</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-gray-500 mb-6">In the meantime, you can support the team directly.</p>
          <Link href="/support" className="inline-block bg-[#1E3A6E] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#16305D] transition-colors">
            Support the Team →
          </Link>
        </div>
      </div>
    );
  }

  const activeItems = (data.items || []).filter(i => i.isActive);

  const soonestClose = activeItems
    .filter(i => i.closesAt && new Date(i.closesAt) > new Date())
    .sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt))[0];

  return (
    <div>
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Rotterdam 2026
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Silent Auction</h1>
          <p className="text-[#BFD9F5] text-lg max-w-2xl leading-relaxed">
            Bid on exclusive items to support HK Masters Hockey at the World Masters Cup in Rotterdam.
            Bids update live — no refresh needed.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Live bidding
            </span>
            <span className="text-[#BFD9F5] text-sm">{activeItems.length} item{activeItems.length !== 1 ? "s" : ""}</span>
            {soonestClose && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                ⏱ Closes in: <CountdownBadge closesAt={soonestClose.closesAt} hero />
              </span>
            )}
          </div>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {activeItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Items will be listed here shortly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onBidPlaced={() => fetchAuction()}
              />
            ))}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9C9A8] text-center">
          <p className="text-gray-600 text-sm mb-3">Want to support the team in other ways?</p>
          <Link href="/support" className="inline-block text-[#1E3A6E] font-semibold text-sm hover:underline">
            Make a pledge →
          </Link>
        </div>
      </section>
    </div>
  );
}
