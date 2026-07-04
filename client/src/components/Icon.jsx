// Line-art icon set for the Graspr design. Stroke icons inherit currentColor.
// Usage: <Icon name="spark" size={18} />
export default function Icon({ name, size = 18, stroke = 1.6, className, style }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    style,
  };
  const paths = {
    book: (<><path d="M4 5.5A2 2 0 0 1 6 3.5h13v15H6a2 2 0 0 0-2 2z" /><path d="M19 18.5H6a2 2 0 0 0-2 2" /></>),
    pencil: (<><path d="M16.5 4.5l3 3L8 19l-4 1 1-4z" /><path d="M14 7l3 3" /></>),
    spark: (<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></>),
    check: <path d="M5 12.5l4.5 4.5L19 7" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    arrowR: (<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>),
    clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
    eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></>),
    eyeOff: (<><path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6M6.2 7.4A16 16 0 0 0 2.5 12S6 18 12 18a9.4 9.4 0 0 0 3.1-.5" /><path d="M9.8 9.9a2.6 2.6 0 0 0 3.7 3.7" /></>),
    flag: (<><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>),
    chevD: <path d="M6 9l6 6 6-6" />,
    chevU: <path d="M6 15l6-6 6 6" />,
    target: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></>),
    link: (<><path d="M9 15l6-6" /><path d="M11 6l1-1a4 4 0 0 1 6 6l-2 2" /><path d="M13 18l-1 1a4 4 0 0 1-6-6l2-2" /></>),
    send: (<><path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" /><path d="M10 13.5L21 3" /></>),
    flame: (<><path d="M12 3c1 3-1.5 4.5-1.5 7A1.5 1.5 0 0 0 12 11c1-1 1-2.5 1-2.5 1.5 1 3 3 3 6a4 4 0 0 1-8 0c0-2 1-3.5 1.5-4.5C7 11 6 12.5 6 14.5A6 6 0 0 0 18 14c0-5-4-8-6-11z" /></>),
    retry: (<><path d="M3 12a9 9 0 1 1 3 6.7" /><path d="M3 12V7M3 12h5" /></>),
    google: (
      <g stroke="none">
        <path fill="#4285F4" d="M21.6 12.2c0-.6-.05-1.2-.15-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1z" />
        <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
        <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.2 1.1 4.6L6.4 14z" />
        <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 12 2 10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.6 9.4 5.9 12 5.9z" />
      </g>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}
