"use client";

import { useCallback, useEffect, useState } from "react";
import { Facebook, Instagram, Link2, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/responsive-alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  META_CONNECTIONS_API_PATH,
  META_OAUTH_MESSAGE_TYPE,
} from "@/lib/meta/constants";
import type {
  MetaConnectionLookup,
  MetaConnectionSummary,
  MetaOauthProvider,
} from "@/lib/meta/types";

const PROVIDER_PERMISSIONS: Record<MetaOauthProvider, string[]> = {
  facebook: ["Instagram profile", "Instagram insights", "Managed Pages"],
  instagram: ["Instagram business profile", "Instagram business insights"],
};

/** Workspace-wide Meta login management with reconnect and disconnect controls. */
export function MetaConnectionsManager() {
  const [lookup, setLookup] = useState<MetaConnectionLookup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(META_CONNECTIONS_API_PATH, { cache: "no-store" });
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok || !isConnectionLookup(raw)) {
        throw new Error(getApiError(raw) ?? "Could not load Meta connections");
      }
      setLookup(raw);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Meta connections");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handleOauthMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        !isRecord(event.data) ||
        event.data.type !== META_OAUTH_MESSAGE_TYPE ||
        typeof event.data.success !== "boolean" ||
        typeof event.data.message !== "string"
      ) {
        return;
      }
      if (event.data.success) {
        toast.success(event.data.message);
        void load();
      } else {
        toast.error(event.data.message);
      }
    };
    window.addEventListener("message", handleOauthMessage);
    return () => window.removeEventListener("message", handleOauthMessage);
  }, [load]);

  const connect = (provider: MetaOauthProvider, username = "__workspace__") => {
    const url = `/api/meta/oauth/${provider}/start?username=${encodeURIComponent(username)}&returnTo=${encodeURIComponent("/settings/meta")}`;
    window.open(url, "velocity-meta-oauth", "popup,width=620,height=760");
  };

  const disconnect = async (connectionId: string) => {
    setDeletingId(connectionId);
    try {
      const response = await fetch(`${META_CONNECTIONS_API_PATH}/${connectionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const raw: unknown = await response.json().catch(() => null);
        throw new Error(getApiError(raw) ?? "Could not disconnect Meta login");
      }
      toast.success("Meta login disconnected. Previously collected insights were retained.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Meta login");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading && !lookup) {
    return (
      <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Validating workspace Meta logins…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => connect("facebook")} disabled={!lookup?.configured}>
          <Facebook />
          Connect Facebook
        </Button>
        <Button type="button" variant="outline" onClick={() => connect("instagram")} disabled={!lookup?.configured}>
          <Instagram />
          Connect Instagram
        </Button>
      </div>

      {lookup?.connections.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {lookup.connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              isDeleting={deletingId === connection.id}
              onReconnect={() => connect(connection.provider, connection.accounts[0]?.username)}
              onDisconnect={() => void disconnect(connection.id)}
            />
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Link2 /></EmptyMedia>
            <EmptyTitle>No Meta connections</EmptyTitle>
            <EmptyDescription>
              Connect a tester login to reuse access across authorized Velocity users.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function ConnectionCard({
  connection,
  isDeleting,
  onReconnect,
  onDisconnect,
}: {
  connection: MetaConnectionSummary;
  isDeleting: boolean;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarImage src={connection.accountPictureUrl ?? undefined} />
            <AvatarFallback>{connection.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{connection.displayName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {connection.provider === "facebook" ? "Facebook Login" : "Instagram Login"}
            </p>
          </div>
          <Badge variant="outline">{connection.accounts.length} accounts</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          {PROVIDER_PERMISSIONS[connection.provider].map((permission) => (
            <Badge key={permission} variant="secondary">{permission}</Badge>
          ))}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instagram access</p>
          <p>{connection.accounts.map((account) => `@${account.username}`).join(", ") || "No professional accounts returned"}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Last validated</dt>
            <dd>{formatDate(connection.lastValidatedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Token expiry</dt>
            <dd>{formatDate(connection.tokenExpiresAt)}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onReconnect}>
          <RefreshCw />
          Reconnect
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm" disabled={isDeleting}>
              <Trash2 />
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {connection.displayName}?</AlertDialogTitle>
              <AlertDialogDescription>
                The encrypted token will be removed. Previously collected Instagram data remains available.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDisconnect}>Disconnect</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "No expiry provided";
}

function isConnectionLookup(value: unknown): value is MetaConnectionLookup {
  return isRecord(value) && typeof value.configured === "boolean" && Array.isArray(value.connections);
}

function getApiError(value: unknown): string | null {
  return isRecord(value) && typeof value.error === "string" ? value.error : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

