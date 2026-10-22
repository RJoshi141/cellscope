import type { PackState } from "../format";

const Icon = ({ tone, label }: PackState) => {
  if (tone === "good")
    return (
      <svg width="9" height="12" viewBox="0 0 9 12" aria-hidden><path d="M5.6 0 0 7h3.6L2.8 12 9 4.8H5.2z" fill="currentColor" /></svg>
    );
  if (tone === "warning" || tone === "critical")
    return (
      <svg width="12" height="11" viewBox="0 0 12 11" aria-hidden>
        <path d="M6 .5 11.6 10.4H.4z" fill="currentColor" />
        <rect x="5.35" y="3.8" width="1.3" height="3.6" rx=".6" fill="#fff" />
        <circle cx="6" cy="8.8" r=".75" fill="#fff" />
      </svg>
    );
  return label === "Waiting" ? null : (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden><circle cx="4" cy="4" r="3" fill="currentColor" opacity=".55" /></svg>
  );
};

export function StatusPill(state: PackState) {
  return (
    <span className="pill" data-tone={state.tone}>
      <Icon {...state} />
      {state.label}
    </span>
  );
}
