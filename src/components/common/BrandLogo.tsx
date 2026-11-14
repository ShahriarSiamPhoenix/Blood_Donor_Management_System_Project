export function BrandLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Blood drop silhouette */}
      <path
        d="M20 3.5C20 3.5 8.5 16.2 8.5 24.5C8.5 31.1 13.65 36.5 20 36.5C26.35 36.5 31.5 31.1 31.5 24.5C31.5 16.2 20 3.5 20 3.5Z"
        fill="#C62828"
      />
      {/* Heart integrated inside blood drop */}
      <path
        d="M20 29.8L19.05 28.94C15.68 25.88 13.45 23.86 13.45 21.38C13.45 19.36 15.04 17.78 17.05 17.78C18.19 17.78 19.28 18.31 20 19.14C20.72 18.31 21.81 17.78 22.95 17.78C24.96 17.78 26.55 19.36 26.55 21.38C26.55 23.86 24.32 25.88 20.95 28.95L20 29.8Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
