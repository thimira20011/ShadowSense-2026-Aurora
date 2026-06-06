import React, { useState } from 'react';
import {
  IconShieldX,
  IconShieldCheck,
  IconInfoCircle,
  IconLayoutGrid,
} from '@tabler/icons-react';

interface GigListingCardsProps {
  highlightAnchors?: boolean;
}

export const GigListingCards: React.FC<GigListingCardsProps> = ({ highlightAnchors = false }) => {
  const [anchorsActive, setAnchorsActive] = useState(highlightAnchors);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        Your 5-Week Proposal features <b>Pre-Engagement Trust Screening</b>. The browser extension
        scans public Gig cards or Buyer request cards and embeds a floating, non-intrusive safety
        badge on the page. This prevents freelancers from exposing themselves to toxic buyers{' '}
        <i>before</i> starting conversations.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button className="preset-btn" onClick={() => setAnchorsActive(true)}>
          🔍 Highlight Selector Anchors
        </button>
        <button className="preset-btn" onClick={() => setAnchorsActive(false)}>
          ✕ Clear Highlights
        </button>
      </div>

      <div className="block-label">
        <IconLayoutGrid size={14} /> Real-time Gig Listing Injection Preview
      </div>

      <div className="job-board-mock" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Risky Job Card */}
          <div className={`job-card${anchorsActive ? ' highlight-anchor' : ''}`}>
            <div className="job-header">
              <div className={`job-client-row${anchorsActive ? ' anchor-marker' : ''}`}>
                <div
                  className="client-avatar-mock"
                  style={{ background: '#fcebeb', color: '#a32d2d' }}
                >
                  X
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>anon_buyer99</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                    Joined 2 days ago
                  </div>
                </div>
              </div>
              <span
                className="badge-injected"
                style={{
                  background: 'var(--color-risk-bg)',
                  borderColor: 'var(--color-risk-border)',
                  color: 'var(--color-risk-text)',
                }}
              >
                <IconShieldX size={12} /> 18/100 RISK
              </span>
            </div>
            <div className="job-title">Design logo briefing containing raw executable packages</div>
            <div className="job-price">$450</div>
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                borderTop: '1px solid var(--color-border-secondary)',
                paddingTop: 8,
              }}
            >
              <IconInfoCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              Flagged: New account, stock profile image, suspicious budget.
            </div>
          </div>

          {/* Safe Job Card */}
          <div className={`job-card${anchorsActive ? ' highlight-anchor' : ''}`}>
            <div className="job-header">
              <div className={`job-client-row${anchorsActive ? ' anchor-marker' : ''}`}>
                <div
                  className="client-avatar-mock"
                  style={{ background: '#e1f5ee', color: '#0f6e56' }}
                >
                  W
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>well_established</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                    14 Completed Jobs
                  </div>
                </div>
              </div>
              <span
                className="badge-injected"
                style={{
                  background: 'var(--color-clear-bg)',
                  borderColor: 'var(--color-clear-border)',
                  color: 'var(--color-clear-text)',
                }}
              >
                <IconShieldCheck size={12} /> 95/100 SAFE
              </span>
            </div>
            <div className="job-title">SaaS Web Application Redesign UI/UX Project</div>
            <div className="job-price">$1,200</div>
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                borderTop: '1px solid var(--color-border-secondary)',
                paddingTop: 8,
              }}
            >
              <IconInfoCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              Clean: Verified payment method, 5-star historical reviews.
            </div>
          </div>
        </div>
      </div>

      {/* Engineering Guidelines */}
      <div
        style={{
          background: 'rgba(123, 97, 255, 0.05)',
          border: '1px solid rgba(123, 97, 255, 0.2)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#3c3489', marginBottom: 8 }}>
          {'</>'} Engineering Guidelines for Pre-Engagement Injections
        </h4>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
          Your content script (<code>src/content/JobListingBadge.tsx</code>) must monitor the
          container selector <code>.gig-card-layout</code> or similar platform search/briefing
          wrappers. Locate the buyer name meta nodes, make an async call to backend{' '}
          <code>/api/analyze-profile</code>, and insert the floating badge adjacent to the metadata
          header node. Ensure the mutation observer ignores modifications on its own nodes to prevent
          infinite rendering loops.
        </p>
      </div>
    </div>
  );
};
