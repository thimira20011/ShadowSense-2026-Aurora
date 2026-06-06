/**
 * ShadowSense Aurora – Fiverr Gig Listing Content Script
 * ────────────────────────────────────────────────────────
 * Runs on Fiverr gig/search pages and injects Pre-Engagement Trust Score
 * badges BEFORE the freelancer applies or contacts the buyer.
 *
 * URL patterns:
 *   Gig detail pages : https://www.fiverr.com/<seller>/<gig-slug>
 *   Search results   : https://www.fiverr.com/search/gigs*
 *   Category pages   : https://www.fiverr.com/categories/*
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
const STORAGE_KEY     = "ss_pre_engage_fiverr_cache";
const NAV_DEBOUNCE_MS = 800;
const MAX_CONCURRENT  = 3;

// ─── Selector catalogue ───────────────────────────────────────────────────────

const GIG_TITLE_SELECTORS = [
  "h1.title", "h1[class*='title']",
  "[data-testid='gig-title']", "[data-testid*='title']", "h1",
] as const;

const GIG_DESCRIPTION_SELECTORS = [
  "[data-testid='description-text']", "[data-testid*='description']",
  ".gig-description-list", "[class*='description-list']",
  "[class*='gig-desc']", ".description", "[class*='description']",
  ".original-description", "p.description-content",
] as const;

const SELLER_MEMBER_SINCE_SELECTORS = [
  "[data-testid='member-since']", "[class*='member-since']", "[class*='memberSince']",
] as const;

const SELLER_REVIEWS_SELECTORS = [
  "[data-testid*='rating-count']", "[class*='reviews-count']",
  "[class*='rating-count']", "strong[class*='count']",
] as const;

const SELLER_LEVEL_SELECTORS = [
  "[data-testid*='seller-level']", "[class*='seller-level']",
  "[class*='sellerLevel']", "[class*='level-badge']",
] as const;

const SELLER_VERIFIED_SELECTORS = [
  "[data-testid*='verified']", "[class*='verified']", "[aria-label*='verified' i]",
] as const;

const CARD_SELECTORS = [
  "[data-testid*='gig-card']", "[class*='gig-card']", "[class*='gigCard']",
  "article[class*='gig']", "li[class*='gig']",
] as const;

const CARD_TITLE_SELECTORS = [
  "h3", "[data-testid*='gig-title']", "[class*='gig-title']", "a[class*='title']",
] as const;

const CARD_PRICE_SELECTORS = [
  "[data-testid*='price']", "[class*='price']", "[class*='Price']",
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

function isGigDetailPage(): boolean {
  const p = window.location.pathname;
  return (
    p.length > 3 &&
    !p.startsWith("/search") && !p.startsWith("/categories") &&
    !p.startsWith("/requests") && !p.startsWith("/inbox") &&
    !p.startsWith("/manage") && p.split("/").length >= 3
  );
}

function isSearchOrCategoryPage(): boolean {
  const p = window.location.pathname;
  return p.startsWith("/search/gigs") || p.startsWith("/categories/") ||
         window.location.search.includes("source=topnav");
}

function parseMemberSinceDays(text: string): number | undefined {
  const t = text.toLowerCase().trim();
  const monthYear = t.match(/([a-z]+)\s+(\d{4})/);
  if (monthYear) {
    const d = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!isNaN(d.getTime())) return Math.floor((Date.now() - d.getTime()) / 86400000);
  }
  const years  = t.match(/(\d+)\s+year/);  if (years)  return parseInt(years[1]) * 365;
  const months = t.match(/(\d+)\s+month/); if (months) return parseInt(months[1]) * 30;
  const days   = t.match(/(\d+)\s+day/);   if (days)   return parseInt(days[1]);
  return undefined;
}

function parseReviewCount(text: string): number | undefined {
  const n = parseInt(text.replace(/[,()\s]/g, ""));
  return isNaN(n) ? undefined : n;
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

interface ScrapedGig {
  jobTitle: string; jobDescription: string; budget?: string;
  reviews?: number; memberSinceDays?: number; level?: string; verified: boolean;
  pageUrl: string; anchorElement: Element; badgeId: string;
}

function scrapeGigDetailPage(): ScrapedGig | null {
  const titleEl = queryFirst(document, GIG_TITLE_SELECTORS);
  if (!titleEl) return null;
  const title = titleEl.textContent?.trim() ?? "";
  if (!title || title.length < 3) return null;

  const descText   = queryFirst(document, GIG_DESCRIPTION_SELECTORS)?.textContent?.trim() ?? "";
  const memberEl   = queryFirst(document, SELLER_MEMBER_SINCE_SELECTORS);
  const reviewsEl  = queryFirst(document, SELLER_REVIEWS_SELECTORS);
  const levelEl    = queryFirst(document, SELLER_LEVEL_SELECTORS);
  const verifiedEl = queryFirst(document, SELLER_VERIFIED_SELECTORS);

  return {
    jobTitle:         title,
    jobDescription:   descText || title,
    reviews:          reviewsEl ? parseReviewCount(reviewsEl.textContent ?? "") : undefined,
    memberSinceDays:  memberEl  ? parseMemberSinceDays(memberEl.textContent ?? "") : undefined,
    level:            levelEl?.textContent?.trim() || undefined,
    verified:         !!verifiedEl,
    pageUrl:          window.location.href,
    anchorElement:    titleEl,
    badgeId:          `ss-gig-${urlToCacheKey(window.location.href)}`,
  };
}

function scrapeGigCard(card: Element, index: number): ScrapedGig | null {
  const titleEl = queryFirst(card, CARD_TITLE_SELECTORS);
  if (!titleEl) return null;
  const title = titleEl.textContent?.trim() ?? "";
  if (!title || title.length < 3) return null;

  const priceEl = queryFirst(card, CARD_PRICE_SELECTORS);
  const link    = card.querySelector<HTMLAnchorElement>("a[href*='/']");
  const gigUrl  = link?.href ?? window.location.href + `#card-${index}`;

  return {
    jobTitle:         title,
    jobDescription:   title,
    budget:           priceEl?.textContent?.trim() || undefined,
    reviews:          undefined, memberSinceDays: undefined,
    level:            undefined, verified: false,
    pageUrl:          gigUrl,
    anchorElement:    titleEl,
    badgeId:          `ss-card-${index}-${urlToCacheKey(gigUrl)}`,
  };
}

// ─── Analysis & Injection ─────────────────────────────────────────────────────

let _activeRequests = 0;

async function analyzeAndBadge(gig: ScrapedGig): Promise<void> {
  if (document.querySelector(`[${BADGE_INJECTED_ATTR}="${gig.badgeId}"]`)) return;

  injectBadge(gig.anchorElement,
    { badgeId: gig.badgeId, score: 0, verdict: "LOADING", redFlags: [], platform: PLATFORM },
    "after");

  const cacheKey = urlToCacheKey(gig.pageUrl);
  const cached   = await getCached(cacheKey);
  if (cached) {
    injectBadge(gig.anchorElement,
      { badgeId: gig.badgeId, score: cached.score, verdict: cached.verdict,
        redFlags: cached.redFlags, topPatternType: cached.topPatternType, platform: PLATFORM },
      "after");
    return;
  }

  if (_activeRequests >= MAX_CONCURRENT) { removeBadge(gig.badgeId); return; }
  _activeRequests++;

  try {
    const request: PreEngageRequest = {
      platform:        PLATFORM,
      job_url:         gig.pageUrl,
      job_title:       gig.jobTitle,
      job_description: gig.jobDescription,
      budget:          gig.budget,
      client_profile: {
        reviews:           gig.reviews,
        member_since_days: gig.memberSinceDays,
        level:             gig.level,
        verified:          gig.verified,
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

    const anchor = gig.anchorElement.isConnected
      ? gig.anchorElement
      : queryFirst(document, GIG_TITLE_SELECTORS) ?? gig.anchorElement;

    injectBadge(anchor,
      { badgeId: gig.badgeId, score: entry.score, verdict: entry.verdict,
        redFlags: entry.redFlags, topPatternType: entry.topPatternType, platform: PLATFORM },
      "after");

    console.log(`[ShadowSense] Fiverr gig: "${gig.jobTitle}" → ${entry.score} ${entry.verdict}`);
  } catch (err) {
    console.warn("[ShadowSense] Fiverr pre-engage failed:", err);
    injectBadge(gig.anchorElement,
      { badgeId: gig.badgeId, score: 50, verdict: "ERROR",
        redFlags: ["Backend unreachable — start ShadowSense backend"], platform: PLATFORM },
      "after");
  } finally {
    _activeRequests--;
  }
}

// ─── Page scan ────────────────────────────────────────────────────────────────

async function scanPage(): Promise<void> {
  if (isGigDetailPage()) {
    const gig = scrapeGigDetailPage();
    if (gig) await analyzeAndBadge(gig);
    return;
  }
  if (isSearchOrCategoryPage()) {
    const cards = queryAll(document, CARD_SELECTORS).slice(0, MAX_CONCURRENT * 2);
    for (let i = 0; i < cards.length; i++) {
      const gig = scrapeGigCard(cards[i], i);
      if (gig) void analyzeAndBadge(gig);
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
    if (isSearchOrCategoryPage()) void scanPage().catch(() => { /* silent */ });
  }, 600);
}).observe(document.body, { childList: true, subtree: true });

// ─── Entry point ──────────────────────────────────────────────────────────────

(function main(): void {
  console.log("[ShadowSense] Fiverr gig pre-engage script loaded.");
  void scanPage().catch((err) => console.error("[ShadowSense] Fiverr gig scan error:", err));
})();
