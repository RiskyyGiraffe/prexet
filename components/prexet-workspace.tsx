"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderKanban,
  Inbox,
  Mail,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserPlus,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type PartyStatus = "attention" | "pending" | "accepted" | "no_response";
type TabId = "overview" | "documents" | "activity";
type DialogId = "project" | "party" | "brief" | "redline" | "email" | "navigation" | null;
type EmailAudience = "all" | "selected";

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
};

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

const initialProjects: Project[] = [
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
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

function partiesFromCsv(csv: string) {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((row) => row.some(Boolean));
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z]/g, ""));
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const emailColumn = column("email", "emailaddress", "mail");
  const nameColumn = column("name", "fullname", "contact", "contactname");
  const companyColumn = column("company", "organization", "organisation", "firm");

  if (emailColumn < 0) return [];

  return rows.slice(1).flatMap((row, index) => {
    const email = row[emailColumn]?.trim();
    if (!email || !email.includes("@")) return [];
    const name = row[nameColumn]?.trim() || email.split("@")[0].replace(/[._-]+/g, " ");
    const company = row[companyColumn]?.trim() || "Unassigned company";
    return [{
      id: `imported-${Date.now()}-${index}`,
      name: name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      company,
      email,
      initials: initialsFor(name),
      status: "pending" as PartyStatus,
      lastTouch: "Just imported",
      clauseCount: 0,
      editSummary: "Added from the uploaded email list. No markup returned yet.",
      aiPosition: "Pending review.",
    }];
  });
}

