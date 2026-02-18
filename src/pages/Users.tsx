import { type ChangeEvent, type KeyboardEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Shield, UserCog } from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "STAFF";
type Status = "ACTIVE" | "DISABLED";

type User = {
  id: string;
  tenantId: string;
  email: string;
  role: Role;
  status?: Status; // if you enabled status in backend
  fullName?: string | null;
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type UsersResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  users: User[];
};

type PlatformTenantAdmin = User & {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "SUSPENDED";
    subscriptionStatus?: "ACTIVE" | "GRACE" | "SUSPENDED";
  };
};

type PlatformTenantAdminsResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  users: PlatformTenantAdmin[];
};

export default function Users() {
  const nav = useNavigate();
  const myRole = (localStorage.getItem("userRole") || "STAFF").toUpperCase() as Role;
  const isSuperAdmin = localStorage.getItem("isSuperAdmin") === "true";

  // Guard: STAFF cannot access Users page
  useEffect(() => {
    if (myRole === "STAFF") {
      toast.error("You don’t have access to User Management.");
      nav("/app/dashboard");
    }
  }, [myRole, nav]);

  const canCreateManager = myRole === "ADMIN";
  const canManageAll = myRole === "ADMIN";
  const [scope, setScope] = useState<"TENANT" | "PLATFORM_ADMINS">(isSuperAdmin ? "PLATFORM_ADMINS" : "TENANT");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");

  // Data
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [platformAdmins, setPlatformAdmins] = useState<PlatformTenantAdmin[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createRole, setCreateRole] = useState<Role>(canCreateManager ? "MANAGER" : "STAFF");
  const [createTempPassword, setCreateTempPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<Role>("STAFF");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
    if (scope === "PLATFORM_ADMINS") {
      setRoleFilter("ADMIN");
    } else {
      setRoleFilter(myRole === "MANAGER" ? "STAFF" : "ALL");
    }
    setRefreshKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // Load users
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (scope === "TENANT" && roleFilter !== "ALL") params.set("role", roleFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);

        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        if (scope === "PLATFORM_ADMINS" && isSuperAdmin) {
          const data = (await apiFetch(`/api/platform/tenant-admins?${params.toString()}`)) as PlatformTenantAdminsResponse;
          setPlatformAdmins(Array.isArray(data?.users) ? data.users : []);
          setUsers([]);
          setTotal(Number(data?.total ?? 0));
          setTotalPages(Math.max(1, Number(data?.totalPages ?? 1)));
        } else {
          const data = (await apiFetch(`/api/users?${params.toString()}`)) as UsersResponse;
          setUsers(Array.isArray(data?.users) ? data.users : []);
          setPlatformAdmins([]);
          setTotal(Number(data?.total ?? 0));
          setTotalPages(Math.max(1, Number(data?.totalPages ?? 1)));
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, page, pageSize, scope]);

  function canManagerTouch(user: User) {
    // ADMIN can manage all; MANAGER can manage STAFF only
    if (myRole === "ADMIN") return true;
    if (myRole === "MANAGER") return user.role === "STAFF";
    return false;
  }

  function openCreate() {
    setCreateEmail("");
    setCreateFullName("");
    setCreatePhone("");
    setCreateRole(canCreateManager ? "MANAGER" : "STAFF");
    setCreateTempPassword("");
    setCreateOpen(true);
  }

  async function submitCreate() {
    if (!createEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    // Manager can only create STAFF
    if (myRole === "MANAGER" && createRole !== "STAFF") {
      toast.error("Managers can only create STAFF users.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        email: createEmail.trim(),
        role: createRole,
        fullName: createFullName.trim() || undefined,
        phone: createPhone.trim() || undefined,
        tempPassword: createTempPassword.trim() || undefined,
      };

      const res = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success(`User created: ${res.user?.email}`);
      if (res.tempPassword) {
        toast.message("Temporary password", {
          description: res.tempPassword,
        });
      }
      setCreateOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u: User) {
    if (!canManagerTouch(u)) {
      toast.error("You don’t have permission to edit this user.");
      return;
    }
    setEditUser(u);
    setEditFullName(u.fullName || "");
    setEditPhone(u.phone || "");
    setEditRole(u.role);
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!editUser) return;

    // Manager cannot change role away from STAFF
    if (myRole === "MANAGER" && editRole !== "STAFF") {
      toast.error("Managers cannot promote users.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        fullName: editFullName.trim() || null,
        phone: editPhone.trim() || null,
      };

      // ADMIN can change role
      if (myRole === "ADMIN") payload.role = editRole;

      const res = await apiFetch(`/api/users/${editUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success(`Updated: ${res.user?.email}`);
      setEditOpen(false);
      setEditUser(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(u: User) {
    if (!canManagerTouch(u)) {
      toast.error("You don’t have permission to change this user.");
      return;
    }

    // If your backend has status endpoints enabled:
    const currentlyDisabled = u.status === "DISABLED";
    const endpoint = currentlyDisabled ? "enable" : "disable";

    try {
      await apiFetch(`/api/users/${u.id}/${endpoint}`, { method: "POST" });
      toast.success(`${currentlyDisabled ? "Enabled" : "Disabled"} ${u.email}`);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      // If you haven't enabled status endpoints yet, you'll get NOT_FOUND — that's OK.
      toast.error(err?.message || "Failed to update status");
    }
  }

  function roleBadge(role: Role) {
    if (role === "ADMIN") return <Badge className="gap-1"><Shield className="h-3 w-3" /> ADMIN</Badge>;
    if (role === "MANAGER") return <Badge variant="secondary" className="gap-1"><UserCog className="h-3 w-3" /> MANAGER</Badge>;
    return <Badge variant="outline">STAFF</Badge>;
  }

  function statusBadge(status?: Status) {
    if (!status) return null;
    return status === "ACTIVE" ? (
      <Badge className="bg-green-600">ACTIVE</Badge>
    ) : (
      <Badge className="bg-red-600">DISABLED</Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-2">
          {scope === "PLATFORM_ADMINS"
            ? "Super Admin view: tenant admins across all workspaces."
            : myRole === "ADMIN"
            ? "Manage admins, managers, and staff in your tenant."
            : "Manage staff in your tenant."}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Users</CardTitle>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
              Refresh
            </Button>
            <Button onClick={openCreate} disabled={scope === "PLATFORM_ADMINS"}>
              <Plus className="h-4 w-4 mr-2" />
              New User
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-3 md:grid-cols-3">
            {isSuperAdmin ? (
              <div>
                <Select value={scope} onValueChange={(v: string) => setScope(v as "TENANT" | "PLATFORM_ADMINS")}>
                  <SelectTrigger>
                    <SelectValue placeholder="View scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLATFORM_ADMINS">Platform Tenant Admins</SelectItem>
                    <SelectItem value="TENANT">Current Workspace Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search email or name..."
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") setRefreshKey((k) => k + 1);
                }}
              />
            </div>

            <div>
              <Select value={roleFilter} onValueChange={(v: string) => setRoleFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  {scope === "TENANT" ? (
                    <>
                      {myRole === "ADMIN" ? <SelectItem value="ADMIN">ADMIN</SelectItem> : null}
                      {myRole === "ADMIN" ? <SelectItem value="MANAGER">MANAGER</SelectItem> : null}
                      <SelectItem value="STAFF">STAFF</SelectItem>
                    </>
                  ) : (
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All status</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="DISABLED">DISABLED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (page === 1) setRefreshKey((k) => k + 1);
                else setPage(1);
              }}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setRoleFilter(scope === "TENANT" ? (myRole === "MANAGER" ? "STAFF" : "ALL") : "ADMIN");
                setStatusFilter("ALL");
                if (page === 1) setRefreshKey((k) => k + 1);
                else setPage(1);
              }}
            >
              Clear
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-50 text-xs font-medium text-muted-foreground px-4 py-3">
              <div className={scope === "PLATFORM_ADMINS" ? "col-span-3" : "col-span-4"}>User</div>
              {scope === "PLATFORM_ADMINS" ? <div className="col-span-3">Tenant</div> : null}
              <div className="col-span-2">Role</div>
              <div className={scope === "PLATFORM_ADMINS" ? "col-span-2" : "col-span-2"}>Status</div>
              <div className={scope === "PLATFORM_ADMINS" ? "col-span-1" : "col-span-2"}>Phone</div>
              <div className={scope === "PLATFORM_ADMINS" ? "col-span-1 text-right" : "col-span-2 text-right"}>
                {scope === "PLATFORM_ADMINS" ? "Info" : "Actions"}
              </div>
            </div>

            {loading ? (
              <div className="p-6 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading users...
              </div>
            ) : scope === "PLATFORM_ADMINS" ? (
              platformAdmins.length === 0 ? (
                <div className="p-6 text-muted-foreground">No tenant admins found.</div>
              ) : (
                platformAdmins.map((u) => (
                  <div key={u.id} className="grid grid-cols-12 px-4 py-3 border-t items-center">
                    <div className="col-span-3">
                      <div className="font-medium">{u.fullName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="col-span-3">
                      <div className="font-medium">{u.tenant?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">@{u.tenant?.slug || "—"}</div>
                    </div>
                    <div className="col-span-2">{roleBadge(u.role)}</div>
                    <div className="col-span-2">{statusBadge(u.status) || <span className="text-xs text-muted-foreground">—</span>}</div>
                    <div className="col-span-1 text-sm">{u.phone || "—"}</div>
                    <div className="col-span-1 flex justify-end">
                      <Badge variant="outline">{u.tenant?.subscriptionStatus || "ACTIVE"}</Badge>
                    </div>
                  </div>
                ))
              )
            ) : users.length === 0 ? (
              <div className="p-6 text-muted-foreground">No users found.</div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="grid grid-cols-12 px-4 py-3 border-t items-center">
                  <div className="col-span-4">
                    <div className="font-medium">{u.fullName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>

                  <div className="col-span-2">{roleBadge(u.role)}</div>

                  <div className="col-span-2">
                    {statusBadge(u.status) || <span className="text-xs text-muted-foreground">—</span>}
                  </div>

                  <div className="col-span-2 text-sm">{u.phone || "—"}</div>

                  <div className="col-span-2 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(u)}
                      disabled={!canManagerTouch(u)}
                    >
                      Edit
                    </Button>

                    {/* Status toggle requires status endpoints; if not yet enabled, you can hide this button */}
                    <Button
                      variant={u.status === "DISABLED" ? "secondary" : "destructive"}
                      size="sm"
                      onClick={() => toggleStatus(u)}
                      disabled={!canManagerTouch(u)}
                    >
                      {u.status === "DISABLED" ? "Enable" : "Disable"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Showing page {page} of {totalPages} • {total} total user{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v: string) => {
                  const next = Number(v);
                  setPageSize(Number.isFinite(next) ? next : 20);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={createEmail} onChange={(e: ChangeEvent<HTMLInputElement>) => setCreateEmail(e.target.value)} placeholder="user@company.com" />
            </div>

            <div className="grid gap-2">
              <Label>Full name</Label>
              <Input value={createFullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setCreateFullName(e.target.value)} placeholder="Firstname Lastname" />
            </div>

            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={createPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => setCreatePhone(e.target.value)} placeholder="0905XXXXXXX" />
            </div>

            <div className="grid gap-2 ">
              <Label>Role</Label>
              <Select
                value={createRole}
                onValueChange={(v: string) => setCreateRole(v as Role)}
              >
                <SelectTrigger >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent  className="bg-white">
                  {canCreateManager ? <SelectItem value="MANAGER">MANAGER</SelectItem> : null}
                  <SelectItem value="STAFF">STAFF</SelectItem>
                  {canManageAll ? <SelectItem value="ADMIN">ADMIN</SelectItem> : null}
                </SelectContent>
              </Select>
              {myRole === "MANAGER" ? (
                <p className="text-xs text-muted-foreground">Managers can only create STAFF.</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Temporary password (optional)</Label>
              <Input
                value={createTempPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCreateTempPassword(e.target.value)}
                placeholder="Leave empty to auto-generate secure temp password"
              />
              <p className="text-xs text-muted-foreground">
                If left empty, system generates a temporary password and shows it once after create.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="text-sm text-muted-foreground">
              {editUser?.email}
            </div>

            <div className="grid gap-2">
              <Label>Full name</Label>
              <Input value={editFullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditFullName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditPhone(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={editRole}
                onValueChange={(v: string) => setEditRole(v as Role)}
                disabled={myRole !== "ADMIN"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="MANAGER">MANAGER</SelectItem>
                  <SelectItem value="STAFF">STAFF</SelectItem>
                </SelectContent>
              </Select>
              {myRole !== "ADMIN" ? (
                <p className="text-xs text-muted-foreground">Only ADMIN can change roles.</p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={saving || !editUser}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
