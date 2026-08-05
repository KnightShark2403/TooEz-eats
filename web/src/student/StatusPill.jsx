export default function StatusPill({ status }) {
  return (
    <span className="status-pill" data-status={status}>
      {status}
    </span>
  );
}
