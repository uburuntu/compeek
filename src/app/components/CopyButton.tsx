import { useState } from 'react';

interface Props {
  text: string;
  className?: string;
}

export default function CopyButton({ text, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
        copied
          ? 'bg-compeek-success/15 border-compeek-success/30 text-compeek-success'
          : 'bg-compeek-bg border-compeek-border text-compeek-text-dim hover:text-compeek-text hover:border-compeek-accent/50'
      } ${className}`}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
