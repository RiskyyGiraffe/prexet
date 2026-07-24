"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  FileText,
  FolderKanban,
  Inbox,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PrexetMark } from "@/components/prexet-logo";
import { RichTextEmailEditor } from "@/components/rich-text-email-editor";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type PartyStatus = "attention" | "pending" | "accepted" | "no_response";
type TabId = "overview" | "emails" | "documents" | "activity";
type DialogId = "project" | "recipients" | "brief" | "redline" | "email" | "draft" | "navigation" | "stages" | "document" | "account" | "inbox" | null;
type EmailAudience = "all" | "selected";
type MailboxProvider = "google" | "microsoft";
type EmailDraftStatus = "draft" | "ready" | "sent";

type Party = {
  id: string;
  name: string;
  company: string;
  email: string;
  initials: string;
  status: PartyStatus;
  lastTouch: string;
  clauseCount: number;
  editSummary: string;
  aiPosition: string;
  stageId?: string;
};

type ProjectStage = {
  id: string;
  name: string;
  unlockAfterStageId: string | null;
  documentNames: string[];
};

type RecipientDraft = {
  id: string;
  name: string;
  email: string;
  company: string;
  stageId: string;
};

type EmailTemplate = {
  id: string;
  name: string;
  stageId: string;
  subject: string;
  body: string;
};

type EmailDraft = {
  id: string;
  partyId: string;
  stageId: string;
  templateId?: string;
  from: string;
  mailboxId?: string;
  subject: string;
  bodyHtml: string;
  attachmentNames: string[];
  status: EmailDraftStatus;
  customized: boolean;
  updatedAt: string;
};

type MailboxAccount = {
  id: string;
  provider: MailboxProvider;
  email: string;
  displayName: string;
  status: "connected" | "needs_reauth" | "revoked";
  scopes: string[];
  inboxAccessEnabled: boolean;
  inboxSyncStatus: "not_started" | "syncing" | "ready" | "error";
  inboxLastSyncedAt: string | null;
  inboxMessageCount: number;
};

type InboxSettings = {
  onboardingCompleted: boolean;
  enabled: boolean;
};

type InboxEvidence = {
  id: string;
  mailboxEmail: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  snippet: string;
  gmailUrl: string;
};

type Project = {
  id: string;
  title: string;
  reference: string;
  documentName: string;
  due: string;
  round: string;
  owner: string;
  guardrails: string[];
  summary: string;
  parties: Party[];
  activity: string[];
  stages: ProjectStage[];
  emailTemplates: EmailTemplate[];
  emailDrafts: EmailDraft[];
};

type ProjectSeed = Omit<Project, "stages" | "emailTemplates" | "emailDrafts">;

const statusOrder: PartyStatus[] = [
  "attention",
  "pending",
  "accepted",
  "no_response",
];

const statusMeta: Record<
  PartyStatus,
  { label: string; tone: string; dot: string; description: string }
> = {
  attention: {
    label: "Needs review",
    tone: "border-black bg-black text-white",
    dot: "bg-black",
    description: "New markup or requested exceptions",
  },
  pending: {
    label: "Pending",
    tone: "border-zinc-300 bg-zinc-100 text-zinc-800",
    dot: "bg-zinc-600",
    description: "Sent and waiting on edits",
  },
  accepted: {
    label: "Accepted",
    tone: "border-zinc-300 bg-white text-black",
    dot: "bg-zinc-400",
    description: "Within current authority",
  },
  no_response: {
    label: "No response",
    tone: "border-zinc-200 bg-zinc-50 text-zinc-500",
    dot: "bg-zinc-300",
    description: "No activity after delivery",
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function normalizeEmailHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value) ? value : plainTextToHtml(value);
}

function createEmailDraft({
  project,
  party,
  stage,
  template,
  subject,
  body,
}: {
  project: Pick<Project, "id" | "title" | "due">;
  party: Party;
  stage: ProjectStage;
  template?: EmailTemplate;
  subject?: string;
  body?: string;
}): EmailDraft {
  const firstName = party.name.split(" ")[0] || party.name;
  const message = body || template?.body || `Hi ${firstName},\n\nPlease review the attached materials and reply with any questions.`;
  return {
    id: `draft-${project.id}-${stage.id}-${party.id}`,
    partyId: party.id,
    stageId: stage.id,
    templateId: template?.id,
    from: "Choose a connected mailbox",
    subject: subject || template?.subject || `${project.title}: ${stage.name}`,
    bodyHtml: normalizeEmailHtml(message).replaceAll("{{first_name}}", escapeHtml(firstName)),
    attachmentNames: [...stage.documentNames],
    status: "draft",
    customized: false,
    updatedAt: "Just now",
  };
}

const projectSeeds: ProjectSeed[] = [
  {
    id: "morrison-plaza",
    title: "Morrison Plaza Access Agreement",
    reference: "MP-2026-04",
    documentName: "Morrison_Plaza_Access_Agreement_v2.docx",
    due: "Jul 24",
    round: "Round 2",
    owner: "R. Lane",
    guardrails: [
      "Accept restoration cure periods up to 90 days.",
      "Accept insurance certificates with equivalent A-rated carriers.",
      "Do not accept access windows before 7:00 AM without owner approval.",
      "Escalate any indemnity cap below $5M.",
    ],
    summary:
      "Six parties are aligned on access, restoration, and insurance language. Two requests require a business call before the deadline: early maintenance access and a lower indemnity cap.",
    activity: [
      "AI summarized 18 redlines across 4 parties.",
      "Reminder queued for Northline Capital.",
      "Grant & Myers accepted the latest form without edits.",
    ],
    parties: [
      {
        id: "aurora",
        name: "Priya Shah",
        company: "Aurora Retail Group",
        email: "priya.shah@auroraretail.example",
        initials: "PS",
        status: "attention",
        lastTouch: "18 min ago",
        clauseCount: 5,
        editSummary:
          "Requests weekend access rights and a carveout for emergency HVAC work.",
        aiPosition:
          "Accept weekend access with notice. Escalate emergency access if it bypasses the 30-day notice standard.",
      },
      {
        id: "northline",
        name: "Marcus Bell",
        company: "Northline Capital",
        email: "marcus.bell@northline.example",
        initials: "MB",
        status: "attention",
        lastTouch: "47 min ago",
        clauseCount: 3,
        editSummary:
          "Proposes an indemnity cap of $3M and removes the fee reimbursement sentence.",
        aiPosition:
          "Reject the $3M cap under current authority. Fee reimbursement can be allocated to the owner if capped at documented costs.",
      },
      {
        id: "civitas",
        name: "Elena Torres",
        company: "Civitas Engineering",
        email: "elena.torres@civitas.example",
        initials: "ET",
        status: "pending",
        lastTouch: "Yesterday",
        clauseCount: 0,
        editSummary: "Document delivered. No markup returned yet.",
        aiPosition: "No action until a marked copy or response arrives.",
      },
      {
        id: "keystone",
        name: "Andre Coleman",
        company: "Keystone Advisory",
        email: "andre.coleman@keystone.example",
        initials: "AC",
        status: "pending",
        lastTouch: "2 days ago",
        clauseCount: 1,
        editSummary: "Asked for a deadline extension, but no document changes.",
        aiPosition: "Accept a three business day extension if it does not affect closing.",
      },
      {
        id: "grant-myers",
        name: "Dana Wu",
        company: "Grant & Myers LLP",
        email: "dana.wu@grantmyers.example",
        initials: "DW",
        status: "accepted",
        lastTouch: "Today",
        clauseCount: 0,
        editSummary: "Accepted v2 form without redlines.",
        aiPosition: "Mark accepted and include in final closing package.",
      },
      {
        id: "lincoln",
        name: "Owen Park",
        company: "Lincoln Brokerage",
        email: "owen.park@lincoln.example",
        initials: "OP",
        status: "no_response",
        lastTouch: "5 days ago",
        clauseCount: 0,
        editSummary: "No response after initial delivery.",
        aiPosition: "Send a reminder and surface as stale if no response in 24 hours.",
      },
    ],
  },
  {
    id: "atlas-renewal",
    title: "Atlas Renewal Side Letter",
    reference: "AR-2026-11",
    documentName: "Atlas_Renewal_Side_Letter_Form.docx",
    due: "Aug 02",
    round: "Initial send",
    owner: "M. Patel",
    guardrails: [
      "Accept typo fixes and party name corrections.",
      "Do not accept economic term changes without approval.",
      "Escalate assignment rights and termination changes.",
    ],
    summary:
      "Initial package is out to four parties. One recipient has opened the document and none have returned markup.",
    activity: [
      "Email list imported from Atlas_contacts.csv.",
      "Form document attached to outbound package.",
      "AI guardrails saved for economic terms.",
    ],
    parties: [
      {
        id: "temple",
        name: "Maya Henson",
        company: "Temple Partners",
        email: "maya.henson@temple.example",
        initials: "MH",
        status: "pending",
        lastTouch: "3 hr ago",
        clauseCount: 0,
        editSummary: "Opened the Word package. No edits returned.",
        aiPosition: "Wait for markup before allocating concessions.",
      },
      {
        id: "meridian",
        name: "Noah Reed",
        company: "Meridian Works",
        email: "noah.reed@meridian.example",
        initials: "NR",
        status: "no_response",
        lastTouch: "2 days ago",
        clauseCount: 0,
        editSummary: "No response after delivery.",
        aiPosition: "Send a reminder if still quiet tomorrow.",
      },
      {
        id: "ashbury",
        name: "Leah Kim",
        company: "Ashbury Legal",
        email: "leah.kim@ashbury.example",
        initials: "LK",
        status: "accepted",
        lastTouch: "Today",
        clauseCount: 0,
        editSummary: "Confirmed form is acceptable.",
        aiPosition: "Keep accepted unless a later revision changes economics.",
      },
    ],
  },
  {
    id: "rivergate-nda",
    title: "Rivergate Mutual NDA",
    reference: "RG-2026-09",
    documentName: "Rivergate_Mutual_NDA_Form.docx",
    due: "Aug 09",
    round: "Round 1",
    owner: "C. Moss",
    guardrails: [
      "Accept confidentiality period up to 5 years.",
      "Reject unilateral residual knowledge clauses.",
      "Escalate employee non-solicit language.",
    ],
    summary:
      "One legal team requested a narrower residual knowledge clause. The rest of the list is still pending.",
    activity: [
      "Stone Peak returned marked NDA.",
      "AI flagged residual knowledge language.",
      "Digest generated for project owner.",
    ],
    parties: [
      {
        id: "stone",
        name: "Samir Rao",
        company: "Stone Peak Legal",
        email: "samir.rao@stonepeak.example",
        initials: "SR",
        status: "attention",
        lastTouch: "Today",
        clauseCount: 4,
        editSummary: "Adds residual knowledge language and a two-year term.",
        aiPosition: "Reject unilateral residual knowledge. Accept two-year term.",
      },
      {
        id: "harbor",
        name: "Iris Chen",
        company: "Harbor Strategy",
        email: "iris.chen@harbor.example",
        initials: "IC",
        status: "pending",
        lastTouch: "Yesterday",
        clauseCount: 0,
        editSummary: "Document delivered. No marked copy returned.",
        aiPosition: "No action.",
      },
      {
        id: "summit",
        name: "Ari James",
        company: "Summit Bank",
        email: "ari.james@summit.example",
        initials: "AJ",
        status: "no_response",
        lastTouch: "4 days ago",
        clauseCount: 0,
        editSummary: "No response.",
        aiPosition: "Queue reminder before end of week.",
      },
    ],
  },
];

const initialProjects: Project[] = projectSeeds.map((project) => {
  const stageId = `${project.id}-review`;
  const stage: ProjectStage = {
    id: stageId,
    name: project.title.includes("NDA") ? "NDA review" : "Document review",
    unlockAfterStageId: null,
    documentNames: project.documentName ? [project.documentName] : [],
  };
  const template: EmailTemplate = {
    id: `${stageId}-initial-email`,
    name: "Initial request",
    stageId,
    subject: `${project.title}: review request`,
    body: `Please review the attached documents and return any comments by ${project.due}.`,
  };
  const parties = project.parties.map((party) => ({ ...party, stageId }));
  const hydratedProject = {
    ...project,
    parties,
    stages: [stage],
    emailTemplates: [template],
  };
  return {
    ...hydratedProject,
    emailDrafts: parties.map((party) => createEmailDraft({ project: hydratedProject, party, stage, template })),
  };
});

