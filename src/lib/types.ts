export type ModuleKey =
  | "dashboard"
  | "leads"
  | "properties"
  | "followups"
  | "more";

export type WorkspaceTool =
  | "overview"
  | "site-visits"
  | "attendance"
  | "social"
  | "reports"
  | "team"
  | "integrations"
  | "settings";

export type LeadTemperature = "Hot" | "Warm" | "Cold";

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Interested"
  | "Site Visit"
  | "Negotiation"
  | "Won"
  | "Lost"
  | "Not Responding";

export interface Lead {
  id: string;
  name: string;
  initials: string;
  phone: string;
  source: string;
  propertyType: string;
  budget: string;
  location: string;
  status: LeadStatus;
  temperature: LeadTemperature;
  agent: string;
  nextFollowup: string;
  created: string;
  createdAt?: string;
  note: string;
  qualificationStatus?: "pending" | "in_progress" | "complete" | "failed";
  qualifiedBudgetMin?: number | null;
  qualifiedBudgetMax?: number | null;
  qualifiedLocations?: string[] | null;
  qualifiedTimeline?: string | null;
  qualifiedPropertyType?: string | null;
  qualificationSentiment?: string | null;
  qualificationCompletedAt?: string | null;
}

export interface Property {
  id: string;
  title: string;
  location: string;
  type: string;
  price: string;
  details: string;
  status: "Available" | "Hold" | "Sold" | "Rented";
  image: string;
  images?: string[];
  documents?: PropertyDocument[];
  matches: number;
  address?: string;
  sizeSqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  furnishingStatus?: string;
  unitsAvailable?: number;
  ownerDeveloper?: string;
  amenities?: string[];
  notes?: string;
  internalTags?: string[];
}

export interface PropertyDocument {
  id?: string;
  name: string;
  type: string;
  url?: string;
  storagePath?: string;
}

export interface Followup {
  id: string;
  lead: string;
  leadId?: string;
  initials: string;
  purpose: string;
  time: string;
  channel: "Call" | "WhatsApp" | "SMS" | "Email" | "Site visit";
  temperature: LeadTemperature;
  overdue?: boolean;
}

export interface SiteVisit {
  id: string;
  lead: string;
  leadId?: string;
  initials: string;
  location: string;
  scheduledFor: string;
  assignee: string;
  assigneeId?: string;
  notes: string;
  status: "Scheduled" | "Completed";
  completedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  role: string;
  status: "Checked in" | "Checked out" | "Absent";
  checkIn?: string;
  checkOut?: string;
  location?: string;
  notes?: string;
  selfieStoragePath?: string;
}

export interface AttendanceHistoryRecord {
  id: string;
  date: string;
  status: "Checked in" | "Checked out";
  checkIn: string;
  checkOut?: string;
  location?: string;
  notes?: string;
  selfieStoragePath?: string;
}

export interface SocialPost {
  id: string;
  title: string;
  type: "Instagram Reel" | "Instagram Post" | "Facebook Post" | "LinkedIn Post" | "Story";
  caption: string;
  status: "Idea" | "Draft" | "Scheduled" | "Published";
  scheduledFor: string;
  assignee: string;
  notes?: string;
  mediaStoragePaths?: string[];
  mediaUrls?: string[];
}

export interface TeamMember {
  id: string;
  profileId?: string;
  name: string;
  initials: string;
  email?: string;
  role: string;
  phone: string;
  status: "Available" | "Busy" | "Offline";
  leads: number;
}

export interface LeadTimelineItem {
  id: string;
  icon: "phone" | "message" | "share" | "followup" | "lead";
  title: string;
  detail: string;
  timestamp: string;
}

export interface IntegrationSettings {
  twilioPhone: string;
  whatsappSender: string;
  emailSender: string;
  socialPublishWebhookUrl: string;
  callDryRun: boolean;
  messagingDryRun: boolean;
  emailDryRun: boolean;
  socialPublishDryRun: boolean;
  secretStatus: IntegrationSecretStatus;
}

export interface IntegrationSecretStatus {
  twilioAccountSid: boolean;
  twilioAuthToken: boolean;
  resendApiKey: boolean;
  webhookSecret: boolean;
  openAiApiKey: boolean;
}

export type LeadAssignmentMode = "round_robin" | "manual" | "least_busy";

export interface WorkspaceSettings {
  organizationName: string;
  assignmentMode: LeadAssignmentMode;
}

export interface OrganizationSettingsSnapshot {
  workspace: WorkspaceSettings;
  integrations: IntegrationSettings;
}

export interface WorkspaceNotification {
  id: string;
  type: "new_lead_assigned" | "missed_lead_call" | "followup_due" | "site_visit_scheduled" | "property_shared" | "attendance_issue" | "social_post_due" | "general";
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
}

export interface DashboardActivity {
  id: string;
  icon: "phone" | "share" | "lead" | "visit";
  text: string;
  detail: string;
  time: string;
}

export interface AgentPerformance {
  name: string;
  calls: number;
}

export interface AnalyticsSnapshot {
  newLeadsToday: number;
  callsToday: number;
  followupsDueToday: number;
  urgentFollowups: number;
  siteVisitsToday: number;
  availableProperties: number;
  teamCheckedIn: number;
  completedFollowups: number;
  totalFollowups: number;
  propertyShares: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  pipeline: Record<string, number>;
  sources: { label: string; value: number }[];
  agentPerformance: AgentPerformance[];
  recentActivities: DashboardActivity[];
}
