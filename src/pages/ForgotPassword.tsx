import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicFetch } from "@/lib/api";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) return toast.error("Email is required");
    setLoading(true);
    try {
      await publicFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email,
        }),
      });
      toast.success("If the email exists, a reset link was sent");
      nav("/login");
    } catch (err: any) {
      toast.error(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center space-y-2">
          <div className="text-3xl font-bold tracking-tight text-indigo-700">EazziHotech</div>
          <div className="text-sm text-muted-foreground">Reset your account password</div>
        </div>

        <Card className="rounded-2xl border-indigo-300 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Reset password</CardTitle>
            <p className="text-xs text-slate-400 text-muted-foreground text-center">
              Enter your email to receive a reset link.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <Button className="w-full bg-indigo-200 hover:bg-indigo-700 text-white" disabled={loading} type="submit">
                {loading ? "Sending..." : "Send reset link"}
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                By continuing, you agree to your organization’s access policy.
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} EazziHotech. All rights reserved.
        </div>
      </div>
    </div>
  );
}
