"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  LoaderCircle,
  MapPin,
  Megaphone,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { WorkspaceIdentity } from "@/lib/auth-types";
import type { AnalyticsSnapshot, AttendanceHistoryRecord, AttendanceRecord, IntegrationSettings, Lead, Property, SocialPost, TeamMember, WorkspaceTool } from "@/lib/types";
import { requestAttendanceCoordinates, type AttendanceAction, type AttendanceCoordinates } from "@/services/attendance-service";

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe5df] bg-white px-3 text-xs outline-none focus:border-[#8ab5a4]";

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "amber" | "neutral" | "purple" }) {
  const tones = { green: "bg-[#e7f3ed] text-[#176b4d]", amber: "bg-[#fdf4e3] text-[#a96c12]", neutral: "bg-[#eff1ee] text-[#63716b]", purple: "bg-[#eeeafb] text-[#6950a0]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function Avatar({ initials, index = 0 }: { initials: string; index?: number }) {
  const colors = ["#e9f3ef", "#f7eddd", "#e9ebf8", "#f8e9e7"];
  return <div style={{ backgroundColor: colors[index % colors.length] }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-[#315a4c]">{initials}</div>;
}

function ToolHeader({ eyebrow, title, copy, back, action, onAction }: { eyebrow: string; title: string; copy: string; back: () => void; action?: string; onAction?: () => void }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><button onClick={back} className="mb-3 flex min-h-10 items-center gap-1 text-[11px] font-bold text-[#176b4d]"><ChevronLeft size={14} />More tools</button><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8d9a95]">{eyebrow}</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.055em]">{title}</h2><p className="mt-1 text-sm text-[#74817c]">{copy}</p></div>{action && <button onClick={onAction} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#176b4d] px-4 text-xs font-bold text-white sm:h-10 sm:w-auto"><Plus size={15} />{action}</button>}</div>;
}

export function AttendanceTool({ identity, records, history, updateAttendance, back, notify }: {
  identity: WorkspaceIdentity;
  records: AttendanceRecord[];
  history: AttendanceHistoryRecord[];
  updateAttendance: (action: AttendanceAction, coordinates: AttendanceCoordinates, notes: string, selfie?: File) => Promise<void>;
  back: () => void;
  notify: (message: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [selfie, setSelfie] = useState<File>();
  const [submitting, setSubmitting] = useState(false);
  const self = records.find((record) => record.userId === identity.id) ?? records.find((record) => record.name === identity.fullName);
  const checkedIn = self?.status === "Checked in";
  const toggleAttendance = async () => {
    setSubmitting(true);

    try {
      const coordinates = await requestAttendanceCoordinates();
      await updateAttendance(checkedIn ? "check-out" : "check-in", coordinates, notes, selfie);
      setNotes("");
      setSelfie(undefined);
      notify(checkedIn ? "Checked out successfully" : "Attendance check-in captured");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to record attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return <div>
    <ToolHeader eyebrow="Field operations" title="Attendance" copy="Track GPS-based check-ins and field availability." back={back} />
    <section className="rounded-2xl bg-[#1d493a] p-5 text-white"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold text-white/65">YOUR ATTENDANCE</p><h3 className="mt-2 text-xl font-bold">{checkedIn ? "You are checked in" : "You are checked out"}</h3><p className="mt-1 flex items-center gap-1 text-xs text-white/70"><MapPin size={12} />{self?.location || "Your GPS location is captured when you record attendance"}</p></div><button disabled={submitting} onClick={() => void toggleAttendance()} className="flex min-w-28 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#176b4d] disabled:cursor-wait disabled:opacity-75">{submitting && <LoaderCircle className="animate-spin" size={14} />}{submitting ? "Capturing..." : checkedIn ? "Check out" : "Check in now"}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-[11px] font-bold text-white/70">Field note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="mt-1.5 min-h-16 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none placeholder:text-white/40 focus:border-white/35" placeholder="Optional site visit or field note..." /></label><label className="block text-[11px] font-bold text-white/70">Optional selfie<input type="file" accept="image/*" capture="user" onChange={(event) => setSelfie(event.target.files?.[0])} className="mt-1.5 block w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] text-white file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-[#176b4d]" /><span className="mt-1 block text-[10px] font-medium text-white/50">{selfie ? selfie.name : "Stored privately in your organization folder."}</span></label></div></section>
    <section className="mt-5 rounded-2xl border border-[#e5e9e4] bg-white p-4"><h3 className="text-sm font-bold">Your attendance history</h3><div className="mt-3 divide-y divide-[#edf0ec]">{history.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs font-bold">{record.date}</p><p className="mt-1 text-[10px] text-[#87938e]">{record.location || "No GPS location"}{record.notes ? ` - ${record.notes}` : ""}</p></div><div className="text-right"><Badge tone={record.status === "Checked in" ? "amber" : "green"}>{record.status}</Badge><p className="mt-1 text-[10px] text-[#87938e]">{record.checkIn}{record.checkOut ? ` - ${record.checkOut}` : ""}</p></div></div>)}</div>{!history.length && <p className="py-8 text-center text-xs text-[#87938e]">No attendance history recorded yet.</p>}</section>
    <section className="mt-5 rounded-2xl border border-[#e5e9e4] bg-white p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Team today</h3><Badge tone="green">{records.filter((record) => record.status === "Checked in").length} checked in</Badge></div><div className="mt-3 divide-y divide-[#edf0ec]">{records.map((record, index) => <div key={record.id} className="flex items-center gap-3 py-3"><Avatar initials={record.initials} index={index} /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{record.name}</p><p className="mt-1 truncate text-[10px] text-[#87938e]">{record.role} - {record.location || "No location"}</p></div><div className="text-right"><Badge tone={record.status === "Checked in" ? "green" : "neutral"}>{record.status}</Badge><p className="mt-1 text-[10px] text-[#87938e]">{record.checkIn || "No check-in"}</p></div></div>)}</div></section>
  </div>;
}

export function SocialTool({ posts, publishPost, draftCaption, back, openForm }: {
  posts: SocialPost[];
  publishPost: (post: SocialPost) => Promise<void>;
  draftCaption: (post: SocialPost) => Promise<void>;
  back: () => void;
  openForm: () => void;
}) {
  return <div>
    <ToolHeader eyebrow="Content calendar" title="Social media" copy="Plan posts and move approved content through your publishing workflow." back={back} action="Create post" onAction={openForm} />
    <div className="grid gap-4 lg:grid-cols-3">{posts.map((post) => <article key={post.id} className="overflow-hidden rounded-2xl border border-[#e5e9e4] bg-white">{post.mediaUrls?.[0] && <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${post.mediaUrls[0]})` }} />}<div className="p-4"><div className="flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eeeafb] text-[#6950a0]"><Megaphone size={16} /></div><Badge tone={post.status === "Published" ? "green" : post.status === "Scheduled" ? "purple" : "amber"}>{post.status}</Badge></div><h3 className="mt-4 text-sm font-bold">{post.title}</h3><p className="mt-2 text-xs leading-5 text-[#77857f]">{post.caption || "Draft a caption with the AI helper or add one manually."}</p>{post.notes && <p className="mt-3 rounded-lg bg-[#f7f8f5] p-2 text-[10px] leading-4 text-[#77857f]">Internal: {post.notes}</p>}<div className="mt-4 border-t border-[#edf0ec] pt-3"><p className="text-[10px] font-bold text-[#8c9893]">{post.type}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-[#68766f]"><CalendarClock size={11} />{post.scheduledFor}</p><p className="mt-1 text-[10px] text-[#87938e]">{post.mediaStoragePaths?.length ?? 0} media files - {post.assignee}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => void draftCaption(post)} className="rounded-lg bg-[#eeeafb] py-2 text-xs font-bold text-[#6950a0]"><Sparkles className="mr-1 inline" size={12} />AI caption</button>{post.status !== "Published" ? <button onClick={() => void publishPost(post)} className="rounded-lg bg-[#f0f5f2] py-2 text-xs font-bold text-[#176b4d]">Mark published</button> : <div className="grid place-items-center rounded-lg bg-[#f0f5f2] text-xs font-bold text-[#176b4d]">Published</div>}</div></div></article>)}</div>
    {!posts.length && <div className="rounded-2xl border border-[#e5e9e4] bg-white py-14 text-center"><Megaphone className="mx-auto text-[#a3afaa]" size={22} /><p className="mt-3 text-sm font-bold">No social posts yet</p><p className="mt-1 text-xs text-[#89958f]">Create your first content draft for the calendar.</p></div>}
  </div>;
}

export function ReportsTool({ leads, analytics, back }: { leads: Lead[]; analytics: AnalyticsSnapshot; back: () => void }) {
  const pipeline = ["New", "Contacted", "Interested", "Site Visit", "Negotiation", "Won", "Lost"];
  return <div>
    <ToolHeader eyebrow="Business insights" title="Reports" copy="Review the current sales pipeline and inventory performance." back={back} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><ReportMetric label="Total leads" value={String(leads.length)} icon={Users} /><ReportMetric label="Calls today" value={String(analytics.callsToday)} icon={Sparkles} /><ReportMetric label="Properties shared" value={String(analytics.propertyShares)} icon={CircleDollarSign} /><ReportMetric label="Team checked in" value={String(analytics.teamCheckedIn)} icon={CheckCircle2} /></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-[#e5e9e4] bg-white p-4"><h3 className="text-sm font-bold">Leads by source</h3><div className="mt-5 space-y-4">{analytics.sources.map((source) => <ReportBar key={source.label} label={source.label} value={source.value} max={Math.max(1, ...analytics.sources.map((item) => item.value))} />)}</div>{!analytics.sources.length && <p className="py-8 text-center text-xs text-[#87938e]">No lead source data yet.</p>}</section><section className="rounded-2xl border border-[#e5e9e4] bg-white p-4"><h3 className="text-sm font-bold">Lead pipeline</h3><div className="mt-5 space-y-4">{pipeline.map((status) => <div key={status} className="flex items-center justify-between border-b border-[#edf0ec] pb-3 text-xs"><span className="text-[#74817c]">{status}</span><span className="font-bold">{analytics.pipeline[status] ?? 0}</span></div>)}</div></section></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-[#e5e9e4] bg-white p-4"><h3 className="text-sm font-bold">Agent call performance</h3><div className="mt-5 space-y-4">{analytics.agentPerformance.map((agent) => <ReportBar key={agent.name} label={agent.name} value={agent.calls} max={Math.max(1, ...analytics.agentPerformance.map((item) => item.calls))} />)}</div>{!analytics.agentPerformance.length && <p className="py-8 text-center text-xs text-[#87938e]">No call activity recorded yet.</p>}</section><section className="rounded-2xl border border-[#e5e9e4] bg-white p-4"><h3 className="text-sm font-bold">Operations summary</h3><div className="mt-4 grid grid-cols-2 gap-3"><SummaryValue label="Follow-ups completed" value={analytics.completedFollowups} /><SummaryValue label="Follow-ups total" value={analytics.totalFollowups} /><SummaryValue label="Won leads" value={analytics.wonLeads} /><SummaryValue label="Lost leads" value={analytics.lostLeads} /><SummaryValue label="Available inventory" value={analytics.availableProperties} /><SummaryValue label="Conversion" value={`${analytics.conversionRate}%`} /></div></section></div>
  </div>;
}

function ReportBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="grid grid-cols-[92px_1fr_22px] items-center gap-3"><span className="truncate text-xs text-[#74817c]">{label}</span><div className="h-2 rounded-full bg-[#edf0ec]"><div className="h-full rounded-full bg-[#4c927c]" style={{ width: `${Math.max(value ? 8 : 0, (value / max) * 100)}%` }} /></div><span className="text-right text-xs font-bold">{value}</span></div>;
}

function SummaryValue({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl bg-[#f7f8f5] p-3"><p className="text-lg font-bold text-[#315044]">{value}</p><p className="mt-1 text-[10px] font-semibold text-[#87938e]">{label}</p></div>;
}

function ReportMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return <article className="rounded-2xl border border-[#e5e9e4] bg-white p-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f3ed] text-[#176b4d]"><Icon size={16} /></div><p className="mt-4 text-2xl font-bold tracking-[-0.05em]">{value}</p><p className="mt-1 text-xs text-[#74817c]">{label}</p></article>;
}

export function TeamTool({ identity, members, back, openForm, updateMember }: { identity: WorkspaceIdentity; members: TeamMember[]; back: () => void; openForm: () => void; updateMember: (member: TeamMember) => Promise<void> }) {
  const canManageTeam = identity.isDemo || identity.role === "admin";

  return <div>
    <ToolHeader eyebrow="Organization" title="Team" copy="Manage roles, availability, and sales workload." back={back} action={canManageTeam ? "Invite member" : undefined} onAction={canManageTeam ? openForm : undefined} />
    <section className="rounded-2xl border border-[#e5e9e4] bg-white p-4"><div className="divide-y divide-[#edf0ec]">{members.map((member, index) => <div key={member.id} className="flex flex-wrap items-center gap-3 py-4"><Avatar initials={member.initials} index={index} /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{member.name}</p><p className="mt-1 text-[10px] text-[#87938e]">{member.phone}{member.email ? ` - ${member.email}` : ""}</p><p className="mt-1 text-[10px] text-[#87938e]">{member.leads} assigned leads</p></div>{canManageTeam ? <div className="grid w-full grid-cols-2 gap-2 sm:w-auto"><select aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => void updateMember({ ...member, role: event.target.value })} className="h-9 rounded-lg border border-[#dfe5df] bg-white px-2 text-[10px] font-bold text-[#65736e]">{["Admin", "Sales Manager", "Sales Agent", "Field Executive", "Social Media Manager"].map((role) => <option key={role}>{role}</option>)}</select><select aria-label={`Availability for ${member.name}`} value={member.status} onChange={(event) => void updateMember({ ...member, status: event.target.value as TeamMember["status"] })} className="h-9 rounded-lg border border-[#dfe5df] bg-white px-2 text-[10px] font-bold text-[#65736e]">{["Available", "Busy", "Offline"].map((status) => <option key={status}>{status}</option>)}</select></div> : <div className="text-right"><Badge tone={member.status === "Available" ? "green" : member.status === "Busy" ? "amber" : "neutral"}>{member.status}</Badge><p className="mt-1 text-[10px] text-[#87938e]">{member.role}</p></div>}</div>)}</div></section>
  </div>;
}

export function IntegrationsTool({ settings, setSettings, back, notify }: { settings: IntegrationSettings; setSettings: (settings: IntegrationSettings) => void; back: () => void; notify: (message: string) => void }) {
  return <div>
    <ToolHeader eyebrow="External services" title="Integrations" copy="Configure provider adapters. Secrets remain server-side in production." back={back} />
    <form onSubmit={(event) => { event.preventDefault(); notify("Integration settings saved locally"); }} className="rounded-2xl border border-[#e5e9e4] bg-white p-5">
      <div className="flex items-center gap-3 border-b border-[#edf0ec] pb-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f3ed] text-[#176b4d]"><Zap size={18} /></div><div><h3 className="text-sm font-bold">Provider configuration</h3><p className="mt-1 text-xs text-[#87938e]">Dry-run mode is recommended until production credentials are available.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <IntegrationField label="Twilio Account SID" value={settings.twilioSid} update={(value) => setSettings({ ...settings, twilioSid: value })} placeholder="AC********" />
        <IntegrationField label="Twilio phone number" value={settings.twilioPhone} update={(value) => setSettings({ ...settings, twilioPhone: value })} placeholder="+1..." />
        <IntegrationField label="WhatsApp sender" value={settings.whatsappSender} update={(value) => setSettings({ ...settings, whatsappSender: value })} placeholder="+91..." />
        <IntegrationField label="Email sender" value={settings.emailSender} update={(value) => setSettings({ ...settings, emailSender: value })} placeholder="sales@example.com" />
        <IntegrationField label="Lead webhook secret" value={settings.webhookSecret} update={(value) => setSettings({ ...settings, webhookSecret: value })} placeholder="********" />
      </div>
      <label className="mt-4 flex items-center gap-3 rounded-xl bg-[#f7f8f5] p-3 text-xs font-bold text-[#586760]"><input type="checkbox" checked={settings.dryRun} onChange={(event) => setSettings({ ...settings, dryRun: event.target.checked })} className="h-4 w-4 accent-[#176b4d]" />Use dry-run mode for calls and messages</label>
      <button type="submit" className="mt-4 rounded-lg bg-[#176b4d] px-4 py-2.5 text-xs font-bold text-white">Save configuration</button>
    </form>
  </div>;
}

function IntegrationField({ label, value, update, placeholder }: { label: string; value: string; update: (value: string) => void; placeholder: string }) {
  return <label className="text-[11px] font-bold text-[#65736e]">{label}<input className={inputClass} value={value} onChange={(event) => update(event.target.value)} placeholder={placeholder} /></label>;
}

export function SettingsTool({ back, notify }: { back: () => void; notify: (message: string) => void }) {
  return <div>
    <ToolHeader eyebrow="Workspace" title="Settings" copy="Manage default CRM behavior for your organization." back={back} />
    <form onSubmit={(event) => { event.preventDefault(); notify("Workspace settings saved"); }} className="rounded-2xl border border-[#e5e9e4] bg-white p-5"><div className="flex items-center gap-3 border-b border-[#edf0ec] pb-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f3ed] text-[#176b4d]"><Settings size={18} /></div><div><h3 className="text-sm font-bold">Lead operations</h3><p className="mt-1 text-xs text-[#87938e]">Choose how new enquiries enter the sales queue.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold text-[#65736e]">Organization name<input className={inputClass} defaultValue="EstateFlow Demo Realty" /></label><label className="text-[11px] font-bold text-[#65736e]">Lead assignment mode<select className={inputClass} defaultValue="Round Robin"><option>Round Robin</option><option>Manual</option><option>Least Busy Agent</option></select></label></div><button className="mt-4 rounded-lg bg-[#176b4d] px-4 py-2.5 text-xs font-bold text-white">Save workspace</button></form>
    <section className="mt-4 rounded-2xl border border-[#e5e9e4] bg-white p-5"><div className="flex gap-3"><ShieldCheck className="text-[#176b4d]" size={19} /><div><h3 className="text-sm font-bold">Organization data isolation</h3><p className="mt-1 text-xs leading-5 text-[#7c8984]">The Supabase migration includes organization-scoped Row Level Security policies for leads, calls, properties, and follow-ups.</p></div></div></section>
  </div>;
}

export function WorkspaceToolView({ tool, ...props }: {
  tool: WorkspaceTool;
  identity: WorkspaceIdentity;
  analytics: AnalyticsSnapshot;
  attendance: AttendanceRecord[];
  attendanceHistory: AttendanceHistoryRecord[];
  updateAttendance: (action: AttendanceAction, coordinates: AttendanceCoordinates, notes: string, selfie?: File) => Promise<void>;
  socialPosts: SocialPost[];
  publishSocialPost: (post: SocialPost) => Promise<void>;
  draftSocialPostCaption: (post: SocialPost) => Promise<void>;
  leads: Lead[];
  properties: Property[];
  members: TeamMember[];
  updateTeamMember: (member: TeamMember) => Promise<void>;
  settings: IntegrationSettings;
  setSettings: (settings: IntegrationSettings) => void;
  back: () => void;
  openSocialForm: () => void;
  openMemberForm: () => void;
  notify: (message: string) => void;
}) {
  if (tool === "attendance") return <AttendanceTool identity={props.identity} records={props.attendance} history={props.attendanceHistory} updateAttendance={props.updateAttendance} back={props.back} notify={props.notify} />;
  if (tool === "social") return <SocialTool posts={props.socialPosts} publishPost={props.publishSocialPost} draftCaption={props.draftSocialPostCaption} back={props.back} openForm={props.openSocialForm} />;
  if (tool === "reports") return <ReportsTool leads={props.leads} analytics={props.analytics} back={props.back} />;
  if (tool === "team") return <TeamTool identity={props.identity} members={props.members} back={props.back} openForm={props.openMemberForm} updateMember={props.updateTeamMember} />;
  if (tool === "integrations") return <IntegrationsTool settings={props.settings} setSettings={props.setSettings} back={props.back} notify={props.notify} />;
  return <SettingsTool back={props.back} notify={props.notify} />;
}
