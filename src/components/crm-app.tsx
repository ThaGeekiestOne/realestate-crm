"use client";

import {
  ArrowRight,
  AlertCircle,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Filter,
  FileText,
  Home,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  attendance as initialAttendance,
  attendanceHistory as initialAttendanceHistory,
  followups as initialFollowups,
  leads as initialLeads,
  notifications as initialNotifications,
  properties as initialProperties,
  socialPosts as initialSocialPosts,
  teamMembers as initialTeamMembers,
} from "@/lib/demo-data";
import { usePersistentState } from "@/lib/use-persistent-state";
import type {
  Followup,
  AttendanceHistoryRecord,
  AttendanceRecord,
  AnalyticsSnapshot,
  DashboardActivity,
  IntegrationSettings,
  Lead,
  LeadTimelineItem,
  LeadStatus,
  LeadTemperature,
  ModuleKey,
  Property,
  SocialPost,
  WorkspaceTool,
  WorkspaceNotification,
} from "@/lib/types";
import { followupTemplates, type FollowupMessageChannel, type FollowupTemplateId } from "@/lib/followup-templates";
import {
  type FormDialogState,
  WorkspaceFormDialog,
} from "@/components/workspace-forms";
import { WorkspaceToolView } from "@/components/workspace-tools";
import type { WorkspaceIdentity } from "@/lib/auth-types";
import {
  completeOrganizationFollowup,
  createOrganizationFollowup,
  createOrganizationLead,
  createOrganizationProperty,
  getOrganizationWorkspaceSnapshot,
} from "@/services/crm-data-service";
import { shareLeadProperty, type PropertyShareChannel } from "@/services/property-share-client-service";
import { sendLeadFollowup, snoozeLeadFollowup } from "@/services/followup-client-service";
import {
  createOrganizationSocialPost,
  draftDemoSocialCaption,
  draftOrganizationSocialCaption,
  getOrganizationSocialPosts,
  publishOrganizationSocialPost,
} from "@/services/social-post-client-service";
import {
  formatAttendanceLocation,
  getOrganizationAttendance,
  recordOrganizationAttendance,
  uploadAttendanceSelfie,
  type AttendanceAction,
  type AttendanceCoordinates,
} from "@/services/attendance-service";
import { getDemoAnalyticsSnapshot, getOrganizationAnalyticsSnapshot } from "@/services/analytics-service";
import {
  getOrganizationTeamMembers,
  inviteOrganizationTeamMember,
  updateOrganizationTeamMember,
} from "@/services/team-member-service";
import {
  getLeadTimeline,
  startLeadBridgeCall,
  updateOrganizationLead,
  type LeadUpdateInput,
} from "@/services/lead-action-client-service";
import {
  deleteOrganizationProperty,
  updateOrganizationProperty,
  type PropertyUpdateInput,
} from "@/services/property-action-client-service";
import {
  getOrganizationNotifications,
  markOrganizationNotificationRead,
} from "@/services/notification-client-service";

const nav = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "leads", label: "Leads", icon: Users },
  { key: "properties", label: "Properties", icon: Building2 },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "more", label: "More", icon: MoreHorizontal },
] satisfies { key: ModuleKey; label: string; icon: typeof Home }[];

const avatarColors = ["#e9f3ef", "#f7eddd", "#e9ebf8", "#f8e9e7"];
const notificationIcons = {
  new_lead_assigned: Bell,
  missed_lead_call: Phone,
  followup_due: CalendarClock,
  site_visit_scheduled: CalendarClock,
  property_shared: Share2,
  attendance_issue: UserCheck,
  social_post_due: Megaphone,
  general: Bell,
} satisfies Record<WorkspaceNotification["type"], typeof Bell>;

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "neutral" | "purple" }) {
  const styles = {
    green: "bg-[#e7f3ed] text-[#176b4d]",
    amber: "bg-[#fdf4e3] text-[#a96c12]",
    red: "bg-[#fbebea] text-[#b34b49]",
    neutral: "bg-[#eff1ee] text-[#63716b]",
    purple: "bg-[#eeeafb] text-[#6950a0]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[tone]}`}>{children}</span>;
}

function temperatureTone(temp: LeadTemperature) {
  return temp === "Hot" ? "red" : temp === "Warm" ? "amber" : "neutral";
}

function statusTone(status: LeadStatus) {
  return ["Won", "Interested"].includes(status) ? "green" : status === "Negotiation" ? "purple" : status === "New" ? "amber" : "neutral";
}

function Avatar({ initials, index = 0, size = "md" }: { initials: string; index?: number; size?: "sm" | "md" | "lg" }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-bold text-[#315a4c] ${size === "lg" ? "h-14 w-14 text-base" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs"}`}
      style={{ backgroundColor: avatarColors[index % avatarColors.length] }}
    >
      {initials}
    </div>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[#26352f]">{title}</h2>
      {action && <button onClick={onAction} className="flex items-center gap-1 text-xs font-semibold text-[#176b4d]">{action}<ChevronRight size={14} /></button>}
    </div>
  );
}

function MetricCard({ label, value, delta, icon: Icon, tone }: { label: string; value: string; delta: string; icon: typeof Users; tone: string }) {
  return (
    <article className="rounded-2xl border border-[#e6eae5] bg-white p-4 shadow-[0_2px_12px_rgba(40,62,53,0.025)]">
      <div className="flex items-center justify-between">
        <div className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon size={17} /></div>
        <span className="text-[10px] font-semibold text-[#84908b]">TODAY</span>
      </div>
      <p className="mt-4 text-[26px] font-bold tracking-[-0.05em] text-[#1e2e28]">{value}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p className="text-xs font-medium text-[#718079]">{label}</p>
        <span className="text-[10px] font-bold text-[#21815d]">{delta}</span>
      </div>
    </article>
  );
}

function WorkspaceSyncStatus({ state, retry }: { state: { status: "demo" | "loading" | "ready" | "error"; message?: string }; retry: () => void }) {
  if (state.status === "ready" || state.status === "demo") {
    return null;
  }

  if (state.status === "loading") {
    return <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#dce7e1] bg-[#f5faf7] px-3 py-2.5 text-xs font-semibold text-[#477163]"><LoaderCircle className="animate-spin" size={15} />Syncing your organization workspace...</div>;
  }

  return <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#f0d6d2] bg-[#fff6f5] px-3 py-2.5 text-xs font-semibold text-[#a44e4b]"><AlertCircle size={15} /><span className="flex-1">{state.message}</span><button onClick={retry} className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#a44e4b] shadow-sm"><RefreshCw size={12} />Retry</button></div>;
}

function NotificationCenter({ notifications, close, markRead }: { notifications: WorkspaceNotification[]; close: () => void; markRead: (notificationId?: string) => Promise<void> }) {
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return <div className="fixed inset-0 z-40 bg-[#15251f]/20" onMouseDown={close}><section aria-label="Notifications panel" onMouseDown={(event) => event.stopPropagation()} className="absolute inset-x-3 top-[76px] max-h-[calc(100vh-9.5rem)] overflow-hidden rounded-2xl border border-[#e1e6e0] bg-white shadow-2xl sm:left-auto sm:right-4 sm:w-[390px]">
    <div className="flex items-center justify-between border-b border-[#edf0ec] px-4 py-3"><div><h2 className="text-sm font-bold text-[#2c3d36]">Notifications</h2><p className="mt-0.5 text-[10px] text-[#89958f]">{unreadCount ? `${unreadCount} unread updates` : "You are all caught up"}</p></div><div className="flex items-center gap-2">{unreadCount > 0 && <button onClick={() => void markRead()} className="text-[10px] font-bold text-[#176b4d]">Mark all read</button>}<button aria-label="Close notifications" onClick={close} className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f3f0] text-[#68756f]"><X size={14} /></button></div></div>
    <div className="max-h-[calc(100vh-13.5rem)] overflow-y-auto p-2">{notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} markRead={markRead} />)}{!notifications.length && <div className="py-12 text-center"><Bell className="mx-auto text-[#a3afaa]" size={22} /><p className="mt-3 text-sm font-bold">No notifications yet</p><p className="mt-1 text-xs text-[#89958f]">New lead and follow-up updates will appear here.</p></div>}</div>
  </section></div>;
}

