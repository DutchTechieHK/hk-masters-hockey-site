import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateStaffMatch,
  useUpdateStaffMatch,
  useCreateStaffEvent,
  useUpdateStaffEvent,
  getGetStaffTeamQueryKey,
  CreateMatchStatus,
  ClubEventInputKind,
  type Match,
  type ClubEvent,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { errorStatus, explainError, hkInputToIso, isoToHkInput } from "@/lib/staff-utils";

type CommonProps = {
  teamId: number;
  teamName: string;
  open: boolean;
  onClose: () => void;
  onAccessError: (err: unknown) => void;
};

const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", in_progress: "In progress", final: "Final", cancelled: "Cancelled" };
const KIND_LABEL: Record<string, string> = {
  training: "Training", meeting: "Meeting", social: "Social", physio: "Physio", team_dinner: "Team dinner",
  dinner: "Dinner", free_time: "Free time", warmup: "Warm-up", game: "Game",
};

export function MatchDialog({ teamId, teamName, open, onClose, onAccessError, match }: CommonProps & { match: Match | null }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {open && <MatchForm key={match?.id ?? "new"} teamId={teamId} teamName={teamName} match={match} onClose={onClose} onAccessError={onAccessError} />}
      </DialogContent>
    </Dialog>
  );
}

function MatchForm({ teamId, teamName, match, onClose, onAccessError }: { teamId: number; teamName: string; match: Match | null; onClose: () => void; onAccessError: (err: unknown) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useCreateStaffMatch();
  const update = useUpdateStaffMatch();
  const [opponent, setOpponent] = useState(match?.opponent ?? "");
  const [kickoff, setKickoff] = useState(isoToHkInput(match?.kickoffAt));
  const [venue, setVenue] = useState(match?.venue ?? "");
  const [status, setStatus] = useState<string>(match?.status ?? "scheduled");
  const [ourScore, setOurScore] = useState(match?.ourScore != null ? String(match.ourScore) : "");
  const [theirScore, setTheirScore] = useState(match?.theirScore != null ? String(match.theirScore) : "");
  const [notes, setNotes] = useState(match?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    const kickoffAt = hkInputToIso(kickoff);
    if (!opponent.trim()) return setError("Opponent is required.");
    if (!kickoffAt) return setError("Pick a kick-off date and time.");
    const scoreOk = (v: string) => v === "" || (/^\d+$/.test(v) && Number(v) <= 99);
    if (!scoreOk(ourScore) || !scoreOk(theirScore)) return setError("Scores must be whole numbers.");
    setError(null);
    const data = {
      teamId,
      opponent: opponent.trim(),
      kickoffAt,
      venue: venue.trim(),
      status: status as CreateMatchStatus,
      ourScore: ourScore === "" ? null : Number(ourScore),
      theirScore: theirScore === "" ? null : Number(theirScore),
      notes: notes.trim(),
    };
    const handlers = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStaffTeamQueryKey(teamId) });
        toast({ title: match ? "Match updated" : "Match added" });
        onClose();
      },
      onError: (err: unknown) => {
        setError(explainError(err));
        const s = errorStatus(err);
        if (s === 401 || s === 403) onAccessError(err);
      },
    };
    if (match) update.mutate({ teamId, id: match.id, data }, handlers);
    else create.mutate({ teamId, data }, handlers);
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-staff-match">
      <DialogHeader>
        <DialogTitle className="font-display">{match ? "Edit match" : "Add match"}</DialogTitle>
        <DialogDescription>For {teamName}. Times are Hong Kong time.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="m-opp">Opponent</Label>
        <Input id="m-opp" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="e.g. Valley Masters" data-testid="input-match-opponent" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="m-ko">Push-back (HKT)</Label>
          <Input id="m-ko" type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} data-testid="input-match-kickoff" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="select-match-status">
              {Object.values(CreateMatchStatus).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-venue">Venue</Label>
        <Input id="m-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. King's Park Hockey Ground" data-testid="input-match-venue" />
      </div>
      {(status === "final" || status === "in_progress") && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-us">Our score</Label>
            <Input id="m-us" inputMode="numeric" value={ourScore} onChange={(e) => setOurScore(e.target.value)} className="font-mono" data-testid="input-match-our-score" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-them">Their score</Label>
            <Input id="m-them" inputMode="numeric" value={theirScore} onChange={(e) => setTheirScore(e.target.value)} className="font-mono" data-testid="input-match-their-score" />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="m-notes">Notes</Label>
        <Textarea id="m-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-match-notes" />
      </div>
      {error && <p className="text-xs text-destructive" data-testid="text-match-error">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending} data-testid="button-save-match">{pending ? "Saving…" : match ? "Save match" : "Add match"}</Button>
      </DialogFooter>
    </form>
  );
}

