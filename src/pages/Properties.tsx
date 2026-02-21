// src/pages/Properties.tsx

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Trash2, ChevronDown, ChevronUp, Users, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatNaira } from "@/lib/currency";

interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  unitCount: number;
  totalUnits: number;
  occupancy: number;
  monthlyRevenue: number;
  status: "active" | "inactive";
  units?: Unit[];
  expandedUnits?: boolean;
}

/**
 * Backend uses:
 * - type: "ROOM" | "APARTMENT"
 * - basePrice: string | null (Prisma Decimal)
 *
 * Keep optional pricePerNight for backward compatibility (if any old data exists).
 */
interface Unit {
  id: string;
  name: string;
  propertyId: string;
  type: "ROOM" | "APARTMENT" | string;
  basePrice?: string | null;
  discountType?: "PERCENT" | "FIXED_PRICE" | null;
  discountValue?: string | null;
  discountStart?: string | null;
  discountEnd?: string | null;
  discountLabel?: string | null;
  pricePerNight?: number; // fallback for older API/data
  capacity: number;
  status: "available" | "occupied" | "maintenance";
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "manager" | "staff";
  properties?: string[];
}

type ViewMode = "properties" | "units" | "tenants";

// Get a unit price from either basePrice (preferred) or pricePerNight fallback
function getUnitPrice(unit: Unit) {
  if (unit.basePrice !== undefined) return unit.basePrice; // string | null
  if (unit.pricePerNight !== undefined) return unit.pricePerNight; // number
  return null;
}

