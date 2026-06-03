# ShadowSense AI — Scam Pattern Research

This document collects real-world freelance scam patterns used to design ShadowSense AI detection rules, test scenarios, warning messages, and demo cases. The threat intelligence is drawn from Fiverr, Upwork, freelance communities, and public scam advisories.

## How to read this document
Each example includes:
- **Text**: Actual message, excerpt, or behavior summary.
- **Type**: Standardized as `phishing` | `malware` | `impersonation` | `urgency` | `info-harvesting`.
- **Platform**: Identified target or origin platform (`Fiverr` | `Upwork` | `WhatsApp` | `Telegram` | `General`).
- **Red Flags**: Bulleted list of fraud indicators.
- **Outcome**: The consequence of the scam if successful.
- **Severity**: Threat score from 1 to 10.
- **ShadowSense Agent Mapping**: Shows which agents detect the threat and the expected intervention tier.

---

## 1. Off-Platform Luring Scams

### Example 01: Off-Platform Telegram Invitation
- **Text**: "Please add me on Telegram at @username so we can discuss the project details and get started immediately."
- **Type**: `impersonation` (off-platform luring)
- **Platform**: Fiverr
- **Red Flags**:
  - Attempting to communicate outside platform boundaries.
  - Urgency in request ("get started immediately").
  - Circumvention of platform safety frameworks.
- **Outcome**: Leads to unchecked payment fraud, phishing funnels, or credential theft.
- **Severity**: 8/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: High-confidence match on Telegram patterns.
  - **Identity Profiler**: Check sender's account age and verification status.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40) or **Advisory Warning** (Score: 40–69).

### Example 02: Community Spam outreach
- **Text**: "I have a great opportunity for you. Let's switch to Telegram to discuss."
- **Type**: `impersonation`
- **Platform**: Fiverr
- **Red Flags**:
  - Unsolicited direct message.
  - Request to move to Telegram.
- **Outcome**: Exposure to malicious links or fake job offers.
- **Severity**: 8/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags the off-platform request.
  - **Identity Profiler**: Flags zero-review or newly registered accounts.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 03: Upwork Communication Bypassing
- **Text**: "I cannot use Upwork messaging. Send me a message on WhatsApp or Telegram to proceed."
- **Type**: `impersonation`
- **Platform**: Upwork
- **Red Flags**:
  - Refusal to use the platform's messaging tool.
  - Bypassing platform payment protection and traceability rules.
- **Outcome**: Hidden payment manipulation or contract fraud.
- **Severity**: 8/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags the words "WhatsApp" and "Telegram" accompanied by refusal phrases.
  - **Identity Profiler**: Checks payment verification status.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 04: Rapid Platform Escape
- **Text**: "Hi, I like your gig. Contact me on Telegram ASAP."
- **Type**: `impersonation`
- **Platform**: Fiverr
- **Red Flags**:
  - Rapid shift to off-platform communication.
  - High urgency pressure ("ASAP").
- **Outcome**: Unprotected communication funnel leading to financial exploitation.
- **Severity**: 8/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects urgency + off-platform migration cues.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 05: Brand-Impersonating WhatsApp Offer
- **Text**: "Hello, I am a hiring manager from Upwork. We have reviewed your profile and want to offer you a job. Contact us on WhatsApp."
- **Type**: `impersonation`
- **Platform**: WhatsApp
- **Red Flags**:
  - Using a reputable platform's brand name on an external chat application.
  - Unrealistic hiring process (offering job without interview).
- **Outcome**: Credential phishing, personal data theft, or fake check scam.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects authority impersonation and brand spoofing.
  - **Identity Profiler**: Flags the phone number mismatch with official channels.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

---

## 2. Impersonation Scams

### Example 06: Official Staff Impersonation
- **Text**: "This is FTC support. We detected suspicious activity on your account. Send $500 to verify your identity."
- **Type**: `impersonation`
- **Platform**: General
- **Red Flags**:
  - Pretending to represent a government agency (FTC).
  - Out-of-band payment demand.
