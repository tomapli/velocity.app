"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Database, Facebook, Instagram, LoaderCircle, Settings } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  IG_DEFAULT_REQUESTED_POST_COUNT,
  IG_REQUESTED_POST_COUNT_MAX,
} from "@/lib/ig/constants";
import {
  META_CONNECTIONS_API_PATH,
  META_OAUTH_MESSAGE_TYPE,
} from "@/lib/meta/constants";
import type {
  MetaConnectionLookup,
  MetaConnectionSummary,
  MetaInstagramAccountSummary,
  MetaOauthProvider,
} from "@/lib/meta/types";
import { cn } from "@/lib/utils";

export interface ScrapeParamsConfirmPayload {
  requestedPostCount: number | null;
  sinceWhen: string | null;
  dataSource: "public" | "meta_hybrid";
  metaInstagramAccountId: string | null;
}

interface ScrapeParamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  isUrlInput: boolean;
  isSubmitting?: boolean;
  onConfirm: (payload: ScrapeParamsConfirmPayload) => void;
}

type DialogStep = "source" | "params";
type ScrapeParamsMode = "post_count" | "since_when";

interface OauthMessage {
  type: typeof META_OAUTH_MESSAGE_TYPE;
  success: boolean;
  message: string;
}

/** Two-step source and scrape-range flow shown after the Instagram tab detour. */
export function ScrapeParamsDialog({
  open,
  onOpenChange,
  username,
  isUrlInput,
  isSubmitting = false,
  onConfirm,
}: ScrapeParamsDialogProps) {
  const [step, setStep] = useState<DialogStep>("source");
  const [mode, setMode] = useState<ScrapeParamsMode>("post_count");
  const [postCount, setPostCount] = useState(String(IG_DEFAULT_REQUESTED_POST_COUNT));
  const [sinceWhen, setSinceWhen] = useState("");
  const [lookup, setLookup] = useState<MetaConnectionLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"public" | "meta_hybrid" | null>(null);
  const postCountRef = useRef<HTMLInputElement>(null);
  const sinceWhenRef = useRef<HTMLInputElement>(null);

  const loadConnections = useCallback(async () => {
    if (!username) {
      return;
    }
    setIsLoadingConnections(true);
    setLookupError(null);
    try {
      const response = await fetch(
        `${META_CONNECTIONS_API_PATH}?username=${encodeURIComponent(username)}`,
        { cache: "no-store" },
      );
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok || !isMetaConnectionLookup(raw)) {
        throw new Error(getApiError(raw) ?? "Could not check Meta access");
      }
      setLookup(raw);
      setSelectedAccountId(raw.match?.account.id ?? null);
      setDataSource(raw.match ? "meta_hybrid" : null);
    } catch (error) {
      setLookup(null);
      setLookupError(error instanceof Error ? error.message : "Could not check Meta access");
    } finally {
      setIsLoadingConnections(false);
    }
  }, [username]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep("source");
    setMode("post_count");
    setPostCount(String(IG_DEFAULT_REQUESTED_POST_COUNT));
    setSinceWhen("");
    setLookup(null);
    setLookupError(null);
    setSelectedAccountId(null);
    setDataSource(null);
    void loadConnections();
  }, [loadConnections, open]);

  useEffect(() => {
    const handleOauthMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !isOauthMessage(event.data)) {
        return;
      }
      if (event.data.success) {
        toast.success(event.data.message);
        void loadConnections();
      } else {
        toast.error(event.data.message);
      }
    };
    window.addEventListener("message", handleOauthMessage);
    return () => window.removeEventListener("message", handleOauthMessage);
  }, [loadConnections]);

  useEffect(() => {
    if (!open || step !== "params") {
      return;
    }
    const target = mode === "post_count" ? postCountRef.current : sinceWhenRef.current;
    const frame = window.requestAnimationFrame(() => {
      target?.focus();
      target?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, open, step]);

  const matchingLogins = getMatchingLogins(lookup, username);

  const connectMeta = (provider: MetaOauthProvider) => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const url = `/api/meta/oauth/${provider}/start?username=${encodeURIComponent(username)}&returnTo=${encodeURIComponent(returnTo)}`;
    window.open(url, "velocity-meta-oauth", "popup,width=620,height=760");
  };

  const handleConfirm = () => {
    if (!dataSource) {
      setStep("source");
      return;
    }
    if (isUrlInput || mode === "post_count") {
      const parsed = Number.parseInt(postCount, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > IG_REQUESTED_POST_COUNT_MAX) {
        postCountRef.current?.focus();
        return;
      }
      onConfirm({
        requestedPostCount: parsed,
        sinceWhen: null,
        dataSource,
        metaInstagramAccountId: dataSource === "meta_hybrid" ? selectedAccountId : null,
      });
      return;
    }

    if (!sinceWhen) {
      sinceWhenRef.current?.focus();
      return;
    }
    onConfirm({
      requestedPostCount: null,
      sinceWhen: new Date(`${sinceWhen}T00:00:00`).toISOString(),
      dataSource,
      metaInstagramAccountId: dataSource === "meta_hybrid" ? selectedAccountId : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={step === "source" ? "default" : "outline"}>1 · Data source</Badge>
            <Badge variant={step === "params" ? "default" : "outline"}>2 · Range</Badge>
          </div>
          <DialogTitle>Scrape @{username}</DialogTitle>
          <DialogDescription>
            {step === "source"
              ? "Use private Meta insights when this workspace has access, or deliberately continue with public data."
              : "Choose the same post limit or start date used by the public-data workflow."}
          </DialogDescription>
        </DialogHeader>

        {step === "source" ? (
          <SourceStep
            configured={lookup?.configured ?? false}
            connections={lookup?.connections ?? []}
            matchingLogins={matchingLogins}
            selectedAccountId={selectedAccountId}
            isLoading={isLoadingConnections}
            error={lookupError}
            onSelectAccount={(accountId) => {
              setSelectedAccountId(accountId);
              setDataSource("meta_hybrid");
            }}
            onRetry={() => void loadConnections()}
            onConnect={connectMeta}
            onContinueMeta={() => {
              if (selectedAccountId) {
                setDataSource("meta_hybrid");
                setStep("params");
              }
            }}
            onContinuePublic={() => {
              setDataSource("public");
              setSelectedAccountId(null);
              setStep("params");
            }}
          />
        ) : (
          <ParamsStep
            dataSource={dataSource!}
            isUrlInput={isUrlInput}
            isSubmitting={isSubmitting}
            postCount={postCount}
            postCountRef={postCountRef}
            sinceWhen={sinceWhen}
            sinceWhenRef={sinceWhenRef}
            onModeChange={setMode}
            onPostCountChange={setPostCount}
            onSinceWhenChange={setSinceWhen}
            onConfirm={handleConfirm}
          />
        )}

        {step === "params" ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStep("source")} disabled={isSubmitting}>
              Back
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Scheduling…" : "Confirm"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SourceStep({
  configured,
  connections,
  matchingLogins,
  selectedAccountId,
  isLoading,
  error,
  onSelectAccount,
  onRetry,
  onConnect,
  onContinueMeta,
  onContinuePublic,
}: {
  configured: boolean;
  connections: MetaConnectionSummary[];
  matchingLogins: Array<{ connection: MetaConnectionSummary; account: MetaInstagramAccountSummary }>;
  selectedAccountId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectAccount: (accountId: string) => void;
  onRetry: () => void;
  onConnect: (provider: MetaOauthProvider) => void;
  onContinueMeta: () => void;
  onContinuePublic: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Checking existing workspace logins…
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {matchingLogins.length > 0 ? (
        <div className="space-y-2">
          <Label>Available Meta access</Label>
          {matchingLogins.map(({ connection, account }) => (
            <Button
              key={account.id}
              type="button"
              variant="outline"
              className={cn(
                "h-auto w-full justify-start gap-3 p-3 text-left",
                selectedAccountId === account.id && "border-foreground bg-accent",
              )}
              onClick={() => onSelectAccount(account.id)}
            >
              <Avatar>
                <AvatarImage src={connection.accountPictureUrl ?? account.profilePictureUrl ?? undefined} />
                <AvatarFallback>{connection.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  Will use existing login “{connection.displayName}”
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {connection.provider === "facebook" ? "Facebook Login" : "Instagram Login"} · @{account.username}
                </span>
              </span>
              {selectedAccountId === account.id ? <Check className="size-4" /> : null}
            </Button>
          ))}
          <Button type="button" className="w-full" onClick={onContinueMeta} disabled={!selectedAccountId}>
            Continue with Meta + public data
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          {connections.length > 0
            ? "The existing workspace login does not grant access to this Instagram account. Connect another login or use public data."
            : "No workspace Meta login currently grants access to this Instagram account."}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => onConnect("facebook")} disabled={!configured}>
          <Facebook />
          Facebook Login
        </Button>
        <Button type="button" variant="outline" onClick={() => onConnect("instagram")} disabled={!configured}>
          <Instagram />
          Instagram Login
        </Button>
      </div>
      {!configured ? (
        <p className="text-xs text-muted-foreground">
          Meta OAuth environment variables are not configured yet. Public data remains available.
        </p>
      ) : null}

      <Separator />
      <Button type="button" variant="secondary" className="w-full" onClick={onContinuePublic}>
        <Database />
        Use public data
      </Button>
      <Button asChild type="button" variant="ghost" size="sm" className="w-full">
        <Link href="/settings/meta">
          <Settings />
          Manage Meta connections
        </Link>
      </Button>
    </div>
  );
}

function ParamsStep({
  dataSource,
  isUrlInput,
  isSubmitting,
  postCount,
  postCountRef,
  sinceWhen,
  sinceWhenRef,
  onModeChange,
  onPostCountChange,
  onSinceWhenChange,
  onConfirm,
}: {
  dataSource: "public" | "meta_hybrid";
  isUrlInput: boolean;
  isSubmitting: boolean;
  postCount: string;
  postCountRef: React.RefObject<HTMLInputElement | null>;
  sinceWhen: string;
  sinceWhenRef: React.RefObject<HTMLInputElement | null>;
  onModeChange: (mode: ScrapeParamsMode) => void;
  onPostCountChange: (value: string) => void;
  onSinceWhenChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="space-y-5 py-2"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onConfirm();
        }
      }}
    >
      <Badge variant="outline">
        {dataSource === "meta_hybrid" ? "Meta + public data" : "Public data"}
      </Badge>
      <div className="space-y-2">
        <Label htmlFor="ig-post-count">How many posts</Label>
        <Input
          ref={postCountRef}
          id="ig-post-count"
          type="number"
          min={1}
          max={IG_REQUESTED_POST_COUNT_MAX}
          value={postCount}
          onChange={(event) => {
            onModeChange("post_count");
            onPostCountChange(event.target.value);
          }}
          onFocus={() => onModeChange("post_count")}
          disabled={isSubmitting}
        />
      </div>
      {!isUrlInput ? (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ig-since-when">Since when</Label>
            <Input
              ref={sinceWhenRef}
              id="ig-since-when"
              type="date"
              value={sinceWhen}
              onChange={(event) => {
                onModeChange("since_when");
                onSinceWhenChange(event.target.value);
              }}
              onFocus={() => onModeChange("since_when")}
              disabled={isSubmitting}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function getMatchingLogins(
  lookup: MetaConnectionLookup | null,
  username: string,
): Array<{ connection: MetaConnectionSummary; account: MetaInstagramAccountSummary }> {
  if (!lookup) {
    return [];
  }
  return lookup.connections.flatMap((connection) =>
    connection.accounts
      .filter((account) => account.username.toLowerCase() === username.toLowerCase())
      .map((account) => ({ connection, account })),
  );
}

function isOauthMessage(value: unknown): value is OauthMessage {
  return isRecord(value) &&
    value.type === META_OAUTH_MESSAGE_TYPE &&
    typeof value.success === "boolean" &&
    typeof value.message === "string";
}

function isMetaConnectionLookup(value: unknown): value is MetaConnectionLookup {
  return isRecord(value) &&
    typeof value.configured === "boolean" &&
    Array.isArray(value.connections) &&
    (value.match === null || isRecord(value.match));
}

function getApiError(value: unknown): string | null {
  return isRecord(value) && typeof value.error === "string" ? value.error : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
