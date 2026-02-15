import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicFetch } from "@/lib/api";

function passwordPolicyErrors(password: string) {
  const errs: string[] = [];
  if (password.length < 10) errs.push("10+ chars");
  if (!/[A-Z]/.test(password)) errs.push("1 uppercase");
  if (!/[a-z]/.test(password)) errs.push("1 lowercase");
  if (!/[0-9]/.test(password)) errs.push("1 number");
  if (!/[^A-Za-z0-9]/.test(password)) errs.push("1 special");
  return errs;
}

export default function ResetPassword() {
  const [search] = useSearchParams();
  const token = search.get("token") || "";
  const emailFromQuery = search.get("email") || "";
  const nav = useNavigate();

  const [email, setEmail] = useState(emailFromQuery);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const policyErrors = passwordPolicyErrors(newPassword);
  const passwordStrong = policyErrors.length === 0;

  useEffect(() => {
    if (!token) toast.error("Reset token missing");
  }, [token]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token) return toast.error("Reset token missing");
    if (!newPassword) return toast.error("Enter new password");
    if (!passwordStrong) return toast.error(`Password needs: ${policyErrors.join(", ")}`);
    if (newPassword !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await publicFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword, email: email.trim() || undefined }),
      });
      toast.success("Password reset. Please login");
      nav("/login");
    } catch (err: any) {
      toast.error(err?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center space-y-2">
          <div className="text-3xl font-bold tracking-tight text-indigo-700">EazziHotech</div>
          <div className="text-sm text-muted-foreground">Set a new password for your account</div>
        </div>

        <Card className="rounded-2xl border-indigo-300 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Set a new password</CardTitle>
            <p className="text-xs text-slate-400 text-muted-foreground text-center">
              Provide a new password for your account.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={false}
                  readOnly={false}
                />
              </div>

              <div className="space-y-2">
                <Label>New password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <div className="text-xs text-muted-foreground">
                  Must include: at least 10 chars, uppercase, lowercase, number, special character.
                </div>
                {!passwordStrong && newPassword ? (
                  <div className="text-xs text-red-600">Missing: {policyErrors.join(", ")}</div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Confirm password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>

              <Button className="w-full bg-indigo-200 hover:bg-indigo-700 text-white" disabled={loading || !passwordStrong} type="submit">
                {loading ? "Saving..." : "Save new password"}
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
