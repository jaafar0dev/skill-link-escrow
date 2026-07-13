import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { createJob } from "@/lib/api/jobs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  component: NewJob,
});

function NewJob() {
  const { user } = useAuth();
  const { data: roles, isLoading } = useRoles(user?.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);

  const isPoster = roles?.includes("poster");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { job, error } = await createJob({
        data: {
          posterId: user.id,
          title,
          description,
          budgetNaira: Math.max(0, parseInt(budget || "0", 10)),
        },
      });
      if (error) {
        toast.error(error);
        setLoading(false);
        return;
      }
      const createdJob = job && typeof job === "object" ? job : null;
      if (!createdJob || !createdJob.id) {
        toast.error("Failed to create job");
        setLoading(false);
        return;
      }
      toast.success("Job posted!");
      navigate({ to: "/jobs/$id", params: { id: createdJob.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post job");
      setLoading(false);
    }
  };

  if (!isPoster) {
    return (
      <Card>
        <CardHeader><CardTitle>Post a new job</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only students can post jobs. If you would like to switch to a student account, please contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Post a new job</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t">Title</Label>
            <Input id="t" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Help me debug a React project" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d">Description</Label>
            <Textarea id="d" required maxLength={2000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What do you need done?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b">Budget (USD)</Label>
            <Input id="b" required type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="5000" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post job
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
