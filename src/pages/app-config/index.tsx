import { SectionHelp } from "@/components/section-help";
import { TenSecondsForm } from "@/components/game-rules/ten-seconds-form";

import { useState, useEffect, useCallback } from "react";
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
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Local state for editing
  const [editValues, setEditValues] = useState<
    Record<string, Record<string, string | number | boolean>>
  >({});

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
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
      setLoadError(true);
      toast.error("Failed to load app configurations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

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
            ] ?? "",
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
  const appVersionConfigs = configs.filter((c) => c.app || c.platform);
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
      <div className="space-y-6">
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
    <div className="min-w-0 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <IconSettings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            App Configuration
          </h1>
          <p className="text-muted-foreground">
            Manage releases, availability, rewards, and game rules in one place.
          </p>
        </div>
      </div>

      <nav
        aria-label="Configuration sections"
        className="flex flex-wrap gap-2 border-b pb-4"
      >
        {[
          ...(appVersionConfigs.length
            ? [["app-versions", "App versions"]]
            : []),
          ...(generalConfigs.length
            ? [["general-settings", "General settings"]]
            : []),
          ["game-rules", "Game rules"],
          ...(configs.length ? [["saved-settings", "Saved settings"]] : []),
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {label}
          </a>
        ))}
      </nav>

      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6"
        >
          <div>
            <p className="font-semibold">Configuration could not be loaded</p>
            <p className="text-sm text-muted-foreground">
              Try again to view the application settings.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadConfigs()}>
            Retry loading
          </Button>
        </div>
      )}
      {!loadError && configs.length === 0 && (
        <div className="rounded-xl border border-dashed p-6">
          <p className="font-semibold">No application settings found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no app configurations in this environment. Game rules are
            managed below.
          </p>
        </div>
      )}

      {/* App Version Configurations */}
      {appVersionConfigs.length > 0 && (
        <section
          id="app-versions"
          aria-labelledby="app-versions-heading"
          className="scroll-mt-6 space-y-4"
        >
          <div className="space-y-1">
            <h2
              id="app-versions-heading"
              className="flex items-center gap-2 text-xl font-semibold"
            >
              App Version Settings
              <SectionHelp title="App version settings" />
            </h2>
            <p className="text-sm text-muted-foreground">
              Set the release version for each app and platform. Version changes
              apply when saved; force update switches apply immediately.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {appVersionConfigs.map((config) => (
              <Card key={config.id} className="min-w-0">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 leading-snug">
                    {getPlatformIcon(config.platform)}
                    {config.app
                      ? `${config.app.charAt(0).toUpperCase()}${config.app.slice(1)} App`
                      : "Application"}
                    <Badge variant="outline" className="ml-auto">
                      {config.platform || "Platform unspecified"}
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
                        className="min-w-0"
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
                  <div className="flex items-center justify-between gap-4 pt-4 border-t">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`forceupdate-${config.id}`}
                        className="flex items-center gap-2"
                      >
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
                      id={`forceupdate-${config.id}`}
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
        </section>
      )}

      {/* General Configurations */}
      {generalConfigs.length > 0 && (
        <section
          id="general-settings"
          aria-labelledby="general-settings-heading"
          className="scroll-mt-6 space-y-4"
        >
          <div className="space-y-1">
            <h2
              id="general-settings-heading"
              className="flex items-center gap-2 text-xl font-semibold"
            >
              General Settings
              <SectionHelp title="General settings" />
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage app availability and signup rewards. Switches apply
              immediately; save amount changes individually.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {generalConfigs.map((config) => (
              <Card key={config.id} className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconSettings className="h-5 w-5" />
                    {config.id === "I1bfdpsvQwpH1Zpb1ypN"
                      ? "Signup Bonus Configuration"
                      : config.name || config.id}
                  </CardTitle>
                  <CardDescription>
                    Application availability and reward settings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Is Active Toggle */}
                    {config.isActive !== undefined && (
                      <div className="flex items-center justify-between gap-4 border-t pt-4">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`active-${config.id}`}
                            className="flex items-center gap-2"
                          >
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
                          id={`active-${config.id}`}
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
                      <div className="space-y-2 border-t pt-4">
                        <Label
                          htmlFor={`signupbonus-${config.id}`}
                          className="flex items-center gap-2"
                        >
                          <IconGift className="h-4 w-4" />
                          Signup Bonus Amount (₦)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            className="min-w-0"
                            id={`signupbonus-${config.id}`}
                            type="number"
                            min="0"
                            value={
                              editValues[
                                config.id!
                              ]?.signupbonusamount?.toString() ?? ""
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
        </section>
      )}

      <section id="game-rules" aria-label="Game rules" className="scroll-mt-6">
        <TenSecondsForm />
      </section>

      {/* Summary */}
      {configs.length > 0 && (
        <Card id="saved-settings" className="scroll-mt-6">
          <CardHeader>
            <CardTitle>Saved Settings</CardTitle>
            <CardDescription>
              All saved configurations. Unsaved field edits are not reflected
              here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(config.platform)}
                    <span className="min-w-0 break-words font-medium">
                      {config.app || config.platform
                        ? `${config.app || "Application"} (${config.platform || "Unspecified platform"})`
                        : config.signupbonusamount !== undefined
                          ? "Signup Bonus"
                          : config.name || config.id}
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
                      <span className="text-muted-foreground">
                        Force Update:
                      </span>{" "}
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
                      <Badge
                        variant={config.isActive ? "default" : "secondary"}
                      >
                        {config.isActive ? "Yes" : "No"}
                      </Badge>
                    </p>
                  )}
                  {config.signupbonusamount !== undefined && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        Signup Bonus:
                      </span>{" "}
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
      )}
    </div>
  );
}
