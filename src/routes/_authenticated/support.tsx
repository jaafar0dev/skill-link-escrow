import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";
import { StatusPill } from "./dashboard";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportQueuePage,
});

function SupportQueuePage() {
  const { user } = useAuth();
  const { data: roles, isLoading } = useRoles(user?.id);
  const qc = useQueryClient();
  const isAdmin = roles?.includes("admin");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const { data: reports, isFetching } = useQuery({
    queryKey: ["support-reports"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, jobs(id, title, status, poster_id, assigned_provider_id)")
        .ilike("body", "REPORT_TO_ADMIN:%")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const senderIds = Array.from(new Set((data ?? []).map((m: any) => m.sender_id)));
      const { data: senderProfiles } = senderIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
        : { data: [] as { id: string; full_name: string }[] };
      const nameById = new Map((senderProfiles ?? []).map((p) => [p.id, p.full_name]));

      return (data ?? []).map((m: any) => ({
        ...m,
        reporter_name: nameById.get(m.sender_id) ?? "Member",
        trimmed_body: m.body.replace(/REPORT_TO_ADMIN:\s*/i, ""),
      }));
    },
  });

  const sendReply = async (report: any) => {
    if (!user) return;
    if (!replyBody.trim()) return toast.error("Enter a reply message.");
    setReplyLoading(true);

    const { error } = await supabase.from("messages").insert({
      job_id: report.job_id,
      sender_id: user.id,
      body: `ADMIN_RESPONSE: ${replyBody.trim()}`,
      attachment_url: null,
      attachment_name: null,
    });

    setReplyLoading(false);
    if (error) return toast.error(error.message);

    toast.success("Reply sent to the conversation.");
    setReplyBody("");
    setActiveReplyId(null);
    qc.invalidateQueries({ queryKey: ["support-reports"] });
    qc.invalidateQueries({ queryKey: ["messages", report.job_id] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <ShieldAlert className="mx-auto mb-2 h-6 w-6" />
          Admin access only.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Support queue</h1>
          <p className="text-sm text-muted-foreground">
            Review support reports and reply directly to the job conversation.
          </p>
        </div>
        <Link
          to="/admin"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          Back to admin
        </Link>
      </div>

      {!reports?.length ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            {isFetching ? "Loading support reports…" : "No active support reports at the moment."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report: any) => (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-4 text-base">
                  <div>
                    <Link
                      to="/jobs/$id"
                      params={{ id: report.job_id }}
                      className="font-semibold hover:underline"
                    >
                      {report.jobs?.title || "Unknown job"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Reported by {report.reporter_name} ·{" "}
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusPill status={report.jobs?.status ?? "open"} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-medium">Support request</p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {report.trimmed_body || "No report details provided."}
                  </p>
                </div>
                {report.attachment_name && (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-medium">Reported attachment</p>
                    <p className="mt-1 text-xs text-muted-foreground">{report.attachment_name}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Textarea
                    value={activeReplyId === report.id ? replyBody : ""}
                    placeholder="Write an admin reply to the job conversation..."
                    onChange={(e) => {
                      setActiveReplyId(report.id);
                      setReplyBody(e.target.value);
                    }}
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={activeReplyId !== report.id || replyLoading}
                      onClick={() => sendReply(report)}
                    >
                      {replyLoading ? "Sending…" : "Send admin reply"}
                    </Button>
                    <Link
                      to="/jobs/$id"
                      params={{ id: report.job_id }}
                      className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
                    >
                      Open job conversation
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
