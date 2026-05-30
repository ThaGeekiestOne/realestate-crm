import type { AttendanceHistoryRecord, AttendanceRecord, Followup, Lead, Property, SocialPost, TeamMember } from "@/lib/types";

export const leads: Lead[] = [
  { id: "LD-1048", name: "Aarav Mehta", initials: "AM", phone: "+91 98765 40218", source: "MagicBricks", propertyType: "Apartment", budget: "₹1.2–1.5 Cr", location: "Golf Course Road", status: "New", temperature: "Hot", agent: "Riya Kapoor", nextFollowup: "Today, 11:30 AM", created: "8 min ago", note: "Looking for a ready-to-move 3 BHK. Wants to schedule a visit this weekend." },
  { id: "LD-1047", name: "Priya Sharma", initials: "PS", phone: "+91 98117 62950", source: "Instagram", propertyType: "Villa", budget: "₹2.5–3 Cr", location: "Sohna Road", status: "Interested", temperature: "Hot", agent: "Kabir Singh", nextFollowup: "Today, 12:15 PM", created: "24 min ago", note: "Interested in gated communities with clubhouse facilities." },
  { id: "LD-1046", name: "Rohan Verma", initials: "RV", phone: "+91 99582 18404", source: "36 Acre", propertyType: "Apartment", budget: "₹85 L–1.1 Cr", location: "Dwarka Expressway", status: "Contacted", temperature: "Warm", agent: "Riya Kapoor", nextFollowup: "Today, 2:00 PM", created: "41 min ago", note: "Needs options near proposed metro corridor." },
  { id: "LD-1045", name: "Sneha Iyer", initials: "SI", phone: "+91 98910 77416", source: "Referral", propertyType: "Plot", budget: "₹1.8–2.2 Cr", location: "New Gurgaon", status: "Site Visit", temperature: "Hot", agent: "Kabir Singh", nextFollowup: "Today, 3:30 PM", created: "1 hr ago", note: "Site visit confirmed for Saturday with family." },
  { id: "LD-1044", name: "Karan Malhotra", initials: "KM", phone: "+91 97177 62009", source: "Website", propertyType: "Commercial", budget: "₹95 L–1.3 Cr", location: "Sector 65", status: "Negotiation", temperature: "Warm", agent: "Riya Kapoor", nextFollowup: "Tomorrow, 10:00 AM", created: "2 hrs ago", note: "Comparing two retail units; requested rental yield projection." },
  { id: "LD-1043", name: "Naina Gupta", initials: "NG", phone: "+91 98109 38812", source: "Housing", propertyType: "Apartment", budget: "₹70–90 L", location: "Sector 83", status: "Contacted", temperature: "Cold", agent: "Kabir Singh", nextFollowup: "Tomorrow, 12:30 PM", created: "3 hrs ago", note: "First-time buyer, exploring finance options." },
];

