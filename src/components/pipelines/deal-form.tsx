"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { CURRENCIES } from "@/lib/currency";
import type {
  AppointmentStatus,
  ConsentStatus,
  Contact,
  Conversation,
  Deal,
  DealStatus,
  ForecastCategory,
  HandoffStatus,
  LeadIntent,
  PipelineStage,
  Profile,
} from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();
  const { t } = useLanguage();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [sourceChannel, setSourceChannel] = useState("");
  const [leadIntent, setLeadIntent] = useState<LeadIntent>("unknown");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState<AppointmentStatus>("not_scheduled");
  const [forecastCategory, setForecastCategory] = useState<ForecastCategory>("unclassified");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [nextActionChannel, setNextActionChannel] = useState("");
  const [objectionCode, setObjectionCode] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [recycleAt, setRecycleAt] = useState("");
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>("unknown");
  const [consentSource, setConsentSource] = useState("");
  const [handoffStatus, setHandoffStatus] = useState<HandoffStatus>("not_started");
  const [handoffNotes, setHandoffNotes] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setTitle(deal.title);
      setValue(String(deal.value ?? ""));
      setCurrency(deal.currency || defaultCurrency);
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
      setServiceName(deal.service_name ?? "");
      setUnitName(deal.unit_name ?? "");
      setProfessionalName(deal.professional_name ?? "");
      setSourceChannel(deal.source_channel ?? "");
      setLeadIntent(deal.lead_intent ?? "unknown");
      setAppointmentAt(toLocalDateTime(deal.appointment_at));
      setAppointmentStatus(deal.appointment_status ?? "not_scheduled");
      setForecastCategory(deal.forecast_category ?? "unclassified");
      setNextAction(deal.next_action ?? "");
      setNextActionAt(toLocalDateTime(deal.next_action_at));
      setNextActionChannel(deal.next_action_channel ?? "");
      setObjectionCode(deal.objection_code ?? "");
      setLossReason(deal.loss_reason ?? "");
      setRecycleAt(toLocalDateTime(deal.recycle_at));
      setConsentStatus(deal.consent_status ?? "unknown");
      setConsentSource(deal.consent_source ?? "");
      setHandoffStatus(deal.handoff_status ?? "not_started");
      setHandoffNotes(deal.handoff_notes ?? "");
    } else {
      setTitle("");
      setValue("");
      setCurrency(defaultCurrency);
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate("");
      setNotes("");
      setServiceName("");
      setUnitName("");
      setProfessionalName("");
      setSourceChannel("");
      setLeadIntent("unknown");
      setAppointmentAt("");
      setAppointmentStatus("not_scheduled");
      setForecastCategory("unclassified");
      setNextAction("");
      setNextActionAt("");
      setNextActionChannel("");
      setObjectionCode("");
      setLossReason("");
      setRecycleAt("");
      setConsentStatus("unknown");
      setConsentSource("");
      setHandoffStatus("not_started");
      setHandoffNotes("");
    }
  }, [open, deal, defaultStageId, stages, defaultCurrency]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!title.trim() || !contactId || !stageId) {
      toast.error(t('deal.toastRequired'));
      return;
    }
    if (!nextAction.trim() || !nextActionAt) {
      toast.error("Every open deal needs a specific next action and due date.");
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      value: parseFloat(value) || 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
      service_name: serviceName.trim() || null,
      unit_name: unitName.trim() || null,
      professional_name: professionalName.trim() || null,
      source_channel: sourceChannel.trim() || null,
      lead_intent: leadIntent,
      appointment_at: toIsoDateTime(appointmentAt),
      appointment_status: appointmentStatus,
      forecast_category: forecastCategory,
      next_action: nextAction.trim() || null,
      next_action_at: toIsoDateTime(nextActionAt),
      next_action_channel: nextActionChannel.trim() || null,
      objection_code: objectionCode || null,
      loss_reason: lossReason.trim() || null,
      recycle_at: toIsoDateTime(recycleAt),
      consent_status: consentStatus,
      consent_source: consentSource.trim() || null,
      consent_recorded_at: consentStatus === "granted" ? new Date().toISOString() : null,
      handoff_status: handoffStatus,
      handoff_notes: handoffNotes.trim() || null,
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", deal.id);
      if (error) {
        toast.error(t('deal.toastSaveFailed'));
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error("Not signed in");
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error("Your profile is not linked to an account.");
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, user_id: user.id, account_id: accountId, status: "open" });
      if (error) {
        toast.error(t('deal.toastCreateFailed'));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? t('deal.toastUpdated') : t('deal.toastCreated'));
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    if (status === "lost" && !lossReason.trim()) {
      toast.error("Record the loss reason before closing this deal.");
      return;
    }
    setStatusAction(status);
    const { error } = await supabase
      .from("deals")
      .update({ status, loss_reason: status === "lost" ? lossReason.trim() : null })
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error(t('deal.toastStatusFailed'));
      return;
    }
    toast.success(
      status === "won" ? t('deal.toastWon') : status === "lost" ? t('deal.toastLost') : t('deal.toastReopened'),
    );
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error(t('deal.toastDeleteFailed'));
      return;
    }
    toast.success(t('deal.toastDeleted'));
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground sm:max-w-lg w-full p-0"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/50 p-4">
            <SheetTitle className="text-popover-foreground">
              {deal ? t('deal.editTitle') : t('deal.newTitle')}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t('deal.title')}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('deal.titlePlaceholder')}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t('deal.contact')}</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">{t('deal.selectContact')}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href="/inbox"
                  className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  <MessageSquare className="h-3 w-3" />
                  {t('deal.linkConversation')}
                </Link>
              )}
            </div>

            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('deal.value')}</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="border-border bg-muted pl-7 text-foreground"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('deal.currency')}</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t('deal.expectedCloseDate')}</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t('deal.stage')}</Label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t('deal.assignedTo')}</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">{t('deal.unassigned')}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t('deal.notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('deal.notesPlaceholder')}
                className="min-h-[100px] border-border bg-muted text-foreground"
              />
            </div>

            <FormSection title="Commercial context">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Service / treatment">
                  <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Implant treatment" className="border-border bg-muted" />
                </Field>
                <Field label="Lead intent">
                  <Select value={leadIntent} onChange={(v) => setLeadIntent(v as LeadIntent)} options={[
                    ["unknown", "Not assessed"], ["low", "Low"], ["medium", "Medium"], ["high", "High"],
                  ]} />
                </Field>
                <Field label="Unit">
                  <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="Location or branch" className="border-border bg-muted" />
                </Field>
                <Field label="Professional">
                  <Input value={professionalName} onChange={(e) => setProfessionalName(e.target.value)} placeholder="Responsible professional" className="border-border bg-muted" />
                </Field>
                <Field label="Source channel">
                  <Input value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)} placeholder="Instagram, Google, referral…" className="border-border bg-muted" />
                </Field>
                <Field label="Main objection">
                  <Select value={objectionCode} onChange={setObjectionCode} options={[
                    ["", "Not identified"], ["price", "Price"], ["think", "Needs to think"], ["fear", "Fear / insecurity"], ["time", "Time"], ["competition", "Comparing options"], ["decision_maker", "Needs another decision maker"],
                  ]} />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Evaluation / appointment">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date and time"><Input type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} className="border-border bg-muted" /></Field>
                <Field label="Attendance status"><Select value={appointmentStatus} onChange={(v) => setAppointmentStatus(v as AppointmentStatus)} options={[
                  ["not_scheduled", "Not scheduled"], ["scheduled", "Scheduled"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["no_show", "No-show"], ["cancelled", "Cancelled"], ["rescheduled", "Rescheduled"],
                ]} /></Field>
              </div>
            </FormSection>

            <FormSection title="Next action and forecast">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Next action"><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Specific bilateral action" className="border-border bg-muted" /></Field>
                <Field label="Due date"><Input type="datetime-local" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} className="border-border bg-muted" /></Field>
                <Field label="Channel"><Select value={nextActionChannel} onChange={setNextActionChannel} options={[["", "Select"], ["whatsapp", "WhatsApp"], ["phone", "Phone"], ["email", "Email"], ["meeting", "Meeting"], ["internal", "Internal task"]]} /></Field>
                <Field label="Forecast"><Select value={forecastCategory} onChange={(v) => setForecastCategory(v as ForecastCategory)} options={[
                  ["unclassified", "Unclassified"], ["commit", "Commit"], ["best_case", "Best case"], ["stretch", "Stretch"],
                ]} /></Field>
                <Field label="Recycle on"><Input type="datetime-local" value={recycleAt} onChange={(e) => setRecycleAt(e.target.value)} className="border-border bg-muted" /></Field>
                <Field label="Loss reason"><Input value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="Required when lost" className="border-border bg-muted" /></Field>
              </div>
            </FormSection>

            <FormSection title="Consent and handoff">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contact consent"><Select value={consentStatus} onChange={(v) => setConsentStatus(v as ConsentStatus)} options={[
                  ["unknown", "Unknown"], ["granted", "Granted"], ["revoked", "Revoked"], ["not_required", "Not required"],
                ]} /></Field>
                <Field label="Consent source"><Input value={consentSource} onChange={(e) => setConsentSource(e.target.value)} placeholder="Form, event, referral…" className="border-border bg-muted" /></Field>
                <Field label="Handoff status"><Select value={handoffStatus} onChange={(v) => setHandoffStatus(v as HandoffStatus)} options={[
                  ["not_started", "Not started"], ["pending", "Pending"], ["complete", "Complete"], ["blocked", "Blocked"],
                ]} /></Field>
              </div>
              <Field label="Commercial handoff notes (do not include clinical records)">
                <Textarea value={handoffNotes} onChange={(e) => setHandoffNotes(e.target.value)} placeholder="Promises, preferences and agreed next steps" className="min-h-20 border-border bg-muted" />
              </Field>
            </FormSection>

            {deal && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('deal.status')}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("won")}
                    disabled={!!statusAction || deal.status === "won"}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {statusAction === "won" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        {t('deal.markWon')}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("lost")}
                    disabled={!!statusAction || deal.status === "lost"}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {statusAction === "lost" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="mr-1 h-4 w-4" />
                        {t('deal.markLost')}
                      </>
                    )}
                  </Button>
                </div>
                {deal.status && deal.status !== "open" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleStatusChange("open")}
                    disabled={!!statusAction}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    {t('deal.reopen')}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/50 bg-popover/80 p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-muted"
              >
                {t('pipelines.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !contactId || !stageId || !nextAction.trim() || !nextActionAt}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? t('deal.saving') : deal ? t('deal.saveChanges') : t('deal.create')}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">{t('deal.deleteConfirm')}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
                    >
                      {t('pipelines.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? t('deal.deleting') : t('deal.confirm')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  {t('deal.delete')}
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</h3>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label className="text-muted-foreground">{label}</Label>{children}</div>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
}
