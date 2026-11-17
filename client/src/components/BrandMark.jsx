const BrandMark = ({ className = 'brand-mark' }) => (
  <span className={className} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" focusable="false">
      <path
        d="M9 39h30M12 37V20l12-9 12 9v17"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 37V27a6 6 0 0 1 12 0v10M16 23h3m10 0h3"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export default BrandMark;