- **Outcome**: Direct financial loss and identity fraud.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags authority-asserting terms ("FTC support", "verify").
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 07: Urgency-Driven Corporate Imposter
- **Text**: "I am a manager at [Known Company]. Your account is flagged for violating policies. You must verify your details immediately or face legal action."
- **Type**: `urgency`
- **Platform**: General
- **Red Flags**:
  - Demands immediate action.
  - Severe threat pressure ("legal action").
  - Request for confidential credentials or verification files.
- **Outcome**: Immediate account takeover or personal data exfiltration.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects psychological manipulation and legal threats.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 08: Account Creation Abuse
- **Text**: "Can you create an Upwork account for me using your ID? I will pay you 20% of my monthly earnings."
- **Type**: `info-harvesting`
- **Platform**: Upwork
- **Red Flags**:
  - Request to share or create account credentials.
  - Promise of passive revenue splitting.
- **Outcome**: Permanent platform ban, identity theft, and potential legal liability.
- **Severity**: 8/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags key phrases like "create account", "using your ID".
  - **Identity Profiler**: Identifies anomalies in behavior.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 09: Multi-Platform Account Subletting
- **Text**: "I am a developer from Asia. I want to rent your Fiverr and Upwork accounts to get jobs. I will pay $150 a week."
- **Type**: `impersonation`
- **Platform**: General
- **Red Flags**:
  - Asking to rent, lease, or buy user accounts.
  - Financial incentives for policy violations.
- **Outcome**: Theft of funds, chargeback liability, and account suspension.
- **Severity**: 8/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags account leasing offers.
  - **Identity Profiler**: Checks for suspicious access locations.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 10: WhatsApp Move with Brand Abuse
- **Text**: "Fiverr Support Notice: Please verify your contact information by message on WhatsApp link: wa.me/number."
- **Type**: `impersonation`
- **Platform**: WhatsApp
- **Red Flags**:
  - Support notices sent via third-party chat platforms.
  - Immediate action requested via a redirect link.
- **Outcome**: Identity compromise and malware payload delivery.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects support branding impersonation.
  - **Payload Auditor**: Evaluates the destination URL.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 11: Identity Spoofing
- **Text**: "Hello, I am [Real Name] from [Real Company]. Let's discuss a job." (Sends fake/spoofed ID verification image).
- **Type**: `impersonation`
- **Platform**: General
- **Red Flags**:
  - Over-eagerness to send proof of identity before being asked.
  - Discrepancy in metadata or low-quality verification document images.
- **Outcome**: Fake job or financial check scam.
- **Severity**: 7/10
- **ShadowSense Agent Mapping**:
  - **Identity Profiler**: Cross-references sender data, flags mismatched profile information.
  - **Shield Orchestrator**: Triggers **Advisory Warning** (Score: 40–69).

---

## 3. Phishing Scams

### Example 12: Payment Verification Link
- **Text**: "Your Fiverr order is ready, but you need to verify your billing information before receiving it. Click here: fiverr-payment-verify.xyz"
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - Non-official domain name mimicking Fiverr (`fiverr-payment-verify.xyz`).
  - Request to verify billing details.
- **Outcome**: Theft of credit card or bank credentials.
- **Severity**: 10/10
- **ShadowSense Agent Mapping**:
  - **Payload Auditor**: Identifies non-standard domains (typosquatting).
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 13: Billing Issues Account Suspension
- **Text**: "Attention: Your Upwork account will be suspended in 24 hours due to a billing discrepancy. Click the attachment to fix it."
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - Urgency ("suspended in 24 hours").
  - Account actions requested via email attachments.
- **Outcome**: Malware infection or credential harvest.
- **Severity**: 10/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Identifies suspension and urgency triggers.
  - **Payload Auditor**: Scans the attachment.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 14: Unexpected Link Attachment
- **Text**: "I have uploaded the requirements to this secure drive. Download them from here: secure-googledrive-shares.com"
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - Use of lookalike cloud storage domains.
  - Request to download unspecified file assets.
- **Outcome**: Stolen credentials or session token hijacking.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Payload Auditor**: Flags fake Google Drive domains.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 15: Isolated Support Verification
- **Text**: "To solve your issue, communicate only with our specialized live chat at helper-desk.net. Do not use the platform dashboard."
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - Active discouragement of using official platform support.
  - Redirection to a self-contained chat interface.