export const properties: Property[] = ([
  { id: "PR-209", title: "Emaar Palm Heights", location: "Sector 77, Gurgaon", type: "3 BHK Apartment", price: "₹1.42 Cr", details: "2,025 sq.ft. · Ready to move", status: "Available", matches: 14, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80" },
  { id: "PR-208", title: "DLF The Arbour", location: "Sector 63, Gurgaon", type: "4 BHK Apartment", price: "₹6.85 Cr", details: "3,950 sq.ft. · New launch", status: "Available", matches: 8, image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80" },
  { id: "PR-207", title: "M3M Antalya Hills", location: "Sector 79, Gurgaon", type: "3 BHK Builder Floor", price: "₹1.68 Cr", details: "1,534 sq.ft. · Possession 2027", status: "Hold", matches: 11, image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=80" },
  { id: "PR-206", title: "Godrej Meridien", location: "Sector 106, Gurgaon", type: "3 BHK Apartment", price: "₹2.35 Cr", details: "1,855 sq.ft. · Ready to move", status: "Available", matches: 17, image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80" },
] satisfies Property[]).map((property, index) => ({
  ...property,
  address: `${property.location}, Haryana`,
  sizeSqft: [2025, 3950, 1534, 1855][index],
  bedrooms: [3, 4, 3, 3][index],
  bathrooms: [3, 5, 3, 3][index],
  unitsAvailable: [4, 7, 2, 5][index],
  ownerDeveloper: ["Emaar", "DLF", "M3M", "Godrej Properties"][index],
  amenities: ["Clubhouse", "Security", "Parking"],
  notes: "Sales team inventory record. Verify availability before confirming a visit.",
  internalTags: ["verified", "share-ready"],
}));

export const followups: Followup[] = [
  { id: "FU-31", lead: "Aarav Mehta", initials: "AM", purpose: "Discuss shortlisted 3 BHK options", time: "11:30 AM", channel: "Call", temperature: "Hot" },
  { id: "FU-30", lead: "Priya Sharma", initials: "PS", purpose: "Send villa brochure and location pin", time: "12:15 PM", channel: "WhatsApp", temperature: "Hot" },
  { id: "FU-29", lead: "Rohan Verma", initials: "RV", purpose: "Share payment plan for Emaar Palm Heights", time: "2:00 PM", channel: "WhatsApp", temperature: "Warm" },
  { id: "FU-28", lead: "Sneha Iyer", initials: "SI", purpose: "Confirm Saturday pickup details", time: "3:30 PM", channel: "Site visit", temperature: "Hot" },
  { id: "FU-27", lead: "Dev Khanna", initials: "DK", purpose: "Call back after missed bridge call", time: "10:45 AM", channel: "Call", temperature: "Warm", overdue: true },
];

export const activities = [
  { icon: "phone", text: "Riya connected with Aarav Mehta", detail: "Bridge call · 3m 42s", time: "8m" },
  { icon: "share", text: "Property shared with Priya Sharma", detail: "DLF The Arbour via WhatsApp", time: "19m" },
  { icon: "lead", text: "New lead from MagicBricks", detail: "Assigned to Riya Kapoor", time: "24m" },
  { icon: "visit", text: "Site visit scheduled", detail: "Sneha Iyer · Saturday, 11:00 AM", time: "1h" },
];

export const attendance: AttendanceRecord[] = [
  { id: "AT-01", userId: "demo-riya", name: "Riya Kapoor", initials: "RK", role: "Sales Manager", status: "Checked in", checkIn: "9:08 AM", location: "DLF Phase 5 Office" },
  { id: "AT-02", userId: "demo-kabir", name: "Kabir Singh", initials: "KS", role: "Sales Agent", status: "Checked in", checkIn: "9:22 AM", location: "Sector 65, Gurgaon" },
  { id: "AT-03", userId: "demo-aditi", name: "Aditi Verma", initials: "AV", role: "Field Executive", status: "Checked in", checkIn: "9:41 AM", location: "Sector 77 Site" },
  { id: "AT-04", userId: "demo-neha", name: "Neha Mehra", initials: "NM", role: "Social Media Manager", status: "Checked out", checkIn: "8:58 AM", checkOut: "5:45 PM", location: "DLF Phase 5 Office" },
];

export const attendanceHistory: AttendanceHistoryRecord[] = [
  { id: "AT-H01", date: "Today", status: "Checked in", checkIn: "9:08 AM", location: "DLF Phase 5 Office" },
  { id: "AT-H02", date: "Yesterday", status: "Checked out", checkIn: "9:04 AM", checkOut: "6:12 PM", location: "DLF Phase 5 Office" },
  { id: "AT-H03", date: "28 May", status: "Checked out", checkIn: "9:11 AM", checkOut: "5:58 PM", location: "Sector 65, Gurgaon" },
];

export const socialPosts: SocialPost[] = [
  { id: "SP-12", title: "Palm Heights walkthrough", type: "Instagram Reel", caption: "Step inside a ready-to-move 3 BHK in Sector 77.", status: "Scheduled", scheduledFor: "Today, 6:00 PM", assignee: "Neha Mehra" },
  { id: "SP-11", title: "Weekend site visit guide", type: "Instagram Post", caption: "Three things to check before your next site visit.", status: "Draft", scheduledFor: "Tomorrow, 11:00 AM", assignee: "Neha Mehra" },
  { id: "SP-10", title: "New Gurgaon market update", type: "LinkedIn Post", caption: "Why buyer interest continues to grow across New Gurgaon.", status: "Idea", scheduledFor: "Monday, 10:00 AM", assignee: "Riya Kapoor" },
];

export const teamMembers: TeamMember[] = [
  { id: "TM-01", name: "Riya Kapoor", initials: "RK", role: "Sales Manager", phone: "+91 98765 00001", status: "Available", leads: 18 },
  { id: "TM-02", name: "Kabir Singh", initials: "KS", role: "Sales Agent", phone: "+91 98765 00002", status: "Busy", leads: 14 },
  { id: "TM-03", name: "Aditi Verma", initials: "AV", role: "Field Executive", phone: "+91 98765 00003", status: "Available", leads: 0 },
  { id: "TM-04", name: "Neha Mehra", initials: "NM", role: "Social Media Manager", phone: "+91 98765 00004", status: "Offline", leads: 0 },
];
