import React from "react";
import MatchAttendanceSummary from "./MatchAttendanceSummary";

// Missing sessions may have started or changed audience since the schedule loaded.
// Never fall back to schedule counts while the private snapshot is unavailable.
export default function TrainingAttendanceSummary({ attendance, loading, error, onRefresh }) {
  return (
    <MatchAttendanceSummary
      kind="training"
      attendance={attendance}
      loading={loading}
      error={error || (!loading && !attendance ? "Training attendance is unavailable for this session." : "")}
      onRefresh={onRefresh}
    />
  );
}