export function EventDialog({ teamId, teamName, open, onClose, onAccessError, event }: CommonProps & { event: ClubEvent | null }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {open && <EventForm key={event?.id ?? "new"} teamId={teamId} teamName={teamName} event={event} onClose={onClose} onAccessError={onAccessError} />}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({ teamId, teamName, event, onClose, onAccessError }: { teamId: number; teamName: string; event: ClubEvent | null; onClose: () => void; onAccessError: (err: unknown) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useCreateStaffEvent();
  const update = useUpdateStaffEvent();
  const [kind, setKind] = useState<string>(event?.kind ?? "training");
  const [title, setTitle] = useState(event?.title ?? "");
  const [startsAt, setStartsAt] = useState(isoToHkInput(event?.startsAt));
  const [endsAt, setEndsAt] = useState(isoToHkInput(event?.endsAt ?? null));
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    const start = hkInputToIso(startsAt);
    const end = endsAt ? hkInputToIso(endsAt) : null;
    if (!title.trim()) return setError("Title is required.");
    if (!start) return setError("Pick a start date and time.");
    if (end && Date.parse(end) <= Date.parse(start)) return setError("End must be after the start.");
    setError(null);
    const data = {
      kind: kind as ClubEventInputKind,
      title: title.trim(),
      startsAt: start,
      endsAt: end,
      location: location.trim() || null,
      description: description.trim() || null,
      teamId,
      audienceMode: "squad" as const,
      groupIds: [],
      isPublic: false,
      sendNotify: false,
    };
    const handlers = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStaffTeamQueryKey(teamId) });
        toast({ title: event ? "Event updated" : "Event added" });
        onClose();
      },
      onError: (err: unknown) => {
        setError(explainError(err));
        const s = errorStatus(err);
        if (s === 401 || s === 403) onAccessError(err);
      },
    };
    if (event) update.mutate({ teamId, id: event.id, data }, handlers);
    else create.mutate({ teamId, data }, handlers);
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-staff-event">
      <DialogHeader>
        <DialogTitle className="font-display">{event ? "Edit team event" : "Add team event"}</DialogTitle>
        <DialogDescription>Private to the {teamName} squad. No notifications are sent from here.</DialogDescription>
      </DialogHeader>
      <div className="grid sm:grid-cols-[140px_1fr] gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} data-testid="select-event-kind">
              {Object.values(ClubEventInputKind).map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>)}
            
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-title">Title</Label>
          <Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tuesday short-corner session" data-testid="input-event-title" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="e-start">Starts (HKT)</Label>
          <Input id="e-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} data-testid="input-event-start" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-end">Ends (HKT, optional)</Label>
          <Input id="e-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} data-testid="input-event-end" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-loc">Location</Label>
        <Input id="e-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Happy Valley Pitch 5" data-testid="input-event-location" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-desc">Details</Label>
        <Textarea id="e-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-event-description" />
      </div>
      {error && <p className="text-xs text-destructive" data-testid="text-event-error">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending} data-testid="button-save-event">{pending ? "Saving…" : event ? "Save event" : "Add event"}</Button>
      </DialogFooter>
    </form>
  );
}
