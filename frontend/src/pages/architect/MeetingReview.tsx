import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, StatusBadge, SectionHeading } from "../../components/ui";

interface ActionItem {
  id: string;
  description: string;
  suggested_assignee_name: string | null;
  assignee_user_id: string | null;
  assignee_name_resolved: string | null;
  due_date: string | null;
  confidence_score: number | null;
  status: string;
}

interface MeetingDetail {
  id: string;
  meeting_date: string;
  mom_status: string;
  transcript: string | null;
  mom_document: string | null;
  action_items: ActionItem[];
}

export default function MeetingReview() {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  function load() {
    if (!meetingId) return;
    api.get<MeetingDetail>(`/meetings/${meetingId}`).then((res) => setMeeting(res.data));
  }

  useEffect(() => {
    load();
    // Poll while still processing, since transcription/drafting runs in the background
    const interval = setInterval(() => {
      if (meeting?.mom_status === "processing") load();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, meeting?.mom_status]);

  async function handlePublish() {
    if (!meetingId) return;
    setPublishing(true);
    try {
      const { data } = await api.post(`/meetings/${meetingId}/publish`);
      setPublishResult(
        `Published. ${data.tasks_created} task(s) created and assigned.` +
          (data.unassigned_action_items > 0
            ? ` ${data.unassigned_action_items} item(s) still need an assignee before they become tasks.`
            : "")
      );
      load();
    } finally {
      setPublishing(false);
    }
  }

  if (!meeting) return <p className="text-line text-sm">Loading…</p>;

  return (
    <div>
      <SectionHeading eyebrow="MOM · Review" title="Minutes of meeting" />

      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={meeting.mom_status} />
        <span className="font-mono text-xs text-line">{new Date(meeting.meeting_date).toLocaleString()}</span>
      </div>

      {meeting.mom_status === "processing" && (
        <Card className="text-center py-10">
          <p className="text-ink/70 text-sm">Transcribing and drafting the MOM — this can take a minute for longer recordings.</p>
        </Card>
      )}

      {meeting.mom_status !== "processing" && (
        <>
          <Card className="mb-6">
            <p className="font-mono text-xs text-line uppercase tracking-wide mb-3">Action items</p>
            <p className="text-ink/60 text-xs mb-4">
              Review each item before publishing. Items the system couldn't confidently match to a project
              member need a manual assignee — nothing is sent to anyone's task list until you publish.
            </p>

            <div className="space-y-3">
              {meeting.action_items.map((item) => (
                <div key={item.id} className="border border-line/15 rounded-md p-3.5">
                  <p className="text-sm text-ink mb-2">{item.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <StatusBadge status={item.status} />
                    <span className="font-mono text-line">
                      {item.assignee_name_resolved ? (
                        <>Assigned → {item.assignee_name_resolved}</>
                      ) : (
                        <>Heard: "{item.suggested_assignee_name ?? "unclear"}" — needs manual assignment</>
                      )}
                    </span>
                    {item.due_date && <span className="font-mono text-line">Due {item.due_date}</span>}
                    {item.confidence_score !== null && (
                      <span className="font-mono text-line/60">match {Math.round(item.confidence_score * 100)}%</span>
                    )}
                  </div>
                </div>
              ))}
              {meeting.action_items.length === 0 && (
                <p className="text-ink/50 text-sm">No action items were extracted from this meeting.</p>
              )}
            </div>
          </Card>

          {meeting.mom_status === "pending_review" && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="bg-blueprint hover:bg-blueprint-light text-white font-medium text-sm px-5 py-2.5 rounded-md transition-colors disabled:opacity-60"
            >
              {publishing ? "Publishing…" : "Publish & assign tasks"}
            </button>
          )}
          {publishResult && <p className="text-site-green text-sm mt-3">{publishResult}</p>}
        </>
      )}
    </div>
  );
}
