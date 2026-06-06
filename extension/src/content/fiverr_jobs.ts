/**
 * ShadowSense Aurora – Fiverr Buyer Requests & Job Listings Content Script
 * ────────────────────────────────────────────────────────────────────────
 * Runs on Fiverr buyer requests, briefs, and category job listing pages.
 * Injects Pre-Engagement Trust Score badges BEFORE the freelancer submits
 * a proposal or contacts the buyer.
 *
 * URL patterns:
 *   Buyer requests page : https://www.fiverr.com/requests/view/buyer-requests
 *   Individual request  : https://www.fiverr.com/requests/*
 *   Categories (briefs) : https://www.fiverr.com/categories/*
 */

import { analyzeJobPosting, type PreEngageRequest } from "../api/index";
import {
  injectBadge,
  removeBadge,
  BADGE_INJECTED_ATTR,
  type BadgeOptions,
  type Verdict,
} from "./pre_engage_badge";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM        = "fiverr" as const;
const CACHE_TTL_MS    = 15 * 60 * 1000;
const STORAGE_KEY     = "ss_pre_engage_fiverr_jobs_cache";
const NAV_DEBOUNCE_MS = 800;
const MAX_CONCURRENT  = 3;

// ─── Selector catalogue ───────────────────────────────────────────────────────

const JOB_CARD_SELECTORS = [
  "[data-testid*='request-card']", "[class*='request-card']", "[class*='requestCard']",
  "[data-testid*='brief-card']", "[class*='brief-card']", "[class*='briefCard']",
  "[data-testid*='lead-card']", "[class*='lead-card']", "[class*='leadCard']",
  "[data-testid*='job-card']", "[class*='job-card']", "[class*='jobCard']",
  "article[class*='request']", "li[class*='request']",
  "article[class*='brief']", "li[class*='brief']",
  "article[class*='lead']", "li[class*='lead']",
  "tr[class*='request']", "tr[class*='brief']",
  ".request-row", ".brief-row", "div.brief-card",
  // Table row or card list element on traditional buyer request pages
  "table.table-buyer-requests tbody tr",
] as const;

const CARD_TITLE_SELECTORS = [
  "h3", "h4", "[class*='title']", "[data-testid*='title']",
  "a[class*='title']", "a[href*='/requests/']", "a[href*='/briefs/']",
  // In table layout, it could be the first cell or strong element
  "td.request-title", "td strong",
] as const;

const CARD_DESCRIPTION_SELECTORS = [
  "[class*='description']", "[class*='desc']", "p",
  "div[class*='text']", "div[class*='content']",
  "td.request-description",
] as const;

const CARD_PRICE_SELECTORS = [
  "[class*='price']", "[class*='Price']", "[class*='budget']", "[class*='Budget']",
  "[data-testid*='price']", "span[class*='amount']",
  "td.request-budget",
] as const;

const BUYER_NAME_SELECTORS = [
  "[class*='buyer-name']", "[class*='username']", "[class*='userName']",
  "a[href*='/users/']", "td.request-buyer",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function queryFirst<T extends Element = Element>(
  root: Element | Document, selectors: readonly string[]
): T | null {
  for (const sel of selectors) {
    try { const el = root.querySelector<T>(sel); if (el) return el; } catch { /* ignore */ }
  }
  return null;
}

function queryAll<T extends Element = Element>(
  root: Element | Document, selectors: readonly string[]
): T[] {
  for (const sel of selectors) {
    try {
      const els = Array.from(root.querySelectorAll<T>(sel));
      if (els.length > 0) return els;
    } catch { /* ignore */ }
  }
  return [];
}

function isBuyerRequestsPage(): boolean {
  const p = window.location.pathname;
  return p.includes("/requests");
}

function urlToCacheKey(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

// ─── Session Cache ────────────────────────────────────────────────────────────

interface CacheEntry {
  score: number; verdict: Verdict; redFlags: string[];
  topPatternType?: string; cachedAt: number;
}

const _memCache = new Map<string, CacheEntry>();

async function getCached(key: string): Promise<CacheEntry | null> {
  const mem = _memCache.get(key);
  if (mem && Date.now() - mem.cachedAt < CACHE_TTL_MS) return mem;
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (r) => {
      const store: Record<string, CacheEntry> = r[STORAGE_KEY] ?? {};
      const e = store[key];
      if (e && Date.now() - e.cachedAt < CACHE_TTL_MS) { _memCache.set(key, e); resolve(e); }
      else resolve(null);
    });
  });
}

async function setCached(key: string, entry: CacheEntry): Promise<void> {
  _memCache.set(key, entry);
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (r) => {
      const store: Record<string, CacheEntry> = r[STORAGE_KEY] ?? {};
      const now = Date.now();
      for (const [k, v] of Object.entries(store)) {
        if (now - v.cachedAt >= CACHE_TTL_MS) delete store[k];
      }
      store[key] = entry;
      chrome.storage.local.set({ [STORAGE_KEY]: store }, () => resolve());
    });
  });
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

interface ScrapedJobCard {
  jobTitle: string; jobDescription: string; budget?: string;
  buyerName?: string; pageUrl: string; anchorElement: Element; badgeId: string;
}

