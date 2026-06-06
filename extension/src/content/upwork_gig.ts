/**
 * ShadowSense Aurora – Upwork Job Listing Content Script
 * ────────────────────────────────────────────────────────
 * Runs on Upwork job pages and injects Pre-Engagement Trust Score badges
 * BEFORE the freelancer submits a proposal.
 *
 * URL patterns:
 *   Job detail  : https://www.upwork.com/jobs/<slug>_~<id>/
 *   Search feed : https://www.upwork.com/nx/search/jobs/*
 *                 https://www.upwork.com/ab/jobs/search/*
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

const PLATFORM        = "upwork" as const;
const CACHE_TTL_MS    = 15 * 60 * 1000;
const STORAGE_KEY     = "ss_pre_engage_upwork_cache";
const NAV_DEBOUNCE_MS = 900;
const MAX_CONCURRENT  = 3;

// ─── Selectors ────────────────────────────────────────────────────────────────

const JOB_TITLE_SELECTORS = [
  "h1[data-v-app]", "h1[class*='title']",
  "[data-test='job-title']", "[data-qa='job-title']", "h1",
] as const;

const JOB_DESCRIPTION_SELECTORS = [
  "[data-test='description']", "[data-qa='description']",
  "[class*='description']", ".break", "section p", "p",
] as const;

const JOB_BUDGET_SELECTORS = [
  "[data-test='budget']", "[data-qa='budget']", "[class*='budget']",
  "[data-test='hourly-rate']", "[class*='hourly-rate']", "[data-test='fixed-price']",
] as const;

const CLIENT_SPEND_SELECTORS = [
  "[data-test='client-spend']", "[data-qa='client-spend']",
  "[class*='total-spent']", "[class*='totalSpent']",
] as const;

const CLIENT_HIRE_RATE_SELECTORS = [
  "[data-test='hire-rate']", "[data-qa='hire-rate']",
  "[class*='hire-rate']", "[class*='hireRate']",
] as const;

const CLIENT_REVIEWS_SELECTORS = [
  "[data-test='reviews-count']", "[data-qa='reviews-count']",
  "[class*='reviews']", "[class*='feedback-count']",
] as const;

const CLIENT_MEMBER_SINCE_SELECTORS = [
  "[data-test='member-since']", "[data-qa='member-since']",
  "[class*='member-since']", "[class*='memberSince']",
] as const;

const CLIENT_LOCATION_SELECTORS = [
  "[data-test='client-location']", "[data-qa='client-location']", "[class*='location']",
] as const;

const CLIENT_VERIFIED_SELECTORS = [
  "[data-test='payment-verified']", "[data-qa='payment-verified']",
  "[aria-label*='payment verified' i]", "[class*='payment-verified']", "[class*='verified-badge']",
] as const;

const CLIENT_JOBS_POSTED_SELECTORS = [
  "[data-test='jobs-posted']", "[data-qa='jobs-posted']", "[class*='jobs-posted']",
] as const;

const JOB_CARD_SELECTORS = [
  "[data-test='job-tile']", "[data-qa='job-tile']",
  "[class*='job-tile']", "[class*='JobTile']",
  "article[class*='job']", "section[class*='job']",
] as const;

const CARD_TITLE_SELECTORS = [
  "h2[class*='title']", "h3[class*='title']",
  "[data-test='job-title']", "[data-qa='job-title']", "h2", "h3",
] as const;

const CARD_BUDGET_SELECTORS = [
  "[data-test='budget']", "[data-qa='budget']",
  "[class*='budget']", "[class*='price']",
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

function isJobDetailPage(): boolean {
  return /\/jobs\/[^/]+/.test(window.location.pathname);
}

function isSearchPage(): boolean {
  const p = window.location.pathname;
  return p.includes("/search/jobs") || p.includes("/ab/jobs/search") || p.includes("/nx/search/jobs");
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

function parseSpend(text: string): number | undefined {
  const cleaned = text.replace(/[$,\s]/g, "");
  const kMatch = cleaned.match(/([\d.]+)k\+?/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  const plain = parseFloat(cleaned);
  return isNaN(plain) ? undefined : plain;
}

function parseHireRate(text: string): number | undefined {
  const m = text.match(/([\d.]+)\s*%/);
  return m ? parseFloat(m[1]) : undefined;
}

function parseCount(text: string): number | undefined {
  const n = parseInt(text.replace(/[,()\s]/g, ""));
  return isNaN(n) ? undefined : n;
}

function urlToCacheKey(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

// ─── Session cache ────────────────────────────────────────────────────────────

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

interface ScrapedJob {
  jobTitle: string; jobDescription: string; budget?: string;
  reviews?: number; memberSinceDays?: number; totalSpend?: number;
  hireRate?: number; country?: string; verified: boolean; jobsPosted?: number;
  pageUrl: string; anchorElement: Element; badgeId: string;
}

function scrapeJobDetailPage(): ScrapedJob | null {
  const titleEl = queryFirst(document, JOB_TITLE_SELECTORS);
  if (!titleEl) return null;
  const title = titleEl.textContent?.trim() ?? "";
  if (!title || title.length < 3) return null;

  return {
    jobTitle:         title,
    jobDescription:   queryFirst(document, JOB_DESCRIPTION_SELECTORS)?.textContent?.trim() || title,
    budget:           queryFirst(document, JOB_BUDGET_SELECTORS)?.textContent?.trim() || undefined,
    totalSpend:       parseSpend(queryFirst(document, CLIENT_SPEND_SELECTORS)?.textContent ?? ""),
    hireRate:         parseHireRate(queryFirst(document, CLIENT_HIRE_RATE_SELECTORS)?.textContent ?? ""),
    reviews:          parseCount(queryFirst(document, CLIENT_REVIEWS_SELECTORS)?.textContent ?? ""),
    memberSinceDays:  parseMemberSinceDays(queryFirst(document, CLIENT_MEMBER_SINCE_SELECTORS)?.textContent ?? ""),
    country:          queryFirst(document, CLIENT_LOCATION_SELECTORS)?.textContent?.trim() || undefined,
    verified:         !!queryFirst(document, CLIENT_VERIFIED_SELECTORS),
    jobsPosted:       parseCount(queryFirst(document, CLIENT_JOBS_POSTED_SELECTORS)?.textContent ?? ""),
    pageUrl:          window.location.href,
    anchorElement:    titleEl,
    badgeId:          `ss-upwork-${urlToCacheKey(window.location.href)}`,
  };
}

function scrapeJobCard(card: Element, index: number): ScrapedJob | null {
  const titleEl = queryFirst(card, CARD_TITLE_SELECTORS);
  if (!titleEl) return null;
  const title = titleEl.textContent?.trim() ?? "";
  if (!title || title.length < 3) return null;

  const link   = card.querySelector<HTMLAnchorElement>("a[href*='/jobs/']");
  const jobUrl = link ? new URL(link.href, window.location.origin).href
                       : window.location.href + `#card-${index}`;

  return {
    jobTitle:        title,
    jobDescription:  title,
    budget:          queryFirst(card, CARD_BUDGET_SELECTORS)?.textContent?.trim() || undefined,
    reviews: undefined, memberSinceDays: undefined, totalSpend: undefined,
    hireRate: undefined, country: undefined, verified: false, jobsPosted: undefined,
    pageUrl:         jobUrl,
    anchorElement:   titleEl,
    badgeId:         `ss-upwork-card-${index}-${urlToCacheKey(jobUrl)}`,
  };
}

// ─── Analysis & Injection ─────────────────────────────────────────────────────

let _activeRequests = 0;

async function analyzeAndBadge(job: ScrapedJob): Promise<void> {
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
        reviews:           job.reviews,
        member_since_days: job.memberSinceDays,
        total_spend:       job.totalSpend,
        hire_rate:         job.hireRate,
        country:           job.country,
        verified:          job.verified,
        jobs_posted:       job.jobsPosted,
      },
    };

    const response = await analyzeJobPosting(request);
    const verdict  = response.verdict as Verdict;
    const entry: CacheEntry = {
      score: response.pre_engage_score, verdict,
      redFlags: response.red_flags ?? [],
      topPatternType: response.similar_patterns?.[0]?.type,
      cachedAt: Date.now(),
    };
    await setCached(cacheKey, entry);

    const anchor = job.anchorElement.isConnected
      ? job.anchorElement
      : queryFirst(document, JOB_TITLE_SELECTORS) ?? job.anchorElement;

    injectBadge(anchor,
      { badgeId: job.badgeId, score: entry.score, verdict: entry.verdict,
        redFlags: entry.redFlags, topPatternType: entry.topPatternType, platform: PLATFORM },
      "after");

    console.log(`[ShadowSense] Upwork job: "${job.jobTitle}" → ${entry.score} ${entry.verdict}`);
  } catch (err) {
    console.warn("[ShadowSense] Upwork pre-engage failed:", err);
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
  if (isJobDetailPage()) {
    const job = scrapeJobDetailPage();
    if (job) await analyzeAndBadge(job);
    return;
  }
  if (isSearchPage()) {
    const cards = queryAll(document, JOB_CARD_SELECTORS).slice(0, MAX_CONCURRENT * 2);
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
    if (isSearchPage()) void scanPage().catch(() => { /* silent */ });
  }, 700);
}).observe(document.body, { childList: true, subtree: true });

// ─── Entry point ──────────────────────────────────────────────────────────────

(function main(): void {
  console.log("[ShadowSense] Upwork pre-engage script loaded.");
  void scanPage().catch((err) => console.error("[ShadowSense] Upwork scan error:", err));
})();