function normalizeProject(project: Project): Project {
  const legacyStageId = `${project.id}-review`;
  const stages = project.stages?.length
    ? project.stages.map((stage, index) => ({
        ...stage,
        unlockAfterStageId: index ? project.stages[index - 1].id : null,
        documentNames: stage.documentNames || [],
      }))
    : [{
        id: legacyStageId,
        name: "Stage 1",
        unlockAfterStageId: null,
        documentNames: project.documentName ? [project.documentName] : [],
      }];
  const firstStageId = stages[0]?.id;
  const emailTemplates = project.emailTemplates?.length
    ? project.emailTemplates
    : firstStageId
      ? [{
          id: `${firstStageId}-initial-email`,
          name: "Initial request",
          stageId: firstStageId,
          subject: `${project.title}: review request`,
          body: "Please review the attached documents and reply with any questions.",
        }]
      : [];
  const normalizedParties = (project.parties || []).map((party) => ({ ...party, stageId: party.stageId || firstStageId }));
  const emailDrafts = project.emailDrafts?.length
    ? project.emailDrafts
    : normalizedParties.flatMap((party) => {
        const stage = stages.find((item) => item.id === party.stageId) || stages[0];
        if (!stage) return [];
        const template = emailTemplates.find((item) => item.stageId === stage.id);
        return [createEmailDraft({ project, party, stage, template })];
      });
  return {
    ...project,
    activity: project.activity || [],
    guardrails: project.guardrails || [],
    parties: normalizedParties,
    stages,
    emailTemplates,
    emailDrafts,
  };
}

function countByStatus(project: Project, status: PartyStatus) {
  return project.parties.filter((party) => party.status === status).length;
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function companyFromEmail(email: string) {
  const domain = email.split("@")[1]?.split(".")[0] || "Individual";
  return domain.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stageIdForParty(party: Party, project: Project) {
  return party.stageId || project.stages[0]?.id || "";
}

function stageNameForParty(party: Party, project: Project) {
  const stageId = stageIdForParty(party, project);
  return project.stages.find((stage) => stage.id === stageId)?.name || "Unassigned";
}

function createParty(nameValue: string, emailValue: string, index = 0, companyValue?: string): Party {
  const email = emailValue.trim().toLowerCase();
  const fallbackName = email.split("@")[0].replace(/[._-]+/g, " ");
  const name = (nameValue.trim() || fallbackName).replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    id: `party-${Date.now()}-${index}`,
    name,
    company: companyValue?.trim() || companyFromEmail(email),
    email,
    initials: initialsFor(name),
    status: "pending",
    lastTouch: "Just added",
    clauseCount: 0,
    editSummary: "Added to the recipient list. No markup returned yet.",
    aiPosition: "Pending review.",
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function partiesFromRows(inputRows: unknown[][]) {
  const rows = inputRows
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some(Boolean));
  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z]/g, ""));
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const emailColumn = column("email", "emailaddress", "mail");
  const nameColumn = column("name", "fullname", "contact", "contactname");
  const companyColumn = column("company", "organization", "organisation", "firm");

  if (emailColumn < 0) {
    return rows.flatMap((row, index) => {
      const emailIndex = row.findIndex((cell) => cell.includes("@"));
      if (emailIndex < 0) return [];
      const email = row[emailIndex];
      const name = row.find((cell, cellIndex) => cellIndex !== emailIndex && cell) || "";
      return [createParty(name, email, index)];
    });
  }

  return rows.slice(1).flatMap((row, index) => {
    const email = row[emailColumn]?.trim();
    if (!email || !email.includes("@")) return [];
    const name = row[nameColumn]?.trim() || email.split("@")[0].replace(/[._-]+/g, " ");
    return [createParty(name, email, index, row[companyColumn])];
  });
}

function partiesFromCsv(csv: string) {
  return partiesFromRows(
    csv
      .split(/\r?\n/)
      .map((line) => (line.includes("\t") ? line.split("\t") : parseCsvLine(line))),
  );
}

function partiesFromPastedColumns(value: string) {
  return partiesFromRows(
    value
      .split(/\r?\n/)
      .map((line) => (line.includes("\t") ? line.split("\t") : parseCsvLine(line))),
  );
}

function recipientDraftFromParty(party: Party): RecipientDraft {
  return {
    id: party.id,
    name: party.name,
    email: party.email,
    company: party.company,
    stageId: party.stageId || "",
  };
}

function emptyRecipientDraft(stageId: string, index = 0): RecipientDraft {
  return {
    id: `recipient-${Date.now()}-${index}`,
    name: "",
    email: "",
    company: "",
    stageId,
  };
}

export function PrexetWorkspace({ user }: { user: { name: string; email: string; image?: string | null } }) {
  return <AuthenticatedWorkspace user={user} />;
}