export function PrexetWorkspace() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0].id);
  const [selectedPartyId, setSelectedPartyId] = useState(initialProjects[0].parties[0].id);
  const [projectQuery, setProjectQuery] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [dialog, setDialog] = useState<DialogId>(null);
  const [emailAudience, setEmailAudience] = useState<EmailAudience>("all");
  const [authorityDraft, setAuthorityDraft] = useState(initialProjects[0].guardrails.join("\n"));
  const [toast, setToast] = useState("");
  const [projectSidebarWidth, setProjectSidebarWidth] = useState(280);
  const [projectSidebarCollapsed, setProjectSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<PartyStatus, boolean>>({
    attention: true,
    pending: true,
    accepted: true,
    no_response: true,
  });

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

  const acceptedCount = countByStatus(selectedProject, "accepted");
  const attentionCount = countByStatus(selectedProject, "attention");
  const responseCount = acceptedCount + attentionCount;

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
    setAuthorityDraft(project.guardrails.join("\n"));
    setDialog(null);
  }

  async function handleFileSelected(kind: "form" | "list", file?: File) {
    if (!file) return;

    if (kind === "form") {
      setProjects((current) => current.map((project) => project.id === selectedProject.id
        ? {
            ...project,
            documentName: file.name,
            activity: [`${file.name} uploaded as the current form.`, ...project.activity],
          }
        : project));
      setToast(`Current form updated: ${file.name}`);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setToast(`${file.name} staged. Excel parsing will run through the Supabase import worker.`);
      return;
    }

    const importedParties = partiesFromCsv(await file.text());
    if (!importedParties.length) {
      setToast("No recipients found. Include Email, Name, and Company columns.");
      return;
    }

    const existingEmails = new Set(selectedProject.parties.map((party) => party.email.toLowerCase()));
    const uniqueImports = importedParties.filter((party) => !existingEmails.has(party.email.toLowerCase()));
    if (!uniqueImports.length) {
      setToast("Everyone in that list is already in this project.");
      return;
    }

    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      return {
        ...project,
        parties: [...uniqueImports, ...project.parties],
        activity: [`${uniqueImports.length} parties imported from ${file.name}.`, ...project.activity],
      };
    }));
    setSelectedPartyId(uniqueImports[0].id);
    setToast(`${uniqueImports.length} recipients imported from ${file.name}`);
  }

  function openBrief() {
    setAuthorityDraft(selectedProject.guardrails.join("\n"));
    setDialog("brief");
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
    setProjects((current) => current.map((project) => project.id === selectedProject.id
      ? {
          ...project,
          parties: project.parties.map((party) => party.id === selectedParty.id
            ? { ...party, status, lastTouch: "Just now" }
            : party),
          activity: [`${selectedParty.company} moved to ${label.toLowerCase()}.`, ...project.activity],
        }
      : project));
    setToast(`${selectedParty.company}: ${label}`);
  }

  function openEmail(audience: EmailAudience) {
    setEmailAudience(audience);
    setDialog("email");
  }

  function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "Untitled project");
    const documentName = String(form.get("documentName") || "Form_Document.docx");
    const newProject: Project = {
      id: `project-${Date.now()}`,
      title,
      reference: String(form.get("reference") || "PX-NEW"),
      documentName,
      due: String(form.get("due") || "TBD"),
      round: "Initial send",
      owner: "You",
      guardrails: String(form.get("guardrails") || "Confirm changes before accepting.")
        .split("\n")
        .filter(Boolean),
      summary: "New project shell created. Import an email list and upload the form document.",
      activity: ["Project created."],
      parties: [],
    };
    setProjects((current) => [newProject, ...current]);
    setSelectedProjectId(newProject.id);
    setSelectedPartyId("");
    setDialog(null);
    setToast("Project created");
  }

  function handleAddParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "New party");
    const newParty: Party = {
      id: `party-${Date.now()}`,
      name,
      company: String(form.get("company") || "Unassigned company"),
      email: String(form.get("email") || "contact@example.com"),
      initials: initialsFor(name),
      status: "pending",
      lastTouch: "Just now",
      clauseCount: 0,
      editSummary: "Added to the outbound list. No markup returned yet.",
      aiPosition: "Pending review.",
    };
    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              activity: [`${newParty.name} added to email list.`, ...project.activity],
              parties: [newParty, ...project.parties],
            }
          : project,
      ),
    );
    setSelectedPartyId(newParty.id);
    setDialog(null);
    setToast("Party added");
  }

  function queueEmail() {
    const recipientLabel = emailAudience === "selected" && selectedParty
      ? selectedParty.company
      : `${selectedProject.parties.length} project parties`;
    setProjects((current) => current.map((project) => project.id === selectedProject.id
      ? { ...project, activity: [`Email package queued for ${recipientLabel}.`, ...project.activity] }
      : project));
    setDialog(null);
    setToast(`Email queued for ${recipientLabel} in the SES shell`);
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
                <div className="rail-brand-mark grid size-8 shrink-0 place-items-center rounded-lg bg-black text-xs font-black text-white">
                  px
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
            <Button variant="ghost" className="w-full justify-start px-2.5 text-zinc-600 hover:bg-white hover:text-black">
              <Avatar className="size-6 bg-black text-[10px] text-white">RL</Avatar>
              <span className="rail-copy min-w-0 flex-1 truncate text-left">Ryan Lane</span>
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

      <aside className="party-panel border-r border-[var(--border)] bg-white">
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Parties</p>
                <h2 className="mt-1 truncate text-base font-semibold text-slate-950">{selectedProject.title}</h2>
              </div>
              <Button variant="outline" size="icon-sm" onClick={() => setDialog("party")} aria-label="Add party">
                <UserPlus />
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => listInputRef.current?.click()}>
                <UploadCloud />
                Import list
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEmail("all")}>
                <Send />
                Send
              </Button>
            </div>

            <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-slate-50 px-2.5 text-slate-500">
              <Search className="size-4" />
              <input
                value={partyQuery}
                onChange={(event) => setPartyQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Search parties"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {statusOrder.map((status) => {
              const parties = selectedProject.parties.filter(
                (party) =>
                  party.status === status &&
                  `${party.name} ${party.company}`.toLowerCase().includes(partyQuery.toLowerCase()),
              );
              return (
                <section key={status} className="mb-3">
                  <button
                    className="flex w-full items-center justify-between rounded-md px-1.5 py-2 text-left"
                    onClick={() => setOpenGroups((current) => ({ ...current, [status]: !current[status] }))}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("size-2 rounded-full", statusMeta[status].dot)} />
                      <span className="truncate text-xs font-semibold uppercase text-slate-600">
                        {statusMeta[status].label}
                      </span>
                      <span className="text-xs text-slate-400">{parties.length}</span>
                    </span>
                    <ChevronDown className={cn("size-4 text-slate-400 transition", !openGroups[status] && "-rotate-90")} />
                  </button>
                  {openGroups[status] ? (
                    <div className="space-y-1">
                      {parties.map((party) => {
                        const isSelected = selectedParty?.id === party.id;
                        return (
                          <button
                            key={party.id}
                            onClick={() => setSelectedPartyId(party.id)}
                            className={cn(
                              "w-full rounded-lg border p-2.5 text-left transition",
                              isSelected
                                ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]"
                                : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                            )}
                          >
                            <div className="flex gap-2.5">
                              <Avatar>{party.initials}</Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-slate-950">{party.name}</p>
                                  {party.clauseCount ? (
                                    <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                      {party.clauseCount}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="truncate text-xs text-slate-500">{party.company}</p>
                                <p className="mt-1 truncate text-xs text-slate-400">{party.lastTouch}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
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
                <Badge className={statusMeta.attention.tone}>{attentionCount} need review</Badge>
                <Badge className="border-slate-200 bg-white text-slate-700">
                  <CalendarDays className="size-3.5" />
                  Due {selectedProject.due}
                </Badge>
                <Badge className="border-slate-200 bg-white text-slate-700">
                  <FileText className="size-3.5" />
                  {selectedProject.documentName}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => formInputRef.current?.click()}>
                <UploadCloud />
                Upload form
              </Button>
              <Button variant="outline" onClick={() => setDialog("redline")}>
                <Eye />
                Redlines
              </Button>
              <Button variant="accent" onClick={openBrief}>
                <Sparkles />
                AI brief
              </Button>
            </div>
          </div>
          <div className="mt-4 flex gap-1 border-b border-transparent">
            {(["overview", "documents", "activity"] as TabId[]).map((tab) => (
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
        </header>

        <section className="workspace-content">
          {activeTab === "overview" ? (
            <Overview
              selectedProject={selectedProject}
              selectedParty={selectedParty}
              acceptedPercent={percent(acceptedCount, selectedProject.parties.length)}
              responsePercent={percent(responseCount, selectedProject.parties.length)}
              onOpenRedlines={() => setDialog("redline")}
              onQueueEmail={() => openEmail("selected")}
              onChangeStatus={updatePartyStatus}
            />
          ) : null}
          {activeTab === "documents" ? (
            <Documents selectedProject={selectedProject} onUpload={() => formInputRef.current?.click()} />
          ) : null}
          {activeTab === "activity" ? <ActivityLog selectedProject={selectedProject} /> : null}
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
        accept=".csv,.xlsx"
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
        open={dialog === "project"}
        onClose={() => setDialog(null)}
        title="New project"
        description="Create the shell for a form document, party list, and AI review authority."
      >
        <form className="space-y-4 p-6" onSubmit={handleCreateProject}>
          <Field name="title" label="Project name" placeholder="Project or agreement name" required />
          <div className="grid grid-cols-2 gap-3">
            <Field name="reference" label="Reference" placeholder="PX-2026-01" />
            <Field name="due" label="Due date" placeholder="Aug 15" />
          </div>
          <Field name="documentName" label="Form document" placeholder="Form_Agreement.docx" />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">AI authority</span>
            <textarea
              name="guardrails"
              rows={4}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--ring)]"
              placeholder="Accept typo fixes. Reject economic changes without approval."
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "party"}
        onClose={() => setDialog(null)}
        title="Add party"
        description="Add a recipient to the current project."
      >
        <form className="space-y-4 p-6" onSubmit={handleAddParty}>
          <Field name="name" label="Contact name" placeholder="Jane Smith" required />
          <Field name="company" label="Company" placeholder="Acme Legal" required />
          <Field name="email" label="Email" type="email" placeholder="jane@example.com" required />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit">Add party</Button>
          </div>
        </form>
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
        title="Word redline review"
        description="Browser view is a review surface. Professional markup should remain in native Word with track changes preserved."
        className="max-w-3xl"
      >
        <div className="p-6">
          <RedlinePreview expanded />
        </div>
      </Dialog>

      <Dialog
        open={dialog === "email"}
        onClose={() => setDialog(null)}
        title="Email package"
        description="This is the outbound shell that can later be backed by Amazon SES."
      >
        <div className="space-y-4 p-6">
          <Field
            label="To"
            name="to"
            value={emailAudience === "selected" && selectedParty
              ? `${selectedParty.name} <${selectedParty.email}>`
              : `${selectedProject.parties.length} project parties`}
            readOnly
          />
          <Field label="Subject" name="subject" defaultValue={`${selectedProject.title}: review request`} />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Message</span>
            <textarea
              rows={5}
              defaultValue={`Please review the attached form document and return a marked Word copy by ${selectedProject.due}.`}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--ring)]"
            />
          </label>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-3 text-sm text-slate-600">
            <Paperclip className="mr-2 inline size-4" />
            {selectedProject.documentName}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={queueEmail}>
              <Send />
              Queue email
            </Button>
          </div>
        </div>
      </Dialog>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function Overview({
  selectedProject,
  selectedParty,
  acceptedPercent,
  responsePercent,
  onOpenRedlines,
  onQueueEmail,
  onChangeStatus,
}: {
  selectedProject: Project;
  selectedParty?: Party;
  acceptedPercent: number;
  responsePercent: number;
  onOpenRedlines: () => void;
  onQueueEmail: () => void;
  onChangeStatus: (status: PartyStatus) => void;
}) {
  return (
    <div className="overview-grid">
      <div className="space-y-5">
        <section className="panel">
          <div className="grid gap-4 md:grid-cols-3">
            <Metric icon={Users} label="Parties" value={selectedProject.parties.length} detail={`${responsePercent}% responded`} />
            <Metric icon={CheckCircle2} label="Accepted" value={`${acceptedPercent}%`} detail="Within authority" />
            <Metric icon={Clock3} label="Deadline" value={selectedProject.due} detail={selectedProject.round} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ProgressBlock label="Response rate" value={responsePercent} />
            <ProgressBlock label="Accepted without escalation" value={acceptedPercent} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">AI summary</p>
              <h2>Project position</h2>
            </div>
            <Badge className="border-zinc-300 bg-zinc-100 text-zinc-800">
              <Bot className="size-3.5" />
              Guardrails applied
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{selectedProject.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {selectedProject.guardrails.slice(0, 4).map((guardrail) => (
              <div key={guardrail} className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm leading-5 text-slate-700">
                {guardrail}
              </div>
            ))}
          </div>
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

        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Native Word path</p>
              <h2>Professional review</h2>
            </div>
            <FileCheck2 className="size-4 text-[var(--accent-strong)]" />
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>Prexet should preserve `.docx` files as the source of truth and use Word track changes for edits.</p>
            <p>The browser can summarize, compare, assign status, and route decisions. A Word add-in or Office integration should handle native markup.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function Documents({ selectedProject, onUpload }: { selectedProject: Project; onUpload: () => void }) {
  return (
    <div className="space-y-5">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Files</p>
            <h2>Current document package</h2>
          </div>
          <Button variant="outline" onClick={onUpload}>
            <UploadCloud />
            Upload
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <FileCard icon={FileText} title={selectedProject.documentName} detail="Form document, current version" />
          <FileCard icon={Inbox} title="Party email list" detail={`${selectedProject.parties.length} recipients loaded`} />
          <FileCard icon={MessageSquareText} title="AI authority prompt" detail={`${selectedProject.guardrails.length} guardrails saved`} />
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

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <Icon className="size-4 text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ProgressBlock({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <p className="text-xs font-semibold text-slate-700">{value}%</p>
      </div>
      <Progress value={value} />
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