export default function Properties() {
  const [viewMode, setViewMode] = useState<ViewMode>("properties");
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "staff">("staff");

  // Dialog states
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showEditPropertyDialog, setShowEditPropertyDialog] = useState(false);
  const [showEditUnitDialog, setShowEditUnitDialog] = useState(false);
  const [showTenantDialog, setShowTenantDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Form states
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    address: "",
    type: "HOTEL",
  });

  // IMPORTANT: match backend fields
  const [unitForm, setUnitForm] = useState({
    name: "",
    // backend expects "ROOM" | "APARTMENT"
    type: "ROOM" as "ROOM" | "APARTMENT",
    basePrice: "", // string
    capacity: "2",
  });

  const [editPropertyForm, setEditPropertyForm] = useState({
    id: "",
    name: "",
    address: "",
    type: "HOTEL",
  });

  const [editUnitForm, setEditUnitForm] = useState({
    id: "",
    name: "",
    type: "ROOM" as "ROOM" | "APARTMENT",
    basePrice: "",
    capacity: "1",
    discountType: "" as "" | "PERCENT" | "FIXED_PRICE",
    discountValue: "",
    discountStart: "",
    discountEnd: "",
    discountLabel: "",
  });

  const [tenantForm, setTenantForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "manager" as "manager" | "staff",
  });
  const [editPropertyAttempted, setEditPropertyAttempted] = useState(false);
  const [editUnitAttempted, setEditUnitAttempted] = useState(false);

  useEffect(() => {
    const role = (localStorage.getItem("userRole") || "staff") as "admin" | "manager" | "staff";
    setUserRole(role);
    fetchData(role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canManageProperties = userRole === "admin" || userRole === "manager";
  const canDeleteProperties = userRole === "admin";
  const editPropertyNameError = editPropertyForm.name.trim() ? "" : "Property name is required.";
  const editPropertyValid = !editPropertyNameError;

  const editUnitNameError = editUnitForm.name.trim() ? "" : "Unit name is required.";
  const editUnitBasePriceNum = Number(editUnitForm.basePrice || "0");
  const editUnitBasePriceError =
    Number.isFinite(editUnitBasePriceNum) && editUnitBasePriceNum >= 0
      ? ""
      : "Base price must be a valid number.";
  const editUnitCapacityNum = Number(editUnitForm.capacity || "0");
  const editUnitCapacityError =
    Number.isFinite(editUnitCapacityNum) && editUnitCapacityNum >= 1
      ? ""
      : "Capacity must be at least 1.";

  const useDiscount = Boolean(editUnitForm.discountType);
  const discountValueNum = Number(editUnitForm.discountValue || "0");
  const discountValueError = !useDiscount
    ? ""
    : Number.isFinite(discountValueNum) && discountValueNum > 0
      ? ""
      : "Enter a discount value greater than 0.";
  const discountDatesError = !useDiscount
    ? ""
    : editUnitForm.discountStart && editUnitForm.discountEnd
      ? ""
      : "Select both promo start and end dates.";
  const discountDateOrderError =
    !useDiscount || !editUnitForm.discountStart || !editUnitForm.discountEnd
      ? ""
      : new Date(editUnitForm.discountEnd) >= new Date(editUnitForm.discountStart)
        ? ""
        : "Promo end date must be on/after promo start date.";

  const effectiveNightlyRate =
    Number.isFinite(editUnitBasePriceNum) && editUnitBasePriceNum >= 0
      ? !useDiscount
        ? editUnitBasePriceNum
        : editUnitForm.discountType === "PERCENT"
          ? Math.max(0, editUnitBasePriceNum * (1 - Math.max(0, Math.min(100, discountValueNum || 0)) / 100))
          : Number.isFinite(discountValueNum)
            ? Math.max(0, discountValueNum)
            : 0
      : 0;

  const editUnitValid =
    !editUnitNameError &&
    !editUnitBasePriceError &&
    !editUnitCapacityError &&
    !discountValueError &&
    !discountDatesError &&
    !discountDateOrderError;

  async function fetchData(roleOverride?: "admin" | "manager" | "staff") {
    const role = roleOverride ?? userRole;

    try {
      setLoading(true);

      // Fetch properties
      try {
        const propsData = await apiFetch("/api/properties");
        setProperties(
          (propsData.properties || []).map((p: Property) => ({
            ...p,
            expandedUnits: false,
            units: [],
          }))
        );
      } catch (err) {
        console.error("Failed to fetch properties:", err);
      }

      // Fetch all units (admin/manager only). Staff uses per-property units endpoint.
      if (role !== "staff") {
        try {
          const unitsData = await apiFetch("/api/units");
          setUnits(unitsData.units || []);
        } catch (err) {
          console.error("Failed to fetch units:", err);
        }
      } else {
        setUnits([]);
      }

      // Fetch tenants (admin only)
      if (role === "admin") {
        try {
          const tenantsData = await apiFetch("/api/tenants");
          setTenants(tenantsData.tenants || []);
        } catch (err) {
          console.error("Failed to fetch tenants:", err);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllUnits() {
    try {
      const unitsData = await apiFetch("/api/units");
      setUnits(unitsData.units || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch units");
    }
  }

  async function fetchPropertyUnits(propertyId: string) {
    try {
      const unitsData = await apiFetch(`/api/properties/${propertyId}/units`);
      const list: Unit[] = unitsData.units || [];

      setProperties((prevProps) =>
        prevProps.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                units: list,
                expandedUnits: true,
                unitCount: list.length,
              }
            : p
        )
      );

      return list;
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch property units");
      return [];
    }
  }

  function togglePropertyUnits(property: Property) {
    if (property.expandedUnits) {
      setProperties((prevProps) => prevProps.map((p) => (p.id === property.id ? { ...p, expandedUnits: false } : p)));
      return;
    }
    fetchPropertyUnits(property.id);
  }

  async function handleCreateProperty() {
    if (!propertyForm.name || !propertyForm.address || !propertyForm.type) {
      toast.error("Please fill all property fields");
      return;
    }

    try {
      const created = await apiFetch("/api/properties", {
        method: "POST",
        body: JSON.stringify(propertyForm),
      });

      toast.success("Property created successfully");
      setShowPropertyDialog(false);
      setPropertyForm({ name: "", address: "", type: "HOTEL" });

      await fetchData();

      const createdId = created?.property?.id ?? created?.id ?? null;
      if (createdId) {
        setSelectedProperty({ id: createdId } as any);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create property");
    }
  }

  async function handleCreateUnit() {
    if (!selectedProperty) {
      toast.error("Please select a property");
      return;
    }

    if (!unitForm.name || !unitForm.basePrice) {
      toast.error("Please fill all unit fields");
      return;
    }

    // Validate basePrice as numeric-ish but send as string
    const priceNumber = Number(unitForm.basePrice);
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      toast.error("Base price must be a valid number");
      return;
    }

    const propertyId = selectedProperty.id;

    try {
      await apiFetch(`/api/properties/${propertyId}/units`, {
        method: "POST",
        body: JSON.stringify({
          name: unitForm.name,
          type: unitForm.type, // "ROOM" | "APARTMENT"
          basePrice: priceNumber.toFixed(2), // send as string for Prisma Decimal
          capacity: parseInt(unitForm.capacity, 10),
        }),
      });

      toast.success("Unit created successfully");
      setShowUnitDialog(false);
      setUnitForm({
        name: "",
        type: "ROOM",
        basePrice: "",
        capacity: "2",
      });

      await fetchPropertyUnits(propertyId);
      await fetchAllUnits();
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create unit");
    }
  }

  function openEditProperty(property: Property) {
    setEditPropertyAttempted(false);
    setSelectedProperty(property);
    setEditPropertyForm({
      id: property.id,
      name: property.name || "",
      address: property.address || "",
      type: (property.type as "HOTEL" | "SHORTLET") || "HOTEL",
    });
    setShowEditPropertyDialog(true);
  }

  async function handleUpdateProperty() {
    setEditPropertyAttempted(true);
    if (!editPropertyForm.id || !editPropertyValid) {
      toast.error(editPropertyNameError || "Please resolve validation errors.");
      return;
    }
    try {
      await apiFetch(`/api/properties/${editPropertyForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editPropertyForm.name.trim(),
          address: editPropertyForm.address.trim(),
          type: editPropertyForm.type,
        }),
      });
      toast.success("Property updated");
      setShowEditPropertyDialog(false);
      await fetchData();
      if (selectedProperty?.id) await fetchPropertyUnits(selectedProperty.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update property");
    }
  }

  function openEditUnit(unit: Unit) {
    setEditUnitAttempted(false);
    setEditUnitForm({
      id: unit.id,
      name: unit.name || "",
      type: (unit.type as "ROOM" | "APARTMENT") || "ROOM",
      basePrice: unit.basePrice ? String(unit.basePrice) : "",
      capacity: String(unit.capacity ?? 1),
      discountType: (unit.discountType as "" | "PERCENT" | "FIXED_PRICE") || "",
      discountValue: unit.discountValue ? String(unit.discountValue) : "",
      discountStart: unit.discountStart ? String(unit.discountStart).slice(0, 10) : "",
      discountEnd: unit.discountEnd ? String(unit.discountEnd).slice(0, 10) : "",
      discountLabel: unit.discountLabel ? String(unit.discountLabel) : "",
    });
    setShowEditUnitDialog(true);
  }

  async function handleUpdateUnit() {
    setEditUnitAttempted(true);
    if (!editUnitForm.id || !editUnitValid) {
      toast.error("Please resolve unit form validation errors.");
      return;
    }

    try {
      await apiFetch(`/api/units/${editUnitForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editUnitForm.name.trim(),
          type: editUnitForm.type,
          basePrice: editUnitBasePriceNum.toFixed(2),
          capacity: editUnitCapacityNum,
          discountType: useDiscount ? editUnitForm.discountType : null,
          discountValue: useDiscount ? Number(editUnitForm.discountValue).toFixed(2) : null,
          discountStart: useDiscount ? `${editUnitForm.discountStart}T00:00:00.000Z` : null,
          discountEnd: useDiscount ? `${editUnitForm.discountEnd}T23:59:59.999Z` : null,
          discountLabel: useDiscount ? editUnitForm.discountLabel.trim() || null : null,
        }),
      });
      toast.success("Unit updated");
      setShowEditUnitDialog(false);
      await fetchData();
      if (selectedProperty?.id) await fetchPropertyUnits(selectedProperty.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update unit");
    }
  }

  async function handleAddTenant() {
    if (!tenantForm.name || !tenantForm.email || !tenantForm.phone) {
      toast.error("Please fill all tenant fields");
      return;
    }

    try {
      await apiFetch("/api/tenants", {
        method: "POST",
        body: JSON.stringify(tenantForm),
      });
      toast.success("Tenant added successfully");
      setShowTenantDialog(false);
      setTenantForm({ name: "", email: "", phone: "", role: "manager" });
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add tenant");
    }
  }

  async function handleDeleteProperty(id: string) {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
      await apiFetch(`/api/properties/${id}`, { method: "DELETE" });
      toast.success("Property deleted");
      await fetchData();
      await fetchAllUnits();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete property");
    }
  }

  async function handleDeleteUnit(propertyId: string, unitId: string) {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
      await apiFetch(`/api/properties/${propertyId}/units/${unitId}`, { method: "DELETE" });
      toast.success("Unit deleted");

      await fetchPropertyUnits(propertyId);
      await fetchAllUnits();
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete unit");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="text-muted-foreground">Loading properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground mt-2">Manage your properties, units, and team members.</p>
        </div>
      </div>

      {/* Tabs */}
      {userRole === "admin" && (
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setViewMode("properties")}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              viewMode === "properties"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-slate-900"
            }`}
          >
            Properties
          </button>
          <button
            onClick={() => setViewMode("units")}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              viewMode === "units"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-slate-900"
            }`}
          >
            Units
          </button>
          <button
            onClick={() => setViewMode("tenants")}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              viewMode === "tenants"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-slate-900"
            }`}
          >
            Team Organization
          </button>
        </div>
      )}

      {/* Properties View */}
      {(viewMode === "properties" || userRole !== "admin") && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Properties</h2>
            {userRole === "admin" && (
              <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Property</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Property Name</Label>
                      <Input
                        placeholder="e.g., Sunset Villa"
                        value={propertyForm.name}
                        onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input
                        placeholder="Street address"
                        value={propertyForm.address}
                        onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        value={propertyForm.type}
                        onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value })}
                      >
                        <option value="HOTEL">Hotel</option>
                        <option value="SHORTLET">Shortlet</option>
                      </select>
                    </div>
                    <Button onClick={handleCreateProperty} className="w-full">
                      Create Property
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {properties.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No properties yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {properties.map((property) => (
                <div key={property.id}>
                  <PropertyCard
                    property={property}
                    onDelete={handleDeleteProperty}
                    onEdit={openEditProperty}
                    onToggleUnits={() => togglePropertyUnits(property)}
                    canManage={canManageProperties}
                    canDelete={canDeleteProperties}
                    onAddUnit={() => {
                      setSelectedProperty(property);
                      setShowUnitDialog(true);
                    }}
                  />

                  {/* Units List */}
                  {property.expandedUnits && (
                    <div className="ml-4 mt-3 space-y-2 border-l-2 border-indigo-200 pl-4">
                      {property.units && property.units.length > 0 ? (
                        property.units.map((unit) => (
                          <UnitCard
                            key={unit.id}
                            unit={unit}
                            onEdit={() => openEditUnit(unit)}
                            onDelete={() => handleDeleteUnit(property.id, unit.id)}
                            canManage={canManageProperties}
                            canDelete={canDeleteProperties}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground py-2">No units in this property</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Units View */}
      {viewMode === "units" && userRole === "admin" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">All Units</h2>

          {units.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No units yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {units.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  onEdit={() => openEditUnit(unit)}
                  onDelete={() => handleDeleteUnit(unit.propertyId, unit.id)}
                  canManage={canManageProperties}
                  canDelete={canDeleteProperties}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tenants View */}
      {viewMode === "tenants" && userRole === "admin" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Team Members</h2>
            <Dialog open={showTenantDialog} onOpenChange={setShowTenantDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Team Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={tenantForm.name}
                      onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={tenantForm.email}
                      onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      placeholder="+234..."
                      value={tenantForm.phone}
                      onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      value={tenantForm.role}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, role: e.target.value as "manager" | "staff" })
                      }
                    >
                      <option value="manager">Manager</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                  <Button onClick={handleAddTenant} className="w-full">
                    Add Team Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {tenants.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No team members yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">{tenants.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} />)}</div>
          )}
        </div>
      )}

      {/* Add Unit Dialog */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Unit to {selectedProperty?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Unit Name</Label>
              <Input
                placeholder="e.g., Room 101"
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Type</Label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                value={unitForm.type}
                onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value as "ROOM" | "APARTMENT" })}
              >
                <option value="ROOM">Room</option>
                <option value="APARTMENT">Apartment</option>
              </select>
            </div>

            <div>
              <Label>Base Price Per Night (₦)</Label>
              <Input
                type="number"
                placeholder="50000"
                value={unitForm.basePrice}
                onChange={(e) => setUnitForm({ ...unitForm, basePrice: e.target.value })}
              />
            </div>

            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                placeholder="2"
                value={unitForm.capacity}
                onChange={(e) => setUnitForm({ ...unitForm, capacity: e.target.value })}
              />
            </div>

            <Button onClick={handleCreateUnit} className="w-full">
              Create Unit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditPropertyDialog}
        onOpenChange={(open) => {
          setShowEditPropertyDialog(open);
          if (!open) setEditPropertyAttempted(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Property Name</Label>
              <Input
                value={editPropertyForm.name}
                onChange={(e) => setEditPropertyForm((p) => ({ ...p, name: e.target.value }))}
              />
              {editPropertyAttempted && editPropertyNameError ? (
                <p className="text-xs text-red-600 mt-1">{editPropertyNameError}</p>
              ) : null}
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={editPropertyForm.address}
                onChange={(e) => setEditPropertyForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                value={editPropertyForm.type}
                onChange={(e) =>
                  setEditPropertyForm((p) => ({ ...p, type: e.target.value as "HOTEL" | "SHORTLET" }))
                }
              >
                <option value="HOTEL">Hotel</option>
                <option value="SHORTLET">Shortlet</option>
              </select>
            </div>
            <Button onClick={handleUpdateProperty} className="w-full" disabled={!editPropertyValid}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditUnitDialog}
        onOpenChange={(open) => {
          setShowEditUnitDialog(open);
          if (!open) setEditUnitAttempted(false);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Unit Name</Label>
              <Input
                value={editUnitForm.name}
                onChange={(e) => setEditUnitForm((p) => ({ ...p, name: e.target.value }))}
              />
              {editUnitAttempted && editUnitNameError ? (
                <p className="text-xs text-red-600 mt-1">{editUnitNameError}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  value={editUnitForm.type}
                  onChange={(e) => setEditUnitForm((p) => ({ ...p, type: e.target.value as "ROOM" | "APARTMENT" }))}
                >
                  <option value="ROOM">Room</option>
                  <option value="APARTMENT">Apartment</option>
                </select>
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={editUnitForm.capacity}
                  onChange={(e) => setEditUnitForm((p) => ({ ...p, capacity: e.target.value }))}
                />
                {editUnitAttempted && editUnitCapacityError ? (
                  <p className="text-xs text-red-600 mt-1">{editUnitCapacityError}</p>
                ) : null}
              </div>
            </div>

            <div>
              <Label>Base Price Per Night (₦)</Label>
              <Input
                type="number"
                value={editUnitForm.basePrice}
                onChange={(e) => setEditUnitForm((p) => ({ ...p, basePrice: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is your default nightly rate when no promo is active.
              </p>
              {editUnitAttempted && editUnitBasePriceError ? (
                <p className="text-xs text-red-600 mt-1">{editUnitBasePriceError}</p>
              ) : null}
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-sm font-medium">Temporary Discount / Promo Rate</p>
              <p className="text-xs text-muted-foreground">
                Use this for campaigns like weekend promos or festive pricing. Booking totals will automatically use this during the selected dates.
              </p>
              <div>
                <Label>Discount Type</Label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  value={editUnitForm.discountType}
                  onChange={(e) =>
                    setEditUnitForm((p) => ({
                      ...p,
                      discountType: e.target.value as "" | "PERCENT" | "FIXED_PRICE",
                    }))
                  }
                >
                  <option value="">No discount</option>
                  <option value="PERCENT">Percent off (%)</option>
                  <option value="FIXED_PRICE">Fixed nightly rate</option>
                </select>
              </div>

              {editUnitForm.discountType ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{editUnitForm.discountType === "PERCENT" ? "Discount %" : "Promo Rate (₦)"}</Label>
                      <Input
                        type="number"
                        value={editUnitForm.discountValue}
                        onChange={(e) => setEditUnitForm((p) => ({ ...p, discountValue: e.target.value }))}
                      />
                      {editUnitAttempted && discountValueError ? (
                        <p className="text-xs text-red-600 mt-1">{discountValueError}</p>
                      ) : null}
                    </div>
                    <div>
                      <Label>Label (optional)</Label>
                      <Input
                        placeholder="Weekend promo"
                        value={editUnitForm.discountLabel}
                        onChange={(e) => setEditUnitForm((p) => ({ ...p, discountLabel: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={editUnitForm.discountStart}
                        onChange={(e) => setEditUnitForm((p) => ({ ...p, discountStart: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={editUnitForm.discountEnd}
                        onChange={(e) => setEditUnitForm((p) => ({ ...p, discountEnd: e.target.value }))}
                      />
                    </div>
                    {editUnitAttempted && discountDatesError ? (
                      <p className="text-xs text-red-600">{discountDatesError}</p>
                    ) : null}
                    {editUnitAttempted && discountDateOrderError ? (
                      <p className="text-xs text-red-600">{discountDateOrderError}</p>
                    ) : null}
                  </div>
                </>
              ) : null}

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs text-muted-foreground">Effective nightly rate preview</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatNaira(effectiveNightlyRate)}
                  {useDiscount && editUnitForm.discountStart && editUnitForm.discountEnd
                    ? ` (from ${editUnitForm.discountStart} to ${editUnitForm.discountEnd})`
                    : " (default rate)"}
                </p>
              </div>
            </div>

            <Button onClick={handleUpdateUnit} className="w-full" disabled={!editUnitValid}>
              Save Unit Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Property Card Component
function PropertyCard({
  property,
  onDelete,
  onEdit,
  onToggleUnits,
  canManage,
  canDelete,
  onAddUnit,
}: {
  property: Property;
  onDelete: (id: string) => void;
  onEdit: (property: Property) => void;
  onToggleUnits: () => void;
  canManage: boolean;
  canDelete: boolean;
  onAddUnit: () => void;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{property.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {property.address} • {property.type}
            </p>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <>
                <button onClick={() => onEdit(property)} className="p-2 hover:bg-amber-50 rounded-lg transition">
                  <Pencil className="h-4 w-4 text-amber-600" />
                </button>
                <button onClick={onAddUnit} className="p-2 hover:bg-indigo-50 rounded-lg transition">
                  <Plus className="h-4 w-4 text-indigo-600" />
                </button>
                {canDelete ? (
                  <button onClick={() => onDelete(property.id)} className="p-2 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Units</p>
              <p className="text-lg font-bold text-indigo-600">{property.unitCount ?? property.totalUnits ?? 0}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Occupancy</p>
              <p className="text-lg font-bold text-green-600">{property.occupancy ?? 0}%</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Monthly</p>
              <p className="text-lg font-bold text-blue-600">{formatNaira(property.monthlyRevenue ?? 0)}</p>
            </div>
          </div>
          <button
            onClick={onToggleUnits}
            className="w-full mt-3 flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition text-sm font-medium text-indigo-600"
          >
            <span>{property.expandedUnits ? "Hide Units" : "View Units"}</span>
            {property.expandedUnits ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// Unit Card Component
function UnitCard({
  unit,
  onEdit,
  onDelete,
  canManage,
  canDelete,
}: {
  unit: Unit;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
  canDelete: boolean;
}) {
  const statusColors: Record<Unit["status"], string> = {
    available: "bg-green-100 text-green-800",
    occupied: "bg-blue-100 text-blue-800",
    maintenance: "bg-yellow-100 text-yellow-800",
  };

  const price = getUnitPrice(unit);

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Building2 className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold">{unit.name}</p>
                <p className="text-xs text-muted-foreground">{unit.type}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-sm font-medium">{formatNaira(price)}/night</p>
              <p className="text-xs text-muted-foreground">Capacity: {unit.capacity}</p>
              {unit.discountType && unit.discountValue && unit.discountStart && unit.discountEnd ? (
                <p className="text-xs text-amber-700">
                  Promo: {unit.discountType === "PERCENT" ? `${unit.discountValue}% off` : `${formatNaira(unit.discountValue)}/night`}{" "}
                  ({String(unit.discountStart).slice(0, 10)} to {String(unit.discountEnd).slice(0, 10)})
                </p>
              ) : null}
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[unit.status]}`}>
              {unit.status}
            </span>
            {canManage ? (
              <button onClick={onEdit} className="p-2 hover:bg-amber-50 rounded-lg transition">
                <Pencil className="h-4 w-4 text-amber-600" />
              </button>
            ) : null}
            {canDelete ? (
              <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg transition">
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Tenant Card Component
function TenantCard({ tenant }: { tenant: Tenant }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-medium">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{tenant.name}</p>
              <p className="text-xs text-muted-foreground">{tenant.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{tenant.phone}</p>
            <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
              {tenant.role}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
