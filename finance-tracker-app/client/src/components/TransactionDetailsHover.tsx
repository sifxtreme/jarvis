import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Transaction } from "../lib/api";
import { MapPin, Globe, CreditCard, Tag, Calendar, Store, ShoppingCart } from "lucide-react";
import { ReactNode } from "react";

/**
 * Rich detail popover for a transaction row.
 *
 * Plaid hands us a lot of context we were throwing away — location (city/region/
 * street), whether the charge was online or in-store, its own category with a
 * confidence level, the merchant's logo and website, and the authorized-vs-posted
 * dates. All of it already lives in `raw_data`; the UI only ever dumped it as raw
 * JSON. This surfaces the useful parts on hover so a row can be identified without
 * opening anything.
 *
 * Handles BOTH shapes:
 *   - Plaid (amex)  -> location / payment_channel / personal_finance_category / logo
 *   - Teller (chase) -> details.category / details.counterparty / type
 * Renders only the fields that actually exist, so a sparse Teller row degrades to
 * just the raw name rather than a wall of "N/A".
 */

type Raw = Record<string, any>;

const titleize = (s: string) =>
  s.toLowerCase().split(/[_\s]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// "FOOD_AND_DRINK_GROCERIES" -> "Food And Drink › Groceries"
function plaidCategory(raw: Raw): { label: string; confidence?: string } | null {
  const pfc = raw?.personal_finance_category;
  if (!pfc?.primary) return null;
  const primary = titleize(pfc.primary);
  const detailed: string | undefined = pfc.detailed;
  // detailed is prefixed with primary — strip it so we don't repeat ourselves
  const tail = detailed && detailed.startsWith(pfc.primary)
    ? detailed.slice(pfc.primary.length).replace(/^_/, "")
    : detailed;
  return {
    label: tail ? `${primary} › ${titleize(tail)}` : primary,
    confidence: pfc.confidence_level ? titleize(pfc.confidence_level) : undefined,
  };
}

function locationLine(raw: Raw): { city?: string; street?: string } | null {
  const loc = raw?.location;
  if (!loc) return null;
  const cityBits = [loc.city, loc.region].filter(Boolean).join(", ");
  const street = [loc.address, loc.postal_code].filter(Boolean).join(" · ");
  if (!cityBits && !street) return null;
  return { city: cityBits || undefined, street: street || undefined };
}

const Row = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <div className="flex items-start gap-2 text-xs">
    <span className="mt-[2px] text-muted-foreground shrink-0">{icon}</span>
    <span className="min-w-0">{children}</span>
  </div>
);

export function TransactionDetailsHover({
  transaction,
  children,
}: {
  transaction: Transaction;
  children: ReactNode;
}) {
  const raw: Raw = (transaction.raw_data as Raw) || {};

  const loc = locationLine(raw);
  const cat = plaidCategory(raw);
  const channel: string | undefined = raw.payment_channel;
  const website: string | undefined = raw.website;
  const logo: string | undefined = raw.logo_url;
  const authorized: string | undefined = raw.authorized_date;
  const posted: string | undefined = raw.date;
  // Teller shape
  const tellerCat: string | undefined = raw?.details?.category;
  const tellerParty: string | undefined = raw?.details?.counterparty?.name;

  const display = transaction.merchant_name || transaction.plaid_name || "";
  const hasExtras =
    loc || cat || channel || website || authorized || tellerCat || tellerParty;

  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 space-y-2.5">
        {/* header */}
        <div className="flex items-center gap-2">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="h-7 w-7 rounded border bg-white object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="h-7 w-7 rounded border flex items-center justify-center text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{display}</div>
            {transaction.plaid_name && transaction.plaid_name !== display && (
              <div className="font-mono text-[10px] text-muted-foreground truncate">
                {transaction.plaid_name}
              </div>
            )}
          </div>
        </div>

        {hasExtras && <div className="border-t" />}

        {loc && (
          <Row icon={<MapPin className="h-3.5 w-3.5" />}>
            {loc.city && <div>{loc.city}</div>}
            {loc.street && <div className="text-muted-foreground">{loc.street}</div>}
          </Row>
        )}

        {channel && (
          <Row icon={channel === "online" ? <Globe className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}>
            {channel === "in store" ? "In store" : titleize(channel)}
          </Row>
        )}

        {cat && (
          <Row icon={<Tag className="h-3.5 w-3.5" />}>
            <div>{cat.label}</div>
            {cat.confidence && (
              <div className="text-muted-foreground">Plaid confidence: {cat.confidence}</div>
            )}
          </Row>
        )}

        {/* Teller rows have no Plaid enrichment — show what they do carry */}
        {!cat && tellerCat && (
          <Row icon={<Tag className="h-3.5 w-3.5" />}>{titleize(tellerCat)}</Row>
        )}
        {!loc && tellerParty && (
          <Row icon={<Store className="h-3.5 w-3.5" />}>{tellerParty}</Row>
        )}

        {website && (
          <Row icon={<Globe className="h-3.5 w-3.5" />}>
            <span className="text-muted-foreground">{website}</span>
          </Row>
        )}

        {authorized && posted && authorized !== posted && (
          <Row icon={<Calendar className="h-3.5 w-3.5" />}>
            <span className="text-muted-foreground">
              Authorized {authorized} · Posted {posted}
            </span>
          </Row>
        )}

        <div className="border-t pt-2">
          <Row icon={<CreditCard className="h-3.5 w-3.5" />}>
            <span className="text-muted-foreground">{transaction.source || "—"}</span>
          </Row>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
