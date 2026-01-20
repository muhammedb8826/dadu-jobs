"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type EvaluationPayload = {
  id?: string;
  writtenExam?: number | null;
  interview?: number | null;
  practical?: number | null;
  totalScore?: number | null;
  rank?: number | null;
  notes?: string | null;
};

interface EvaluationFormProps {
  applicationDocumentId: string;
  existingEvaluation?: EvaluationPayload | null;
}

export function EvaluationForm({ applicationDocumentId, existingEvaluation }: EvaluationFormProps) {
  const [writtenExam, setWrittenExam] = useState<string>(existingEvaluation?.writtenExam?.toString() ?? "");
  const [interview, setInterview] = useState<string>(existingEvaluation?.interview?.toString() ?? "");
  const [practical, setPractical] = useState<string>(existingEvaluation?.practical?.toString() ?? "");
  const [rank, setRank] = useState<string>(existingEvaluation?.rank?.toString() ?? "");
  const [notes, setNotes] = useState<string>(existingEvaluation?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toNumberOrNull = (value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const writtenValue = toNumberOrNull(writtenExam);
  const interviewValue = toNumberOrNull(interview);
  const practicalValue = toNumberOrNull(practical);
  const totalScoreValue =
    writtenValue === null || interviewValue === null || practicalValue === null
      ? null
      : writtenValue + interviewValue + practicalValue;

  const handleSubmit = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      applicationDocumentId,
      writtenExam: toNumberOrNull(writtenExam),
      interview: toNumberOrNull(interview),
      practical: toNumberOrNull(practical),
      totalScore: totalScoreValue,
      rank: toNumberOrNull(rank),
      notes: notes.trim() ? notes.trim() : null,
    };

    try {
      const response = await fetch(`/api/evaluations${existingEvaluation?.id ? `?id=${existingEvaluation.id}` : ""}`, {
        method: existingEvaluation?.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: payload }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || result?.message || "Failed to save evaluation");
      }

      setSuccessMessage("Evaluation saved successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save evaluation");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-sm text-muted-foreground">Written Exam</label>
            <Input value={writtenExam} onChange={(e) => setWrittenExam(e.target.value)} type="number" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Interview</label>
            <Input value={interview} onChange={(e) => setInterview(e.target.value)} type="number" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Practical</label>
            <Input value={practical} onChange={(e) => setPractical(e.target.value)} type="number" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Total Score</label>
            <Input value={totalScoreValue === null ? "" : totalScoreValue.toString()} readOnly />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Rank</label>
            <Input value={rank} onChange={(e) => setRank(e.target.value)} type="number" />
          </div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Notes</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
        </div>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Evaluation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
