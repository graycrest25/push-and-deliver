"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { appConfigService } from "@/services/appconfig.service";
import type { AppConfig } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/contexts/UserContext";
import { Navigate } from "react-router-dom";
import {
  IconSettings,
  IconDeviceMobile,
  IconRefresh,
  IconGift,
  IconBrandApple,
  IconBrandAndroid,
} from "@tabler/icons-react";

export default function AppConfigPage() {
  const { user } = useCurrentUser();
  const isAdminViewOnly =
    user?.adminType === "customercare" || user?.adminType === "verifier";

  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Local state for editing
  const [editValues, setEditValues] = useState<
    Record<string, Record<string, string | number | boolean>>
  >({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await appConfigService.getAllConfigs();
      setConfigs(data);

      // Initialize edit values
      const initialValues: Record<
        string,
        Record<string, string | number | boolean>
      > = {};
      data.forEach((config) => {
        if (config.id) {
          initialValues[config.id] = {
            appversion: config.appversion || "",
            forceupdate: config.forceupdate || false,
            isActive: config.isActive || false,
            signupbonusamount: config.signupbonusamount || 0,
          };
        }
      });
      setEditValues(initialValues);
    } catch (error) {
      console.error("Error loading app configs:", error);
      toast.error("Failed to load app configurations");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateField = async (
    configId: string,
    field: string,
    value: string | number | boolean,
  ) => {
    try {
      setSaving(`${configId}-${field}`);
      await appConfigService.updateField(configId, field, value);
      toast.success(`${field} updated successfully`);
      // Update local state
      setConfigs((prev) =>
        prev.map((c) => (c.id === configId ? { ...c, [field]: value } : c)),
      );
    } catch (error) {
      toast.error(`Failed to update ${field}`);
      // Revert local edit value on error
      setEditValues((prev) => ({
        ...prev,
        [configId]: {
          ...prev[configId],
          [field]:
            configs.find((c) => c.id === configId)?.[
              field as keyof AppConfig
            ] || "",
        },
      }));
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = async (
    configId: string,
    field: string,
    currentValue: boolean,
  ) => {
    const newValue = !currentValue;
    // Optimistically update
    setEditValues((prev) => ({
      ...prev,
      [configId]: {
        ...prev[configId],
        [field]: newValue,
      },
    }));
    await handleUpdateField(configId, field, newValue);
  };

  const updateEditValue = (
    configId: string,
    field: string,
    value: string | number | boolean,
  ) => {
    setEditValues((prev) => ({
      ...prev,
      [configId]: {
        ...prev[configId],
        [field]: value,
      },
    }));
  };

  // Only super and regular admins can access
  if (
    !loading &&
    user?.adminType !== "super" &&
    user?.adminType !== "regular"
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  // Separate configs into app version configs and general config
  const appVersionConfigs = configs.filter((c) => c.app && c.platform);
  const generalConfigs = configs.filter((c) => !c.app && !c.platform);

  const getPlatformIcon = (platform?: string) => {
    if (platform?.toLowerCase() === "ios") {
      return <IconBrandApple className="h-5 w-5" />;
    }
    if (platform?.toLowerCase() === "android") {
      return <IconBrandAndroid className="h-5 w-5" />;
    }
    return <IconDeviceMobile className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            App Configuration
          </h1>
          <p className="text-muted-foreground">Manage application settings</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <IconSettings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            App Configuration
          </h1>
          <p className="text-muted-foreground">
            Manage application settings and configuration
          </p>
        </div>
      </div>

      {/* App Version Configurations */}
      {appVersionConfigs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">App Version Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {appVersionConfigs.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getPlatformIcon(config.platform)}
                    {config.app?.charAt(0).toUpperCase() +
                      (config.app?.slice(1) || "")}{" "}
                    App
                    <Badge variant="outline" className="ml-auto">
                      {config.platform}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Version control for {config.platform} {config.app}{" "}
                    application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* App Version */}
                  <div className="space-y-2">
                    <Label htmlFor={`appversion-${config.id}`}>Version</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`appversion-${config.id}`}
                        value={
                          editValues[config.id!]?.appversion?.toString() || ""
                        }
                        onChange={(e) =>
                          updateEditValue(
                            config.id!,
                            "appversion",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. 1.0.0"
                        disabled={isAdminViewOnly}
                      />
                      {!isAdminViewOnly && (
                        <Button
                          onClick={() =>
                            handleUpdateField(
                              config.id!,
                              "appversion",
                              editValues[config.id!]?.appversion || "",
                            )
                          }
                          disabled={saving === `${config.id}-appversion`}
                        >
                          {saving === `${config.id}-appversion`
                            ? "Saving..."
                            : "Save"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Force Update Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2">
                        <IconRefresh className="h-4 w-4" />
                        Force Update
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {editValues[config.id!]?.forceupdate
                          ? "Users must update to continue"
                          : "Users can use older versions"}
                      </p>
                    </div>
                    <Switch
                      checked={!!editValues[config.id!]?.forceupdate}
                      onCheckedChange={() =>
                        handleToggle(
                          config.id!,
                          "forceupdate",
                          !!editValues[config.id!]?.forceupdate,
                        )
                      }
                      disabled={
                        saving === `${config.id}-forceupdate` || isAdminViewOnly
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* General Configurations */}
      {generalConfigs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">General Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {generalConfigs.map((config) => (
              <Card key={config.id} className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconSettings className="h-5 w-5" />
                    {config.id === "I1bfdpsvQwpH1Zpb1ypN"
                      ? "Signup Bonus Configuration"
                      : config.name}
                  </CardTitle>
                  <CardDescription>
                    {/* Global app settings and bonus configurations */}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Is Active Toggle */}
                    {config.isActive !== undefined && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2">
                            <IconDeviceMobile className="h-4 w-4" />
                            App Active Status
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {editValues[config.id!]?.isActive
                              ? "App is active and operational"
                              : "App may be in maintenance mode"}
                          </p>
                        </div>
                        <Switch
                          checked={!!editValues[config.id!]?.isActive}
                          onCheckedChange={() =>
                            handleToggle(
                              config.id!,
                              "isActive",
                              !!editValues[config.id!]?.isActive,
                            )
                          }
                          disabled={
                            saving === `${config.id}-isActive` ||
                            isAdminViewOnly
                          }
                        />
                      </div>
                    )}

                    {/* Signup Bonus Amount */}
                    {config.signupbonusamount !== undefined && (
                      <div className="space-y-2 p-4 border rounded-lg">
                        <Label
                          htmlFor={`signupbonus-${config.id}`}
                          className="flex items-center gap-2"
                        >
                          <IconGift className="h-4 w-4" />
                          Signup Bonus Amount (₦)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`signupbonus-${config.id}`}
                            type="number"
                            min="0"
                            value={
                              editValues[config.id!]?.signupbonusamount || ""
                            }
                            onChange={(e) =>
                              updateEditValue(
                                config.id!,
                                "signupbonusamount",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            placeholder="e.g. 500"
                            disabled={isAdminViewOnly}
                          />
                          {!isAdminViewOnly && (
                            <Button
                              onClick={() =>
                                handleUpdateField(
                                  config.id!,
                                  "signupbonusamount",
                                  editValues[config.id!]?.signupbonusamount ||
                                    0,
                                )
                              }
                              disabled={
                                saving === `${config.id}-signupbonusamount`
                              }
                            >
                              {saving === `${config.id}-signupbonusamount`
                                ? "Saving..."
                                : "Save"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
          <CardDescription>Overview of all current settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {configs.map((config) => (
              <div
                key={config.id}
                className="p-4 bg-muted rounded-lg space-y-2"
              >
                <div className="flex items-center gap-2">
                  {getPlatformIcon(config.platform)}
                  <span className="font-medium">
                    {config.app && config.platform
                      ? `${config.app} (${config.platform})`
                      : config.signupbonusamount
                        ? "Signup Bonus"
                        : config.name}
                  </span>
                </div>
                {config.appversion && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Version:</span>{" "}
                    <span className="font-medium">{config.appversion}</span>
                  </p>
                )}
                {config.forceupdate !== undefined && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Force Update:</span>{" "}
                    <Badge
                      variant={config.forceupdate ? "default" : "secondary"}
                    >
                      {config.forceupdate ? "Enabled" : "Disabled"}
                    </Badge>
                  </p>
                )}
                {config.isActive !== undefined && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Active:</span>{" "}
                    <Badge variant={config.isActive ? "default" : "secondary"}>
                      {config.isActive ? "Yes" : "No"}
                    </Badge>
                  </p>
                )}
                {config.signupbonusamount !== undefined && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Signup Bonus:</span>{" "}
                    <span className="font-medium">
                      ₦{config.signupbonusamount.toLocaleString()}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
