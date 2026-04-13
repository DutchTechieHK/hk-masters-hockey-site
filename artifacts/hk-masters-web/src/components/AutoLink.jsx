export default function AutoLink({ text, className }) {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#006B3C] underline hover:text-green-800 break-all"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </span>
  );
}
