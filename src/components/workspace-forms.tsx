"use client";

import { X } from "lucide-react";
import type { Followup, Lead, LeadTemperature, Property, SocialPost, TeamMember } from "@/lib/types";

type FormKind = "lead" | "property" | "followup" | "social" | "member";

export interface FormDialogState {
  kind: FormKind;
  lead?: Lead;
}

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe5df] bg-white px-3 text-xs outline-none focus:border-[#8ab5a4]";
const textareaClass = "mt-1.5 min-h-20 w-full rounded-lg border border-[#dfe5df] bg-white px-3 py-2 text-xs outline-none focus:border-[#8ab5a4]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[11px] font-bold text-[#65736e]">{label}{children}</label>;
}

function Dialog({ title, copy, close, children }: { title: string; copy: string; close: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid items-end bg-[#15251f]/35 backdrop-blur-[2px] sm:place-items-center sm:p-4" onMouseDown={close}>
    <section onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-[#fbfcfa] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold tracking-[-0.04em]">{title}</h2><p className="mt-1 text-xs text-[#7c8984]">{copy}</p></div><button aria-label="Close form" onClick={close} className="grid h-8 w-8 place-items-center rounded-full bg-[#eef1ee] text-[#65736e]"><X size={15} /></button></div>
      {children}
    </section>
  </div>;
}

export function WorkspaceFormDialog({ state, close, addLead, addProperty, addFollowup, addSocialPost, addMember }: {
  state: FormDialogState;
  close: () => void;
  addLead: (lead: Lead) => void;
  addProperty: (property: Property, files?: File[]) => void;
  addFollowup: (followup: Followup) => void;
  addSocialPost: (post: SocialPost, files?: File[]) => void;
  addMember: (member: TeamMember) => void;
}) {
  if (state.kind === "lead") {
    return <Dialog title="Add new lead" copy="Create a lead and prepare it for round-robin assignment." close={close}>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name"));
        addLead({
          id: `LD-${Date.now().toString().slice(-5)}`,
          name,
          initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
          phone: String(data.get("phone")),
          source: String(data.get("source")),
          propertyType: String(data.get("propertyType")),
          budget: String(data.get("budget")),
          location: String(data.get("location")),
          status: "New",
          temperature: String(data.get("temperature")) as LeadTemperature,
          agent: "Riya Kapoor",
          nextFollowup: "Not scheduled",
          created: "Just now",
          note: String(data.get("note")),
        });
      }}>
        <Field label="Full name"><input required name="name" className={inputClass} placeholder="Rahul Sharma" /></Field>
        <Field label="Phone"><input required name="phone" className={inputClass} placeholder="+91 99999 99999" /></Field>
        <Field label="Source"><select name="source" className={inputClass}>{["Manual", "36 Acre", "MagicBricks", "Housing", "Facebook", "Instagram", "Website", "Referral"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Property type"><select name="propertyType" className={inputClass}>{["Apartment", "Villa", "Plot", "Commercial", "Rental"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Budget"><input required name="budget" className={inputClass} placeholder="₹80 L–1.2 Cr" /></Field>
        <Field label="Preferred location"><input required name="location" className={inputClass} placeholder="Golf Course Road" /></Field>
        <Field label="Temperature"><select name="temperature" className={inputClass}>{["Warm", "Hot", "Cold"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <div />
        <label className="text-[11px] font-bold text-[#65736e] sm:col-span-2">Notes<textarea name="note" className={textareaClass} placeholder="Add buyer requirements..." /></label>
        <FormActions close={close} />
      </form>
    </Dialog>;
  }

  if (state.kind === "property") {
    return <Dialog title="Add property" copy="Create an inventory record ready for matching and sharing." close={close}>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        addProperty({
          id: `PR-${Date.now().toString().slice(-4)}`,
          title: String(data.get("title")),
          location: String(data.get("location")),
          type: String(data.get("type")),
          price: String(data.get("price")),
          details: String(data.get("details")),
          status: String(data.get("status")) as Property["status"],
          image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
          matches: 0,
        }, data.getAll("images").filter((value): value is File => value instanceof File && value.size > 0));
      }}>
        <Field label="Property title"><input required name="title" className={inputClass} placeholder="Project or listing name" /></Field>
        <Field label="Location"><input required name="location" className={inputClass} placeholder="Sector 65, Gurgaon" /></Field>
        <Field label="Type"><input required name="type" className={inputClass} placeholder="3 BHK Apartment" /></Field>
        <Field label="Price"><input required name="price" className={inputClass} placeholder="₹1.25 Cr" /></Field>
        <Field label="Details"><input required name="details" className={inputClass} placeholder="1,850 sq.ft. · Ready to move" /></Field>
        <Field label="Availability"><select name="status" className={inputClass}>{["Available", "Hold", "Sold", "Rented"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <label className="text-[11px] font-bold text-[#65736e] sm:col-span-2">Property photos<input name="images" type="file" accept="image/*" multiple className="mt-1.5 block w-full rounded-lg border border-[#dfe5df] bg-white px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#e7f3ed] file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-[#176b4d]" /><span className="mt-1 block text-[10px] font-medium text-[#98a39f]">Uploads are stored in your organization&apos;s Supabase Storage folder when connected.</span></label>
        <FormActions close={close} />
      </form>
    </Dialog>;
  }

  if (state.kind === "followup") {
    return <Dialog title="Schedule follow-up" copy="Add a task to the sales queue." close={close}>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const lead = String(data.get("lead"));
        addFollowup({
          id: `FU-${Date.now().toString().slice(-4)}`,
          lead,
          initials: lead.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
          purpose: String(data.get("purpose")),
          time: String(data.get("time")),
          channel: String(data.get("channel")) as Followup["channel"],
          temperature: "Warm",
        });
      }}>
        <Field label="Lead"><input required name="lead" className={inputClass} defaultValue={state.lead?.name} placeholder="Lead name" /></Field>
        <Field label="Time"><input required name="time" className={inputClass} placeholder="Tomorrow, 11:00 AM" /></Field>
        <Field label="Channel"><select name="channel" className={inputClass}>{["Call", "WhatsApp", "SMS", "Email", "Site visit"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Purpose"><input required name="purpose" className={inputClass} placeholder="Discuss shortlisted options" /></Field>
        <FormActions close={close} />
      </form>
    </Dialog>;
  }

  if (state.kind === "social") {
    return <Dialog title="Create social post" copy="Add a draft to the content calendar." close={close}>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const scheduledFor = String(data.get("scheduledFor"));
        addSocialPost({ id: `SP-${Date.now().toString().slice(-4)}`, title: String(data.get("title")), type: String(data.get("type")) as SocialPost["type"], caption: String(data.get("caption")), status: scheduledFor ? "Scheduled" : "Draft", scheduledFor: scheduledFor || "Not scheduled", assignee: "Neha Mehra", notes: String(data.get("notes")) }, data.getAll("media").filter((value): value is File => value instanceof File && value.size > 0));
      }}>
        <Field label="Post title"><input required name="title" className={inputClass} placeholder="Property walkthrough" /></Field>
        <Field label="Post type"><select name="type" className={inputClass}>{["Instagram Reel", "Instagram Post", "Facebook Post", "LinkedIn Post", "Story"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Schedule"><input name="scheduledFor" className={inputClass} placeholder="Optional, e.g. Tomorrow, 6:00 PM" /></Field>
        <div />
        <label className="text-[11px] font-bold text-[#65736e] sm:col-span-2">Caption<textarea required name="caption" className={textareaClass} placeholder="Write the social caption..." /></label>
        <label className="text-[11px] font-bold text-[#65736e] sm:col-span-2">Media<input name="media" type="file" accept="image/*,video/*" multiple className="mt-1.5 block w-full rounded-lg border border-[#dfe5df] bg-white px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#e7f3ed] file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-[#176b4d]" /></label>
        <label className="text-[11px] font-bold text-[#65736e] sm:col-span-2">Internal notes<textarea name="notes" className={textareaClass} placeholder="Approval notes or publishing instructions..." /></label>
        <FormActions close={close} />
      </form>
    </Dialog>;
  }

  return <Dialog title="Invite team member" copy="Add a team member to your organization." close={close}>
    <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name"));
      addMember({ id: `TM-${Date.now().toString().slice(-4)}`, name, initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), email: String(data.get("email")), role: String(data.get("role")), phone: String(data.get("phone")), status: "Available", leads: 0 });
    }}>
      <Field label="Full name"><input required name="name" className={inputClass} placeholder="Team member name" /></Field>
      <Field label="Email"><input required type="email" name="email" className={inputClass} placeholder="agent@example.com" /></Field>
      <Field label="Phone"><input required name="phone" className={inputClass} placeholder="+91 99999 99999" /></Field>
      <Field label="Role"><select name="role" className={inputClass}>{["Sales Manager", "Sales Agent", "Field Executive", "Social Media Manager"].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <FormActions close={close} />
    </form>
  </Dialog>;
}

function FormActions({ close }: { close: () => void }) {
  return <div className="mt-2 flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={close} className="rounded-lg border border-[#dfe5df] px-4 py-2.5 text-xs font-bold text-[#65736e]">Cancel</button><button type="submit" className="rounded-lg bg-[#176b4d] px-4 py-2.5 text-xs font-bold text-white">Save record</button></div>;
}