- **Outcome**: Compromise of login credentials and financial details.
- **Severity**: 8/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags support redirection phrases.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 16: Fake Security Warning
- **Text**: "We noticed a login from a new device. If this was not you, please secure your account immediately at secure-login-link.com"
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - Security warnings originating from unverified external senders.
  - Links to unofficial authentication portals.
- **Outcome**: Loss of account access.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Payload Auditor**: Discovers misleading login forms.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

---

## 4. Payment Fraud and Fake Payment Scams

### Example 17: Payment Delay Excuses
- **Text**: "The finance department is experiencing issues. We will transfer your funds next week. Please complete the work first."
- **Type**: `impersonation`
- **Platform**: General
- **Red Flags**:
  - Excuses regarding system or billing delays.
  - Expecting delivery of work without escrow or deposit confirmation.
- **Outcome**: Freelancer delivers work but receives no payment.
- **Severity**: 7/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects deferment and delay patterns.
  - **Identity Profiler**: Cross-references user verification.
  - **Shield Orchestrator**: Triggers **Advisory Warning** (Score: 40–69).

### Example 18: Unrealistic High Compensation
- **Text**: "I need a simple data entry project completed. It will take 1 hour, and I will pay $1,500. Let's do this now."
- **Type**: `info-harvesting`
- **Platform**: General
- **Red Flags**:
  - Payout is disproportionately high for the effort required.
  - Urgency combined with high payment.
- **Outcome**: Transition into a fake check scam, fee scam, or labor exploitation.
- **Severity**: 6/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags too-good-to-be-true economic details.
  - **Identity Profiler**: Checks for unverified payment indicators.
  - **Shield Orchestrator**: Triggers **Advisory Warning** (Score: 40–69).

### Example 19: Off-Platform Payment Solicitation
- **Text**: "I will pay you directly via PayPal or bank transfer to avoid Upwork fees. I can give you a 10% bonus."
- **Type**: `info-harvesting`
- **Platform**: Upwork
- **Red Flags**:
  - Requests to pay outside platform safeguards.
  - Offers of bonuses or fee avoidance tactics.
- **Outcome**: Non-payment without any recourse from the platform.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects external payment methods (PayPal, Bank transfer).
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 20: High-Pay Upfront Info Harvesting
- **Text**: "We want to hire you for $2,000/week. Before we start, please send your bank account details, routing number, and a copy of your ID."
- **Type**: `info-harvesting`
- **Platform**: Upwork
- **Red Flags**:
  - Requests sensitive personal and banking details before formal contract setup.
  - High salary package offer.
- **Outcome**: Identity theft or unauthorized bank withdrawals.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags requests for banking info ("routing number", "copy of ID").
  - **Identity Profiler**: Checks client reputation.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 21: Cryptographic / Gift Card Payments
- **Text**: "We can only settle payments using Bitcoin or Steam gift cards due to corporate tax reasons."
- **Type**: `info-harvesting`
- **Platform**: General
- **Red Flags**:
  - Demand for non-standard, irreversible currency types.
  - Unusual justification ("tax reasons").
- **Outcome**: Freelancer receives fake checks or stolen card codes, losing real funds.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags cryptocurrency and gift card keywords.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

---

## 5. Unpaid Trial Work Scams

### Example 22: Scope Creep Trial Task
- **Text**: "As a test of your skills, please write a 1,500-word article on this topic. If it is good, we will hire you."
- **Type**: `info-harvesting`
- **Platform**: General
- **Red Flags**:
  - Requesting fully usable work products as a "free test."
  - Large scope for a trial task without payment.
- **Outcome**: The client uses the free sample and cuts communication.
- **Severity**: 6/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags unpaid trial keywords ("test of your skills", "free test").
  - **Shield Orchestrator**: Triggers **Advisory Warning** (Score: 40–69).

### Example 23: Large Unpaid Project
- **Text**: "To join our team, you must design a complete landing page mockup. This is part of our evaluation."
- **Type**: `info-harvesting`
- **Platform**: General
- **Red Flags**:
  - Large test assignments instead of standard portfolio checks.
  - Unclear post-hiring details.
- **Outcome**: The work is stolen, and the developer is not hired.
- **Severity**: 6/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags high-effort test task requests.
  - **Shield Orchestrator**: Triggers **Advisory Warning** (Score: 40–69).

