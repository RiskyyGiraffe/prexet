import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Prexet",
  description: "Terms governing use of Prexet.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="July 18, 2026">
      <p>These terms govern your use of Prexet. By using the service, you agree to them. If you use Prexet for an organization, you represent that you may bind that organization.</p>

      <LegalSection title="The service">
        <p>Prexet provides document, recipient, workflow, AI-assisted review, and email transmission tools. You must be at least 18 and may use the service only in compliance with law.</p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>You are responsible for your account, connected mailboxes, credentials, and activity. Give us accurate information and notify us of unauthorized use. We may limit, suspend, or terminate access to protect the service or others.</p>
      </LegalSection>

      <LegalSection title="Your content and instructions">
        <p>You retain ownership of content you submit. You give Prexet a limited license to host, process, transmit, reproduce, and modify that content as needed to operate, secure, support, and improve the service. You represent that you have the necessary rights, permissions, and lawful basis to provide recipient information, documents, and instructions.</p>
        <p>We may use aggregated or de-identified information to operate, analyze, improve, and develop Prexet. Feedback may be used without restriction or compensation.</p>
      </LegalSection>

      <LegalSection title="Email and connected services">
        <p>You control when Prexet sends an email. You are responsible for recipients, content, attachments, consent, anti-spam compliance, and use of connected Google or other third-party services. Third-party terms also apply.</p>
      </LegalSection>

      <LegalSection title="AI and professional review">
        <p>AI output may be incomplete or wrong. Prexet does not provide legal, financial, or other professional advice and is not a substitute for professional judgment. You are responsible for reviewing documents, redlines, summaries, recipients, and messages before relying on or sending them.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Do not use Prexet to violate law or third-party rights; send spam or deceptive content; distribute malware; access accounts or data without authorization; interfere with the service; or reverse engineer the service except where law permits.</p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>The service may change, experience errors or interruptions, impose limits, or discontinue features at any time. Beta and preview features may be changed or removed. Any future charges will be disclosed before they apply.</p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>To the maximum extent permitted by law, Prexet is provided “as is” and “as available,” without warranties of accuracy, availability, fitness, merchantability, non-infringement, or any particular result.</p>
        <p>To the maximum extent permitted by law, Prexet and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost data, profits, business, or opportunities. Total liability for claims relating to the service will not exceed the greater of $100 or the amount you paid Prexet during the 12 months before the claim.</p>
      </LegalSection>

      <LegalSection title="Indemnity and termination">
        <p>You will defend and indemnify Prexet and its operators from claims arising from your content, instructions, recipients, unlawful use, or violation of these terms. You may stop using the service at any time. Provisions that should reasonably survive termination will survive.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>We may update these terms by posting a revised version. Continued use after the effective date means you accept the revised terms. Questions may be sent to <a className="text-black underline underline-offset-4" href="mailto:privacy@prexet.com">privacy@prexet.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
