import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createJob = createServerFn({ method: "POST" })
  .validator(
    z.object({
      posterId: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      budgetNaira: z.number().min(0),
    })
  )
  .handler(async ({ data }) => {
    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .insert({
        poster_id: data.posterId,
        title: data.title,
        description: data.description,
        budget_naira: data.budgetNaira,
      });

    if (error) return { job: null, error: error.message };
    return { job, error: null };
  });

export const getJobs = createServerFn()
  .handler(async () => {
    const { data: jobs, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { jobs: [], error: error.message };
    return { jobs: jobs ?? [], error: null };
  });

export const getJobDetail = createServerFn()
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (jobError) return { job: null, bids: [], messages: [], posterProfile: null, error: jobError.message };
    if (!job) return { job: null, bids: [], messages: [], posterProfile: null, error: null };

    const { data: bids, error: bidsError } = await supabaseAdmin
      .from("bids")
      .select("*")
      .eq("job_id", data.id)
      .order("created_at", { ascending: false });

    if (bidsError) return { job, bids: [], messages: [], posterProfile: null, error: bidsError.message };

    const providerIds = Array.from(new Set((bids ?? []).map((b: any) => b.provider_id)));
    const { data: profiles, error: profilesError } = providerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", providerIds)
      : { data: [] as { id: string; full_name: string }[], error: null };
    if (profilesError) return { job, bids: [], messages: [], posterProfile: null, error: profilesError.message };

    const providerNameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const enrichedBids = (bids ?? []).map((b: any) => ({
      ...b,
      profiles: { full_name: providerNameById.get(b.provider_id) ?? "Provider" },
    }));

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("job_id", data.id)
      .order("created_at", { ascending: true });

    if (messagesError) return { job, bids: enrichedBids, messages: [], posterProfile: null, error: messagesError.message };

    const senderIds = Array.from(new Set((messages ?? []).map((m: any) => m.sender_id)));
    const { data: senderProfiles, error: senderProfilesError } = senderIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", senderIds)
      : { data: [] as { id: string; full_name: string }[], error: null };
    if (senderProfilesError) return { job, bids: enrichedBids, messages: [], posterProfile: null, error: senderProfilesError.message };

    const senderNameById = new Map((senderProfiles ?? []).map((p: any) => [p.id, p.full_name]));
    const enrichedMessages = (messages ?? []).map((m: any) => ({
      ...m,
      sender_name: senderNameById.get(m.sender_id) ?? "Member",
    }));

    const { data: posterProfile, error: posterProfileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", job.poster_id)
      .maybeSingle();
    if (posterProfileError) return { job, bids: enrichedBids, messages: enrichedMessages, posterProfile: null, error: posterProfileError.message };

    return { job, bids: enrichedBids, messages: enrichedMessages, posterProfile, error: null };
  });