function scrapeJobCard(card: Element, index: number): ScrapedJobCard | null {
  const titleEl = queryFirst(card, CARD_TITLE_SELECTORS);
  if (!titleEl) return null;
  const title = titleEl.textContent?.trim() ?? "";
  if (!title || title.length < 3) return null;

  const descEl = queryFirst(card, CARD_DESCRIPTION_SELECTORS);
  const description = descEl?.textContent?.trim() ?? title;

  const priceEl = queryFirst(card, CARD_PRICE_SELECTORS);
  const budget = priceEl?.textContent?.trim() || undefined;

  const buyerEl = queryFirst(card, BUYER_NAME_SELECTORS);
  const buyerName = buyerEl?.textContent?.trim() || undefined;

  const link = card.querySelector<HTMLAnchorElement>("a[href*='/requests/'], a[href*='/briefs/']");
  const jobUrl = link?.href ?? window.location.href + `#request-${index}-${encodeURIComponent(title.slice(0, 15))}`;

  return {
    jobTitle:       title,
    jobDescription: description,
    budget,
    buyerName,
    pageUrl:        jobUrl,
    anchorElement:  titleEl,
    badgeId:        `ss-job-${index}-${urlToCacheKey(jobUrl)}`,
  };
}

// ─── Analysis & Injection ─────────────────────────────────────────────────────

let _activeRequests = 0;

async function analyzeAndBadge(job: ScrapedJobCard): Promise<void> {
  if (document.querySelector(`[${BADGE_INJECTED_ATTR}="${job.badgeId}"]`)) return;

  injectBadge(job.anchorElement,
    { badgeId: job.badgeId, score: 0, verdict: "LOADING", redFlags: [], platform: PLATFORM },
    "after");

  const cacheKey = urlToCacheKey(job.pageUrl);
  const cached   = await getCached(cacheKey);
  if (cached) {
    injectBadge(job.anchorElement,
      { badgeId: job.badgeId, score: cached.score, verdict: cached.verdict,
        redFlags: cached.redFlags, topPatternType: cached.topPatternType, platform: PLATFORM },
      "after");
    return;
  }

  if (_activeRequests >= MAX_CONCURRENT) { removeBadge(job.badgeId); return; }
  _activeRequests++;

  try {
    const request: PreEngageRequest = {
      platform:        PLATFORM,
      job_url:         job.pageUrl,
      job_title:       job.jobTitle,
      job_description: job.jobDescription,
      budget:          job.budget,
      client_profile: {
        reviews:           undefined,
        member_since_days: undefined,
        level:             undefined,
        verified:          false,
      },
    };

    const response  = await analyzeJobPosting(request);
    const verdict   = response.verdict as Verdict;
    const entry: CacheEntry = {
      score: response.pre_engage_score, verdict,
      redFlags: response.red_flags ?? [],
      topPatternType: response.similar_patterns?.[0]?.type,
      cachedAt: Date.now(),
    };
    await setCached(cacheKey, entry);

    const anchor = job.anchorElement.isConnected ? job.anchorElement : job.anchorElement;

    injectBadge(anchor,
      { badgeId: job.badgeId, score: entry.score, verdict: entry.verdict,
        redFlags: entry.redFlags, topPatternType: entry.topPatternType, platform: PLATFORM },
      "after");

    console.log(`[ShadowSense] Fiverr job request: "${job.jobTitle}" → ${entry.score} ${entry.verdict}`);
  } catch (err) {
    console.warn("[ShadowSense] Fiverr pre-engage job request failed:", err);
    injectBadge(job.anchorElement,
      { badgeId: job.badgeId, score: 50, verdict: "ERROR",
        redFlags: ["Backend unreachable — start ShadowSense backend"], platform: PLATFORM },
      "after");
  } finally {
    _activeRequests--;
  }
}

// ─── Page scan ────────────────────────────────────────────────────────────────

async function scanPage(): Promise<void> {
  if (isBuyerRequestsPage() || window.location.pathname.startsWith("/categories/")) {
    const cards = queryAll(document, JOB_CARD_SELECTORS).slice(0, MAX_CONCURRENT * 4);
    console.log(`[ShadowSense] Found ${cards.length} job cards/listings on requests/categories page.`);
    for (let i = 0; i < cards.length; i++) {
      const job = scrapeJobCard(cards[i], i);
      if (job) void analyzeAndBadge(job);
    }
  }
}

// ─── SPA navigation ───────────────────────────────────────────────────────────

let _lastUrl = window.location.href;
let _navTimer: ReturnType<typeof setTimeout> | null = null;

function handleNavigation(): void {
  if (window.location.href === _lastUrl) return;
  _lastUrl = window.location.href;
  if (_navTimer !== null) clearTimeout(_navTimer);
  _navTimer = setTimeout(() => {
    _navTimer = null;
    void scanPage().catch(() => { /* silent */ });
  }, NAV_DEBOUNCE_MS);
}

(function patchHistory(): void {
  const push    = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState    = (...a) => { push(...a);    handleNavigation(); };
  history.replaceState = (...a) => { replace(...a); handleNavigation(); };
})();
window.addEventListener("popstate", handleNavigation);

let _mutationDebounce: ReturnType<typeof setTimeout> | null = null;
new MutationObserver(() => {
  if (_mutationDebounce !== null) clearTimeout(_mutationDebounce);
  _mutationDebounce = setTimeout(() => {
    _mutationDebounce = null;
    if (isBuyerRequestsPage() || window.location.pathname.startsWith("/categories/")) {
      void scanPage().catch(() => { /* silent */ });
    }
  }, 600);
}).observe(document.body, { childList: true, subtree: true });

// ─── Entry point ──────────────────────────────────────────────────────────────

(function main(): void {
  console.log("[ShadowSense] Fiverr requests/jobs pre-engage script loaded.");
  void scanPage().catch((err) => console.error("[ShadowSense] Fiverr requests scan error:", err));
})();
