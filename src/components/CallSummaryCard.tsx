import { CheckCircle, Clock, Phone, XCircle } from "lucide-react";

export type QualificationStatus = "pending" | "in_progress" | "complete" | "failed";

interface CallSummaryProps {
  qualificationStatus: QualificationStatus;
  budgetMin?: number | null;
  budgetMax?: number | null;
  locations?: string[] | null;
  timeline?: string | null;
  propertyType?: string | null;
  sentiment?: string | null;
  completedAt?: string | null;
}

const sentimentColor: Record<string, string> = {
  positive: "text-green-600",
  neutral: "text-yellow-600",
  negative: "text-red-600",
};

function formatBudget(min?: number | null, max?: number | null) {
  if (!min && !max) {
    return null;
  }

  const formatValue = (value: number) => `INR ${(value / 100000).toFixed(0)}L`;

  if (min && max) {
    return `${formatValue(min)} to ${formatValue(max)}`;
  }

  if (max) {
    return `Up to ${formatValue(max)}`;
  }

  return `From ${formatValue(min ?? 0)}`;
}

export function CallSummaryCard({
  qualificationStatus,
  budgetMin,
  budgetMax,
  locations,
  timeline,
  propertyType,
  sentiment,
  completedAt,
}: CallSummaryProps) {
  if (qualificationStatus === "pending") {
    return null;
  }

  const icon =
    qualificationStatus === "complete" ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : qualificationStatus === "failed" ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <Clock className="h-4 w-4 text-yellow-500" />
    );
  const budget = formatBudget(budgetMin, budgetMax);

  return (
    <div className="rounded-xl border border-[#e6eae5] bg-white p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <Phone className="h-4 w-4 text-[#6f7d77]" />
        <span className="text-[#31423b]">AI Qualification Call</span>
        {icon}
        {completedAt ? <span className="ml-auto text-xs text-[#87938e]">{new Date(completedAt).toLocaleString("en-IN")}</span> : null}
      </div>

      {qualificationStatus === "complete" ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {budget ? (
            <>
              <dt className="text-[#87938e]">Budget</dt>
              <dd className="text-[#46554f]">{budget}</dd>
            </>
          ) : null}
          {locations?.length ? (
            <>
              <dt className="text-[#87938e]">Locations</dt>
              <dd className="text-[#46554f]">{locations.join(", ")}</dd>
            </>
          ) : null}
          {timeline ? (
            <>
              <dt className="text-[#87938e]">Timeline</dt>
              <dd className="text-[#46554f]">{timeline}</dd>
            </>
          ) : null}
          {propertyType ? (
            <>
              <dt className="text-[#87938e]">Property type</dt>
              <dd className="text-[#46554f]">{propertyType}</dd>
            </>
          ) : null}
          {sentiment ? (
            <>
              <dt className="text-[#87938e]">Sentiment</dt>
              <dd className={sentimentColor[sentiment] ?? ""}>{sentiment}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {qualificationStatus === "failed" ? <p className="text-xs text-[#87938e]">Call could not be completed.</p> : null}
    </div>
  );
}
