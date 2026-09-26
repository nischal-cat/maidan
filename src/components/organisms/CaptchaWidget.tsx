import { useState, useEffect } from 'react';
import { Button } from '../ui/button';

interface CaptchaWidgetProps {
  onVerify: (verified: boolean) => void;
}

const OPERATORS = ['+', '-', 'x'];
const getMathProblem = () => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const op = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
  let answer: number;
  switch (op) {
    case '+': answer = a + b; break;
    case '-': answer = a - b; break;
    case 'x': answer = a * b; break;
    default: answer = a + b;
  }
  return { a, b, op, answer };
};

export default function CaptchaWidget({ onVerify }: CaptchaWidgetProps) {
  const [problem, setProblem] = useState(getMathProblem);
  const [userAnswer, setUserAnswer] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setProblem(getMathProblem());
  }, []);

  const handleVerify = () => {
    const num = parseInt(userAnswer, 10);
    if (isNaN(num) || num !== problem.answer) {
      setError('Incorrect answer, try again.');
      setProblem(getMathProblem());
      setUserAnswer('');
      onVerify(false);
    } else {
      setVerified(true);
      setError('');
      onVerify(true);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3">
        <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-bold text-primary">Verified</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <p className="mb-2 text-sm font-semibold text-muted-foreground">Solve to confirm you are human:</p>
      <div className="flex items-center gap-3">
        <span className="rounded-xl border border-border bg-card px-3 py-1.5 text-lg font-extrabold text-foreground">
          {problem.a} {problem.op} {problem.b} = ?
        </span>
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => { setUserAnswer(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          placeholder="?"
          className="w-20 rounded-xl border border-input bg-background px-3 py-2 text-center text-sm text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={handleVerify} size="sm">
          Check
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
