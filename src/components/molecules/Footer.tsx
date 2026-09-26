import { Link } from 'react-router-dom';
import { BrandLockup } from '../ui/brand';

export default function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <Link to="/" className="text-foreground" aria-label="Maidan home">
          <BrandLockup />
        </Link>
        <p className="text-sm text-muted-foreground">Play more. Search less.</p>
      </div>
    </footer>
  );
}
