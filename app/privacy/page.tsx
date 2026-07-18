import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Prexet",
  description: "How Prexet handles personal, project, and Google user data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="July 18, 2026">
      <p>This policy explains how Prexet collects, uses, and shares information when you use our document workflow and email services.</p>

      <LegalSection title="Information we collect">
        <p>We collect account information such as your name, email address, and basic Google profile information; project information such as recipient details, documents, instructions, redlines, email drafts, and attachments; and technical information such as device, IP address, usage, and security logs.</p>
        <p>If you connect Gmail, we store encrypted OAuth tokens and the Gmail address you connect. Prexet requests permission to send messages you direct us to send. We do not request permission to read your Gmail inbox.</p>
      </LegalSection>

      <LegalSection title="How we use information">
        <p>We use information to authenticate users; operate, secure, support, and improve Prexet; process documents; generate requested AI-assisted output; prepare and send emails; prevent misuse; and comply with law. We may use aggregated or de-identified information to analyze and improve the service.</p>
        <p>We do not sell personal information or Google user data, use Google user data for advertising, or use Google user data to train generalized AI models.</p>
      </LegalSection>

      <LegalSection title="AI processing">
        <p>When you request an AI feature, relevant documents, text, and instructions may be sent to an AI service provider acting for us. Do not submit information you lack authority to process.</p>
      </LegalSection>

      <LegalSection title="How we share information">
        <p>We may share information with infrastructure, database, authentication, email, storage, security, and AI vendors that help operate Prexet; with recipients when you direct us to send content; when required by law or to protect rights and safety; or in connection with a financing, merger, acquisition, or sale of the service. Vendors may process information only for the services they provide to us.</p>
      </LegalSection>

      <LegalSection title="Google API data">
        <p>Prexet&apos;s use and transfer of information received from Google APIs complies with the Google API Services User Data Policy, including its Limited Use requirements. Gmail access is used only for the user-facing sending features you initiate.</p>
      </LegalSection>

      <LegalSection title="Retention and choices">
        <p>We retain information for as long as reasonably needed to provide the service, meet legal and security obligations, resolve disputes, and maintain backups. You may disconnect Gmail in account settings, which revokes the connection. You may request account or data deletion by contacting us.</p>
      </LegalSection>

      <LegalSection title="Security and international processing">
        <p>We use reasonable safeguards, but no system is completely secure. Information may be processed in the United States and other locations where our providers operate.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>We may update this policy as the service changes. Material changes will be posted here or communicated through the service. Questions and deletion requests may be sent to <a className="text-black underline underline-offset-4" href="mailto:privacy@prexet.com">privacy@prexet.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
