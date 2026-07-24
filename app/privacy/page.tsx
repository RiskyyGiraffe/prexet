import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Prexet",
  description: "How Prexet handles personal, project, and Google user data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="July 24, 2026">
      <p>This policy explains how Prexet collects, uses, and shares information when you use our document workflow and email services.</p>

      <LegalSection title="Information we collect">
        <p>We collect account information such as your name, email address, and basic Google profile information; project information such as recipient details, documents, instructions, redlines, email drafts, and attachments; and technical information such as device, IP address, usage, and security logs.</p>
        <p>If you connect Gmail, we store encrypted OAuth tokens and the Gmail address you connect. Sending access is used for messages you direct us to send. If you separately enable optional inbox search, Prexet also stores a searchable copy of Gmail message headers and text so you can find and ask questions about your email. Inbox search is off by default, and attachment files are not downloaded into the inbox index.</p>
      </LegalSection>

      <LegalSection title="How we use information">
        <p>We use information to authenticate users; operate, secure, support, and improve Prexet; process documents; generate requested AI-assisted output; prepare and send emails; prevent misuse; and comply with law. We may use aggregated or de-identified information to analyze and improve the service.</p>
        <p>We do not sell personal information or Google user data, use Google user data for advertising, or use Google user data to train generalized AI models.</p>
      </LegalSection>

      <LegalSection title="AI processing">
        <p>When you request an AI feature, relevant documents, text, instructions, or a limited set of retrieved email messages may be sent to an AI service provider acting for us. Inbox questions do not send your entire mailbox to the AI provider. Do not submit information you lack authority to process.</p>
      </LegalSection>

      <LegalSection title="How we share information">
        <p>We may share information with infrastructure, database, authentication, email, storage, security, and AI vendors that help operate Prexet; with recipients when you direct us to send content; when required by law or to protect rights and safety; or in connection with a financing, merger, acquisition, or sale of the service. Vendors may process information only for the services they provide to us.</p>
      </LegalSection>

      <LegalSection title="Google API data">
        <p>Prexet&apos;s use and transfer of information received from Google APIs complies with the <a className="text-black underline underline-offset-4" href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including its Limited Use requirements. Gmail access is used only for user-facing sending and optional inbox-search features you initiate.</p>
        <p>Inbox access is read-only. Prexet and its AI do not delete, move, archive, label, edit, or reply to Gmail messages. Prexet does not use Google user data for advertising, credit decisions, or training generalized AI models.</p>
      </LegalSection>

      <LegalSection title="Retention and choices">
        <p>We retain information for as long as reasonably needed to provide the service, meet legal and security obligations, resolve disputes, and maintain backups. You may turn off inbox search or disconnect Gmail in account settings. Turning off inbox search stops future synchronization and AI inbox queries; disconnecting revokes the provider connection. You may request deletion of your Prexet account or stored data by contacting us. The AI itself has no deletion capability.</p>
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
