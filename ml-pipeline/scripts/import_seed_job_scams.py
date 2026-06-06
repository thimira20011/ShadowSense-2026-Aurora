"""
ml-pipeline/scripts/import_seed_job_scams.py
=============================================
Seeds the ChromaDB ``job_scam_patterns`` collection with ~35 realistic
fraudulent job posting templates covering all major scam categories.

Run from the repository root:

    python ml-pipeline/scripts/import_seed_job_scams.py
    python ml-pipeline/scripts/import_seed_job_scams.py --reset
    python ml-pipeline/scripts/import_seed_job_scams.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_REPO_ROOT / "ml-pipeline"))

from embeddings import (           # type: ignore
    EmbeddingsGenerator,
    JOB_SCAM_COLLECTION,
    _get_chroma_collection,
    _DEFAULT_DB_DIR,
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Seed data — 35 fraudulent job posting templates
# ---------------------------------------------------------------------------

SEED_RECORDS = [
    # ── Off-platform payment / redirect ─────────────────────────────────────
    {
        "id": "job_scam_001",
        "text": "I need a talented developer for a long-term project. Pay is $500 upfront but you must send me a processing fee of $50 via Western Union first to confirm your commitment. Once I receive it I will send you the project files.",
        "type": "advance_fee", "category": "processing_fee_scam", "severity": 10,
        "red_flags": ["advance fee", "Western Union", "processing fee before work"],
    },
    {
        "id": "job_scam_002",
        "text": "We are looking for freelancers for data entry work. Payment $200/day. Contact us on WhatsApp only: +1-555-0100. Do NOT communicate through the platform — we prefer direct contact for confidentiality.",
        "type": "off_platform", "category": "whatsapp_redirect", "severity": 9,
        "red_flags": ["WhatsApp redirect", "off-platform communication demand"],
    },
    {
        "id": "job_scam_003",
        "text": "Hiring logo designers urgently. $300 per logo, paid via Bitcoin only. You must complete a free trial design first to demonstrate your skill.",
        "type": "unpaid_trial", "category": "crypto_payment_trial", "severity": 8,
        "red_flags": ["bitcoin only", "unpaid trial work"],
    },
    # ── Invoice redirect scam (matches scenario_21) ─────────────────────────
    {
        "id": "job_scam_004",
        "text": "I want to pay for your work but the platform payment is not working today. Can you send me an invoice to my personal email moneytransfer99@protonmail.com? I will pay by bank transfer and add a 20% tip for the trouble.",
        "type": "off_platform", "category": "invoice_redirect", "severity": 9,
        "red_flags": ["off-platform invoice request", "protonmail email", "tip bait", "fabricated payment failure"],
    },
    {
        "id": "job_scam_005",
        "text": "Our payment system is down. Please send your invoice to billing@secure-payments-gateway.net and we will wire you directly. We add a 15% bonus for patience.",
        "type": "off_platform", "category": "invoice_redirect", "severity": 9,
        "red_flags": ["external invoice email", "payment system excuse", "bonus bait"],
    },
    # ── Money mule ──────────────────────────────────────────────────────────
    {
        "id": "job_scam_006",
        "text": "Need a freelancer to receive payments on our behalf to our personal bank account and forward funds via wire transfer after deducting your 15% commission. Work from home, no experience needed, $800/week guaranteed.",
        "type": "money_mule", "category": "payment_forwarding", "severity": 10,
        "red_flags": ["money mule", "receive payments on behalf", "wire transfer forwarding"],
    },
    {
        "id": "job_scam_007",
        "text": "We need a mystery shopper to test our payment processors. You will receive a check by mail, deposit it, purchase gift cards (iTunes, Google Play), and send us the codes within 24 hours. Keep $50 for your time.",
        "type": "money_mule", "category": "mystery_shopper_gift_card", "severity": 10,
        "red_flags": ["mystery shopper", "gift card codes", "fake check"],
    },
    # ── Fake escrow ──────────────────────────────────────────────────────────
    {
        "id": "job_scam_008",
        "text": "I will pay you through a third-party escrow service outside Fiverr for security. The escrow company will hold the $1200 and release it once the project is complete. Please click the link I'll send you to register.",
        "type": "fake_escrow", "category": "third_party_escrow", "severity": 9,
        "red_flags": ["fake escrow", "third-party payment outside platform"],
    },
    # ── Identity / credential harvest ───────────────────────────────────────
    {
        "id": "job_scam_009",
        "text": "Our company uses a secure payment portal for all freelancer transactions. I'll need your full name, address, and bank routing number to set up direct deposit. All details are encrypted and secure.",
        "type": "identity_theft", "category": "bank_detail_harvest", "severity": 10,
        "red_flags": ["bank routing number request", "personal information harvest"],
    },
    {
        "id": "job_scam_010",
        "text": "Congratulations! You have been selected for a remote data entry position. To complete your onboarding, please upload a scan of your national ID or passport and a selfie with the document. Salary: $1800/month.",
        "type": "identity_theft", "category": "document_harvest_fake_job", "severity": 10,
        "red_flags": ["ID/passport upload request", "selfie with document", "unsolicited job offer"],
    },
    # ── Malware delivery ─────────────────────────────────────────────────────
    {
        "id": "job_scam_011",
        "text": "Download the project brief and creative assets from this link: http://bit.ly/proj-files2025. You must install the preview client (setup.exe) to view the protected design files. Budget: $650. Reply fast.",
        "type": "malware", "category": "malicious_executable_delivery", "severity": 10,
        "red_flags": ["setup.exe download", "shortened link"],
    },
    {
        "id": "job_scam_012",
        "text": "I'm working on a confidential app. Run this Python script on your machine first to verify that your environment meets our requirements before I share the brief. Script link in my profile.",
        "type": "malware", "category": "remote_access_script", "severity": 9,
        "red_flags": ["run script before details shared", "remote access potential"],
    },
    {
        "id": "job_scam_013",
        "text": "Junior IT support technician needed for testing. Install our remote monitoring tool (TeamViewer alternative) from the link in my profile to allow real-time collaboration. Budget $300. Must be available today.",
        "type": "malware", "category": "rat_remote_access_tool", "severity": 9,
        "red_flags": ["remote access tool installation", "urgent same-day start"],
    },
    # ── Pay-to-work / kit scam ───────────────────────────────────────────────
    {
        "id": "job_scam_014",
        "text": "Work from home data entry job. $350/week. You will need to purchase our proprietary data-processing software kit ($99) before starting. The kit fee is reimbursed in your first paycheck.",
        "type": "pay_to_work", "category": "equipment_software_kit", "severity": 8,
        "red_flags": ["pay for software kit before work", "reimbursement promise"],
    },
    # ── Overpayment / fake check ─────────────────────────────────────────────
    {
        "id": "job_scam_015",
        "text": "I'll send you a check for $2000 for the $400 project. Please cash it and send the remaining $1600 to my vendor via Zelle immediately. This is standard for our international payment process.",
        "type": "overpayment", "category": "fake_check_overpayment", "severity": 10,
        "red_flags": ["overpayment check scam", "Zelle transfer", "cash and forward"],
    },
    # ── Phishing ─────────────────────────────────────────────────────────────
    {
        "id": "job_scam_016",
        "text": "Click here to verify your Fiverr seller account and claim your $250 bonus: http://fiverr-verify-seller.com/claim. Your account may be suspended if you don't verify within 48 hours.",
        "type": "phishing", "category": "platform_credential_phishing", "severity": 10,
        "red_flags": ["phishing link", "account suspension threat", "fake bonus"],
    },
    {
        "id": "job_scam_017",
        "text": "Your Upwork payment is on hold. Sign in at http://upwork-payments.secure-verify.net to release your funds. Failure to verify within 24 hours will result in account closure.",
        "type": "phishing", "category": "payment_hold_phishing", "severity": 10,
        "red_flags": ["fake payment hold", "phishing URL", "account closure threat"],
    },
    {
        "id": "job_scam_018",
        "text": "Remote QA tester needed. You will test our internal web app. Login credentials will be sent by email — please use your personal email password on the test login form so we can verify identity.",
        "type": "phishing", "category": "credential_spear_phish", "severity": 10,
        "red_flags": ["use personal email password on form", "credential phishing"],
    },
    # ── Reshipping / package forwarding ──────────────────────────────────────
    {
        "id": "job_scam_019",
        "text": "We need a package forwarding agent in your country. Receive packages at your home address and forward them internationally. $75 per package. No experience needed. Work from home. Immediate start.",
        "type": "money_mule", "category": "reshipping_package_forwarding", "severity": 9,
        "red_flags": ["reshipping agent", "receive packages at home"],
    },
    # ── Crypto / investment scam ─────────────────────────────────────────────
    {
        "id": "job_scam_020",
        "text": "Join our crypto trading team as a remote analyst. $1500/week guaranteed. You will manage client accounts on our proprietary trading platform. Initial deposit of $200 USDT required to unlock your analyst dashboard.",
        "type": "crypto_scam", "category": "fake_trading_job", "severity": 10,
        "red_flags": ["crypto deposit required", "guaranteed earnings", "fake trading platform"],
    },
    {
        "id": "job_scam_021",
        "text": "NFT promoter wanted. Your job is to promote our NFT collection on social media. Pay is 0.1 ETH per post. To receive payment you must first hold 0.05 ETH in a wallet we provide and stake it as a performance bond.",
        "type": "crypto_scam", "category": "nft_performance_bond", "severity": 9,
        "red_flags": ["crypto stake required", "fake NFT promotion job"],
    },
    # ── Fake customer service / refund mule ──────────────────────────────────
    {
        "id": "job_scam_022",
        "text": "Work from home customer service rep. $22/hr. You will process refund requests for our e-commerce store. You'll use your personal PayPal to process refunds and be reimbursed weekly by our finance team.",
        "type": "money_mule", "category": "fake_customer_service", "severity": 9,
        "red_flags": ["personal PayPal for refunds", "reimbursement promise"],
    },
    # ── Fake review / social media farm ──────────────────────────────────────
    {
        "id": "job_scam_023",
        "text": "I will pay you $5 per review left on our Amazon product page. You must purchase the product first and I'll refund via PayPal plus $5 bonus. 50 reviews needed. Quick turnaround.",
        "type": "fake_reviews", "category": "paid_review_manipulation", "severity": 7,
        "red_flags": ["purchase first refund later", "fake review scheme"],
    },
    {
        "id": "job_scam_024",
        "text": "Get paid to follow accounts and like posts. $1 per action. Minimum 500 actions required per day. Paid daily via cryptocurrency. Must download our task app first at http://clickjob-app.com.",
        "type": "click_farm", "category": "social_media_farm", "severity": 7,
        "red_flags": ["suspicious app download", "click farm"],
    },
    # ── Illegal requests ─────────────────────────────────────────────────────
    {
        "id": "job_scam_025",
        "text": "Need a developer to crack the license verification of commercial software. Must be done quietly — no NDAs, no contracts, private deal only. $250 paid in Monero.",
        "type": "illegal_request", "category": "software_crack", "severity": 9,
        "red_flags": ["software crack request", "Monero payment", "private deal no contract"],
    },
    {
        "id": "job_scam_026",
        "text": "Scrape personal contact details (names, emails, phone numbers) from LinkedIn for our cold email marketing database. 10,000 records needed. $150 flat fee, paid after delivery.",
        "type": "illegal_request", "category": "gdpr_violating_scrape", "severity": 7,
        "red_flags": ["LinkedIn scraping", "personal data harvest"],
    },
    {
        "id": "job_scam_027",
        "text": "Looking for someone with contacts inside a telecom provider who can help port a phone number to a new SIM. Discreet. Pays $500 per successful port. Contact Telegram only.",
        "type": "illegal_request", "category": "sim_swap_solicitation", "severity": 10,
        "red_flags": ["SIM swap", "telecom insider fraud", "Telegram only"],
    },
    # ── Fake government / NGO contract ───────────────────────────────────────
    {
        "id": "job_scam_028",
        "text": "We are looking for a contractor for a USAID-funded project. You must cover your own travel expenses upfront ($400 flights) and be reimbursed upon arrival. Please wire the funds to our logistics coordinator to hold your slot.",
        "type": "advance_fee", "category": "fake_government_contract", "severity": 10,
        "red_flags": ["fake government contract", "advance travel expense", "wire transfer to coordinator"],
    },
    # ── Background check fee ─────────────────────────────────────────────────
    {
        "id": "job_scam_029",
        "text": "You have been shortlisted for a senior developer role at our stealth startup. Before we can share project details you must sign and return the attached NDA and pay a $30 background check fee via Venmo. Interview on Zoom next week.",
        "type": "advance_fee", "category": "background_check_fee", "severity": 8,
        "red_flags": ["background check fee", "NDA before details", "Venmo payment"],
    },
    # ── Pyramid / MLM ────────────────────────────────────────────────────────
    {
        "id": "job_scam_030",
        "text": "Join our affiliate network and earn unlimited income by recruiting 5 members. Start-up kit costs $49. You earn $20 per recruit. Our top earners make $5000/month. Work from anywhere. Passive income guaranteed.",
        "type": "pyramid_scheme", "category": "mlm_recruitment", "severity": 8,
        "red_flags": ["pyramid recruitment", "pay to join", "guaranteed passive income"],
    },
    # ── Fake PA / personal assistant card mule ───────────────────────────────
    {
        "id": "job_scam_031",
        "text": "My company needs a personal assistant. The role involves travel bookings, managing my schedule, and making payments on my behalf from a company card I will post to you. Salary $3000/month. Very flexible hours, can start immediately.",
        "type": "personal_assistant", "category": "fake_pa_card_mule", "severity": 8,
        "red_flags": ["company card posted to you", "make payments on behalf"],
    },
    # ── Brand ambassador buy-and-review ──────────────────────────────────────
    {
        "id": "job_scam_032",
        "text": "Brand ambassador needed. Purchase our product at full price from Amazon ($75), post an honest review with photos, and we will send you a full refund plus $30 bonus within 72 hours. 20 ambassadors selected each week.",
        "type": "fake_reviews", "category": "buy_and_review_scam", "severity": 7,
        "red_flags": ["purchase before refund", "amazon review manipulation"],
    },
    # ── Confidentiality bond ─────────────────────────────────────────────────
    {
        "id": "job_scam_033",
        "text": "Translate 50 confidential legal documents from English to French. Documents contain personal information. You must sign a $200 confidentiality bond (refundable) wired to our legal team before accessing the files.",
        "type": "advance_fee", "category": "confidentiality_bond", "severity": 9,
        "red_flags": ["confidentiality bond wire", "advance payment for document access"],
    },
    # ── HR / payroll credential harvest ──────────────────────────────────────
    {
        "id": "job_scam_034",
        "text": "HR assistant wanted. Update payroll records for 30 employees in our HRIS system. You must verify your own identity by entering your SSN and bank details in the admin portal before getting access. $25/hr, remote.",
        "type": "identity_theft", "category": "hr_credential_harvest", "severity": 10,
        "red_flags": ["SSN collection", "bank details before access", "fake HR job"],
    },
    # ── Account selling ──────────────────────────────────────────────────────
    {
        "id": "job_scam_035",
        "text": "Top-Rated badge seller on Fiverr. I can share my verified account with you for $150 so you can start selling immediately with 5-star reputation. Account has 200+ reviews and 4.9 rating. PayPal only.",
        "type": "account_fraud", "category": "account_selling", "severity": 7,
        "red_flags": ["selling platform account", "fake reputation access"],
    },
]


def import_seed_data(reset: bool = False, dry_run: bool = False) -> None:
    generator  = EmbeddingsGenerator()
    collection = _get_chroma_collection(db_dir=_DEFAULT_DB_DIR,
                                        collection_name=JOB_SCAM_COLLECTION)

    if reset and not dry_run:
        log.info("--reset: dropping collection '%s' ...", JOB_SCAM_COLLECTION)
        import chromadb
        client = chromadb.PersistentClient(path=str(_DEFAULT_DB_DIR))
        client.delete_collection(JOB_SCAM_COLLECTION)
        collection = _get_chroma_collection(_DEFAULT_DB_DIR, JOB_SCAM_COLLECTION)

    log.info("Preparing %d seed records for '%s' ...", len(SEED_RECORDS), JOB_SCAM_COLLECTION)

    ids       = [r["id"]   for r in SEED_RECORDS]
    texts     = [r["text"] for r in SEED_RECORDS]
    metadatas = [
        {
            "type":      r["type"],
            "category":  r["category"],
            "severity":  r["severity"],
            "red_flags": json.dumps(r["red_flags"], ensure_ascii=False),
        }
        for r in SEED_RECORDS
    ]

    if dry_run:
        log.info("[DRY RUN] Would import %d records. First 3:", len(ids))
        for i in range(min(3, len(ids))):
            log.info("  %s: %s...", ids[i], texts[i][:80])
        return

    log.info("Generating embeddings for %d documents ...", len(texts))
    vectors = generator.embed_batch(texts)
    log.info("Upserting into ChromaDB ...")

    collection.upsert(ids=ids, documents=texts, embeddings=vectors, metadatas=metadatas)

    log.info("✅  Done. '%s' now contains %d document(s).",
             JOB_SCAM_COLLECTION, collection.count())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed ChromaDB job_scam_patterns collection.")
    parser.add_argument("--reset",   action="store_true",
                        help="Drop and recreate collection before importing.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be imported without writing.")
    args = parser.parse_args()
    import_seed_data(reset=args.reset, dry_run=args.dry_run)
