"""ForexFactory Calendar Client with Finnhub & JBlanked fallback/enrichment.

Implements the ForexCalendarClient singleton to fetch economic events from the
ForexFactory static JSON feed (`nfs.faireconomy.media`), merge it with Finnhub 
baseline metrics, and enrich with JBlanked API predictions and historical data.

TASK-UPDATE-003
"""
import asyncio
import logging
import re
import time
from collections import deque
from datetime import datetime, timezone
import difflib
import httpx

from app.config import get_settings
import enum

class CircuitBreakerState(enum.Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

logger = logging.getLogger(__name__)

# JBlanked Lazy Loading
try:
    from jb_news import JBNewsClient as _JBClient
    _HAS_JBLANKED = True
except ImportError:
    _HAS_JBLANKED = False
    logger.warning("jb-news SDK not installed; JBlanked features disabled")

_FF_FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
_FF_RATE_LIMIT = 2
_FF_RATE_WINDOW = 300.0


def _normalize_name(name: str) -> str:
    """Strip, lower, and remove basic punctuation for matching."""
    if not name:
        return ""
    name = name.lower()
    return re.sub(r"[^\w\s]", "", name).strip()


class ForexCalendarClient:
    """Singleton client managing ForexFactory and JBlanked data fetches."""

    def __init__(self) -> None:
        self._http: httpx.AsyncClient | None = None
        
        # FF Rate Limiter
        self._ff_rate_limiter: deque[float] = deque()
        self._ff_rate_lock = asyncio.Lock()
        
        # FF Circuit Breaker
        self._ff_cb_state = CircuitBreakerState.CLOSED
        self._ff_cb_failures: deque[float] = deque()
        self._ff_cb_lock = asyncio.Lock()
        
        # JB Circuit Breaker
        self._jb_cb_state = CircuitBreakerState.CLOSED
        self._jb_cb_failures: deque[float] = deque()
        self._jb_cb_lock = asyncio.Lock()
        
        # JBlanked Instance
        self._jb_client = None
        self._jb_api_key = get_settings().jblanked_api_key
        if _HAS_JBLANKED and self._jb_api_key:
            try:
                self._jb_client = _JBClient(self._jb_api_key)
            except Exception as e:
                logger.warning("Failed to init JBlanked SDK: %s", e)

        # Configuration constants
        self._cb_threshold = 3
        self._cb_window = 300.0
        self._cb_cooldown = 900.0  # 15 min
        self._ff_cb_open_time = 0.0
        self._jb_cb_open_time = 0.0

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=httpx.Timeout(10.0, read=30.0))
        return self._http

    async def close(self) -> None:
        if self._http:
            await self._http.aclose()
            self._http = None

    # --- ForexFactory Protection & Fetch ---
    async def _ff_record_failure(self) -> None:
        now = time.monotonic()
        async with self._ff_cb_lock:
            self._ff_cb_failures.append(now)
            while self._ff_cb_failures and now - self._ff_cb_failures[0] > self._cb_window:
                self._ff_cb_failures.popleft()
            if len(self._ff_cb_failures) >= self._cb_threshold and self._ff_cb_state == CircuitBreakerState.CLOSED:
                self._ff_cb_state = CircuitBreakerState.OPEN
                self._ff_cb_open_time = now
                logger.warning("ForexFactory circuit breaker OPENED")

    async def _check_ff_cb(self) -> bool:
        async with self._ff_cb_lock:
            if self._ff_cb_state == CircuitBreakerState.OPEN:
                if time.monotonic() - self._ff_cb_open_time > self._cb_cooldown:
                    self._ff_cb_state = CircuitBreakerState.HALF_OPEN
                    logger.info("ForexFactory circuit HALF_OPEN")
                    return True
                return False
            return True

    async def _check_ff_rate_limit(self) -> bool:
        now = time.monotonic()
        async with self._ff_rate_lock:
            while self._ff_rate_limiter and now - self._ff_rate_limiter[0] > _FF_RATE_WINDOW:
                self._ff_rate_limiter.popleft()
            if len(self._ff_rate_limiter) >= _FF_RATE_LIMIT:
                return False
            self._ff_rate_limiter.append(now)
            return True

    async def _fetch_ff(self) -> list[dict] | None:
        if not await self._check_ff_cb():
            return None
        if not await self._check_ff_rate_limit():
            logger.warning("ForexFactory rate limit exceeded (2 req / 5 min)")
            return None

        client = await self._get_http()
        try:
            resp = await client.get(_FF_FEED_URL)
            if resp.status_code == 429:
                logger.warning("ForexFactory HTTP 429")
                await self._ff_record_failure()
                return None
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, list):
                logger.error("ForexFactory returned non-list schema")
                await self._ff_record_failure()
                return None
                
            # Basic validation
            if data and not all(k in data[0] for k in ["title", "date", "impact"]):
                logger.error("ForexFactory missing required fields in schema")
                await self._ff_record_failure()
                return None
                
            async with self._ff_cb_lock:
                if self._ff_cb_state == CircuitBreakerState.HALF_OPEN:
                    self._ff_cb_state = CircuitBreakerState.CLOSED
                    self._ff_cb_failures.clear()
            return data
        except Exception as e:
            logger.warning("ForexFactory fetch error: %s", type(e).__name__)
            await self._ff_record_failure()
            return None

    # --- JBlanked Protection & Fetch ---
    async def _jb_record_failure(self) -> None:
        now = time.monotonic()
        async with self._jb_cb_lock:
            self._jb_cb_failures.append(now)
            while self._jb_cb_failures and now - self._jb_cb_failures[0] > self._cb_window:
                self._jb_cb_failures.popleft()
            if len(self._jb_cb_failures) >= self._cb_threshold and self._jb_cb_state == CircuitBreakerState.CLOSED:
                self._jb_cb_state = CircuitBreakerState.OPEN
                self._jb_cb_open_time = now
                logger.warning("JBlanked circuit breaker OPENED")

    async def _check_jb_cb(self) -> bool:
        if not self._jb_client:
            return False
            
        async with self._jb_cb_lock:
            if self._jb_cb_state == CircuitBreakerState.OPEN:
                if time.monotonic() - self._jb_cb_open_time > self._cb_cooldown:
                    self._jb_cb_state = CircuitBreakerState.HALF_OPEN
                    logger.info("JBlanked circuit HALF_OPEN")
                    return True
                return False
            return True

    # --- Public API ---
    async def get_weekly_calendar(self) -> dict | None:
        """Return merged FF + Finnhub events for this week."""
        # 1. Fetch FF
        ff_events_raw = await self._fetch_ff()
        
        # 2. Fetch Finnhub
        from app.data.finnhub_client import get_finnhub_client
        fh_client = get_finnhub_client()
        fh_data = await fh_client.get_economic_calendar()
        fh_events_raw = fh_data.get("economicCalendar", []) if fh_data else []

        # If completely dead
        if not ff_events_raw and not fh_events_raw:
            return {"events": [], "week_start": "", "week_end": "", "event_count": 0, "_source": "finnhub", "_fetched_at": datetime.now(timezone.utc).isoformat()}
            
        # 3. Merge Prep
        fh_lookup = {}
        for event in fh_events_raw:
            dt = event.get("time", "")[:10]  # YYYY-MM-DD
            name = _normalize_name(event.get("event", ""))
            # Store list to handle multiple events with same name/date (rare but possible)
            key = f"{dt}::{name}"
            if key not in fh_lookup:
                fh_lookup[key] = []
            fh_lookup[key].append(event)
            
        merged_events = []
        is_ff_primary = ff_events_raw is not None
        
        # If FF down, return Finnhub only
        if not is_ff_primary:
            for ev in fh_events_raw:
                merged_events.append({
                    "event_name": ev.get("event", ""),
                    "country": ev.get("country", ""),
                    "event_date": ev.get("time", ""),
                    "event_time": "",
                    "impact": "unknown",
                    "forecast": str(ev.get("estimate", "")) if ev.get("estimate") is not None else "N/A",
                    "previous": str(ev.get("previous", "")) if ev.get("previous") is not None else "N/A",
                    "actual": str(ev.get("actual", "")) if ev.get("actual") is not None else "N/A",
                    "currency": ""
                })
        else:
            # Merge logic
            unmatched_fh = list(fh_events_raw)
            for ff_ev in ff_events_raw:
                # Ensure no HTML parsing happens
                # ff_ev looks like: {'title': '...', 'country': '...', 'date': '...T...', 'impact': '...', 'forecast': '...', 'previous': '...'}
                date_iso = ff_ev.get("date", "")[:10]
                norm_name = _normalize_name(ff_ev.get("title", ""))
                
                # Match attempt
                best_match = None
                key = f"{date_iso}::{norm_name}"
                if key in fh_lookup and fh_lookup[key]:
                    best_match = fh_lookup[key].pop(0)
                else:
                    # Fuzzy fallback
                    best_score = 0
                    for fh_ev in unmatched_fh:
                        fh_d = fh_ev.get("time", "")[:10]
                        if fh_d == date_iso:
                            fh_n = _normalize_name(fh_ev.get("event", ""))
                            score = difflib.SequenceMatcher(None, norm_name, fh_n).ratio() * 100
                            if score > best_score:
                                best_score = score
                                best_match = fh_ev
                    
                    if best_match and best_score >= 80:
                        unmatched_fh.remove(best_match)
                    else:
                        best_match = None
                
                # Impact processing
                raw_impact = str(ff_ev.get("impact", "")).lower()
                impact_map = {"high": "High", "medium": "Medium", "low": "Low", "holiday": "Low", "non-economic": "Low"}
                impact = impact_map.get(raw_impact, "Low")
                
                # Extract actuals with conflict resolution
                actual = "N/A"
                if best_match and best_match.get("actual") is not None:
                    actual = str(best_match["actual"])
                
                # N/A Forecast rules
                raw_ff_forecast = ff_ev.get("forecast", "")
                is_speech = "speech" in norm_name or "speaks" in norm_name or "hearing" in norm_name or "testifies" in norm_name
                forecast = str(raw_ff_forecast) if raw_ff_forecast else "N/A"
                if is_speech:
                    forecast = "N/A"

                merged_events.append({
                    "event_name": ff_ev.get("title", ""),
                    "country": ff_ev.get("country", ""),
                    "event_date": date_iso,
                    "event_time": ff_ev.get("date", ""),
                    "impact": impact,
                    "forecast": forecast,
                    "previous": str(ff_ev.get("previous", "")) if ff_ev.get("previous") else "N/A",
                    "actual": actual,
                    "currency": ff_ev.get("currency", ""),
                    "event_type": "speech" if is_speech else "metric"
                })

        # Sort
        merged_events.sort(key=lambda x: (x["event_date"], x.get("event_time", "")))
        
        dates = [e["event_date"] for e in merged_events if e["event_date"]]
        week_start = min(dates) if dates else ""
        week_end = max(dates) if dates else ""

        return {
            "events": merged_events,
            "week_start": week_start,
            "week_end": week_end,
            "event_count": len(merged_events),
            "_source": "forexfactory" if is_ff_primary else "finnhub",
            "_fetched_at": datetime.now(timezone.utc).isoformat()
        }

    async def get_today_events(self) -> dict | None:
        """Return today's events."""
        data = await self.get_weekly_calendar()
        if not data:
            return None
        
        today_iso = datetime.now(timezone.utc).isoformat()[:10]
        today_events = [e for e in data.get("events", []) if e.get("event_date") == today_iso]
        
        return {
            "events": today_events,
            "date": today_iso,
            "event_count": len(today_events),
            "_source": data.get("_source", "forexfactory"),
            "_fetched_at": datetime.now(timezone.utc).isoformat()
        }

    async def get_event_history(self, event_id: str) -> dict | None:
        """Fetch JBlanked event history."""
        if not await self._check_jb_cb():
            return None
            
        try:
            # Note: _jb_client fetch logic typically would be async. If SDK is sync, run in executor.
            # Assuming SDK supports async or is fast enough for now, but will wrap in thread if needed later.
            data = self._jb_client.get_event_history(event_id)
            if not data:
                return None
                
            async with self._jb_cb_lock:
                if self._jb_cb_state == CircuitBreakerState.HALF_OPEN:
                    self._jb_cb_state = CircuitBreakerState.CLOSED
                    self._jb_cb_failures.clear()
                    
            return {
                "event_id": event_id,
                "event_name": data.get("event_name", ""),
                "releases": data.get("releases", []),
                "_source": "jblanked",
                "_fetched_at": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.warning("JBlanked fetch error (history): %s", e)
            await self._jb_record_failure()
            return None

    async def get_predictions(self) -> list[dict] | None:
        """Fetch JBlanked predictions."""
        if not await self._check_jb_cb():
            return []
            
        try:
            preds = self._jb_client.get_predictions()
            if preds is None:
                return []
                
            async with self._jb_cb_lock:
                if self._jb_cb_state == CircuitBreakerState.HALF_OPEN:
                    self._jb_cb_state = CircuitBreakerState.CLOSED
                    self._jb_cb_failures.clear()
                    
            for p in preds:
                p["_source"] = "jblanked"
                p["_fetched_at"] = datetime.now(timezone.utc).isoformat()
            return preds
        except Exception as e:
            logger.warning("JBlanked fetch error (predictions): %s", e)
            await self._jb_record_failure()
            return []


_client: ForexCalendarClient | None = None

def get_forex_calendar_client() -> ForexCalendarClient:
    """Return the global ForexCalendarClient singleton."""
    global _client
    if _client is None:
        _client = ForexCalendarClient()
    return _client

async def close_forex_calendar_client() -> None:
    """Close the global ForexCalendarClient HTTP connection."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