### Example 24: Iterative Free Sample Requests
- **Text**: "Your initial draft was good. Now do a second chapter so we can be sure about your quality."
- **Type**: `info-harvesting`
- **Platform**: General
- **Red Flags**:
  - Multiple sequential requests for free iterations.
  - Postponing formal contract signings.
- **Outcome**: Work is systematically extracted without pay.
- **Severity**: 7/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Identifies incremental request patterns.
  - **Identity Profiler**: Evaluates client history.
  - **Shield Orchestrator**: Triggers **Advisory Warning** (Score: 40–69).

### Example 25: Contract Avoidance
- **Text**: "Let's skip the official contract for this phase. I will pay you via direct transfer upon completion."
- **Type**: `impersonation`
- **Platform**: General
- **Red Flags**:
  - Intentionally avoiding official platform agreements.
  - Refusing to place funds in escrow.
- **Outcome**: Work delivery without payment or arbitration recourse.
- **Severity**: 5/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects contract bypass language.
  - **Identity Profiler**: Cross-references transaction histories.
  - **Shield Orchestrator**: Triggers **Advisory Warning** (Score: 40–69).

---

## 6. Malicious File and Link Scams

### Example 26: Masquerading ZIP Attachment
- **Text**: "I have attached the logo specifications. Please open the zip file: logo_brief.zip" (Contains `logo_brief.exe`).
- **Type**: `malware`
- **Platform**: General
- **Red Flags**:
  - ZIP or RAR attachments containing executable files (`.exe`, `.scr`, `.bat`).
  - Disguised extensions (e.g., `brief.pdf.exe`).
- **Outcome**: Ransomware or credential-stealing malware installation.
- **Severity**: 10/10
- **ShadowSense Agent Mapping**:
  - **Payload Auditor**: Unpacks/scans extension structure and flags executables.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 27: Fake Portal Redirect
- **Text**: "Check our portfolio here to see the style we want: portfolio-design-link.net" (Redirects to a phishing portal).
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - Links to external pages that request third-party site authentication.
- **Outcome**: Credentials harvested via fake login interfaces.
- **Severity**: 10/10
- **ShadowSense Agent Mapping**:
  - **Payload Auditor**: Evaluates redirect destination behaviors.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 28: Official Brand Spoofed Notification
- **Text**: "Security Alert: Mismatched bank card. Go to client-verification-service.com/login."
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - Direct request to log in to fix a transaction failure.
  - Domain typosquatting.
- **Outcome**: Full financial account compromise.
- **Severity**: 10/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Flags the security alert tone.
  - **Payload Auditor**: Analyzes the suspicious login domain.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 29: Urgently Locked Account Notification
- **Text**: "System: Your account is locked due to security policy violations. Click here to unlock: platform-security-check.org"
- **Type**: `phishing`
- **Platform**: General
- **Red Flags**:
  - High urgency threat.
  - Direct call to action linking to unofficial domain.
- **Outcome**: Stolen login tokens or credentials.
- **Severity**: 10/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects authority tone + urgency patterns.
  - **Payload Auditor**: Identifies high-risk domain extensions.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

### Example 30: Isolation Under Pressure
- **Text**: "Do not disconnect from this chat or close this page. The system is verifying your deposit. If you leave, your funds are permanently lost."
- **Type**: `urgency`
- **Platform**: General
- **Red Flags**:
  - Emotional and isolation pressure.
  - Threat of immediate financial penalty.
- **Outcome**: Freelancer complies with further fraud instructions.
- **Severity**: 9/10
- **ShadowSense Agent Mapping**:
  - **Linguistic Analyst**: Detects high-pressure behavioral control.
  - **Shield Orchestrator**: Triggers **High-Risk Block** (Score: <40).

---

## 7. Strategic Synthesis

The 30 examples compiled in this document verify that freelance-oriented scams do not rely on isolated signals. Most combine:
1. **Linguistic Manipulation** (Urgency, fear of missing out, authority claims).
2. **Profile Anomaly** (New accounts, unverified payment).
3. **Payload / Phishing Links** (Direct attempts to bypass platform security).

By feeding this intelligence corpus into ChromaDB, the **Shield Orchestrator** is equipped to run targeted, multi-tiered warnings that protect freelancers dynamically.
