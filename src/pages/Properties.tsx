// In src/pages/Properties.tsx, update the Properties component with these changes:

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Users,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

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

interface Unit {
  id: string;
  name: string;
  propertyId: string;
  type: string;
  pricePerNight: number;
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

export default function Properties() {
  const nav = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("properties");
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "staff">("staff");

  // Dialog states
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showTenantDialog, setShowTenantDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Form states
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    address: "",
    type: "HOTEL",
  });

  const [unitForm, setUnitForm] = useState({
    name: "",
    type: "standard",
    pricePerNight: "",
    capacity: "2",
  });

  const [tenantForm, setTenantForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "manager" as "manager" | "staff",
  });

  // Fetch data
  useEffect(() => {
    const role = (localStorage.getItem("userRole") || "staff") as "admin" | "manager" | "staff";
    setUserRole(role);
    fetchData();
  }, []);

  async function fetchData() {
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

      // Fetch all units (for units view)
      try {
        const unitsData = await apiFetch("/api/units");
        setUnits(unitsData.units || []);
      } catch (err) {
        console.error("Failed to fetch units:", err);
      }

      // Fetch tenants (admin only)
      if (userRole === "admin") {
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

  // Fetch units for a specific property
  async function fetchPropertyUnits(propertyId: string) {
    try {
      const unitsData = await apiFetch(`/api/properties/${propertyId}/units`);
      setProperties((prevProps) =>
        prevProps.map((p) =>
          p.id === propertyId
            ? { ...p, units: unitsData.units || [], expandedUnits: true }
            : p
        )
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch property units");
    }
  }

  // Toggle units expansion
  function togglePropertyUnits(property: Property) {
    if (property.expandedUnits && property.units?.length) {
      setProperties((prevProps) =>
        prevProps.map((p) =>
          p.id === property.id ? { ...p, expandedUnits: false } : p
        )
      );
    } else {
      fetchPropertyUnits(property.id);
    }
  }

  // Create property (Manager)
  async function handleCreateProperty() {
    if (!propertyForm.name || !propertyForm.address || !propertyForm.type) {
      toast.error("Please fill all property fields");
      return;
    }

    try {
      await apiFetch("/api/properties", {
        method: "POST",
        body: JSON.stringify(propertyForm),
      });
      toast.success("Property created successfully");
      setShowPropertyDialog(false);
      setPropertyForm({ name: "", address: "", type: "HOTEL" });
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create property");
    }
  }

  // Create unit for specific property
  async function handleCreateUnit() {
    if (!selectedProperty) {
      toast.error("Please select a property");
      return;
    }

    if (!unitForm.name || !unitForm.pricePerNight) {
      toast.error("Please fill all unit fields");
      return;
    }

    try {
      await apiFetch(`/api/properties/${selectedProperty.id}/units`, {
        method: "POST",
        body: JSON.stringify({
          name: unitForm.name,
          type: unitForm.type,
          pricePerNight: parseFloat(unitForm.pricePerNight),
          capacity: parseInt(unitForm.capacity),
        }),
      });
      toast.success("Unit created successfully");
      setShowUnitDialog(false);
      setUnitForm({
        name: "",
        type: "standard",
        pricePerNight: "",
        capacity: "2",
      });
      setSelectedProperty(null);
      fetchPropertyUnits(selectedProperty.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create unit");
    }
  }

  // Add tenant (Admin)
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

  // Delete property
  async function handleDeleteProperty(id: string) {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
      await apiFetch(`/api/properties/${id}`, { method: "DELETE" });
      toast.success("Property deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete property");
    }
  }

  // Delete unit
  async function handleDeleteUnit(propertyId: string, unitId: string) {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
      await apiFetch(`/api/properties/${propertyId}/units/${unitId}`, {
        method: "DELETE",
      });
      toast.success("Unit deleted");
      fetchPropertyUnits(propertyId);
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
          <p className="text-muted-foreground mt-2">
            Manage your properties, units, and team members.
          </p>
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
            Tenants
          </button>
        </div>
      )}

      {/* Properties View */}
      {(viewMode === "properties" || userRole !== "admin") && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Properties</h2>
            {userRole !== "staff" && (
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
                        onChange={(e) =>
                          setPropertyForm({ ...propertyForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input
                        placeholder="Street address"
                        value={propertyForm.address}
                        onChange={(e) =>
                          setPropertyForm({ ...propertyForm, address: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        value={propertyForm.type}
                        onChange={(e) =>
                          setPropertyForm({ ...propertyForm, type: e.target.value })
                        }
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
                    onToggleUnits={() => togglePropertyUnits(property)}
                    canEdit={userRole !== "staff"}
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
                            onDelete={() =>
                              handleDeleteUnit(property.id, unit.id)
                            }
                            canEdit={userRole !== "staff"}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground py-2">
                          No units in this property
                        </p>
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
                  onDelete={() => handleDeleteUnit(unit.propertyId, unit.id)}
                  canEdit={userRole !== "staff"}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tenants View (Admin only) */}
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
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={tenantForm.email}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      placeholder="+234..."
                      value={tenantForm.phone}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      value={tenantForm.role}
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          role: e.target.value as "manager" | "staff",
                        })
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
            <div className="space-y-3">
              {tenants.map((tenant) => (
                <TenantCard key={tenant.id} tenant={tenant} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Unit Dialog */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Unit to {selectedProperty?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Unit Name</Label>
              <Input
                placeholder="e.g., Room 101"
                value={unitForm.name}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Type</Label>
              <Input
                placeholder="e.g., Standard, Deluxe"
                value={unitForm.type}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, type: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Price Per Night (₦)</Label>
              <Input
                type="number"
                placeholder="50000"
                value={unitForm.pricePerNight}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, pricePerNight: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                placeholder="2"
                value={unitForm.capacity}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, capacity: e.target.value })
                }
              />
            </div>
            <Button onClick={handleCreateUnit} className="w-full">
              Create Unit
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
  onToggleUnits,
  canEdit,
  onAddUnit,
}: {
  property: Property;
  onDelete: (id: string) => void;
  onToggleUnits: () => void;
  canEdit: boolean;
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
            {canEdit && (
              <>
                <button
                  onClick={onAddUnit}
                  className="p-2 hover:bg-indigo-50 rounded-lg transition"
                >
                  <Plus className="h-4 w-4 text-indigo-600" />
                </button>
                <button
                  onClick={() => onDelete(property.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
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
              <p className="text-lg font-bold text-indigo-600">
                {property.unitCount || 0}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Occupancy</p>
              <p className="text-lg font-bold text-green-600">
                {property.occupancy || 0}%
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Monthly</p>
              <p className="text-lg font-bold text-blue-600">
                ₦{property.monthlyRevenue || 0}
              </p>
            </div>
          </div>
          <button
            onClick={onToggleUnits}
            className="w-full mt-3 flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition text-sm font-medium text-indigo-600"
          >
            <span>
              {property.expandedUnits ? "Hide Units" : "View Units"}
            </span>
            {property.expandedUnits ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// Unit Card Component
function UnitCard({
  unit,
  onDelete,
  canEdit,
}: {
  unit: Unit;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const statusColors = {
    available: "bg-green-100 text-green-800",
    occupied: "bg-blue-100 text-blue-800",
    maintenance: "bg-yellow-100 text-yellow-800",
  };

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
              <p className="text-sm font-medium">₦{unit.pricePerNight}/night</p>
              <p className="text-xs text-muted-foreground">
                Capacity: {unit.capacity}
              </p>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                statusColors[unit.status]
              }`}
            >
              {unit.status}
            </span>
            {canEdit && (
              <button
                onClick={onDelete}
                className="p-2 hover:bg-red-50 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            )}
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