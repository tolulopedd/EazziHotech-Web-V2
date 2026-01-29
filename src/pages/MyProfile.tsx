import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function MyProfile() {
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState(localStorage.getItem("userName") || "");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function saveProfile() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ fullName, phone }),
      });
      toast.success("Profile updated");
      localStorage.setItem("userName", res.user?.fullName || res.user?.email || "User");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill current password and new password");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/me/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-2">Update your profile details and password.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0905..." />
          </div>

          <Button onClick={saveProfile} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Current password</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>New password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>

          <Button variant="secondary" onClick={changePassword} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