function AuthenticatedWorkspace({ user }: { user: { name: string; email: string; image?: string | null } }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0].id);
  const [selectedPartyId, setSelectedPartyId] = useState(initialProjects[0].parties[0].id);
  const [projectQuery, setProjectQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [dialog, setDialog] = useState<DialogId>(null);
  const [emailAudience, setEmailAudience] = useState<EmailAudience>("all");
  const [pastedRecipients, setPastedRecipients] = useState("");
  const [recipientDrafts, setRecipientDrafts] = useState<RecipientDraft[]>([]);
  const [stageDrafts, setStageDrafts] = useState<string[]>(["Stage 1"]);
  const [documentStageId, setDocumentStageId] = useState("");
  const [emailStageId, setEmailStageId] = useState("");
  const [emailTemplateId, setEmailTemplateId] = useState("");
  const [emailTemplateName, setEmailTemplateName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBodyHtml, setEmailBodyHtml] = useState("");
  const [emailRecipientIds, setEmailRecipientIds] = useState<string[]>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [editingDraftId, setEditingDraftId] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBodyHtml, setDraftBodyHtml] = useState("");
  const [redlineFile, setRedlineFile] = useState<File>();
  const [redlineInstructions, setRedlineInstructions] = useState("");
  const [redlineBusy, setRedlineBusy] = useState(false);
  const [redlineError, setRedlineError] = useState("");
  const [authorityDraft, setAuthorityDraft] = useState(initialProjects[0].guardrails.join("\n"));
  const [toast, setToast] = useState("");
  const [projectSidebarWidth, setProjectSidebarWidth] = useState(280);
  const [projectSidebarCollapsed, setProjectSidebarCollapsed] = useState(false);
  const [mailboxes, setMailboxes] = useState<MailboxAccount[]>([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(true);
  const [selectedMailboxId, setSelectedMailboxId] = useState("");
  const [documentFiles, setDocumentFiles] = useState<Record<string, File>>({});
  const [sendBusy, setSendBusy] = useState(false);
  const [inboxSettings, setInboxSettings] = useState<InboxSettings>({
    onboardingCompleted: true,
    enabled: false,
  });
  const [showInboxOnboarding, setShowInboxOnboarding] = useState(false);
  const [inboxOnboardingChoice, setInboxOnboardingChoice] = useState(false);
  const [selectedInboxMailboxId, setSelectedInboxMailboxId] = useState("");
  const [inboxSyncing, setInboxSyncing] = useState(false);
  const [inboxSyncProgress, setInboxSyncProgress] = useState("");
  const [inboxQuestion, setInboxQuestion] = useState("");
  const [inboxAnswer, setInboxAnswer] = useState("");
  const [inboxEvidence, setInboxEvidence] = useState<InboxEvidence[]>([]);
  const [inboxBusy, setInboxBusy] = useState(false);
  const [inboxError, setInboxError] = useState("");

  const projectSearchRef = useRef<HTMLInputElement>(null);
  const formInputRef = useRef<HTMLInputElement>(null);
  const listInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId],
  );

  const selectedParty =
    selectedProject.parties.find((party) => party.id === selectedPartyId) ??
    selectedProject.parties[0];

  const filteredProjects = projects.filter((project) =>
    `${project.title} ${project.reference}`.toLowerCase().includes(projectQuery.toLowerCase()),
  );

  const attentionCount = countByStatus(selectedProject, "attention");
  const documentCount = selectedProject.stages.reduce((total, stage) => total + stage.documentNames.length, 0);
  const projectReady = selectedProject.parties.length > 0 && selectedProject.stages.length > 0 && documentCount > 0;
  const emailStage = selectedProject.stages.find((stage) => stage.id === emailStageId);
  const emailStageParties = selectedProject.parties.filter((party) => stageIdForParty(party, selectedProject) === emailStageId);
  const emailStageTemplates = selectedProject.emailTemplates.filter((template) => template.stageId === emailStageId);
  const editingDraft = selectedProject.emailDrafts.find((draft) => draft.id === editingDraftId);
  const editingDraftParty = selectedProject.parties.find((party) => party.id === editingDraft?.partyId);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedProjects = window.localStorage.getItem("prexet-projects");
      if (storedProjects) {
        try {
          const parsed = JSON.parse(storedProjects) as Project[];
          if (Array.isArray(parsed) && parsed.length) {
            const restored = parsed.map(normalizeProject);
            setProjects(restored);
            setSelectedProjectId(restored[0].id);
            setSelectedPartyId(restored[0].parties[0]?.id || "");
            setAuthorityDraft(restored[0].guardrails.join("\n"));
          }
        } catch {
          window.localStorage.removeItem("prexet-projects");
        }
      }
      setProjectsLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/inbox/settings");
        const result = await response.json() as { settings?: InboxSettings; mailboxes?: MailboxAccount[] };
        if (!cancelled && response.ok) {
          const connected = result.mailboxes || [];
          setMailboxes(connected);
          setSelectedMailboxId((current) => current || connected.find((mailbox) => mailbox.status === "connected")?.id || "");
          setSelectedInboxMailboxId((current) => current || connected.find((mailbox) => mailbox.inboxAccessEnabled)?.id || "");
          if (result.settings) {
            setInboxSettings(result.settings);
            if (!result.settings.onboardingCompleted) setShowInboxOnboarding(true);
          }
        }
      } finally {
        if (!cancelled) setMailboxesLoading(false);
      }
    }
    void load();

    const url = new URL(window.location.href);
    const connected = url.searchParams.get("mailbox");
    const mailboxError = url.searchParams.get("mailbox_error");
    const oauthMessage = mailboxError
      || (connected === "inbox_connected"
        ? "Gmail inbox search enabled — start a sync when you are ready"
        : connected === "connected" ? "Gmail connected — it is ready to send" : "");
    const toastTimer = oauthMessage ? window.setTimeout(() => setToast(oauthMessage), 0) : undefined;
    if (connected || mailboxError) {
      url.searchParams.delete("mailbox");
      url.searchParams.delete("mailbox_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return () => {
      cancelled = true;
      if (toastTimer) window.clearTimeout(toastTimer);
    };
  }, []);

  useEffect(() => {
    if (!projectsLoaded) return;
    window.localStorage.setItem("prexet-projects", JSON.stringify(projects));
  }, [projects, projectsLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        projectSearchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedWidth = Number(window.localStorage.getItem("prexet-project-sidebar-width"));
      const savedCollapsed = window.localStorage.getItem("prexet-project-sidebar-collapsed");
      if (savedWidth >= 220 && savedWidth <= 420) setProjectSidebarWidth(savedWidth);
      if (savedCollapsed === "true") setProjectSidebarCollapsed(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function setSidebarCollapsed(collapsed: boolean) {
    setProjectSidebarCollapsed(collapsed);
    window.localStorage.setItem("prexet-project-sidebar-collapsed", String(collapsed));
  }

  function resizeProjectSidebar(width: number) {
    const nextWidth = Math.max(220, Math.min(420, width));
    setProjectSidebarWidth(nextWidth);
    window.localStorage.setItem("prexet-project-sidebar-width", String(nextWidth));
  }

  function startProjectSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    if (projectSidebarCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = projectSidebarWidth;
    document.body.classList.add("is-resizing-sidebar");

    const handlePointerMove = (moveEvent: PointerEvent) => {
      resizeProjectSidebar(startWidth + moveEvent.clientX - startX);
    };
    const handlePointerUp = () => {
      document.body.classList.remove("is-resizing-sidebar");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleProjectSidebarResizeKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    resizeProjectSidebar(projectSidebarWidth + (event.key === "ArrowRight" ? 12 : -12));
  }

  function selectProject(project: Project) {
    setSelectedProjectId(project.id);
    setSelectedPartyId(project.parties[0]?.id ?? "");
    setActiveTab("overview");
    setSelectedDraftIds([]);
    setAuthorityDraft(project.guardrails.join("\n"));
    setDialog(null);
  }

  function openRecipients() {
    setRecipientDrafts(
      selectedProject.parties.length
        ? selectedProject.parties.map(recipientDraftFromParty)
        : [emptyRecipientDraft(selectedProject.stages[0]?.id || "")],
    );
    setPastedRecipients("");
    setDialog("recipients");
  }

  function mergeRecipientDrafts(recipients: Party[]) {
    if (!recipients.length) {
      setToast("No recipients found. Include at least a name and email address.");
      return;
    }

    const defaultStageId = selectedProject.stages[0]?.id || "";
    setRecipientDrafts((current) => {
      const meaningful = current.filter((draft) => draft.name.trim() || draft.email.trim());
      const knownEmails = new Set(meaningful.map((draft) => draft.email.trim().toLowerCase()));
      const additions = recipients
        .filter((party) => !knownEmails.has(party.email.toLowerCase()))
        .map((party) => ({ ...recipientDraftFromParty(party), stageId: defaultStageId }));
      return [...meaningful, ...additions];
    });
    setToast(`${recipients.length} ${recipients.length === 1 ? "row" : "rows"} added for review`);
  }

  function addPastedRecipientRows() {
    const recipients = partiesFromPastedColumns(pastedRecipients);
    if (!recipients.length) {
      setToast("No email addresses found in the pasted rows.");
      return;
    }
    mergeRecipientDrafts(recipients);
    setPastedRecipients("");
  }

  function saveRecipientDrafts() {
    const rows = recipientDrafts.filter((draft) => draft.name.trim() || draft.email.trim() || draft.company.trim());
    const invalid = rows.find((draft) => !draft.email.includes("@"));
    if (invalid) {
      setToast("Every recipient needs a valid email address.");
      return;
    }

    const seenEmails = new Set<string>();
    const deduped = rows.filter((draft) => {
      const email = draft.email.trim().toLowerCase();
      if (seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    });

    let firstPartyId = "";
    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      const parties = deduped.map((draft, index) => {
        const existing = project.parties.find((party) => party.id === draft.id || party.email.toLowerCase() === draft.email.trim().toLowerCase());
        const next = existing
          ? {
              ...existing,
              name: draft.name.trim() || existing.name,
              email: draft.email.trim().toLowerCase(),
              company: draft.company.trim() || companyFromEmail(draft.email),
              initials: initialsFor(draft.name.trim() || existing.name),
              stageId: draft.stageId || project.stages[0]?.id,
            }
          : {
              ...createParty(draft.name, draft.email, index, draft.company),
              id: draft.id,
              stageId: draft.stageId || project.stages[0]?.id,
            };
        if (!firstPartyId) firstPartyId = next.id;
        return next;
      });
      const partyIds = new Set(parties.map((party) => party.id));
      const retainedDrafts = project.emailDrafts.filter((draft) => partyIds.has(draft.partyId));
      const emailDrafts = [...retainedDrafts];
      parties.forEach((party) => {
        const stage = project.stages.find((item) => item.id === party.stageId) || project.stages[0];
        if (!stage) return;
        const draftId = `draft-${project.id}-${stage.id}-${party.id}`;
        if (!emailDrafts.some((draft) => draft.id === draftId)) {
          emailDrafts.push(createEmailDraft({
            project,
            party,
            stage,
            template: project.emailTemplates.find((template) => template.stageId === stage.id),
          }));
        }
      });
      return {
        ...project,
        parties,
        emailDrafts,
        round: parties.length && project.documentName ? "Ready to send" : project.round,
        summary: parties.length && project.documentName
          ? "The recipient list and form document are ready. Add review instructions or create transmission drafts."
          : project.summary,
        activity: [`Recipient list updated: ${parties.length} ${parties.length === 1 ? "person" : "people"}.`, ...project.activity],
      };
    }));
    setSelectedPartyId(firstPartyId);
    setDialog(null);
    setToast(`${deduped.length} ${deduped.length === 1 ? "recipient" : "recipients"} saved`);
  }

  async function handleFileSelected(kind: "form" | "list", file?: File) {
    if (!file) return;

    if (kind === "form") {
      setDocumentFiles((current) => ({ ...current, [file.name]: file }));
      const targetStageId = documentStageId || selectedProject.stages[0]?.id;
      if (!targetStageId) {
        setToast("Add a project stage before uploading a document.");
        return;
      }
      setProjects((current) => current.map((project) => project.id === selectedProject.id
          ? {
            ...project,
            documentName: file.name,
            stages: project.stages.map((stage) => stage.id === targetStageId
              ? { ...stage, documentNames: Array.from(new Set([...stage.documentNames, file.name])) }
              : stage),
            emailDrafts: project.emailDrafts.map((draft) => draft.stageId === targetStageId && draft.status !== "sent"
              ? { ...draft, attachmentNames: Array.from(new Set([...draft.attachmentNames, file.name])), updatedAt: "Just now" }
              : draft),
            round: project.parties.length ? "Ready to send" : project.round,
            summary: project.parties.length
              ? "The recipient list and form document are ready. Add review instructions or send the first package."
              : project.summary,
            activity: [`${file.name} added to ${project.stages.find((stage) => stage.id === targetStageId)?.name || "the project"}.`, ...project.activity],
          }
        : project));
      setDialog(null);
      setToast(`Document added: ${file.name}`);
      return;
    }

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const supported = new Set(["csv", "tsv", "xlsx", "xls", "xlsb", "numbers", "ods"]);
      if (!extension || !supported.has(extension)) {
        setToast("Choose an Excel, Numbers, CSV, TSV, or OpenDocument spreadsheet.");
        return;
      }

      const importedParties = extension === "csv" || extension === "tsv"
        ? partiesFromCsv(await file.text())
        : await (async () => {
            const { read, utils } = await import("xlsx");
            const workbook = read(await file.arrayBuffer());
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            if (!sheet) return [];
            const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
            return partiesFromRows(rows);
          })();

      if (!importedParties.length) {
        setToast("No recipients found. Include an Email column and, optionally, Name and Company.");
        return;
      }
      mergeRecipientDrafts(importedParties);
    } catch {
      setToast("That spreadsheet could not be read. Try exporting it as Excel or CSV.");
    }
  }

  function openBrief() {
    setAuthorityDraft(selectedProject.guardrails.join("\n"));
    setDialog("brief");
  }

  function openRedlines() {
    setRedlineFile(undefined);
    setRedlineInstructions(selectedProject.guardrails.join("\n") || "Make only commercially reasonable, balanced changes. Preserve party names, dates, and defined terms.");
    setRedlineError("");
    setDialog("redline");
  }

  async function generateRedline() {
    if (!redlineFile) {
      setRedlineError("Choose the Word document you want Prexet to mark up.");
      return;
    }
    setRedlineBusy(true);
    setRedlineError("");
    try {
      const formData = new FormData();
      formData.set("document", redlineFile);
      formData.set("instructions", redlineInstructions);
      const response = await fetch("/api/redline", { method: "POST", body: formData });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "The document could not be redlined.");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${redlineFile.name.replace(/\.docx$/i, "")}_prexet_redline.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      const changes = response.headers.get("X-Prexet-Changes") || "AI";
      setProjects((current) => current.map((project) => project.id === selectedProject.id
        ? { ...project, activity: [`${changes} tracked changes generated for ${redlineFile.name}.`, ...project.activity] }
        : project));
      setToast("Marked Word document downloaded");
    } catch (error) {
      setRedlineError(error instanceof Error ? error.message : "The document could not be redlined.");
    } finally {
      setRedlineBusy(false);
    }
  }

  async function connectMailbox(provider: MailboxProvider, accessMode: "send" | "inbox" = "send") {
    try {
      const response = await fetch("/api/mail/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, accessMode }),
      });
      const result = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !result.authorizationUrl) throw new Error(result.error || "Mailbox connection is not configured yet.");
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Mailbox connection is not configured yet.");
    }
  }

  async function saveInboxPreference(values: Partial<InboxSettings>) {
    const response = await fetch("/api/inbox/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json() as { settings?: InboxSettings; error?: string };
    if (!response.ok || !result.settings) throw new Error(result.error || "Inbox preferences could not be saved.");
    setInboxSettings(result.settings);
    return result.settings;
  }

  async function declineInboxOnboarding() {
    try {
      await saveInboxPreference({ onboardingCompleted: true, enabled: false });
      setShowInboxOnboarding(false);
      setInboxOnboardingChoice(false);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Inbox preferences could not be saved.");
    }
  }

  async function continueInboxOnboarding() {
    if (!inboxOnboardingChoice) {
      await declineInboxOnboarding();
      return;
    }
    try {
      await saveInboxPreference({ onboardingCompleted: true });
      setShowInboxOnboarding(false);
      await connectMailbox("google", "inbox");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Inbox access could not be started.");
    }
  }

  async function changeInboxEnabled(enabled: boolean) {
    if (enabled) {
      try {
        await saveInboxPreference({ onboardingCompleted: true });
        await connectMailbox("google", "inbox");
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Inbox access could not be started.");
      }
      return;
    }
    try {
      await saveInboxPreference({ enabled: false, onboardingCompleted: true });
      setMailboxes((current) => current.map((mailbox) => ({ ...mailbox, inboxAccessEnabled: false })));
      setInboxAnswer("");
      setInboxEvidence([]);
      setToast("Inbox search turned off");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Inbox search could not be turned off.");
    }
  }

  async function syncInbox(mailboxId: string) {
    if (!mailboxId || inboxSyncing) return;
    setInboxSyncing(true);
    setInboxError("");
    setInboxSyncProgress("Starting read-only sync…");
    let pageToken: string | undefined;
    let syncQuery: string | undefined;
    try {
      for (let page = 0; page < 500; page += 1) {
        const response = await fetch("/api/inbox/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mailboxId, pageToken, syncQuery }),
        });
        const result = await response.json() as {
          totalIndexed?: number;
          totalEstimate?: number;
          nextPageToken?: string | null;
          syncQuery?: string;
          done?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "The inbox could not be synchronized.");
        const estimate = result.totalEstimate ? ` of about ${result.totalEstimate}` : "";
        setInboxSyncProgress(`${result.totalIndexed || 0}${estimate} messages indexed`);
        pageToken = result.nextPageToken || undefined;
        syncQuery = result.syncQuery;
        if (result.done || !pageToken) {
          const syncedAt = new Date().toISOString();
          setMailboxes((current) => current.map((mailbox) => mailbox.id === mailboxId
            ? {
                ...mailbox,
                inboxSyncStatus: "ready",
                inboxLastSyncedAt: syncedAt,
                inboxMessageCount: result.totalIndexed || mailbox.inboxMessageCount,
              }
            : mailbox));
          setToast("Inbox sync complete");
          return;
        }
      }
      throw new Error("This mailbox is very large. Run sync again to continue.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The inbox could not be synchronized.";
      setInboxError(message);
      setToast(message);
    } finally {
      setInboxSyncing(false);
    }
  }

  async function askInbox() {
    const question = inboxQuestion.trim();
    if (!question || inboxBusy) return;
    setInboxBusy(true);
    setInboxError("");
    setInboxAnswer("");
    setInboxEvidence([]);
    try {
      const response = await fetch("/api/inbox/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          mailboxId: selectedInboxMailboxId || undefined,
        }),
      });
      const result = await response.json() as {
        answer?: string;
        evidence?: InboxEvidence[];
        error?: string;
      };
      if (!response.ok || !result.answer) throw new Error(result.error || "The inbox question could not be answered.");
      setInboxAnswer(result.answer);
      setInboxEvidence(result.evidence || []);
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : "The inbox question could not be answered.");
    } finally {
      setInboxBusy(false);
    }
  }

  async function disconnectMailbox(mailboxId: string) {
    try {
      const response = await fetch(`/api/mail/accounts?id=${encodeURIComponent(mailboxId)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The mailbox could not be disconnected.");
      setMailboxes((current) => current.filter((mailbox) => mailbox.id !== mailboxId));
      setSelectedMailboxId((current) => current === mailboxId ? "" : current);
      setToast("Mailbox disconnected");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The mailbox could not be disconnected.");
    }
  }

  function saveAuthority() {
    const guardrails = authorityDraft.split("\n").map((item) => item.trim()).filter(Boolean);
    setProjects((current) => current.map((project) => project.id === selectedProject.id
      ? {
          ...project,
          guardrails,
          activity: ["AI acceptance authority updated.", ...project.activity],
        }
      : project));
    setDialog(null);
    setToast("AI authority saved for this project");
  }

  function updatePartyStatus(status: PartyStatus) {
    if (!selectedParty) return;
    const label = statusMeta[status].label;
    const currentStageIndex = selectedProject.stages.findIndex((stage) => stage.id === stageIdForParty(selectedParty, selectedProject));
    const nextStage = status === "accepted" ? selectedProject.stages[currentStageIndex + 1] : undefined;
    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      const advancedParty = nextStage ? { ...selectedParty, stageId: nextStage.id, status: "pending" as PartyStatus } : undefined;
      const nextDraft = nextStage && advancedParty
        ? createEmailDraft({
            project,
            party: advancedParty,
            stage: nextStage,
            template: project.emailTemplates.find((template) => template.stageId === nextStage.id),
          })
        : undefined;
      return {
        ...project,
        parties: project.parties.map((party) => party.id === selectedParty.id
          ? {
              ...party,
              status: nextStage ? "pending" : status,
              stageId: nextStage?.id || party.stageId,
              lastTouch: "Just now",
            }
          : party),
        emailDrafts: nextDraft && !project.emailDrafts.some((draft) => draft.id === nextDraft.id)
          ? [nextDraft, ...project.emailDrafts]
          : project.emailDrafts,
        activity: [nextStage
          ? `${selectedParty.company} completed ${selectedProject.stages[currentStageIndex]?.name} and advanced to ${nextStage.name}.`
          : `${selectedParty.company} moved to ${label.toLowerCase()}.`, ...project.activity],
      };
    }));
    setToast(nextStage
      ? `${selectedParty.company} unlocked ${nextStage.name}`
      : `${selectedParty.company}: ${label}`);
  }

  function openStages() {
    setStageDrafts(selectedProject.stages.length ? selectedProject.stages.map((stage) => stage.name) : ["Stage 1"]);
    setDialog("stages");
  }

  function saveStages() {
    const names = stageDrafts.map((name, index) => name.trim() || `Stage ${index + 1}`);

    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      const stageSeed = Date.now();
      const stageIds = names.map((_, index) => project.stages[index]?.id || `stage-${stageSeed}-${index}`);
      const stages = names.map((name, index) => {
        const existing = project.stages[index];
        return {
          id: stageIds[index],
          name,
          unlockAfterStageId: index ? stageIds[index - 1] : null,
          documentNames: existing?.documentNames || [],
        };
      });
      const validStageIds = new Set(stages.map((stage) => stage.id));
      const emailTemplates = project.emailTemplates.filter((template) => validStageIds.has(template.stageId));
      stages.forEach((stage) => {
        if (!emailTemplates.some((template) => template.stageId === stage.id)) {
          emailTemplates.push({
            id: `${stage.id}-initial-email`,
            name: "Initial request",
            stageId: stage.id,
            subject: `${project.title}: ${stage.name}`,
            body: `Please review the attached ${stage.name.toLowerCase()} materials and reply with any questions.`,
          });
        }
      });
      return {
        ...project,
        stages,
        emailTemplates,
        parties: project.parties.map((party) => validStageIds.has(stageIdForParty(party, project))
          ? party
          : { ...party, stageId: stages[0].id }),
        activity: [`Project stages updated: ${names.join(" → ")}.`, ...project.activity],
      };
    }));
    setDialog(null);
    setToast(`${names.length} ${names.length === 1 ? "stage" : "stages"} saved`);
  }

  function openDocument(stageId = selectedProject.stages[0]?.id || "") {
    if (!selectedProject.stages.length) {
      openStages();
      setToast("Add stages before assigning documents.");
      return;
    }
    setDocumentStageId(stageId);
    setDialog("document");
  }

  function applyEmailTemplate(stageId: string, templateId?: string, audience: EmailAudience = emailAudience) {
    const stageTemplates = selectedProject.emailTemplates.filter((template) => template.stageId === stageId);
    const template = stageTemplates.find((item) => item.id === templateId) || stageTemplates[0];
    const stageParties = selectedProject.parties.filter((party) => stageIdForParty(party, selectedProject) === stageId);
    setEmailStageId(stageId);
    setEmailTemplateId(template?.id || "");
    setEmailTemplateName(template?.name || "New email form");
    setEmailSubject(template?.subject || `${selectedProject.title}: ${selectedProject.stages.find((stage) => stage.id === stageId)?.name || "project update"}`);
    setEmailBodyHtml(normalizeEmailHtml(template?.body || "Please review the attached materials and reply with any questions."));
    setEmailRecipientIds(audience === "selected" && selectedParty && stageIdForParty(selectedParty, selectedProject) === stageId
      ? [selectedParty.id]
      : stageParties.map((party) => party.id));
  }

  function openEmail(audience: EmailAudience, stageId?: string) {
    const targetStageId = stageId || (selectedParty ? stageIdForParty(selectedParty, selectedProject) : selectedProject.stages[0]?.id) || "";
    setEmailAudience(audience);
    applyEmailTemplate(targetStageId, undefined, audience);
    setDialog("email");
  }

  function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "Untitled project");
    const projectId = `project-${Date.now()}`;
    const stageId = `${projectId}-stage-1`;
    const newProject: Project = {
      id: projectId,
      title,
      reference: `PX-${new Date().getFullYear()}-${String(projects.length + 1).padStart(2, "0")}`,
      documentName: "",
      due: "Not set",
      round: "Setup",
      owner: "You",
      guardrails: [],
      summary: "Add a recipient list and form document to begin this project.",
      activity: ["Project created."],
      parties: [],
      stages: [{ id: stageId, name: "Stage 1", unlockAfterStageId: null, documentNames: [] }],
      emailTemplates: [{
        id: `${stageId}-initial-email`,
        name: "Initial request",
        stageId,
        subject: `${title}: review request`,
        body: "Please review the attached documents and reply with any questions.",
      }],
      emailDrafts: [],
    };
    setProjects((current) => [newProject, ...current]);
    setSelectedProjectId(newProject.id);
    setSelectedPartyId("");
    setDialog(null);
    setToast("Project created");
  }

  function createDraftsFromEmailForm() {
    const recipientLabel = `${emailRecipientIds.length} ${emailRecipientIds.length === 1 ? "recipient" : "recipients"}`;
    if (!emailRecipientIds.length) {
      setToast("Select at least one recipient.");
      return;
    }
    if (!emailStage) {
      setToast("Choose a project stage.");
      return;
    }
    const templateLabel = emailTemplateName.trim() || "Transmission email";
    const draftIds = emailRecipientIds.map((partyId) => `draft-${selectedProject.id}-${emailStage.id}-${partyId}`);
    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      const nextDrafts = [...project.emailDrafts];
      emailRecipientIds.forEach((partyId) => {
        const party = project.parties.find((item) => item.id === partyId);
        if (!party) return;
        const nextDraft = createEmailDraft({
          project,
          party,
          stage: emailStage,
          template: project.emailTemplates.find((item) => item.id === emailTemplateId),
          subject: emailSubject,
          body: emailBodyHtml,
        });
        const index = nextDrafts.findIndex((draft) => draft.id === nextDraft.id);
        if (index >= 0) nextDrafts[index] = nextDraft;
        else nextDrafts.unshift(nextDraft);
      });
      return {
        ...project,
        emailDrafts: nextDrafts,
        activity: [`${templateLabel} drafts created for ${recipientLabel}.`, ...project.activity],
      };
    }));
    setSelectedDraftIds(draftIds);
    setActiveTab("emails");
    setDialog(null);
    setToast(`${recipientLabel} ready for individual review`);
  }

  function openDraft(draftId: string) {
    const draft = selectedProject.emailDrafts.find((item) => item.id === draftId);
    if (!draft) return;
    setEditingDraftId(draft.id);
    setDraftSubject(draft.subject);
    setDraftBodyHtml(draft.bodyHtml);
    setSelectedMailboxId(draft.mailboxId || mailboxes.find((mailbox) => mailbox.status === "connected")?.id || "");
    setDialog("draft");
  }

  function saveDraft(closeAfterSave = true) {
    if (!editingDraft || !draftSubject.trim() || !draftBodyHtml.trim()) {
      setToast("Add a subject and message before saving.");
      return;
    }
    setProjects((current) => current.map((project) => project.id === selectedProject.id
      ? {
          ...project,
          emailDrafts: project.emailDrafts.map((draft) => draft.id === editingDraft.id
            ? {
                ...draft,
                subject: draftSubject.trim(),
                bodyHtml: draftBodyHtml,
                customized: true,
                status: "draft",
                updatedAt: "Just now",
              }
            : draft),
          activity: [`Draft updated for ${editingDraftParty?.name || "recipient"}.`, ...project.activity],
        }
      : project));
    if (closeAfterSave) setDialog(null);
    setToast("Draft saved — nothing was sent");
  }

  async function sendDraftRequest(draft: EmailDraft, party: Party, subject = draft.subject, bodyHtml = draft.bodyHtml) {
    const mailboxId = selectedMailboxId || mailboxes.find((mailbox) => mailbox.status === "connected")?.id;
    if (!mailboxId) throw new Error("Connect a Gmail account before sending.");
    const missingAttachments = draft.attachmentNames.filter((name) => !documentFiles[name]);
    if (missingAttachments.length) {
      throw new Error(`Re-upload ${missingAttachments[0]} so it can be attached before sending.`);
    }
    const form = new FormData();
    form.set("mailboxId", mailboxId);
    form.set("to", party.email);
    form.set("subject", subject.trim());
    form.set("bodyHtml", bodyHtml.trim());
    draft.attachmentNames.forEach((name) => form.append("attachments", documentFiles[name]));
    const response = await fetch("/api/mail/send", { method: "POST", body: form });
    const result = await response.json() as { messageId?: string; error?: string };
    if (!response.ok || !result.messageId) throw new Error(result.error || "Gmail did not send this message.");
    return { mailboxId, messageId: result.messageId };
  }

  async function saveAndQueueDraft() {
    if (!editingDraft || !draftSubject.trim() || !draftBodyHtml.trim()) {
      setToast("Add a subject and message before sending.");
      return;
    }
    if (!editingDraftParty) return;
    setSendBusy(true);
    try {
      const sent = await sendDraftRequest(editingDraft, editingDraftParty, draftSubject, draftBodyHtml);
      const mailbox = mailboxes.find((item) => item.id === sent.mailboxId);
      setProjects((current) => current.map((project) => project.id === selectedProject.id
        ? {
            ...project,
            emailDrafts: project.emailDrafts.map((draft) => draft.id === editingDraft.id
              ? {
                  ...draft,
                  mailboxId: sent.mailboxId,
                  from: mailbox?.email || draft.from,
                  subject: draftSubject.trim(),
                  bodyHtml: draftBodyHtml.trim(),
                  customized: true,
                  status: "sent",
                  updatedAt: "Just now",
                }
              : draft),
            activity: [`Email sent to ${editingDraftParty.name} from ${mailbox?.email || "Gmail"}.`, ...project.activity],
          }
        : project));
      setDialog(null);
      setToast(`Email sent to ${editingDraftParty.email}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The email could not be sent.");
    } finally {
      setSendBusy(false);
    }
  }

  async function queueDrafts(draftIds: string[]) {
    const queueableIds = draftIds.filter((id) => selectedProject.emailDrafts.some((draft) => draft.id === id && draft.status !== "sent"));
    if (!queueableIds.length) {
      setToast("Select at least one draft.");
      return;
    }
    if (!(selectedMailboxId || mailboxes.some((mailbox) => mailbox.status === "connected"))) {
      setDialog("account");
      setToast("Connect a Gmail account before sending.");
      return;
    }
    const candidates = queueableIds.flatMap((id) => {
      const draft = selectedProject.emailDrafts.find((item) => item.id === id);
      const party = selectedProject.parties.find((item) => item.id === draft?.partyId);
      return draft && party ? [{ draft, party }] : [];
    });
    const missing = candidates.flatMap(({ draft }) => draft.attachmentNames.filter((name) => !documentFiles[name]));
    if (missing.length) {
      setToast(`Re-upload ${missing[0]} before sending this batch.`);
      return;
    }
    setSendBusy(true);
    const sentIds: string[] = [];
    let sendError = "";
    for (const { draft, party } of candidates) {
      try {
        await sendDraftRequest(draft, party);
        sentIds.push(draft.id);
      } catch (error) {
        sendError = error instanceof Error ? error.message : "Gmail stopped the batch.";
        break;
      }
    }
    const mailbox = mailboxes.find((item) => item.id === selectedMailboxId) || mailboxes.find((item) => item.status === "connected");
    if (sentIds.length) {
      setProjects((current) => current.map((project) => project.id === selectedProject.id
        ? {
            ...project,
            emailDrafts: project.emailDrafts.map((draft) => sentIds.includes(draft.id)
              ? { ...draft, status: "sent", mailboxId: mailbox?.id, from: mailbox?.email || draft.from, updatedAt: "Just now" }
              : draft),
            activity: [`${sentIds.length} transmission ${sentIds.length === 1 ? "email" : "emails"} sent from ${mailbox?.email || "Gmail"}.`, ...project.activity],
          }
        : project));
    }
    setSelectedDraftIds((current) => current.filter((id) => !sentIds.includes(id)));
    setSendBusy(false);
    setToast(sendError || `${sentIds.length} ${sentIds.length === 1 ? "email" : "emails"} sent`);
  }

  function saveEmailTemplate() {
    const name = emailTemplateName.trim();
    if (!name || !emailStageId || !emailSubject.trim() || !htmlToPreviewText(emailBodyHtml)) {
      setToast("Add a form name, subject, and message.");
      return;
    }
    const templateId = emailTemplateId || `email-${Date.now()}`;
    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      const template: EmailTemplate = {
        id: templateId,
        name,
        stageId: emailStageId,
        subject: emailSubject,
        body: emailBodyHtml,
      };
      return {
        ...project,
        emailTemplates: project.emailTemplates.some((item) => item.id === templateId)
          ? project.emailTemplates.map((item) => item.id === templateId ? template : item)
          : [...project.emailTemplates, template],
        activity: [`Email form saved: ${name}.`, ...project.activity],
      };
    }));
    setEmailTemplateId(templateId);
    setToast("Email form saved");
  }

  function moveSelectedParty(stageId: string) {
    if (!selectedParty) return;
    const targetStage = selectedProject.stages.find((stage) => stage.id === stageId);
    const stageName = targetStage?.name || "stage";
    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      const movedParty = { ...selectedParty, stageId };
      const nextDraft = targetStage
        ? createEmailDraft({
            project,
            party: movedParty,
            stage: targetStage,
            template: project.emailTemplates.find((template) => template.stageId === targetStage.id),
          })
        : undefined;
      return {
        ...project,
        parties: project.parties.map((party) => party.id === selectedParty.id ? movedParty : party),
        emailDrafts: nextDraft && !project.emailDrafts.some((draft) => draft.id === nextDraft.id)
          ? [nextDraft, ...project.emailDrafts]
          : project.emailDrafts,
        activity: [`${selectedParty.company} moved to ${stageName}.`, ...project.activity],
      };
    }));
    setToast(`${selectedParty.company} moved to ${stageName}`);
  }

  return (
    <div
      className="workspace-shell bg-[var(--background)] text-[var(--foreground)]"
      data-project-sidebar-collapsed={projectSidebarCollapsed}
      style={{
        "--project-sidebar-width": `${projectSidebarCollapsed ? 64 : projectSidebarWidth}px`,
      } as React.CSSProperties}
    >
      <aside className="project-rail" aria-label="Project navigation">
        <div className="flex h-full flex-col">
          <div className="px-3 pb-3 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="rail-brand-mark grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-black">
                  <PrexetMark className="size-5" />
                </div>
                <div className="rail-copy min-w-0">
                  <p className="truncate text-sm font-semibold text-black">Prexet</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rail-collapse-button text-zinc-500 hover:bg-zinc-200 hover:text-black"
                onClick={() => setSidebarCollapsed(!projectSidebarCollapsed)}
                aria-label={projectSidebarCollapsed ? "Expand project sidebar" : "Collapse project sidebar"}
              >
                {projectSidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </div>

            <Button
              variant="ghost"
              className="mt-4 w-full justify-start border border-transparent px-2.5 text-zinc-700 hover:border-zinc-200 hover:bg-white hover:text-black"
              onClick={() => setDialog("project")}
              title="New project"
            >
              <Plus />
              <span className="rail-copy">New project</span>
            </Button>

            <label className="rail-search mt-2 flex h-9 items-center gap-2 rounded-lg border border-transparent px-2.5 text-zinc-500 hover:bg-white focus-within:border-zinc-300 focus-within:bg-white">
              <Search className="size-4" />
              <input
                ref={projectSearchRef}
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-zinc-500"
                placeholder="Search projects"
              />
              <span className="rail-copy rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-500">⌘K</span>
            </label>

            <Button
              variant="ghost"
              className="mt-2 w-full justify-start border border-transparent px-2.5 text-zinc-700 hover:border-zinc-200 hover:bg-white hover:text-black"
              onClick={() => setDialog("inbox")}
              title="Ask your inbox"
            >
              <Inbox />
              <span className="rail-copy">Ask inbox</span>
              {inboxSettings.enabled ? <span className="rail-copy ml-auto size-1.5 rounded-full bg-black" /> : null}
            </Button>
          </div>

          <nav className="min-h-0 flex-1 overflow-auto px-2">
            <div className="mb-1 flex items-center justify-between px-2 py-2">
              <p className="rail-copy text-[11px] font-medium text-zinc-500">Projects</p>
            </div>
            <div className="space-y-1">
              {filteredProjects.map((project) => {
                const isSelected = project.id === selectedProject.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project)}
                    title={project.title}
                    className={cn(
                      "group w-full rounded-lg border px-2.5 py-2 text-left transition",
                      isSelected
                        ? "border-zinc-200 bg-white text-black shadow-sm"
                        : "border-transparent text-zinc-700 hover:bg-zinc-200/70 hover:text-black",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <FolderKanban
                        className={cn("mt-0.5 size-4 shrink-0", isSelected ? "text-black" : "text-zinc-500")}
                      />
                      <div className="rail-copy min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{project.title}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-zinc-500">{project.reference}</span>
                          <span className="text-zinc-500">{project.due}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          {statusOrder.map((status) => (
                            <span
                              key={status}
                              className={cn("h-1.5 rounded-full", statusMeta[status].dot)}
                              style={{ width: `${Math.max(10, countByStatus(project, status) * 12)}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-zinc-200 p-2">
            <Button
              variant="ghost"
              className="w-full justify-start px-2.5 text-zinc-600 hover:bg-white hover:text-black"
              onClick={() => setDialog("account")}
            >
              <Avatar className="size-6 bg-black text-[10px] text-white">{initialsFor(user.name || user.email)}</Avatar>
              <span className="rail-copy min-w-0 flex-1 truncate text-left">{user.name || user.email}</span>
              <Settings className="rail-copy" />
            </Button>
          </div>
        </div>
        {!projectSidebarCollapsed ? (
          <div
            className="project-resize-handle"
            role="separator"
            aria-label="Resize project sidebar"
            aria-orientation="vertical"
            aria-valuemin={220}
            aria-valuemax={420}
            aria-valuenow={projectSidebarWidth}
            tabIndex={0}
            onPointerDown={startProjectSidebarResize}
            onKeyDown={handleProjectSidebarResizeKey}
          />
        ) : null}
      </aside>

      <main className="workspace-main">
        <div className="mobile-topbar border-b border-[var(--border)] bg-white px-4 py-3">
          <Button variant="ghost" size="icon-sm" onClick={() => setDialog("navigation")} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{selectedProject.title}</p>
            <p className="text-xs text-slate-500">{selectedProject.parties.length} parties</p>
          </div>
          <Button variant="outline" size="icon-sm" onClick={() => setDialog("project")}>
            <Plus />
          </Button>
        </div>

        <header className="border-b border-[var(--border)] bg-white px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{selectedProject.reference}</span>
                <span>/</span>
                <span>{selectedProject.round}</span>
                <span>/</span>
                <span>Owner {selectedProject.owner}</span>
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold text-slate-950">{selectedProject.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {attentionCount ? <Badge className={statusMeta.attention.tone}>{attentionCount} need review</Badge> : null}
                {selectedProject.due !== "Not set" ? (
                  <Badge className="border-slate-200 bg-white text-slate-700">
                    <CalendarDays className="size-3.5" />
                    Due {selectedProject.due}
                  </Badge>
                ) : null}
                {selectedProject.documentName ? (
                  <Badge className="border-slate-200 bg-white text-slate-700">
                    <FileText className="size-3.5" />
                    {selectedProject.documentName}
                  </Badge>
                ) : null}
              </div>
            </div>
            {projectReady ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={openRecipients}>
                  <Users />
                  Manage recipients
                </Button>
                <Button variant="outline" onClick={() => openDocument()}>
                  <UploadCloud />
                  Add document
                </Button>
                <Button onClick={() => openEmail("all")}>
                  <Mail />
                  Create drafts
                </Button>
              </div>
            ) : null}
          </div>
          {projectReady ? (
            <div className="mt-4 flex gap-1 border-b border-transparent">
              {(["overview", "emails", "documents", "activity"] as TabId[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium capitalize transition",
                    activeTab === tab ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <section className="workspace-content">
          {!projectReady ? (
            <ProjectSetup
              project={selectedProject}
              onAddStages={openStages}
              onAddList={openRecipients}
              onAddForm={() => openDocument()}
              onAddInstructions={openBrief}
            />
          ) : null}
          {projectReady && activeTab === "overview" ? (
            <Overview
              selectedProject={selectedProject}
              selectedParty={selectedParty}
              onSelectParty={setSelectedPartyId}
              onAddParty={openRecipients}
              onEditAuthority={openBrief}
              onOpenRedlines={openRedlines}
              onQueueEmail={() => openEmail("selected")}
              onQueueStageEmail={(stageId) => openEmail("all", stageId)}
              onChangeStatus={updatePartyStatus}
              onMoveParty={moveSelectedParty}
              onEditStages={openStages}
              onAddDocument={openDocument}
            />
          ) : null}
          {projectReady && activeTab === "documents" ? (
            <Documents selectedProject={selectedProject} onUpload={openDocument} />
          ) : null}
          {projectReady && activeTab === "emails" ? (
            <TransmissionDrafts
              project={selectedProject}
              mailboxes={mailboxes}
              selectedMailboxId={selectedMailboxId}
              sending={sendBusy}
              onChangeMailbox={setSelectedMailboxId}
              selectedDraftIds={selectedDraftIds}
              onChangeSelection={setSelectedDraftIds}
              onOpenDraft={openDraft}
              onCreateDrafts={() => openEmail("all")}
              onQueueDrafts={queueDrafts}
            />
          ) : null}
          {projectReady && activeTab === "activity" ? <ActivityLog selectedProject={selectedProject} /> : null}
        </section>
      </main>

      <input
        ref={formInputRef}
        type="file"
        accept=".doc,.docx,.pdf"
        className="hidden"
        onChange={(event) => {
          void handleFileSelected("form", event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={listInputRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xls,.xlsb,.numbers,.ods"
        className="hidden"
        onChange={(event) => {
          void handleFileSelected("list", event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <Dialog
        open={dialog === "navigation"}
        onClose={() => setDialog(null)}
        title="Workspace navigation"
        description="Switch projects or parties."
      >
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Projects</p>
            <div className="mt-2 space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => selectProject(project)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm font-medium",
                    project.id === selectedProject.id
                      ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-white",
                  )}
                >
                  {project.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">Parties</p>
            <div className="mt-2 space-y-1">
              {selectedProject.parties.map((party) => (
                <button
                  key={party.id}
                  onClick={() => {
                    setSelectedPartyId(party.id);
                    setDialog(null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                    party.id === selectedParty?.id
                      ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-white",
                  )}
                >
                  <span className="truncate">{party.company}</span>
                  <span className={cn("size-2 shrink-0 rounded-full", statusMeta[party.status].dot)} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={showInboxOnboarding}
        onClose={() => setShowInboxOnboarding(false)}
        title="Optional: search your Gmail with AI"
        description="You can skip this now and enable it later in Account settings."
        className="max-w-xl"
      >
        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm leading-6 text-zinc-700">
              If enabled, Prexet makes a private searchable index of your Gmail message text and headers. You can ask things like “When did I last talk to Alex?” or “Find the email about the rent proposal.”
            </p>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-zinc-600">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-black" />Prexet and its AI cannot delete, move, archive, label, edit, or reply to messages.</li>
              <li className="flex gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-black" />Access is read-only, optional, and can be turned off later.</li>
              <li className="flex gap-2"><Paperclip className="mt-0.5 size-4 shrink-0 text-black" />Attachment files are not downloaded into the inbox index.</li>
            </ul>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4">
            <input
              type="checkbox"
              checked={inboxOnboardingChoice}
              onChange={(event) => setInboxOnboardingChoice(event.target.checked)}
              className="mt-0.5 size-4 accent-black"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-950">Enable AI inbox search</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">This is unchecked by default. Google will show the exact read-only permission before anything is connected.</span>
            </span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => void declineInboxOnboarding()}>Not now</Button>
            <Button
              onClick={() => void continueInboxOnboarding()}
              disabled={!inboxOnboardingChoice}
            >
              Continue to Google
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "inbox"}
        onClose={() => setDialog(null)}
        title="Ask your inbox"
        description="Search the messages you chose to index. Answers always link back to supporting Gmail messages."
        className="max-w-3xl"
      >
        {!inboxSettings.enabled ? (
          <div className="p-6">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
              <Inbox className="size-5 text-zinc-700" />
              <h3 className="mt-4 text-sm font-semibold text-zinc-950">Inbox search is off</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                This optional feature creates a private, read-only search index. Prexet cannot delete or change Gmail messages. You can review the details before connecting.
              </p>
              <Button className="mt-4" onClick={() => {
                setDialog("account");
              }}>
                Review inbox setting
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label className="text-xs font-medium text-zinc-700" htmlFor="inbox-mailbox">Search mailbox</label>
                <select
                  id="inbox-mailbox"
                  value={selectedInboxMailboxId}
                  onChange={(event) => setSelectedInboxMailboxId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-black"
                >
                  {mailboxes.filter((mailbox) => mailbox.inboxAccessEnabled).map((mailbox) => (
                    <option key={mailbox.id} value={mailbox.id}>{mailbox.email}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                className="self-end"
                onClick={() => void syncInbox(selectedInboxMailboxId)}
                disabled={!selectedInboxMailboxId || inboxSyncing}
              >
                {inboxSyncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                {inboxSyncing ? "Syncing" : "Sync now"}
              </Button>
            </div>
            {inboxSyncProgress ? <p className="text-xs text-zinc-500">{inboxSyncProgress}</p> : null}

            <div>
              <label className="text-xs font-medium text-zinc-700" htmlFor="inbox-question">Question</label>
              <textarea
                id="inbox-question"
                value={inboxQuestion}
                onChange={(event) => setInboxQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void askInbox();
                }}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-zinc-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-black"
                placeholder="When did I last talk to Morgan about the NDA?"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">Prexet only reads the index. It cannot take actions in Gmail.</p>
                <Button onClick={() => void askInbox()} disabled={inboxBusy || !inboxQuestion.trim()}>
                  {inboxBusy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                  Ask
                </Button>
              </div>
            </div>

            {inboxError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{inboxError}</p> : null}
            {inboxAnswer ? (
              <section className="rounded-xl border border-zinc-200 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Answer</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-800">{inboxAnswer}</p>
              </section>
            ) : null}
            {inboxEvidence.length ? (
              <section>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Supporting emails</p>
                <div className="mt-2 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200">
                  {inboxEvidence.map((message, index) => (
                    <a
                      key={message.id}
                      href={message.gmailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block bg-white p-4 transition hover:bg-zinc-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-950">[{index + 1}] {message.subject}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">From {message.from}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                          {new Date(message.date).toLocaleDateString()}
                          <ExternalLink className="size-3.5" />
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-600">{message.snippet}</p>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </Dialog>

      <Dialog
        open={dialog === "account"}
        onClose={() => setDialog(null)}
        title="Account settings"
        description="Manage sending addresses and optional, read-only inbox search."
        className="max-w-2xl"
      >
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-950">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await authClient.signOut();
                window.location.assign("/");
              }}
            >
              <LogOut />
              Sign out
            </Button>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-950">Sending mailboxes</p>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Access and refresh tokens are encrypted and kept on the server. Sending uses a send-only permission unless you separately enable inbox search.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-zinc-100 text-sm font-bold">G</div>
                <div>
                  <p className="text-sm font-semibold text-zinc-950">Gmail</p>
                  <p className="text-xs text-zinc-500">Google Workspace or Gmail</p>
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={() => void connectMailbox("google")}>
                <Plus />
                Add Gmail
              </Button>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-zinc-100 text-sm font-bold">M</div>
                <div>
                  <p className="text-sm font-semibold text-zinc-950">Outlook / Exchange</p>
                  <p className="text-xs text-zinc-500">Microsoft 365 or Outlook.com</p>
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full" disabled title="Microsoft support is next">
                <Plus />
                Microsoft coming next
              </Button>
            </div>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-800">Connected senders</p>
            {mailboxesLoading ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><LoaderCircle className="size-3.5 animate-spin" />Loading mailboxes</p>
            ) : mailboxes.length ? (
              <div className="mt-3 space-y-2">
                {mailboxes.map((mailbox) => (
                  <div key={mailbox.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">{mailbox.email}</p>
                      <p className="text-xs text-zinc-500">
                        {mailbox.status === "connected" ? "Ready to send" : "Reconnect required"}
                        {mailbox.inboxAccessEnabled ? ` · ${mailbox.inboxMessageCount.toLocaleString()} messages indexed` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => void disconnectMailbox(mailbox.id)}>Disconnect</Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs leading-5 text-zinc-500">No mailboxes connected yet. Add Gmail to start sending.</p>
            )}
          </div>
          <div className="rounded-xl border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Inbox className="size-4 text-zinc-700" />
                  <p className="text-sm font-semibold text-zinc-950">AI inbox search</p>
                  <Badge className="border-zinc-200 bg-zinc-50 text-zinc-600">Optional</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Index message text and headers so you can find emails and ask when you last spoke with someone. Attachments are not downloaded. Prexet cannot delete, move, archive, label, edit, or reply to Gmail messages.
                </p>
              </div>
              <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={inboxSettings.enabled}
                  onChange={(event) => void changeInboxEnabled(event.target.checked)}
                  className="peer sr-only"
                  aria-label="Enable AI inbox search"
                />
                <span className="h-6 w-11 rounded-full bg-zinc-200 transition peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
              </label>
            </div>
            {inboxSettings.enabled ? (
              <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
                {mailboxes.filter((mailbox) => mailbox.inboxAccessEnabled).map((mailbox) => (
                  <div key={mailbox.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-zinc-800">{mailbox.email}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {mailbox.inboxLastSyncedAt
                          ? `Last synced ${new Date(mailbox.inboxLastSyncedAt).toLocaleString()}`
                          : "Not synced yet"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void syncInbox(mailbox.id)}
                      disabled={inboxSyncing}
                    >
                      {inboxSyncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                      {mailbox.inboxLastSyncedAt ? "Sync again" : "Start sync"}
                    </Button>
                  </div>
                ))}
                {inboxSyncProgress ? <p className="text-xs text-zinc-500">{inboxSyncProgress}</p> : null}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <Link href="/privacy" className="hover:text-black">Privacy</Link>
            <Link href="/terms" className="hover:text-black">Terms</Link>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "project"}
        onClose={() => setDialog(null)}
        title="New project"
        description="Give the project a name. You can add everything else next."
      >
        <form className="space-y-4 p-6" onSubmit={handleCreateProject}>
          <Field name="title" label="Project name" placeholder="Morrison Plaza access agreement" autoFocus required />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "recipients"}
        onClose={() => setDialog(null)}
        title="Manage recipients"
        description="Build one clean list, review every row, then save it to the project."
        className="max-w-5xl"
      >
        <div className="space-y-5 p-6">
          <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-zinc-900">Paste spreadsheet rows</span>
              <span className="mt-0.5 block text-xs leading-5 text-zinc-500">Copy name and email columns from Excel, Numbers, or Google Sheets. Headers and either column order work.</span>
              <textarea
                value={pastedRecipients}
                onChange={(event) => setPastedRecipients(event.target.value)}
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-black"
                placeholder={"Name\tEmail\nJane Smith\tjane@acme.com"}
              />
            </label>
            <div className="flex items-end gap-2 lg:flex-col lg:items-stretch lg:justify-end">
              <Button variant="outline" onClick={addPastedRecipientRows} disabled={!pastedRecipients.trim()}>
                <Plus />
                Add pasted rows
              </Button>
              <Button variant="outline" onClick={() => listInputRef.current?.click()}>
                <UploadCloud />
                Upload spreadsheet
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-950">Recipients</p>
                <p className="mt-0.5 text-xs text-zinc-500">Edit names, emails, companies, and stage assignments before saving.</p>
              </div>
              <span className="text-xs font-medium text-zinc-500">{recipientDrafts.filter((draft) => draft.email.trim()).length} ready</span>
            </div>
            <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">
              {recipientDrafts.map((recipient, index) => (
                <div key={recipient.id} className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 sm:grid-cols-[32px_minmax(130px,1fr)_minmax(190px,1.25fr)] lg:grid-cols-[32px_minmax(130px,1fr)_minmax(190px,1.25fr)_minmax(120px,.8fr)_150px_32px]">
                  <span className="grid size-8 place-items-center rounded-md bg-white text-xs font-semibold text-zinc-500">{index + 1}</span>
                  <input
                    value={recipient.name}
                    onChange={(event) => setRecipientDrafts((current) => current.map((draft) => draft.id === recipient.id ? { ...draft, name: event.target.value } : draft))}
                    aria-label={`Recipient ${index + 1} name`}
                    placeholder="Name"
                    className="h-8 min-w-0 rounded-md border border-transparent bg-white px-2 text-sm outline-none focus:border-zinc-300"
                  />
                  <input
                    value={recipient.email}
                    onChange={(event) => setRecipientDrafts((current) => current.map((draft) => draft.id === recipient.id ? { ...draft, email: event.target.value } : draft))}
                    aria-label={`Recipient ${index + 1} email`}
                    placeholder="Email address"
                    type="email"
                    className="h-8 min-w-0 rounded-md border border-transparent bg-white px-2 text-sm outline-none focus:border-zinc-300"
                  />
                  <input
                    value={recipient.company}
                    onChange={(event) => setRecipientDrafts((current) => current.map((draft) => draft.id === recipient.id ? { ...draft, company: event.target.value } : draft))}
                    aria-label={`Recipient ${index + 1} company`}
                    placeholder="Company (optional)"
                    className="h-8 min-w-0 rounded-md border border-transparent bg-white px-2 text-sm outline-none focus:border-zinc-300 sm:col-start-2 lg:col-start-auto"
                  />
                  <select
                    value={recipient.stageId || selectedProject.stages[0]?.id || ""}
                    onChange={(event) => setRecipientDrafts((current) => current.map((draft) => draft.id === recipient.id ? { ...draft, stageId: event.target.value } : draft))}
                    aria-label={`Recipient ${index + 1} stage`}
                    className="h-8 min-w-0 rounded-md border border-transparent bg-white px-2 text-xs font-medium outline-none focus:border-zinc-300"
                  >
                    {selectedProject.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRecipientDrafts((current) => current.filter((draft) => draft.id !== recipient.id))}
                    aria-label={`Remove recipient ${index + 1}`}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              {!recipientDrafts.length ? (
                <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">No recipients yet. Add a row, paste columns, or upload a spreadsheet.</div>
              ) : null}
            </div>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => setRecipientDrafts((current) => [...current, emptyRecipientDraft(selectedProject.stages[0]?.id || "", current.length)])}
            >
              <Plus />
              Add recipient
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
            <p className="text-xs text-zinc-500">Excel, Numbers, CSV, TSV, XLSB, and OpenDocument files are supported.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button onClick={saveRecipientDrafts}>
                Save recipients
              </Button>
              </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "stages"}
        onClose={() => setDialog(null)}
        title="Project stages"
        description="Title each stage once, then use it for parties, documents, and emails throughout this project."
        className="max-w-xl"
      >
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            {stageDrafts.map((stage, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-xs font-semibold text-zinc-500">{index + 1}</span>
                <input
                  value={stage}
                  onChange={(event) => setStageDrafts((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                  autoFocus={index === stageDrafts.length - 1}
                  aria-label={`Stage ${index + 1} title`}
                  placeholder={`Stage ${index + 1}`}
                  className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm font-medium outline-none"
                />
                {stageDrafts.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setStageDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove stage ${index + 1}`}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => setStageDrafts((current) => [...current, `Stage ${current.length + 1}`])}
          >
            <Plus />
            Add stage
          </Button>
          <div className="rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
            If you do nothing, the project stays in Stage 1. Parties can advance independently, while documents and email forms stay attached to their stage.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={saveStages}>Save stages</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "document"}
        onClose={() => setDialog(null)}
        title="Add document"
        description="Choose the stage where this document becomes available."
      >
        <div className="space-y-5 p-6">
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Available in stage</span>
            <select
              value={documentStageId}
              onChange={(event) => setDocumentStageId(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-black"
            >
              {selectedProject.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
          </label>
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
            <FileText className="mx-auto size-6 text-zinc-500" />
            <p className="mt-2 text-sm font-medium text-zinc-800">Word or PDF document</p>
            <p className="mt-1 text-xs text-zinc-500">The original file will remain associated with this stage.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={() => formInputRef.current?.click()}>
              <UploadCloud />
              Choose file
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "brief"}
        onClose={() => setDialog(null)}
        title="AI negotiation brief"
        description="The AI prompt is stored per project and applied to each returned marked document."
        className="max-w-2xl"
      >
        <div className="space-y-5 p-6">
          <p className="text-sm leading-6 text-slate-600">{selectedProject.summary}</p>
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <ShieldCheck className="size-4 text-[var(--accent-strong)]" />
              Acceptance authority
            </span>
            <textarea
              value={authorityDraft}
              onChange={(event) => setAuthorityDraft(event.target.value)}
              rows={8}
              className="mt-2 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--ring)]"
              placeholder="Add one acceptance rule per line."
            />
            <span className="mt-2 block text-xs leading-5 text-slate-500">
              One rule per line. Returned Word changes will be compared with these guardrails before a recommendation is made.
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={saveAuthority}>Save authority</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "redline"}
        onClose={() => setDialog(null)}
        title="Generate Word redline"
        description="Prexet reviews the document against this project's authority and returns a native Word file with tracked changes."
        className="max-w-3xl"
      >
        <div className="space-y-5 p-6">
          <label className="block rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center">
            <FileText className="mx-auto size-6 text-zinc-500" />
            <span className="mt-2 block text-sm font-medium text-zinc-900">
              {redlineFile?.name || "Choose a Word document"}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">DOCX only · up to 10 MB</span>
            <input
              type="file"
              accept=".docx"
              className="sr-only"
              onChange={(event) => {
                setRedlineFile(event.target.files?.[0]);
                setRedlineError("");
              }}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Redline instructions</span>
            <textarea
              value={redlineInstructions}
              onChange={(event) => setRedlineInstructions(event.target.value)}
              rows={6}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm leading-6 outline-none focus:border-black"
              placeholder="Describe what can be accepted, rejected, or escalated."
            />
          </label>
          {redlineError ? (
            <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-700">{redlineError}</div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs leading-5 text-zinc-500">The OpenRouter key is used only by the server. The returned document retains real Word insertions and deletions.</p>
            <Button onClick={() => void generateRedline()} disabled={!redlineFile || redlineBusy}>
              {redlineBusy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              {redlineBusy ? "Marking up…" : "Generate and download"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "email"}
        onClose={() => setDialog(null)}
        title="Create transmission drafts"
        description="Use one standard message to create a separate reviewable draft for each selected recipient."
        className="max-w-2xl"
      >
        <div className="space-y-5 p-6">
          <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600">
            Drafts only. No email is sent from this screen. You will review the exact subject, message, attachments, and recipient copy next.
          </div>
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">From</span>
            <div className="mt-1 flex gap-2">
              <select className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-black">
                <option>Prexet delivery service (SES shell)</option>
              </select>
              <Button variant="outline" onClick={() => setDialog("account")}>
                <Settings />
                Mailboxes
              </Button>
            </div>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-800">Stage</span>
              <select
                value={emailStageId}
                onChange={(event) => applyEmailTemplate(event.target.value, undefined, "all")}
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-black"
              >
                {selectedProject.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-800">Email form</span>
              <div className="mt-1 flex gap-2">
                <select
                  value={emailTemplateId}
                  onChange={(event) => applyEmailTemplate(emailStageId, event.target.value, "all")}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-black"
                >
                  {emailStageTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailTemplateId("");
                    setEmailTemplateName("New email form");
                    setEmailSubject(`${selectedProject.title}: ${emailStage?.name || "project update"}`);
                    setEmailBodyHtml(plainTextToHtml("Please review the attached materials and reply with any questions."));
                  }}
                >
                  <Plus />
                  New
                </Button>
              </div>
            </label>
          </div>

          <Field label="Form name" name="templateName" value={emailTemplateName} onChange={(event) => setEmailTemplateName(event.target.value)} />
          <Field label="Subject" name="subject" value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} />
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-800">Message</span>
              <span className="text-xs text-zinc-500">Use {"{{first_name}}"} to personalize each copy</span>
            </div>
            <RichTextEmailEditor value={emailBodyHtml} onChange={setEmailBodyHtml} compact />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-800">Recipients in {emailStage?.name || "stage"}</span>
              <button
                type="button"
                onClick={() => setEmailRecipientIds(emailRecipientIds.length === emailStageParties.length ? [] : emailStageParties.map((party) => party.id))}
                className="text-xs font-medium text-zinc-500 hover:text-black"
              >
                {emailRecipientIds.length === emailStageParties.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-[var(--border)]">
              {emailStageParties.length ? emailStageParties.map((party) => (
                <label key={party.id} className="flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-b-0 hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={emailRecipientIds.includes(party.id)}
                    onChange={(event) => setEmailRecipientIds((current) => event.target.checked
                      ? [...current, party.id]
                      : current.filter((id) => id !== party.id))}
                    className="size-4 accent-black"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">{party.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{party.email}</span>
                  </span>
                </label>
              )) : <p className="p-4 text-sm text-zinc-500">Move parties into this stage before sending.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-zinc-50 p-3 text-sm text-zinc-600">
            <Paperclip className="mr-2 inline size-4" />
            {emailStage?.documentNames.length ? emailStage.documentNames.join(", ") : "No documents attached to this stage"}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={saveEmailTemplate}>Save form</Button>
            <Button onClick={createDraftsFromEmailForm} disabled={!emailRecipientIds.length}>
              <Mail />
              Create {emailRecipientIds.length || 0} drafts
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "draft"}
        onClose={() => setDialog(null)}
        title={editingDraftParty ? `Draft for ${editingDraftParty.name}` : "Review email draft"}
        description="This is the exact recipient copy. Nothing sends until you click Send email."
        className="max-w-4xl"
      >
        {editingDraft && editingDraftParty ? (
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black bg-black px-4 py-3 text-white">
              <div>
                <p className="text-xs font-bold tracking-[0.16em]">DRAFT — NOT SENT</p>
                <p className="mt-1 text-xs text-zinc-300">Review every field below as the recipient will receive it.</p>
              </div>
              {editingDraft.customized ? <span className="rounded-full border border-zinc-600 px-2.5 py-1 text-[11px]">Customized</span> : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="grid gap-px bg-zinc-200 sm:grid-cols-[110px_1fr]">
                <div className="bg-zinc-50 px-3 py-2.5 text-xs font-medium text-zinc-500">From</div>
                <div className="bg-white p-2">
                  {mailboxes.some((mailbox) => mailbox.status === "connected") ? (
                    <select
                      value={selectedMailboxId}
                      onChange={(event) => setSelectedMailboxId(event.target.value)}
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm outline-none focus:border-black"
                    >
                      {mailboxes.filter((mailbox) => mailbox.status === "connected").map((mailbox) => (
                        <option key={mailbox.id} value={mailbox.id}>{mailbox.email}</option>
                      ))}
                    </select>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setDialog("account")}>Connect Gmail</Button>
                  )}
                </div>
                <div className="bg-zinc-50 px-3 py-2.5 text-xs font-medium text-zinc-500">To</div>
                <div className="bg-white px-3 py-2.5 text-sm text-zinc-800">
                  {editingDraftParty.name} <span className="text-zinc-500">&lt;{editingDraftParty.email}&gt;</span>
                </div>
                <div className="bg-zinc-50 px-3 py-2.5 text-xs font-medium text-zinc-500">Subject</div>
                <div className="bg-white p-2">
                  <input
                    value={draftSubject}
                    onChange={(event) => setDraftSubject(event.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-200 px-2.5 text-sm outline-none focus:border-black"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-800">Message</span>
                <span className="text-xs text-zinc-500">Formatting and pasted signatures are preserved</span>
              </div>
              <RichTextEmailEditor value={draftBodyHtml} onChange={setDraftBodyHtml} />
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-800">Attachments recipient will receive</p>
              <div className="mt-2 space-y-2">
                {editingDraft.attachmentNames.length ? editingDraft.attachmentNames.map((name) => (
                  <div key={name} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                    <Paperclip className="size-4 text-zinc-500" />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{name}</span>
                    <span className="text-[11px] font-medium text-zinc-500">{documentFiles[name] ? "READY" : "RE-UPLOAD"}</span>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500">No attachments on this draft.</div>
                )}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:border-zinc-500">
                  <UploadCloud className="size-4" />
                  Add or re-upload attachment files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files || []);
                      if (!files.length) return;
                      setDocumentFiles((current) => ({
                        ...current,
                        ...Object.fromEntries(files.map((file) => [file.name, file])),
                      }));
                      setProjects((current) => current.map((project) => project.id === selectedProject.id
                        ? {
                            ...project,
                            emailDrafts: project.emailDrafts.map((draft) => draft.id === editingDraft.id
                              ? { ...draft, attachmentNames: Array.from(new Set([...draft.attachmentNames, ...files.map((file) => file.name)])) }
                              : draft),
                          }
                        : project));
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
              <p className="text-xs text-zinc-500">Sending is immediate and the message appears in the connected Gmail Sent folder.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => saveDraft()}>Save draft</Button>
                <Button onClick={() => void saveAndQueueDraft()} disabled={sendBusy || !selectedMailboxId}>
                  {sendBusy ? <LoaderCircle className="animate-spin" /> : <Send />}
                  Send email
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function ProjectSetup({
  project,
  onAddStages,
  onAddList,
  onAddForm,
  onAddInstructions,
}: {
  project: Project;
  onAddStages: () => void;
  onAddList: () => void;
  onAddForm: () => void;
  onAddInstructions: () => void;
}) {
  const listAdded = project.parties.length > 0;
  const stagesAdded = project.stages.length > 0;
  const formCount = project.stages.reduce((total, stage) => total + stage.documentNames.length, 0);
  const formAdded = formCount > 0;
  const instructionsAdded = project.guardrails.length > 0;

  return (
    <div className="project-setup">
      <div className="project-setup-intro">
        <p className="eyebrow">Project setup</p>
        <h2>What does this project need?</h2>
        <p>Set the workflow, add the parties, then attach the documents they receive at each stage.</p>
      </div>

      <div className="project-setup-list">
        <SetupItem
          icon={Layers3}
          title="Stages"
          description={project.stages.map((stage) => stage.name).join(" → ") || "Stage 1"}
          complete={stagesAdded}
          actionLabel="Add stage"
          onAction={onAddStages}
        />
        <SetupItem
          icon={Users}
          title="Recipient list"
          description={listAdded ? `${project.parties.length} recipients added` : "Paste rows or upload Excel, Numbers, CSV, or another spreadsheet."}
          complete={listAdded}
          actionLabel={listAdded ? "Manage" : "Add recipients"}
          onAction={onAddList}
        />
        <SetupItem
          icon={FileText}
          title="Stage documents"
          description={formAdded ? `${formCount} ${formCount === 1 ? "document" : "documents"} assigned` : "Upload the Word or PDF documents available at a stage."}
          complete={formAdded}
          actionLabel={formAdded ? "Add another" : "Add document"}
          onAction={onAddForm}
        />
        <SetupItem
          icon={Sparkles}
          title="AI review instructions"
          description={instructionsAdded ? `${project.guardrails.length} instructions saved` : "Describe what can be accepted and what should be escalated."}
          complete={instructionsAdded}
          optional
          actionLabel={instructionsAdded ? "Edit" : "Add instructions"}
          onAction={onAddInstructions}
        />
      </div>

      {!listAdded || !formAdded ? (
        <p className="project-setup-note">Add recipients and the first document to continue. Stage 1 is already ready.</p>
      ) : null}
    </div>
  );
}

function SetupItem({
  icon: Icon,
  title,
  description,
  complete,
  optional = false,
  actionLabel,
  onAction,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  complete: boolean;
  optional?: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="setup-item">
      <div className="setup-item-icon"><Icon /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3>{title}</h3>
          {complete ? <span className="setup-state">Added</span> : null}
          {optional && !complete ? <span className="setup-optional">Optional</span> : null}
        </div>
        <p>{description}</p>
      </div>
      <Button variant={complete ? "ghost" : "outline"} onClick={onAction}>{actionLabel}</Button>
    </div>
  );
}

function Overview({
  selectedProject,
  selectedParty,
  onSelectParty,
  onAddParty,
  onEditAuthority,
  onOpenRedlines,
  onQueueEmail,
  onQueueStageEmail,
  onChangeStatus,
  onMoveParty,
  onEditStages,
  onAddDocument,
}: {
  selectedProject: Project;
  selectedParty?: Party;
  onSelectParty: (partyId: string) => void;
  onAddParty: () => void;
  onEditAuthority: () => void;
  onOpenRedlines: () => void;
  onQueueEmail: () => void;
  onQueueStageEmail: (stageId: string) => void;
  onChangeStatus: (status: PartyStatus) => void;
  onMoveParty: (stageId: string) => void;
  onEditStages: () => void;
  onAddDocument: (stageId?: string) => void;
}) {
  return (
    <div className="overview-grid">
      <div className="space-y-5">
        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Workflow</p>
              <h2>{selectedProject.stages.length} project {selectedProject.stages.length === 1 ? "stage" : "stages"}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onEditStages}>
              <Plus />
              Add stage
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {selectedProject.stages.map((stage, index) => {
              const partyCount = selectedProject.parties.filter((party) => stageIdForParty(party, selectedProject) === stage.id).length;
              return (
                <div key={stage.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-500">Stage {index + 1}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">{stage.name}</p>
                    </div>
                    {stage.unlockAfterStageId ? <LockKeyhole className="size-4 text-zinc-400" /> : null}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">{partyCount} {partyCount === 1 ? "party" : "parties"} · {stage.documentNames.length} {stage.documentNames.length === 1 ? "document" : "documents"}</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onAddDocument(stage.id)}>
                      <Paperclip />
                      Add file
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onQueueStageEmail(stage.id)} disabled={!partyCount}>
                      <Mail />
                      Email
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Parties</p>
              <h2>{selectedProject.parties.length} recipients</h2>
            </div>
            <Button variant="outline" size="sm" onClick={onAddParty}>
              <UserPlus />
              Add recipient
            </Button>
          </div>
          <div className="party-directory mt-4">
            {selectedProject.parties.map((party) => (
              <button
                key={party.id}
                onClick={() => onSelectParty(party.id)}
                className={cn("party-directory-row", selectedParty?.id === party.id && "is-selected")}
              >
                <Avatar className="size-8 bg-zinc-100">{party.initials}</Avatar>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-zinc-950">{party.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{party.email}</span>
                </span>
                <span className="hidden max-w-32 truncate text-xs text-zinc-500 lg:block">{stageNameForParty(party, selectedProject)}</span>
                <Badge className={statusMeta[party.status].tone}>{statusMeta[party.status].label}</Badge>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">AI summary</p>
              <h2>Project position</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onEditAuthority}>
              <Sparkles />
              Edit instructions
            </Button>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{selectedProject.summary}</p>
          {selectedProject.guardrails.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedProject.guardrails.slice(0, 4).map((guardrail) => (
                <div key={guardrail} className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm leading-5 text-slate-700">
                  {guardrail}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">No AI review instructions yet.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Document</p>
              <h2>Latest redlines</h2>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenRedlines}>
              <Eye />
              Review
            </Button>
          </div>
          <RedlinePreview />
        </section>
      </div>

      <aside className="space-y-5">
        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Selected party</p>
              <h2>{selectedParty?.company ?? "No party yet"}</h2>
            </div>
            <MoreHorizontal className="size-4 text-slate-400" />
          </div>
          {selectedParty ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">{selectedParty.initials}</Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{selectedParty.name}</p>
                  <p className="truncate text-xs text-slate-500">{selectedParty.email}</p>
                </div>
              </div>
              <Badge className={statusMeta[selectedParty.status].tone}>{statusMeta[selectedParty.status].label}</Badge>
              <label className="block">
                <span className="eyebrow">Current stage</span>
                <select
                  value={stageIdForParty(selectedParty, selectedProject)}
                  onChange={(event) => onMoveParty(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-black"
                >
                  {selectedProject.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
              </label>
              <div>
                <p className="eyebrow">Returned changes</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{selectedParty.editSummary}</p>
              </div>
              <div>
                <p className="eyebrow">AI allocation</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{selectedParty.aiPosition}</p>
              </div>
              <div>
                <p className="eyebrow">Party outcome</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <Button
                    variant={selectedParty.status === "accepted" ? "accent" : "outline"}
                    size="sm"
                    onClick={() => onChangeStatus("accepted")}
                    aria-label="Mark accepted"
                  >
                    <CheckCircle2 />
                    Accept
                  </Button>
                  <Button
                    variant={selectedParty.status === "attention" ? "danger" : "outline"}
                    size="sm"
                    onClick={() => onChangeStatus("attention")}
                    aria-label="Mark as needing review"
                  >
                    <AlertTriangle />
                    Review
                  </Button>
                  <Button
                    variant={selectedParty.status === "pending" ? "subtle" : "outline"}
                    size="sm"
                    onClick={() => onChangeStatus("pending")}
                    aria-label="Mark pending"
                  >
                    <Clock3 />
                    Pending
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={onQueueEmail}>
                  <Mail />
                  Email
                </Button>
                <Button variant="accent" onClick={onOpenRedlines}>
                  <PencilLine />
                  Markup
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Add a party or import an email list.</p>
          )}
        </section>

      </aside>
    </div>
  );
}

function TransmissionDrafts({
  project,
  mailboxes,
  selectedMailboxId,
  sending,
  onChangeMailbox,
  selectedDraftIds,
  onChangeSelection,
  onOpenDraft,
  onCreateDrafts,
  onQueueDrafts,
}: {
  project: Project;
  mailboxes: MailboxAccount[];
  selectedMailboxId: string;
  sending: boolean;
  onChangeMailbox: (mailboxId: string) => void;
  selectedDraftIds: string[];
  onChangeSelection: (ids: string[]) => void;
  onOpenDraft: (draftId: string) => void;
  onCreateDrafts: () => void;
  onQueueDrafts: (draftIds: string[]) => void;
}) {
  const drafts = project.emailDrafts.filter((draft) => project.parties.some((party) => party.id === draft.partyId));
  const allSelected = drafts.length > 0 && drafts.every((draft) => selectedDraftIds.includes(draft.id));
  const sentCount = drafts.filter((draft) => draft.status === "sent").length;

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-5">
          <div>
            <p className="eyebrow">Outreach</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">Transmission drafts</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
              Each row is a separate recipient copy. Review the subject, message, and attachments before sending anything.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mailboxes.some((mailbox) => mailbox.status === "connected") ? (
              <select
                value={selectedMailboxId}
                onChange={(event) => onChangeMailbox(event.target.value)}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-black"
                aria-label="Sending mailbox"
              >
                {mailboxes.filter((mailbox) => mailbox.status === "connected").map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>From {mailbox.email}</option>
                ))}
              </select>
            ) : null}
            <Button variant="outline" onClick={onCreateDrafts}><Plus />Create drafts</Button>
            <Button onClick={() => onQueueDrafts(selectedDraftIds)} disabled={!selectedDraftIds.length || sending || !selectedMailboxId}>
              {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
              {sending ? "Sending" : `Send selected (${selectedDraftIds.length})`}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChangeSelection(allSelected ? [] : drafts.map((draft) => draft.id))}
              className="size-4 accent-black"
            />
            Select all {drafts.length}
          </label>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{drafts.length - sentCount} drafts</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span>{sentCount} sent</span>
          </div>
        </div>

        {drafts.length ? (
          <div className="divide-y divide-zinc-200">
            {drafts.map((draft) => {
              const party = project.parties.find((item) => item.id === draft.partyId);
              const stage = project.stages.find((item) => item.id === draft.stageId);
              if (!party) return null;
              return (
                <div key={draft.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 px-5 py-4 transition hover:bg-zinc-50 lg:grid-cols-[28px_220px_minmax(0,1fr)_180px_100px]">
                  <label className="mt-1.5 grid size-5 cursor-pointer place-items-center">
                    <input
                      type="checkbox"
                      checked={selectedDraftIds.includes(draft.id)}
                      onChange={(event) => onChangeSelection(event.target.checked
                        ? [...selectedDraftIds, draft.id]
                        : selectedDraftIds.filter((id) => id !== draft.id))}
                      className="size-4 accent-black"
                      aria-label={`Select draft for ${party.name}`}
                    />
                  </label>
                  <button type="button" onClick={() => onOpenDraft(draft.id)} className="min-w-0 text-left lg:contents">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-950">{party.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{party.email}</span>
                      <span className="mt-1 block text-[11px] text-zinc-400 lg:hidden">{stage?.name || "Unassigned stage"}</span>
                    </span>
                    <span className="mt-3 block min-w-0 lg:mt-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">{draft.subject}</span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">{htmlToPreviewText(draft.bodyHtml)}</span>
                    </span>
                    <span className="mt-3 hidden min-w-0 lg:block">
                      <span className="block truncate text-xs font-medium text-zinc-700">{stage?.name || "Unassigned stage"}</span>
                      <span className="mt-1 flex items-center gap-1 truncate text-xs text-zinc-500">
                        <Paperclip className="size-3" />
                        {draft.attachmentNames.length ? `${draft.attachmentNames.length} attached` : "No attachments"}
                      </span>
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-2 lg:mt-0 lg:block">
                      <Badge className={draft.status === "sent"
                        ? "border-black bg-black text-white"
                        : "border-zinc-300 bg-white text-zinc-700"}
                      >
                        {draft.status === "sent" ? "Sent" : draft.status === "ready" ? "Ready" : "Draft"}
                      </Badge>
                      {draft.customized ? <span className="ml-2 text-[10px] font-medium text-zinc-500">CUSTOM</span> : null}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-10 place-items-center rounded-lg border border-zinc-200 bg-zinc-50"><Mail className="size-4 text-zinc-500" /></div>
              <h3 className="mt-3 text-sm font-semibold text-zinc-950">No transmission drafts yet</h3>
              <p className="mt-1 text-sm text-zinc-500">Choose a stage email form and recipients to create individual copies.</p>
              <Button className="mt-4" onClick={onCreateDrafts}><Plus />Create drafts</Button>
            </div>
          </div>
        )}
      </section>

      <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-600">
        <strong className="font-semibold text-zinc-900">Before sending:</strong> each selected row sends immediately through the chosen Gmail account. Review recipient, subject, body, and attachments first.
      </div>
    </div>
  );
}

function htmlToPreviewText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function Documents({ selectedProject, onUpload }: { selectedProject: Project; onUpload: (stageId?: string) => void }) {
  return (
    <div className="space-y-5">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Files</p>
            <h2>Current document package</h2>
          </div>
          <Button variant="outline" onClick={() => onUpload()}>
            <UploadCloud />
            Upload
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {selectedProject.stages.map((stage, index) => (
            <div key={stage.id} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500">Stage {index + 1}</p>
                  <p className="text-sm font-semibold text-zinc-950">{stage.name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onUpload(stage.id)}><Plus />Add document</Button>
              </div>
              {stage.documentNames.length ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {stage.documentNames.map((documentName) => (
                    <div key={documentName} className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                      <FileText className="size-4 text-zinc-500" />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{documentName}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-zinc-500">No documents attached to this stage.</p>}
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-2">
            <FileCard icon={Inbox} title="Party email list" detail={`${selectedProject.parties.length} recipients loaded`} />
            <FileCard icon={MessageSquareText} title="AI authority prompt" detail={`${selectedProject.guardrails.length} guardrails saved`} />
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2>Word-native architecture</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            "Store original and returned `.docx` files in Supabase Storage.",
            "Extract tracked changes and comments into structured review records.",
            "Run AI only on extracted deltas plus project authority.",
            "Return final accepted changes through Word, preserving revision history.",
          ].map((step, index) => (
            <div key={step} className="rounded-lg border border-[var(--border)] bg-white p-4">
              <div className="mb-3 grid size-7 place-items-center rounded-md bg-slate-950 text-xs font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-slate-600">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActivityLog({ selectedProject }: { selectedProject: Project }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>Project activity</h2>
        </div>
        <Activity className="size-4 text-slate-400" />
      </div>
      <div className="mt-5 space-y-4">
        {selectedProject.activity.map((item, index) => (
          <div key={item} className="flex gap-3">
            <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-xs font-semibold text-slate-500">
              {index + 1}
            </div>
            <div className="min-w-0 border-b border-[var(--border)] pb-4">
              <p className="text-sm font-medium text-slate-800">{item}</p>
              <p className="mt-1 text-xs text-slate-500">Captured in project record</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RedlinePreview({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className={cn("word-page mt-4", expanded && "max-h-none")}>
      <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Section 4. Access</p>
          <p className="text-sm text-slate-500">Tracked changes preview</p>
        </div>
        <Button variant="outline" size="sm">
          <Download />
          Export
        </Button>
      </div>
      <p>
        Contractor may access the premises during normal business hours with at least{" "}
        <span className="delete">ten (10)</span>{" "}
        <span className="insert">thirty (30)</span> days prior written notice to Owner.
      </p>
      <p>
        Emergency maintenance access is permitted only when{" "}
        <span className="comment">necessary to prevent material property damage</span> and after notice to the property manager.
      </p>
      <p>
        Reimbursement for access-related costs will be limited to{" "}
        <span className="insert">documented, reasonable out-of-pocket expenses</span>.
      </p>
    </div>
  );
}

function FileCard({ icon: Icon, title, detail }: { icon: typeof FileText; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <Icon className="mb-4 size-5 text-[var(--accent-strong)]" />
      <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...props
}: {
  label: string;
  name: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--ring)]"
        {...props}
      />
    </label>
  );
}