function NotificationItem({ notification, markRead }: { notification: WorkspaceNotification; markRead: (notificationId?: string) => Promise<void> }) {
  const Icon = notificationIcons[notification.type];

  return <button onClick={() => !notification.read && void markRead(notification.id)} className={`flex w-full gap-3 rounded-xl p-3 text-left transition ${notification.read ? "bg-white" : "bg-[#f3f8f5] hover:bg-[#edf5f1]"}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${notification.read ? "bg-[#f1f3f0] text-[#7e8b86]" : "bg-[#e1f0e9] text-[#176b4d]"}`}><Icon size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><p className="flex-1 text-xs font-bold text-[#40514b]">{notification.title}</p>{!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#dc5d54]" />}</div>{notification.body && <p className="mt-1 text-[11px] leading-4 text-[#7c8984]">{notification.body}</p>}<p className="mt-1.5 text-[10px] font-semibold text-[#a0aaa6]">{formatTimelineTime(notification.createdAt)}</p></div></button>;
}

export function CrmApp({ identity, onSignOut }: { identity: WorkspaceIdentity; onSignOut?: () => Promise<void> }) {
  const [active, setActive] = useState<ModuleKey>("dashboard");
  const [search, setSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState("All");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activeTool, setActiveTool] = useState<WorkspaceTool | null>(null);
  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState("");
  const [demoLeads, setDemoLeads] = usePersistentState("estateflow.leads", initialLeads);
  const [demoProperties, setDemoProperties] = usePersistentState("estateflow.properties", initialProperties);
  const [demoFollowups, setDemoFollowups] = usePersistentState("estateflow.followups", initialFollowups);
  const [remoteLeads, setRemoteLeads] = useState<Lead[]>([]);
  const [remoteProperties, setRemoteProperties] = useState<typeof initialProperties>([]);
  const [remoteFollowups, setRemoteFollowups] = useState<typeof initialFollowups>([]);
  const [demoNotifications, setDemoNotifications] = usePersistentState("estateflow.notifications", initialNotifications);
  const [remoteNotifications, setRemoteNotifications] = useState<WorkspaceNotification[]>([]);
  const [workspaceStatus, setWorkspaceStatus] = useState<{ status: "demo" | "loading" | "ready" | "error"; message?: string }>(
    identity.isDemo ? { status: "demo" } : { status: "loading" },
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [demoAttendance, setDemoAttendance] = usePersistentState("estateflow.attendance", initialAttendance);
  const [demoAttendanceHistory, setDemoAttendanceHistory] = usePersistentState("estateflow.attendance-history", initialAttendanceHistory);
  const [remoteAttendance, setRemoteAttendance] = useState<AttendanceRecord[]>([]);
  const [remoteAttendanceHistory, setRemoteAttendanceHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [demoSocialPosts, setDemoSocialPosts] = usePersistentState("estateflow.social-posts", initialSocialPosts);
  const [remoteSocialPosts, setRemoteSocialPosts] = useState<SocialPost[]>([]);
  const [remoteAnalytics, setRemoteAnalytics] = useState<AnalyticsSnapshot>();
  const [demoMembers, setDemoMembers] = usePersistentState("estateflow.members", initialTeamMembers);
  const [remoteMembers, setRemoteMembers] = useState<typeof initialTeamMembers>([]);
  const [settings, setSettings] = usePersistentState<IntegrationSettings>("estateflow.integrations", {
    twilioSid: "",
    twilioPhone: "",
    whatsappSender: "",
    emailSender: "",
    webhookSecret: "",
    dryRun: true,
  });
  const crmLeads = identity.isDemo ? demoLeads : remoteLeads;
  const crmProperties = identity.isDemo ? demoProperties : remoteProperties;
  const crmFollowups = identity.isDemo ? demoFollowups : remoteFollowups;
  const notifications = identity.isDemo ? demoNotifications : remoteNotifications;
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const canAddLead = identity.isDemo || ["admin", "sales_manager", "sales_agent"].includes(identity.role);
  const canManageInventory = identity.isDemo || ["admin", "sales_manager"].includes(identity.role);
  const attendance = identity.isDemo ? demoAttendance : remoteAttendance;
  const attendanceHistory = identity.isDemo ? demoAttendanceHistory : remoteAttendanceHistory;
  const socialPosts = identity.isDemo ? demoSocialPosts : remoteSocialPosts;
  const members = identity.isDemo ? demoMembers : remoteMembers;
  const demoAnalytics = useMemo(() => getDemoAnalyticsSnapshot({
    leads: crmLeads,
    properties: crmProperties,
    followups: crmFollowups,
    attendance,
  }), [attendance, crmFollowups, crmLeads, crmProperties]);
  const analytics = identity.isDemo ? demoAnalytics : remoteAnalytics ?? demoAnalytics;

  useEffect(() => {
    if (identity.isDemo) {
      return;
    }

    let active = true;

    const loadWorkspace = async () => {
      try {
        const [snapshot, attendanceSnapshot, socialSnapshot, analyticsSnapshot, teamSnapshot, notificationSnapshot] = await Promise.all([
          getOrganizationWorkspaceSnapshot(identity),
          getOrganizationAttendance(identity),
          getOrganizationSocialPosts(identity),
          getOrganizationAnalyticsSnapshot(identity),
          getOrganizationTeamMembers(identity),
          getOrganizationNotifications(identity),
        ]);

        if (active) {
          setRemoteLeads(snapshot.leads);
          setRemoteProperties(snapshot.properties);
          setRemoteFollowups(snapshot.followups);
          setRemoteAttendance(attendanceSnapshot.records);
          setRemoteAttendanceHistory(attendanceSnapshot.history);
          setRemoteSocialPosts(socialSnapshot.posts);
          setRemoteAnalytics(analyticsSnapshot);
          setRemoteMembers(teamSnapshot);
          setRemoteNotifications(notificationSnapshot);
          setWorkspaceStatus({ status: "ready" });
        }
      } catch (error) {
        if (active) {
          setWorkspaceStatus({
            status: "error",
            message: error instanceof Error ? error.message : "Unable to load workspace data.",
          });
        }
      }
    };

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [identity, reloadToken]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const navigate = (module: ModuleKey) => {
    setActive(module);
    setActiveTool(null);
  };

  const openTool = (tool: WorkspaceTool) => {
    setActive("more");
    setActiveTool(tool);
  };

  const filteredLeads = useMemo(() => crmLeads.filter((lead) => {
    const matchesSearch = `${lead.name} ${lead.location} ${lead.source}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (leadFilter === "All" || lead.temperature === leadFilter || lead.status === leadFilter);
  }), [crmLeads, search, leadFilter]);

  const reloadWorkspace = () => {
    if (identity.isDemo) {
      return;
    }

    setWorkspaceStatus({ status: "loading" });
    setReloadToken((token) => token + 1);
  };

  const refreshAnalytics = async () => {
    if (identity.isDemo) {
      return;
    }

    try {
      setRemoteAnalytics(await getOrganizationAnalyticsSnapshot(identity));
    } catch (error) {
      console.error("Unable to refresh workspace analytics", error);
    }
  };

  const refreshNotifications = async () => {
    if (identity.isDemo) {
      return;
    }

    try {
      setRemoteNotifications(await getOrganizationNotifications(identity));
    } catch (error) {
      console.error("Unable to refresh workspace notifications", error);
    }
  };

  const addDemoNotification = (notification: Pick<WorkspaceNotification, "type" | "title" | "body">) => {
    setDemoNotifications([{
      id: `NT-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...notification,
    }, ...demoNotifications]);
  };

  const markNotificationRead = async (notificationId?: string) => {
    try {
      await markOrganizationNotificationRead(identity, notificationId);
      const updateNotifications = (items: WorkspaceNotification[]) => items.map((notification) => (
        !notificationId || notification.id === notificationId ? { ...notification, read: true } : notification
      ));

      if (identity.isDemo) {
        setDemoNotifications(updateNotifications(demoNotifications));
      } else {
        setRemoteNotifications(updateNotifications(remoteNotifications));
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update notifications");
    }
  };

  const addLead = async (lead: Lead) => {
    try {
      const createdLead = identity.isDemo ? lead : await createOrganizationLead(identity, lead);
      if (identity.isDemo) {
        setDemoLeads([createdLead, ...demoLeads]);
      } else {
        setRemoteLeads([createdLead, ...remoteLeads]);
      }
      setFormDialog(null);
      notify(`${createdLead.name} added and assigned to ${createdLead.agent}`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to add lead");
    }
  };

  const addProperty = async (property: typeof crmProperties[number], imageFiles: File[] = [], documentFiles: File[] = []) => {
    try {
      const createdProperty = identity.isDemo ? property : await createOrganizationProperty(identity, property, imageFiles, documentFiles);
      if (identity.isDemo) {
        setDemoProperties([createdProperty, ...demoProperties]);
      } else {
        setRemoteProperties([createdProperty, ...remoteProperties]);
      }
      setFormDialog(null);
      notify(`${createdProperty.title} added to inventory`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to add property");
    }
  };

  const updateProperty = async (property: Property, input: PropertyUpdateInput) => {
    try {
      const updatedProperty = await updateOrganizationProperty(identity, property, input);
      const updateProperties = (items: Property[]) => items.map((item) => item.id === property.id ? updatedProperty : item);

      if (identity.isDemo) {
        setDemoProperties(updateProperties(demoProperties));
      } else {
        setRemoteProperties(updateProperties(remoteProperties));
      }

      setSelectedProperty(updatedProperty);
      notify(`${updatedProperty.title} updated`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update property");
    }
  };

  const deleteProperty = async (property: Property) => {
    try {
      await deleteOrganizationProperty(identity, property);
      const removeProperty = (items: Property[]) => items.filter((item) => item.id !== property.id);

      if (identity.isDemo) {
        setDemoProperties(removeProperty(demoProperties));
      } else {
        setRemoteProperties(removeProperty(remoteProperties));
      }

      setSelectedProperty(null);
      notify(`${property.title} removed from inventory`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete property");
    }
  };

  const addFollowup = async (followup: typeof crmFollowups[number]) => {
    try {
      const createdFollowup = identity.isDemo ? followup : await createOrganizationFollowup(identity, followup);
      if (identity.isDemo) {
        setDemoFollowups([createdFollowup, ...demoFollowups]);
      } else {
        setRemoteFollowups([createdFollowup, ...remoteFollowups]);
      }
      setFormDialog(null);
      notify(`Follow-up scheduled for ${createdFollowup.lead}`);
      if (identity.isDemo) {
        addDemoNotification({ type: "followup_due", title: "Follow-up scheduled", body: `${createdFollowup.lead} follow-up is due ${createdFollowup.time}.` });
      } else {
        void refreshNotifications();
      }
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to schedule follow-up");
    }
  };

  const completeFollowup = async (followupId: string, lead: string) => {
    try {
      if (identity.isDemo) {
        setDemoFollowups(demoFollowups.filter((followup) => followup.id !== followupId));
      } else {
        await completeOrganizationFollowup(identity, followupId);
        setRemoteFollowups(remoteFollowups.filter((followup) => followup.id !== followupId));
      }
      notify(`${lead} marked complete`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to complete follow-up");
    }
  };

  const sendQuickFollowup = async (followup: Followup, channel: FollowupMessageChannel, templateId: FollowupTemplateId) => {
    try {
      await sendLeadFollowup(identity, followup.id, channel, templateId);
      notify(`${followup.lead} follow-up sent via ${channel}`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to send follow-up");
    }
  };

  const snoozeFollowup = async (followup: Followup) => {
    try {
      const result = await snoozeLeadFollowup(identity, followup.id, 30);
      const updatedTime = result.dueAt ? formatFollowupActionTime(result.dueAt) : "Snoozed for 30 min";
      const updateQueue = (items: Followup[]) => items.map((item) => (
        item.id === followup.id ? { ...item, time: updatedTime, overdue: false } : item
      ));

      if (identity.isDemo) {
        setDemoFollowups(updateQueue(demoFollowups));
      } else {
        setRemoteFollowups(updateQueue(remoteFollowups));
      }

      notify(`${followup.lead} snoozed for 30 minutes`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to snooze follow-up");
    }
  };

  const sendPropertyShare = async (lead: Lead, property: typeof crmProperties[number], channel: PropertyShareChannel) => {
    try {
      const result = await shareLeadProperty(identity, lead, property, channel);
      await navigator.clipboard?.writeText(result.shareUrl).catch(() => undefined);
      notify(`${property.title} shared via ${channel}. Link copied.`);
      if (identity.isDemo) {
        addDemoNotification({ type: "property_shared", title: "Property details shared", body: `${property.title} was shared with ${lead.name} via ${channel}.` });
      } else {
        void refreshNotifications();
      }
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to share property");
    }
  };

  const updateAttendance = async (action: AttendanceAction, coordinates: AttendanceCoordinates, notes: string, selfie?: File) => {
    const selfieStoragePath = selfie ? await uploadAttendanceSelfie(identity, selfie) : undefined;

    if (!identity.isDemo) {
      await recordOrganizationAttendance(identity, action, coordinates, notes, selfieStoragePath);
      const snapshot = await getOrganizationAttendance(identity);
      setRemoteAttendance(snapshot.records);
      setRemoteAttendanceHistory(snapshot.history);
      void refreshAnalytics();
      return;
    }

    const current = demoAttendance.find((record) => record.userId === identity.id) ?? demoAttendance.find((record) => record.name === identity.fullName);
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const location = formatAttendanceLocation(coordinates);
    const record: AttendanceRecord = {
      id: current?.id ?? `AT-${Date.now()}`,
      userId: identity.id,
      name: identity.fullName,
      initials: identity.initials,
      role: identity.roleLabel,
      status: action === "check-in" ? "Checked in" : "Checked out",
      checkIn: action === "check-in" ? time : current?.checkIn ?? time,
      checkOut: action === "check-out" ? time : undefined,
      location,
      notes: notes || undefined,
      selfieStoragePath,
    };

    setDemoAttendance([record, ...demoAttendance.filter((item) => item.userId !== identity.id && item.name !== identity.fullName)]);
    setDemoAttendanceHistory([
      {
        id: record.id,
        date: "Today",
        status: record.status === "Checked in" ? "Checked in" : "Checked out",
        checkIn: record.checkIn ?? time,
        checkOut: record.checkOut,
        location,
        notes: record.notes,
        selfieStoragePath,
      },
      ...demoAttendanceHistory.filter((item) => item.date !== "Today"),
    ]);
  };

  const addSocialPost = async (post: SocialPost, files: File[] = []) => {
    try {
      const createdPost = identity.isDemo ? post : (await createOrganizationSocialPost(identity, post, files)).post;

      if (identity.isDemo) {
        setDemoSocialPosts([createdPost, ...demoSocialPosts]);
      } else {
        setRemoteSocialPosts([createdPost, ...remoteSocialPosts]);
      }

      setFormDialog(null);
      notify(`${createdPost.title} saved as a draft`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to save social post");
    }
  };

  const publishSocialPost = async (post: SocialPost) => {
    try {
      const publishedPost = identity.isDemo
        ? { ...post, status: "Published" as const }
        : (await publishOrganizationSocialPost(identity, post.id)).post;
      const updatePosts = (items: SocialPost[]) => items.map((item) => item.id === post.id ? publishedPost : item);

      if (identity.isDemo) {
        setDemoSocialPosts(updatePosts(demoSocialPosts));
      } else {
        setRemoteSocialPosts(updatePosts(remoteSocialPosts));
      }

      notify(`${post.title} marked published`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to publish social post");
    }
  };

  const draftSocialPostCaption = async (post: SocialPost) => {
    try {
      const draftedPost = identity.isDemo
        ? { ...post, caption: draftDemoSocialCaption(post) }
        : (await draftOrganizationSocialCaption(identity, post.id)).post;
      const updatePosts = (items: SocialPost[]) => items.map((item) => item.id === post.id ? draftedPost : item);

      if (identity.isDemo) {
        setDemoSocialPosts(updatePosts(demoSocialPosts));
      } else {
        setRemoteSocialPosts(updatePosts(remoteSocialPosts));
      }

      notify(`Caption drafted for ${post.title}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to draft caption");
    }
  };

  const addMember = async (member: typeof members[number]) => {
    try {
      const createdMember = identity.isDemo ? member : await inviteOrganizationTeamMember(identity, member);

      if (identity.isDemo) {
        setDemoMembers([...demoMembers, createdMember]);
      } else {
        setRemoteMembers([...remoteMembers, createdMember]);
      }

      setFormDialog(null);
      notify(identity.isDemo ? `${createdMember.name} added to the demo team` : `Invitation sent to ${createdMember.email}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to invite team member");
    }
  };

  const updateLead = async (lead: Lead, input: LeadUpdateInput) => {
    try {
      const updatedLead = await updateOrganizationLead(identity, lead, input);
      const mergedLead = { ...lead, ...updatedLead, agent: updatedLead.agent ?? lead.agent };
      const updateLeads = (items: Lead[]) => items.map((item) => item.id === lead.id ? mergedLead : item);

      if (identity.isDemo) {
        setDemoLeads(updateLeads(demoLeads));
      } else {
        setRemoteLeads(updateLeads(remoteLeads));
      }

      setSelectedLead(mergedLead);
      notify(`${mergedLead.name} updated`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update lead");
    }
  };

  const callLead = async (lead: Lead) => {
    try {
      const result = await startLeadBridgeCall(identity, lead);
      notify(result.status === "simulated" ? `Calling ${lead.name} in dry-run mode` : `Bridge call queued for ${lead.name}`);
      void refreshAnalytics();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to start bridge call");
    }
  };

  const updateTeamMember = async (member: typeof members[number]) => {
    try {
      const updatedMember = identity.isDemo ? member : await updateOrganizationTeamMember(identity, member);
      const updateMembers = (items: typeof members) => items.map((item) => item.id === updatedMember.id ? updatedMember : item);

      if (identity.isDemo) {
        setDemoMembers(updateMembers(demoMembers));
      } else {
        setRemoteMembers(updateMembers(remoteMembers));
      }

      notify(`${updatedMember.name} updated`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update team member");
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f3]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-[#e1e6e0] bg-[#fbfcf9] lg:block">
        <Logo />
        <nav className="px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.16em] text-[#a0aaa5]">MAIN MENU</p>
          {nav.map((item) => <NavButton key={item.key} item={item} active={active} setActive={navigate} />)}
          <p className="mb-3 mt-8 px-3 text-[10px] font-bold tracking-[0.16em] text-[#a0aaa5]">WORKSPACE</p>
          <SideItem label="Team" icon={UserCheck} onClick={() => openTool("team")} />
          <SideItem label="Reports" icon={BarChart3} onClick={() => openTool("reports")} />
          <SideItem label="Integrations" icon={Zap} onClick={() => openTool("integrations")} />
          <SideItem label="Settings" icon={Settings} onClick={() => openTool("settings")} />
        </nav>
        <div className="absolute inset-x-3 bottom-4 rounded-xl border border-[#e1e7e2] bg-white p-3">
          <div className="flex items-center gap-2.5">
            <Avatar initials={identity.initials} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{identity.fullName}</p>
              <p className="truncate text-[10px] text-[#7b8883]">{identity.roleLabel}</p>
            </div>
            {onSignOut ? <button aria-label="Sign out" onClick={() => void onSignOut()} className="ml-auto text-[#89958f] transition hover:text-[#bd4b49]"><LogOut size={14} /></button> : <ChevronDown className="ml-auto text-[#89958f]" size={14} />}
          </div>
        </div>
      </aside>

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e4e8e3] bg-[#fbfcf9]/95 px-4 backdrop-blur md:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden"><Logo compact /></div>
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#92a099]">{identity.organizationName} · {active}</p>
            <h1 className="text-[17px] font-bold tracking-[-0.02em] text-[#21322c]">{active === "dashboard" ? "Overview" : nav.find((item) => item.key === active)?.label}</h1>
          </div>
          <div className="flex items-center gap-2.5">
            {identity.isDemo && <Badge tone="amber">Demo mode</Badge>}
            <label className="hidden h-9 items-center gap-2 rounded-lg border border-[#e1e6e1] bg-white px-3 text-[#89948f] md:flex">
              <Search size={15} />
              <input className="w-44 bg-transparent text-xs outline-none placeholder:text-[#9ca6a1]" placeholder="Search anything..." />
            </label>
            <button aria-label={`${unreadNotifications} unread notifications`} aria-expanded={showNotifications} onClick={() => setShowNotifications(!showNotifications)} className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#e1e6e1] bg-white text-[#65726d]">
              <Bell size={16} />
              {unreadNotifications > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#dc5d54] px-1 text-[9px] font-bold text-white">{unreadNotifications}</span>}
            </button>
            {onSignOut ? <button aria-label="Sign out" onClick={() => void onSignOut()}><Avatar initials={identity.initials} size="sm" /></button> : <Avatar initials={identity.initials} size="sm" />}
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-5 md:px-6 lg:px-8 lg:pb-8 lg:pt-7">
          {!identity.isDemo && <WorkspaceSyncStatus state={workspaceStatus} retry={reloadWorkspace} />}
          {active === "dashboard" && <Dashboard identity={identity} leads={crmLeads} followups={crmFollowups} analytics={analytics} canAddLead={canAddLead} setActive={navigate} openTool={openTool} openForm={setFormDialog} setSelectedLead={setSelectedLead} />}
          {active === "leads" && <LeadsPage search={search} setSearch={setSearch} leadFilter={leadFilter} setLeadFilter={setLeadFilter} leads={filteredLeads} canAddLead={canAddLead} setSelectedLead={setSelectedLead} openForm={setFormDialog} />}
          {active === "properties" && <PropertiesPage properties={crmProperties} leads={crmLeads} canManageInventory={canManageInventory} openForm={setFormDialog} setSelectedProperty={setSelectedProperty} />}
          {active === "followups" && <FollowupsPage followups={crmFollowups} analytics={analytics} completeFollowup={completeFollowup} sendQuickFollowup={sendQuickFollowup} snoozeFollowup={snoozeFollowup} openForm={setFormDialog} notify={notify} />}
          {active === "more" && !activeTool && <MorePage attendance={attendance} canManageTeam={identity.isDemo || identity.role === "admin"} openTool={openTool} openForm={setFormDialog} />}
          {active === "more" && activeTool && <WorkspaceToolView tool={activeTool} identity={identity} analytics={analytics} attendance={attendance} attendanceHistory={attendanceHistory} updateAttendance={updateAttendance} socialPosts={socialPosts} publishSocialPost={publishSocialPost} draftSocialPostCaption={draftSocialPostCaption} leads={crmLeads} properties={crmProperties} members={members} updateTeamMember={updateTeamMember} settings={settings} setSettings={setSettings} back={() => setActiveTool(null)} openSocialForm={() => setFormDialog({ kind: "social" })} openMemberForm={() => setFormDialog({ kind: "member" })} notify={notify} />}
        </main>
      </div>

      <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(68px+env(safe-area-inset-bottom))] items-start justify-around border-t border-[#e1e6e0] bg-white/95 px-1 pt-2 backdrop-blur lg:hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          return <button aria-current={active === item.key ? "page" : undefined} key={item.key} onClick={() => navigate(item.key)} className={`relative flex min-h-12 min-w-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${active === item.key ? "bg-[#edf6f1] text-[#176b4d]" : "text-[#87918d]"}`}><Icon size={19} strokeWidth={active === item.key ? 2.5 : 2} />{item.label}</button>;
        })}
      </nav>

      {selectedLead && <LeadDrawer key={selectedLead.id} identity={identity} lead={selectedLead} properties={crmProperties} members={members} close={() => setSelectedLead(null)} notify={notify} shareProperty={sendPropertyShare} callLead={callLead} updateLead={updateLead} />}
      {selectedProperty && <PropertyDrawer key={selectedProperty.id} property={selectedProperty} canManageInventory={canManageInventory} close={() => setSelectedProperty(null)} updateProperty={updateProperty} deleteProperty={deleteProperty} />}
      {showNotifications && <NotificationCenter notifications={notifications} close={() => setShowNotifications(false)} markRead={markNotificationRead} />}
      {formDialog && <WorkspaceFormDialog state={formDialog} close={() => setFormDialog(null)} addLead={addLead} addProperty={addProperty} addFollowup={addFollowup} addSocialPost={addSocialPost} addMember={addMember} />}
      {toast && <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl bg-[#1d352c] px-4 py-2.5 text-center text-xs font-semibold text-white shadow-xl lg:bottom-7"><CheckCircle2 className="shrink-0" size={15} />{toast}</div>}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? "" : "h-[68px] border-b border-[#e4e8e3] px-5"}`}>
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#176b4d] text-white"><Building2 size={17} /></div>
      <div><p className="text-sm font-bold tracking-[-0.04em] text-[#20312b]">EstateFlow</p><p className="text-[9px] font-bold tracking-[0.22em] text-[#8f9d97]">CRM</p></div>
    </div>
  );
}

function NavButton({ item, active, setActive }: { item: typeof nav[number]; active: ModuleKey; setActive: (key: ModuleKey) => void }) {
  const Icon = item.icon;
  return <button onClick={() => setActive(item.key)} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${active === item.key ? "bg-[#e6f1eb] text-[#176b4d]" : "text-[#718079] hover:bg-[#f0f3ef]"}`}><Icon size={17} />{item.label}</button>;
}

function SideItem({ label, icon: Icon, onClick }: { label: string; icon: typeof Users; onClick: () => void }) {
  return <button onClick={onClick} className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold text-[#718079] hover:bg-[#f0f3ef]"><Icon size={17} />{label}</button>;
}

function Dashboard({ identity, leads, followups, analytics, canAddLead, setActive, openTool, openForm, setSelectedLead }: { identity: WorkspaceIdentity; leads: Lead[]; followups: typeof initialFollowups; analytics: AnalyticsSnapshot; canAddLead: boolean; setActive: (key: ModuleKey) => void; openTool: (tool: WorkspaceTool) => void; openForm: (state: FormDialogState) => void; setSelectedLead: (lead: Lead) => void }) {
  const pipeline = ["New", "Contacted", "Interested", "Site Visit", "Negotiation"];
  const maxPipeline = Math.max(1, ...pipeline.map((status) => analytics.pipeline[status] ?? 0));
  const conversionDegrees = Math.round((analytics.conversionRate / 100) * 360);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold text-[#7b8983]">{formatDashboardDate()}</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.055em] text-[#1e2d28]">Good morning, {identity.fullName.split(" ")[0]}</h2><p className="mt-1 text-sm text-[#74817c]">Here&apos;s what&apos;s happening across your sales team.</p></div>
        {canAddLead && <button onClick={() => openForm({ kind: "lead" })} className="flex h-10 items-center gap-2 rounded-lg bg-[#176b4d] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#10523a]"><Plus size={16} />Add new lead</button>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="New leads" value={String(analytics.newLeadsToday)} delta="Today" icon={Users} tone="bg-[#e7f3ed] text-[#176b4d]" />
        <MetricCard label="Calls made" value={String(analytics.callsToday)} delta="Today" icon={Phone} tone="bg-[#edf0f9] text-[#52649d]" />
        <MetricCard label="Follow-ups due" value={String(analytics.followupsDueToday)} delta={`${analytics.urgentFollowups} urgent`} icon={CalendarClock} tone="bg-[#fdf4e3] text-[#b37617]" />
        <MetricCard label="Site visits" value={String(analytics.siteVisitsToday)} delta="Today" icon={MapPin} tone="bg-[#f9ece7] text-[#b65d44]" />
        <MetricCard label="Inventory" value={String(analytics.availableProperties)} delta="Available" icon={Building2} tone="bg-[#e7f3ed] text-[#176b4d]" />
        <MetricCard label="Attendance" value={String(analytics.teamCheckedIn)} delta="Checked in" icon={UserCheck} tone="bg-[#edf0f9] text-[#52649d]" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#e6eae5] bg-white p-4 md:p-5">
            <SectionTitle title="Quick actions" />
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {canAddLead && <QuickAction label="Add lead" icon={Plus} onClick={() => openForm({ kind: "lead" })} />}
              <QuickAction label="Call lead" icon={Phone} onClick={() => setSelectedLead(leads[0])} />
              <QuickAction label="Share property" icon={Share2} onClick={() => setActive("properties")} />
              <QuickAction label="Check in" icon={MapPin} onClick={() => openTool("attendance")} />
            </div>
          </section>
          <section className="rounded-2xl border border-[#e6eae5] bg-white p-4 md:p-5">
            <SectionTitle title="Sales pipeline" action="View report" onAction={() => openTool("reports")} />
            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_170px]">
              <div className="space-y-4">
                {pipeline.map((status, index) => <Pipeline key={status} label={status === "Site Visit" ? "Site visits" : status === "New" ? "New leads" : status} value={String(analytics.pipeline[status] ?? 0)} percent={Math.round(((analytics.pipeline[status] ?? 0) / maxPipeline) * 100)} color={["#82b6a3", "#629b88", "#3d8068", "#216c52", "#14573f"][index]} />)}
              </div>
              <div className="flex items-center justify-center">
                <div className="grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#176b4d 0deg ${conversionDegrees}deg, #dde7e1 ${conversionDegrees}deg 360deg)` }}>
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><p className="text-2xl font-bold tracking-[-0.06em]">{analytics.conversionRate}%</p><p className="text-[10px] font-semibold text-[#81908a]">CONVERSION</p></div></div>
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-[#e6eae5] bg-white p-4 md:p-5">
            <SectionTitle title="Hot leads" action="View all" onAction={() => setActive("leads")} />
            <div className="mt-3 divide-y divide-[#edf0ec]">
              {leads.filter((lead) => lead.temperature === "Hot").slice(0, 4).map((lead, index) => <LeadRow key={lead.id} lead={lead} index={index} compact setSelectedLead={setSelectedLead} />)}
            </div>
          </section>
        </div>
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#e6eae5] bg-white p-4 md:p-5">
            <SectionTitle title="Follow-ups today" action="View all" onAction={() => setActive("followups")} />
            <div className="mt-3 space-y-1">{followups.slice(0, 4).map((followup, index) => <FollowupMini key={followup.id} item={followup} index={index} />)}</div>
            <button onClick={() => setActive("followups")} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-[#f0f5f2] py-2.5 text-xs font-bold text-[#176b4d]">Open follow-up queue <ArrowRight size={14} /></button>
          </section>
          <section className="rounded-2xl border border-[#e6eae5] bg-white p-4 md:p-5">
            <SectionTitle title="Recent activity" />
            <div className="mt-4 space-y-5">{analytics.recentActivities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}</div>
            {!analytics.recentActivities.length && <p className="py-6 text-center text-xs text-[#89958f]">No recent workspace activity yet.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, icon: Icon, onClick }: { label: string; icon: typeof Plus; onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-[#e7ebe7] bg-[#fbfcfa] text-[11px] font-bold text-[#54635d] transition hover:border-[#bdd6cb] hover:bg-[#f4f9f6]"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f3ed] text-[#176b4d]"><Icon size={15} /></div>{label}</button>;
}

function Pipeline({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return <div className="grid grid-cols-[82px_1fr_24px] items-center gap-3"><span className="text-xs font-medium text-[#74817c]">{label}</span><div className="h-2 overflow-hidden rounded-full bg-[#edf0ec]"><div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} /></div><span className="text-right font-mono text-xs font-bold text-[#40514b]">{value}</span></div>;
}

function LeadRow({ lead, index, compact = false, setSelectedLead }: { lead: Lead; index: number; compact?: boolean; setSelectedLead: (lead: Lead) => void }) {
  return <button onClick={() => setSelectedLead(lead)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-[#fbfcfa]"><Avatar initials={lead.initials} index={index} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-[#2c3d36]">{lead.name}</p><Badge tone={temperatureTone(lead.temperature)}>{lead.temperature}</Badge></div><p className="mt-1 truncate text-[11px] text-[#84918c]">{lead.propertyType} · {lead.location}</p></div>{!compact && <Badge tone={statusTone(lead.status)}>{lead.status}</Badge>}<div className="hidden text-right sm:block"><p className="text-[11px] font-semibold text-[#60706a]">{lead.nextFollowup}</p><p className="mt-1 text-[10px] text-[#a0aaa6]">{lead.source}</p></div><ChevronRight className="text-[#b0bab6]" size={15} /></button>;
}

function FollowupMini({ item, index }: { item: typeof initialFollowups[number]; index: number }) {
  return <div className="flex items-center gap-3 rounded-lg px-1 py-2.5"><Avatar initials={item.initials} index={index} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#33433d]">{item.lead}</p><p className="mt-0.5 truncate text-[10px] text-[#8a9691]">{item.purpose}</p></div><p className={`text-[10px] font-bold ${item.overdue ? "text-[#bd4b49]" : "text-[#65736e]"}`}>{item.time}</p></div>;
}

function ActivityItem({ activity }: { activity: DashboardActivity }) {
  const icons = { phone: Phone, share: Share2, lead: Sparkles, visit: MapPin };
  const Icon = icons[activity.icon as keyof typeof icons];
  return <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf5f1] text-[#267058]"><Icon size={14} /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#42514c]">{activity.text}</p><p className="mt-1 text-[10px] text-[#8b9692]">{activity.detail}</p></div><span className="text-[10px] font-semibold text-[#a4ada9]">{activity.time}</span></div>;
}

function formatDashboardDate() {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

function PageHeading({ eyebrow, title, copy, action, onAction }: { eyebrow: string; title: string; copy: string; action?: string; onAction?: () => void }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8d9a95]">{eyebrow}</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.055em] text-[#1e2d28]">{title}</h2><p className="mt-1 text-sm text-[#74817c]">{copy}</p></div>{action && <button onClick={onAction} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#176b4d] px-4 text-xs font-bold text-white sm:h-10 sm:w-auto"><Plus size={16} />{action}</button>}</div>;
}

function LeadsPage({ search, setSearch, leadFilter, setLeadFilter, leads, canAddLead, setSelectedLead, openForm }: { search: string; setSearch: (value: string) => void; leadFilter: string; setLeadFilter: (value: string) => void; leads: Lead[]; canAddLead: boolean; setSelectedLead: (lead: Lead) => void; openForm: (state: FormDialogState) => void }) {
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState("All");
  const [source, setSource] = useState("All");
  const [agent, setAgent] = useState("All");
  const [temperature, setTemperature] = useState("All");
  const [date, setDate] = useState("All");
  const sources = [...new Set(leads.map((lead) => lead.source))];
  const agents = [...new Set(leads.map((lead) => lead.agent))];
  const activeFilterCount = [status, source, agent, temperature, date].filter((value) => value !== "All").length;
  const visibleLeads = leads.filter((lead) => (
    (status === "All" || lead.status === status)
    && (source === "All" || lead.source === source)
    && (agent === "All" || lead.agent === agent)
    && (temperature === "All" || lead.temperature === temperature)
    && (date === "All" || isLeadCreatedToday(lead))
  ));
  const clearFilters = () => {
    setStatus("All");
    setSource("All");
    setAgent("All");
    setTemperature("All");
    setDate("All");
  };

  return <div>
    <PageHeading eyebrow="Sales workspace" title="Leads" copy="Track, qualify and convert every property enquiry." action={canAddLead ? "Add lead" : undefined} onAction={canAddLead ? () => openForm({ kind: "lead" }) : undefined} />
    <div className="rounded-2xl border border-[#e6eae5] bg-white p-3 md:p-4">
      <div className="flex flex-wrap gap-2 border-b border-[#edf0ec] pb-3">
        <label className="flex h-9 min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-[#e1e6e1] px-3 text-[#89948f]"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="Search leads, source, location..." /></label>
        <button aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)} className="flex h-9 items-center gap-2 rounded-lg border border-[#e1e6e1] px-3 text-xs font-semibold text-[#65736e]"><Filter size={14} /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</button>
      </div>
      {showFilters && <div className="mt-3 grid gap-2 rounded-xl bg-[#f8faf7] p-3 sm:grid-cols-2 lg:grid-cols-5"><LeadFilterSelect label="Status" value={status} setValue={setStatus} options={["All", "New", "Contacted", "Interested", "Site Visit", "Negotiation", "Won", "Lost", "Not Responding"]} /><LeadFilterSelect label="Source" value={source} setValue={setSource} options={["All", ...sources]} /><LeadFilterSelect label="Assigned agent" value={agent} setValue={setAgent} options={["All", ...agents]} /><LeadFilterSelect label="Temperature" value={temperature} setValue={setTemperature} options={["All", "Hot", "Warm", "Cold"]} /><LeadFilterSelect label="Created" value={date} setValue={setDate} options={["All", "Today"]} />{activeFilterCount > 0 && <button onClick={clearFilters} className="min-h-9 rounded-lg border border-[#dfe5df] bg-white px-3 text-xs font-bold text-[#176b4d] lg:col-span-5">Clear filters</button>}</div>}
      <div className="scrollbar-none flex gap-2 overflow-x-auto py-3">{["All", "Hot", "Warm", "New", "Interested", "Negotiation"].map((filter) => <button key={filter} onClick={() => setLeadFilter(filter)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ${leadFilter === filter ? "bg-[#176b4d] text-white" : "bg-[#f2f4f1] text-[#718079]"}`}>{filter}</button>)}</div>
      <div className="divide-y divide-[#edf0ec]">
        {visibleLeads.map((lead, index) => <LeadRow key={lead.id} lead={lead} index={index} setSelectedLead={setSelectedLead} />)}
      </div>
      {!visibleLeads.length && <div className="py-14 text-center"><Search className="mx-auto text-[#a3afaa]" size={22} /><p className="mt-3 text-sm font-bold">No matching leads</p><p className="mt-1 text-xs text-[#89958f]">Try a different search or filter.</p></div>}
    </div>
  </div>;
}

function LeadFilterSelect({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa5a1]">{label}<select value={value} onChange={(event) => setValue(event.target.value)} className={drawerInputClass}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function isLeadCreatedToday(lead: Lead) {
  if (!lead.createdAt) {
    return /ago|just now|today/i.test(lead.created);
  }

  const created = new Date(lead.createdAt);
  const today = new Date();
  return created.getFullYear() === today.getFullYear() && created.getMonth() === today.getMonth() && created.getDate() === today.getDate();
}

function PropertiesPage({ properties, leads, canManageInventory, openForm, setSelectedProperty }: { properties: Property[]; leads: Lead[]; canManageInventory: boolean; openForm: (state: FormDialogState) => void; setSelectedProperty: (property: Property) => void }) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const [location, setLocation] = useState("All");
  const propertyTypes = [...new Set(properties.map((property) => property.type))];
  const locations = [...new Set(properties.map((property) => property.location))];
  const filteredProperties = properties.filter((property) => {
    const matchesSearch = `${property.title} ${property.location} ${property.type} ${property.ownerDeveloper ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === "All" || property.status === status) && (type === "All" || property.type === type) && (location === "All" || property.location === location);
  });

  return <div>
    <PageHeading eyebrow="Inventory" title="Properties" copy="Match active inventory with the right buyers." action={canManageInventory ? "Add property" : undefined} onAction={canManageInventory ? () => openForm({ kind: "property" }) : undefined} />
    <div className="mb-4 flex flex-wrap gap-2">
      <label className="flex h-9 min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-[#e1e6e1] bg-white px-3 text-[#89948f]"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="Search inventory..." /></label>
      <button aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)} className="flex h-9 items-center gap-2 rounded-lg border border-[#e1e6e1] bg-white px-3 text-xs font-semibold text-[#65736e]"><SlidersHorizontal size={14} /> Filters</button>
    </div>
    {showFilters && <div className="mb-4 grid gap-2 rounded-xl border border-[#e3e8e3] bg-white p-3 sm:grid-cols-3"><InventoryFilter label="Status" value={status} setValue={setStatus} options={["All", "Available", "Hold", "Sold", "Rented"]} /><InventoryFilter label="Property type" value={type} setValue={setType} options={["All", ...propertyTypes]} /><InventoryFilter label="Location" value={location} setValue={setLocation} options={["All", ...locations]} /></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredProperties.map((property) => <article key={property.id} className="overflow-hidden rounded-2xl border border-[#e3e8e3] bg-white">
      <button onClick={() => setSelectedProperty(property)} className="block w-full text-left"><div className="relative h-40 bg-cover bg-center" style={{ backgroundImage: `url(${property.image})` }}><div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" /><span className="absolute left-3 top-3"><Badge tone={property.status === "Available" ? "green" : "amber"}>{property.status}</Badge></span><span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#315044]">{getRecommendedLeads(property, leads).length} matching leads</span></div>
      <div className="p-4"><p className="text-sm font-bold text-[#263730]">{property.title}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-[#85918d]"><MapPin size={12} />{property.location}</p><div className="mt-4 flex items-end justify-between"><div><p className="text-sm font-bold text-[#176b4d]">{property.price}</p><p className="mt-1 text-[10px] text-[#89958f]">{property.details}</p></div><span className="flex items-center gap-1 text-[10px] font-bold text-[#176b4d]">Details <ChevronRight size={13} /></span></div></div></button>
    </article>)}</div>
    {!filteredProperties.length && <div className="rounded-2xl border border-[#e3e8e3] bg-white py-14 text-center"><Search className="mx-auto text-[#a3afaa]" size={22} /><p className="mt-3 text-sm font-bold">No matching properties</p><p className="mt-1 text-xs text-[#89958f]">Try a different project, location, or type.</p></div>}
  </div>;
}

function InventoryFilter({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa5a1]">{label}<select value={value} onChange={(event) => setValue(event.target.value)} className={drawerInputClass}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function FollowupsPage({ followups, analytics, completeFollowup, sendQuickFollowup, snoozeFollowup, openForm, notify }: {
  followups: Followup[];
  analytics: AnalyticsSnapshot;
  completeFollowup: (id: string, lead: string) => Promise<void>;
  sendQuickFollowup: (followup: Followup, channel: FollowupMessageChannel, templateId: FollowupTemplateId) => Promise<void>;
  snoozeFollowup: (followup: Followup) => Promise<void>;
  openForm: (state: FormDialogState) => void;
  notify: (message: string) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<FollowupTemplateId>("review-property");

  return <div>
    <PageHeading eyebrow="Daily queue" title="Follow-ups" copy="Keep every active conversation moving forward." action="Schedule" onAction={() => openForm({ kind: "followup" })} />
    <div className="grid gap-5 xl:grid-cols-[1fr_290px]">
      <div className="rounded-2xl border border-[#e6eae5] bg-white p-4">
        <div className="flex items-center justify-between border-b border-[#edf0ec] pb-3"><p className="text-sm font-bold">Today&apos;s queue</p><Badge tone="amber">{followups.length} pending</Badge></div>
        <div className="divide-y divide-[#edf0ec]">{followups.map((item, index) => <div key={item.id} className="flex items-center gap-3 py-4"><Avatar initials={item.initials} index={index} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold">{item.lead}</p>{item.overdue && <Badge tone="red">Overdue</Badge>}</div><p className="mt-1 truncate text-[11px] text-[#87938e]">{item.purpose}</p><p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#65736e]"><Clock3 size={11} />{item.time} · {item.channel}</p></div><button aria-label={`Complete follow-up for ${item.lead}`} onClick={() => void completeFollowup(item.id, item.lead)} className="grid h-9 w-9 place-items-center rounded-full border border-[#dce6e0] text-[#26815f]"><CheckCircle2 size={17} /></button></div>)}</div>
        {!!followups.length && <div className="mt-4 space-y-2 border-t border-[#edf0ec] pt-4">{followups.map((item) => <FollowupActionTray key={item.id} item={item} templateId={selectedTemplateId} sendQuickFollowup={sendQuickFollowup} snoozeFollowup={snoozeFollowup} notify={notify} />)}</div>}
        {!followups.length && <div className="py-12 text-center"><CheckCircle2 className="mx-auto text-[#78a895]" size={24} /><p className="mt-3 text-sm font-bold">Follow-up queue cleared</p><p className="mt-1 text-xs text-[#89958f]">Schedule the next conversation when needed.</p></div>}
      </div>
      <div className="space-y-4">
        <section className="rounded-2xl border border-[#e6eae5] bg-white p-4"><p className="text-sm font-bold">Queue progress</p><div className="mt-5 grid place-items-center"><div className="grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#176b4d 0deg ${getFollowupProgressDegrees(analytics)}deg, #edf1ee ${getFollowupProgressDegrees(analytics)}deg 360deg)` }}><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><p className="text-2xl font-bold">{analytics.completedFollowups}</p><p className="text-[10px] text-[#86928e]">of {analytics.totalFollowups} done</p></div></div></div></div></section>
        <section className="rounded-2xl bg-[#1c493a] p-4 text-white"><MessageCircle size={18} /><p className="mt-4 text-sm font-bold">Quick templates</p><p className="mt-1 text-xs leading-5 text-white/70">Choose the message used by WhatsApp, SMS, and email actions.</p><div className="mt-4 space-y-2">{followupTemplates.map((template) => <button key={template.id} onClick={() => { setSelectedTemplateId(template.id); notify(`${template.title} template selected`); }} className={`w-full rounded-lg px-3 py-2 text-left text-xs font-bold transition ${selectedTemplateId === template.id ? "bg-white text-[#1c493a]" : "bg-white/10 text-white hover:bg-white/15"}`}>{template.title}</button>)}</div></section>
      </div>
    </div>
  </div>;
}

function FollowupActionTray({ item, templateId, sendQuickFollowup, snoozeFollowup, notify }: {
  item: Followup;
  templateId: FollowupTemplateId;
  sendQuickFollowup: (followup: Followup, channel: FollowupMessageChannel, templateId: FollowupTemplateId) => Promise<void>;
  snoozeFollowup: (followup: Followup) => Promise<void>;
  notify: (message: string) => void;
}) {
  return <div className="rounded-xl bg-[#f8faf7] p-3"><p className="text-[11px] font-bold text-[#52635d]">{item.lead}</p><div className="mt-2 flex flex-wrap gap-2"><FollowupAction label="WhatsApp" onClick={() => void sendQuickFollowup(item, "whatsapp", templateId)} /><FollowupAction label="SMS" onClick={() => void sendQuickFollowup(item, "sms", templateId)} /><FollowupAction label="Email" onClick={() => void sendQuickFollowup(item, "email", templateId)} /><button onClick={() => notify(`Call reminder ready for ${item.lead}`)} className="flex min-h-10 items-center gap-1 rounded-lg border border-[#e1e6e1] px-3 text-[10px] font-bold text-[#60706a] sm:min-h-8 sm:px-2.5"><Phone size={12} />Call</button><button onClick={() => void snoozeFollowup(item)} className="flex min-h-10 items-center gap-1 rounded-lg border border-[#e1e6e1] px-3 text-[10px] font-bold text-[#60706a] sm:min-h-8 sm:px-2.5"><Clock3 size={12} />Snooze</button></div></div>;
}

function FollowupAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="min-h-10 rounded-lg bg-[#e7f3ed] px-3 text-[10px] font-bold text-[#176b4d] sm:min-h-8 sm:px-2.5">{label}</button>;
}

function formatFollowupActionTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getFollowupProgressDegrees(analytics: AnalyticsSnapshot) {
  return analytics.totalFollowups ? Math.round((analytics.completedFollowups / analytics.totalFollowups) * 360) : 0;
}

function MorePage({ attendance, canManageTeam, openTool, openForm }: { attendance: typeof initialAttendance; canManageTeam: boolean; openTool: (tool: WorkspaceTool) => void; openForm: (state: FormDialogState) => void }) {
  const modules = [
    { label: "Attendance", copy: "Check in and track field teams", icon: UserCheck, tool: "attendance" },
    { label: "Social media", copy: "Plan and schedule posts", icon: Megaphone, tool: "social" },
    { label: "Reports", copy: "Review sales performance", icon: BarChart3, tool: "reports" },
    { label: "Team", copy: "Manage roles and members", icon: Users, tool: "team" },
    { label: "Integrations", copy: "Connect Twilio and messaging", icon: Zap, tool: "integrations" },
    { label: "Settings", copy: "Configure your workspace", icon: Settings, tool: "settings" },
  ];
  return <div>
    <PageHeading eyebrow="Workspace" title="More tools" copy="Operate your business from one place." action={canManageTeam ? "Invite member" : undefined} onAction={canManageTeam ? () => openForm({ kind: "member" }) : undefined} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modules.map((module) => { const Icon = module.icon; return <button key={module.label} onClick={() => openTool(module.tool as WorkspaceTool)} className="flex items-center gap-4 rounded-2xl border border-[#e5e9e4] bg-white p-4 text-left transition hover:border-[#bdd6cb] hover:shadow-sm"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e7f3ed] text-[#176b4d]"><Icon size={19} /></div><div className="flex-1"><p className="text-sm font-bold">{module.label}</p><p className="mt-1 text-xs text-[#85918d]">{module.copy}</p></div><ChevronRight className="text-[#aab4b0]" size={16} /></button>; })}</div>
    <div className="mt-6 grid gap-4 xl:grid-cols-2"><section className="rounded-2xl border border-[#e6eae5] bg-white p-5"><SectionTitle title="Team attendance" action="View attendance" onAction={() => openTool("attendance")} /><div className="mt-4 flex items-center gap-3"><div className="flex -space-x-2">{attendance.map((record, index) => <div key={record.id} className="rounded-full border-2 border-white"><Avatar initials={record.initials} index={index} size="sm" /></div>)}</div><p className="text-xs font-semibold text-[#5d6e67]"><span className="text-[#176b4d]">{attendance.filter((record) => record.status === "Checked in").length} checked in</span> · {attendance.filter((record) => record.status !== "Checked in").length} out today</p></div></section><section className="rounded-2xl border border-[#e6eae5] bg-white p-5"><SectionTitle title="Integration health" /><div className="mt-4 flex flex-wrap gap-2"><Badge tone="green">Dry-run ready</Badge><Badge tone="green">Webhook active</Badge><Badge tone="amber">Production keys needed</Badge></div></section></div>
  </div>;
}

function PropertyDrawer({ property, canManageInventory, close, updateProperty, deleteProperty }: { property: Property; canManageInventory: boolean; close: () => void; updateProperty: (property: Property, input: PropertyUpdateInput) => Promise<void>; deleteProperty: (property: Property) => Promise<void> }) {
  const [draft, setDraft] = useState(() => getPropertyDraft(property));
  const [activeImage, setActiveImage] = useState(property.image);
  const images = property.images?.length ? property.images : [property.image];

  const removeProperty = () => {
    if (window.confirm(`Remove ${property.title} from inventory? This cannot be undone.`)) {
      void deleteProperty(property);
    }
  };

  return <div className="fixed inset-0 z-40 bg-[#15251f]/30 backdrop-blur-[2px]" onMouseDown={close}><aside onMouseDown={(event) => event.stopPropagation()} className="absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto bg-white pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
    <div className="relative h-56 bg-cover bg-center" style={{ backgroundImage: `url(${activeImage})` }}><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" /><button aria-label="Close property details" onClick={close} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#68756f]"><X size={15} /></button><div className="absolute bottom-4 left-5"><Badge tone={property.status === "Available" ? "green" : "amber"}>{property.status}</Badge><h3 className="mt-2 text-xl font-bold tracking-[-0.04em] text-white">{property.title}</h3><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-white/80"><MapPin size={12} />{property.location}</p></div></div>
    {images.length > 1 && <div className="flex gap-2 overflow-x-auto px-5 pt-4">{images.map((image) => <button aria-label={`View ${property.title} photo`} key={image} onClick={() => setActiveImage(image)} className={`h-14 w-20 shrink-0 rounded-lg border-2 bg-cover bg-center ${activeImage === image ? "border-[#176b4d]" : "border-transparent"}`} style={{ backgroundImage: `url(${image})` }} />)}</div>}
    <div className="p-5">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f7f8f5] p-4 text-xs"><Detail label="Price" value={property.price} /><Detail label="Type" value={property.type} /><Detail label="Size" value={property.sizeSqft ? `${property.sizeSqft.toLocaleString("en-IN")} sq.ft.` : "Not set"} /><Detail label="Units" value={String(property.unitsAvailable ?? 1)} /><Detail label="Bedrooms" value={String(property.bedrooms ?? "Not set")} /><Detail label="Bathrooms" value={String(property.bathrooms ?? "Not set")} /></div>
      {!!property.amenities?.length && <div className="mt-5"><SectionTitle title="Amenities" /><div className="mt-3 flex flex-wrap gap-2">{property.amenities.map((amenity) => <Badge key={amenity} tone="green">{amenity}</Badge>)}</div></div>}
      <div className="mt-5"><SectionTitle title="Brochures and documents" /><div className="mt-3 space-y-2">{property.documents?.map((document) => document.url ? <a key={document.id ?? document.name} href={document.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-[#e6eae5] p-3 text-left transition hover:border-[#bdd6cb]"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf5f1] text-[#176b4d]"><FileText size={15} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#40514b]">{document.name}</p><p className="mt-1 text-[10px] text-[#89958f]">{document.type}</p></div><span className="text-[10px] font-bold text-[#176b4d]">Open</span></a> : <div key={document.id ?? document.name} className="flex items-center gap-3 rounded-xl border border-[#e6eae5] p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf5f1] text-[#176b4d]"><FileText size={15} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#40514b]">{document.name}</p><p className="mt-1 text-[10px] text-[#89958f]">{document.type}</p></div></div>)}{!property.documents?.length && <p className="rounded-xl bg-[#f7f8f5] p-3 text-xs text-[#89958f]">No brochures uploaded yet.</p>}</div></div>
      <div className="mt-5"><SectionTitle title={canManageInventory ? "Inventory controls" : "Inventory details"} /><div className="mt-3 grid gap-3 rounded-xl border border-[#e6eae5] p-3 sm:grid-cols-2">
        <DrawerField label="Title"><input disabled={!canManageInventory} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={drawerInputClass} /></DrawerField>
        <DrawerField label="Location"><input disabled={!canManageInventory} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className={drawerInputClass} /></DrawerField>
        <DrawerField label="Type"><input disabled={!canManageInventory} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className={drawerInputClass} /></DrawerField>
        <DrawerField label="Price"><input disabled={!canManageInventory} value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className={drawerInputClass} /></DrawerField>
        <DrawerField label="Status"><select disabled={!canManageInventory} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Property["status"] })} className={drawerInputClass}>{["Available", "Hold", "Sold", "Rented"].map((status) => <option key={status}>{status}</option>)}</select></DrawerField>
        <DrawerField label="Units available"><input disabled={!canManageInventory} type="number" min="0" value={draft.unitsAvailable ?? 1} onChange={(event) => setDraft({ ...draft, unitsAvailable: Number(event.target.value) })} className={drawerInputClass} /></DrawerField>
        <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa5a1] sm:col-span-2">Details<textarea disabled={!canManageInventory} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} className={`${drawerInputClass} min-h-20 py-2`} /></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa5a1] sm:col-span-2">Internal notes<textarea disabled={!canManageInventory} value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className={`${drawerInputClass} min-h-20 py-2`} /></label>
        {canManageInventory && <button onClick={() => void updateProperty(property, draft)} className="h-10 rounded-lg bg-[#176b4d] px-4 text-xs font-bold text-white sm:col-span-2">Save property changes</button>}
        {canManageInventory && <button onClick={removeProperty} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f0d6d2] px-4 text-xs font-bold text-[#b34b49] sm:col-span-2"><Trash2 size={14} />Remove from inventory</button>}
      </div></div>
    </div>
  </aside></div>;
}

function getPropertyDraft(property: Property): PropertyUpdateInput {
  return {
    title: property.title,
    location: property.location,
    type: property.type,
    price: property.price,
    details: property.details,
    status: property.status,
    address: property.address,
    sizeSqft: property.sizeSqft,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    floor: property.floor,
    furnishingStatus: property.furnishingStatus,
    unitsAvailable: property.unitsAvailable ?? 1,
    ownerDeveloper: property.ownerDeveloper,
    amenities: property.amenities,
    notes: property.notes,
    internalTags: property.internalTags,
  };
}

function getRecommendedProperties(lead: Lead, properties: Property[]) {
  return [...properties].sort((left, right) => getPropertyMatchScore(right, lead) - getPropertyMatchScore(left, lead));
}

function getRecommendedLeads(property: Property, leads: Lead[]) {
  return leads.filter((lead) => getPropertyMatchScore(property, lead) >= 2);
}

function getPropertyMatchScore(property: Property, lead: Lead) {
  const propertyType = property.type.toLowerCase();
  const leadType = lead.propertyType.toLowerCase();
  const propertyLocation = property.location.toLowerCase();
  const leadLocation = lead.location.toLowerCase();
  const budgetCeiling = getLargestMoneyAmount(lead.budget);
  const propertyPrice = getLargestMoneyAmount(property.price);
  let score = 0;

  if (propertyType.includes(leadType) || leadType.includes(propertyType)) {
    score += 3;
  }

  if (propertyLocation.includes(leadLocation) || leadLocation.includes(propertyLocation) || getSharedLocationToken(propertyLocation, leadLocation)) {
    score += 2;
  }

  if (budgetCeiling && propertyPrice && propertyPrice <= budgetCeiling) {
    score += 2;
  }

  return score;
}

function getLargestMoneyAmount(value: string) {
  const amounts = value.toLowerCase().match(/\d+(?:\.\d+)?\s*(?:cr|l)?/g) ?? [];
  return Math.max(0, ...amounts.map((amount) => {
    const number = Number.parseFloat(amount);
    if (amount.includes("cr")) return number * 10000000;
    if (amount.includes("l")) return number * 100000;
    return number;
  }));
}

function getSharedLocationToken(left: string, right: string) {
  const tokens = left.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return tokens.some((token) => right.includes(token));
}

function LeadDrawer({ identity, lead, properties: unorderedProperties, members, close, notify, shareProperty, callLead, updateLead }: { identity: WorkspaceIdentity; lead: Lead; properties: Property[]; members: typeof initialTeamMembers; close: () => void; notify: (message: string) => void; shareProperty: (lead: Lead, property: Property, channel: PropertyShareChannel) => Promise<void>; callLead: (lead: Lead) => Promise<void>; updateLead: (lead: Lead, input: LeadUpdateInput) => Promise<void> }) {
  const [showProperties, setShowProperties] = useState(false);
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineToken, setTimelineToken] = useState(0);
  const [draft, setDraft] = useState(() => getLeadDraft(lead, members));
  const properties = getRecommendedProperties(lead, unorderedProperties);
  const canReassignLead = identity.isDemo || ["admin", "sales_manager"].includes(identity.role);

  useEffect(() => {
    let active = true;

    void getLeadTimeline(identity, lead).then((items) => {
      if (active) {
        setTimeline(items);
        setTimelineLoading(false);
      }
    }).catch((error) => {
      if (active) {
        setTimeline([]);
        setTimelineLoading(false);
        notify(error instanceof Error ? error.message : "Unable to load lead timeline");
      }
    });

    return () => {
      active = false;
    };
  }, [identity, lead, notify, timelineToken]);

  const refreshTimeline = () => {
    setTimelineLoading(true);
    setTimelineToken((token) => token + 1);
  };

  const saveLead = async () => {
    const agent = members.find((member) => (member.profileId ?? member.id) === draft.assignedAgentId);
    await updateLead(lead, { ...draft, agent: agent?.name ?? lead.agent });
    refreshTimeline();
  };

  return <div className="fixed inset-0 z-40 bg-[#15251f]/30 backdrop-blur-[2px]" onMouseDown={close}><aside onMouseDown={(event) => event.stopPropagation()} className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
    <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8d9a95]">Lead details</p><button aria-label="Close lead details" onClick={close} className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f3f0] text-[#68756f]"><X size={15} /></button></div>
    <div className="mt-6 flex items-center gap-3"><Avatar initials={lead.initials} size="lg" /><div><div className="flex items-center gap-2"><h3 className="text-lg font-bold tracking-[-0.04em]">{lead.name}</h3><Badge tone={temperatureTone(lead.temperature)}>{lead.temperature}</Badge></div><p className="mt-1 text-xs text-[#7c8984]">{lead.id} · {lead.source}</p></div></div>
    <div className="mt-6 grid grid-cols-3 gap-2"><DrawerAction icon={Phone} label="Call now" onClick={() => void callLead(lead).then(refreshTimeline)} /><DrawerAction icon={MessageCircle} label="WhatsApp" onClick={() => notify(`WhatsApp follow-up prepared for ${lead.name}`)} /><DrawerAction icon={Share2} label="Recommended" onClick={() => setShowProperties(!showProperties)} /></div>
    {showProperties && <div className="mt-4 rounded-xl border border-[#dfe7e2] bg-[#fbfcfa] p-3"><div className="flex items-center justify-between"><p className="text-xs font-bold text-[#40514b]">Select a property to share</p><Badge tone="green">{properties.length} listings</Badge></div><div className="mt-2 max-h-72 space-y-2 overflow-y-auto">{properties.map((property) => <div key={property.id} className="rounded-xl border border-[#e6eae5] bg-white p-3"><div className="flex gap-3"><div className="h-12 w-14 shrink-0 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${property.image})` }} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#34443e]">{property.title}</p><p className="mt-1 truncate text-[10px] text-[#85918d]">{property.location} · {property.price}</p></div></div><div className="mt-3 grid grid-cols-3 gap-1.5"><ShareChannelButton label="WhatsApp" icon={MessageCircle} onClick={() => void shareProperty(lead, property, "whatsapp")} /><ShareChannelButton label="SMS" icon={Phone} onClick={() => void shareProperty(lead, property, "sms")} /><ShareChannelButton label="Email" icon={Mail} onClick={() => void shareProperty(lead, property, "email")} /></div></div>)}</div></div>}
    <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-[#f7f8f5] p-4 text-xs"><Detail label="Phone" value={lead.phone} /><Detail label="Status" value={lead.status} /><Detail label="Budget" value={lead.budget} /><Detail label="Property" value={lead.propertyType} /><Detail label="Location" value={lead.location} /><Detail label="Assigned to" value={lead.agent} /></div>
    <div className="mt-6"><SectionTitle title="Qualification" /><div className="mt-3 grid gap-3 rounded-xl border border-[#e6eae5] p-3 sm:grid-cols-2"><DrawerField label="Status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LeadStatus })} className={drawerInputClass}>{["New", "Contacted", "Interested", "Site Visit", "Negotiation", "Won", "Lost", "Not Responding"].map((status) => <option key={status}>{status}</option>)}</select></DrawerField><DrawerField label="Temperature"><select value={draft.temperature} onChange={(event) => setDraft({ ...draft, temperature: event.target.value as Lead["temperature"] })} className={drawerInputClass}>{["Hot", "Warm", "Cold"].map((temperature) => <option key={temperature}>{temperature}</option>)}</select></DrawerField><DrawerField label="Assigned agent"><select disabled={!canReassignLead} value={draft.assignedAgentId} onChange={(event) => setDraft({ ...draft, assignedAgentId: event.target.value })} className={drawerInputClass}>{members.filter((member) => ["Sales Manager", "Sales Agent"].includes(member.role)).map((member) => <option key={member.id} value={member.profileId ?? member.id}>{member.name}</option>)}</select></DrawerField><button onClick={() => setDraft({ ...draft, temperature: "Hot" })} className="mt-5 h-10 rounded-lg bg-[#fbebea] px-3 text-xs font-bold text-[#b34b49]">Mark as hot lead</button><label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa5a1] sm:col-span-2">Notes<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} className={`${drawerInputClass} min-h-20 py-2`} /></label><button onClick={() => void saveLead()} className="h-10 rounded-lg bg-[#176b4d] px-4 text-xs font-bold text-white sm:col-span-2">Save lead changes</button></div></div>
    <div className="mt-6"><SectionTitle title="Next follow-up" /><div className="mt-3 flex items-center gap-3 rounded-xl border border-[#eadfc7] bg-[#fffaf0] p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#faedcd] text-[#a66b16]"><CalendarClock size={16} /></div><div><p className="text-xs font-bold">{lead.nextFollowup}</p><p className="mt-1 text-[10px] text-[#8f7b5e]">Call and discuss shortlisted options</p></div></div></div>
    <div className="mt-6"><SectionTitle title="Activity timeline" />{timelineLoading ? <p className="mt-4 text-xs text-[#8a9691]">Loading timeline...</p> : <div className="mt-4 space-y-4">{timeline.map((item) => <Timeline key={item.id} item={item} />)}</div>}{!timelineLoading && !timeline.length && <p className="mt-4 text-xs text-[#8a9691]">No lead activity recorded yet.</p>}</div>
  </aside></div>;
}

const drawerInputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe5df] bg-white px-3 text-xs font-semibold text-[#46554f] outline-none focus:border-[#8ab5a4]";

function getLeadDraft(lead: Lead, members: typeof initialTeamMembers): LeadUpdateInput {
  const assignedAgent = members.find((member) => member.name === lead.agent);
  return {
    status: lead.status,
    temperature: lead.temperature,
    note: lead.note,
    assignedAgentId: assignedAgent?.profileId ?? assignedAgent?.id,
    agent: lead.agent,
  };
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa5a1]">{label}{children}</label>;
}

function ShareChannelButton({ label, icon: Icon, onClick }: { label: string; icon: typeof Phone; onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-[#edf5f1] px-2 py-2 text-[10px] font-bold text-[#176b4d]"><Icon size={12} />{label}</button>;
}

function DrawerAction({ icon: Icon, label, onClick }: { icon: typeof Phone; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-xl bg-[#e7f3ed] px-2 py-3 text-[11px] font-bold text-[#176b4d]"><Icon size={17} />{label}</button>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa5a1]">{label}</p><p className="mt-1 font-semibold text-[#46554f]">{value}</p></div>;
}

function Timeline({ item }: { item: LeadTimelineItem }) {
  const icons = { phone: Phone, message: MessageCircle, share: Share2, followup: CalendarClock, lead: Sparkles };
  const Icon = icons[item.icon];
  return <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf5f1] text-[#267058]"><Icon size={13} /></div><div><p className="text-xs font-bold text-[#46554f]">{item.title}</p><p className="mt-1 text-[10px] text-[#8a9691]">{item.detail} - {formatTimelineTime(item.timestamp)}</p></div></div>;
}

function formatTimelineTime(value: string) {
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000)), "minute");
}
