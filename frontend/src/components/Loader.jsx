export default function Loader({ text = "Processing AI prediction..." }) {
  return (
    <div className="loader-row">
      <span className="loader" />
      <span>{text}</span>
    </div>
  );
}
