"use client";

import { Building2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { CrmApp } from "@/components/crm-app";
import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase-browser";
import { getWorkspaceIdentity } from "@/services/profile-service";

const demoIdentity: WorkspaceIdentity = {
  id: "demo-riya",
  organizationId: "demo-estateflow",
  organizationName: "Estate AI Flow Demo Realty",
  fullName: "Riya Kapoor",
  initials: "RK",
  role: "sales_manager",
  roleLabel: "Sales Manager",
  email: "riya@estateflow.local",
  isDemo: true,
};

type GateState =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  | { status: "signed-in"; identity: WorkspaceIdentity }
  | { status: "demo"; identity: WorkspaceIdentity };

export function AuthGate() {
  const configured = isSupabaseBrowserConfigured();
  const [state, setState] = useState<GateState>(configured ? { status: "loading" } : { status: "demo", identity: demoIdentity });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    let active = true;

    const resolveUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (error || !data.user) {
        setState({ status: "signed-out" });
        return;
      }

      try {
        const identity = await getWorkspaceIdentity(data.user);
        if (active) {
          setState({ status: "signed-in", identity });
        }
      } catch (profileError) {
        if (active) {
          setState({
            status: "signed-out",
            error: profileError instanceof Error ? profileError.message : "Unable to load your workspace profile.",
          });
        }
      }
    };

    void resolveUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void resolveUser();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state.status === "loading") {
    return <LoadingScreen />;
  }

  if (state.status === "signed-out") {
    return <SignInScreen initialError={state.error} />;
  }

  return (
    <CrmApp
      identity={state.identity}
      onSignOut={state.identity.isDemo ? undefined : async () => {
        const supabase = getSupabaseBrowserClient();
        await supabase?.auth.signOut();
        setState({ status: "signed-out" });
      }}
    />
  );
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#f6f7f3]"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#176b4d]" size={26} /><p className="mt-3 text-xs font-bold text-[#68766f]">Loading your workspace</p></div></div>;
}

function SignInScreen({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("admin@estateflow.local");
  const [password, setPassword] = useState("estateflow123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [submitting, setSubmitting] = useState(false);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
    }
  };

  return <main className="grid min-h-screen bg-[#f6f7f3] lg:grid-cols-[1fr_520px]">
    <section className="hidden bg-[#173f33] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Building2 size={20} /></div><div><p className="text-base font-bold tracking-[-0.04em]">Estate AI Flow</p><p className="text-[10px] font-bold tracking-[0.24em] text-white/55">CRM</p></div></div>
      <div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a8d3c2]">Real estate sales operations</p><h1 className="mt-4 text-5xl font-bold tracking-[-0.07em]">Move every enquiry forward.</h1><p className="mt-5 max-w-lg text-sm leading-7 text-white/65">Assign incoming leads, bridge calls, share properties, and keep the team on schedule from one mobile-first workspace.</p></div>
      <div className="flex items-center gap-2 text-xs font-semibold text-white/60"><ShieldCheck size={16} />Organization-scoped access with Supabase RLS</div>
    </section>
    <section className="grid place-items-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#176b4d] text-white"><Building2 size={18} /></div><div><p className="text-sm font-bold tracking-[-0.04em]">Estate AI Flow</p><p className="text-[9px] font-bold tracking-[0.2em] text-[#8d9a95]">CRM</p></div></div>
        <p className="mt-12 text-[10px] font-bold uppercase tracking-[0.17em] text-[#85928d] lg:mt-0">Secure workspace</p>
        <h2 className="mt-2 text-3xl font-bold tracking-[-0.065em] text-[#20312b]">Sign in to Estate AI Flow</h2>
        <p className="mt-3 text-sm leading-6 text-[#74817c]">Use your organization account to access leads, inventory, and team operations.</p>
        <form onSubmit={signIn} className="mt-8 space-y-4">
          <label className="block text-[11px] font-bold text-[#596862]">Email address<div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#dfe5df] bg-white px-3 focus-within:border-[#86ad9e]"><Mail size={15} className="text-[#8c9893]" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-transparent text-xs outline-none" /></div></label>
          <label className="block text-[11px] font-bold text-[#596862]">Password<div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#dfe5df] bg-white px-3 focus-within:border-[#86ad9e]"><LockKeyhole size={15} className="text-[#8c9893]" /><input required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent text-xs outline-none" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="text-[#83908b]">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
          {error && <p role="alert" className="rounded-xl border border-[#f3d3d0] bg-[#fff5f4] p-3 text-xs font-semibold leading-5 text-[#ad4a48]">{error}</p>}
          <button disabled={submitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#176b4d] text-xs font-bold text-white transition hover:bg-[#10523a] disabled:cursor-wait disabled:opacity-70">{submitting && <LoaderCircle className="animate-spin" size={15} />}{submitting ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="mt-6 text-[11px] leading-5 text-[#8a9691]">Local Supabase seed: <span className="font-semibold text-[#5e6d67]">admin@estateflow.local</span> with password <span className="font-semibold text-[#5e6d67]">estateflow123</span>.</p>
      </div>
    </section>
  </main>;
}
