import { useEffect, useRef, useState } from "react";
import { getMatchLineup, getStaffTeam, listMatches } from "@workspace/api-client-react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { publishedImageSource, renderLineupImage, lineupImageFilename } from "@/lib/lineup-image";
import { explainError } from "@/lib/staff-utils";

export function PublishedLineupDownload({ teamId, matchId, isStaff, hasPublished, disabled }: {
  teamId: number; matchId: number; isStaff: boolean; hasPublished: boolean; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<{ url: string; filename: string } | null>(null);
  const sequence = useRef(0);
  useEffect(() => () => { ++sequence.current; }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  async function prepare() {
    const mine = ++sequence.current;
    setBusy(true); setError(""); setImage(null);
    try {
      // Both reads recheck current team/season access. Never export cached board or local editor state.
      const [workspace, matches] = await Promise.all([
        getMatchLineup(teamId, matchId, { cache: "no-store" }),
        isStaff
          ? getStaffTeam(teamId, { cache: "no-store" }).then((team) => team.matches)
          : listMatches({ teamId, scope: "local_2026_27" }, { cache: "no-store" }),
      ]);
      const source = publishedImageSource(workspace);
      const match = matches.find((m) => m.id === matchId && m.teamId === teamId);
      if (!match) throw new Error("This match is no longer available for this team.");
      const blob = await renderLineupImage(source, `${match.teamName ?? "HK Masters"} vs ${match.opponent}`, match.kickoffAt);
      if (mine !== sequence.current) return;
      setImage({ url: URL.createObjectURL(blob), filename: lineupImageFilename(matchId, source.publishedAt) });
    } catch (err) {
      if (mine === sequence.current) setError(explainError(err, "Could not prepare the published image."));
    } finally {
      if (mine === sequence.current) setBusy(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-border bg-white p-3">
      <Button variant="outline" className="min-h-11" onClick={() => void prepare()}
        disabled={!hasPublished || disabled || busy} data-testid="button-export-published">
        <Download className="mr-2 h-4 w-4" />{busy ? "Preparing image…" : "Download published lineup"}
      </Button>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {hasPublished ? "Exports the last published snapshot only, not your private draft. Nothing is sent automatically." : "Publish a lineup first to download its image."}
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <Dialog open={!!image} onOpenChange={(open) => { if (!open) setImage(null); }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Published lineup image</DialogTitle>
            <DialogDescription>Save this PNG for your team chat. On iPhone or if downloading isn't supported, touch and hold the image and choose Save Image or Save to Photos.</DialogDescription>
          </DialogHeader>
          {image && <>
            <a href={image.url} download={image.filename} className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground" data-testid="link-download-lineup">Download PNG</a>
            <img src={image.url} alt="Published match lineup with publication time, shirt numbers and provisional Maybe labels" className="h-auto w-full rounded-lg" data-testid="image-published-lineup" />
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
