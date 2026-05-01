const base = import.meta.env.BASE_URL;

export default function Slide1Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#1D6962" }}>
      {/* Hero image */}
      <img
        src={`${base}hero-kitchen.png`}
        crossOrigin="anonymous"
        alt="Warm kitchen scene"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.22 }}
      />

      {/* Gradient overlay — bottom heavy so text at bottom reads */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(29,105,98,0.3) 0%, rgba(29,105,98,0.85) 55%, rgba(29,105,98,0.97) 100%)" }}
      />

      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#D29A22" }} />

      {/* Content — left aligned, bottom third */}
      <div className="absolute left-[8vw] right-[30vw] bottom-[10vh]">
        <p
          className="uppercase tracking-[0.25em] mb-[2.5vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            fontSize: "1.1vw",
            color: "#D29A22",
            letterSpacing: "0.22em",
          }}
        >
          Introducing
        </p>

        <h1
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 900,
            fontSize: "8vw",
            color: "#F7F3EB",
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            textWrap: "balance",
          }}
        >
          sort<span style={{ color: "#D29A22" }}>ii</span>.
        </h1>

        <p
          className="mt-[2.5vh]"
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 400,
            fontStyle: "italic",
            fontSize: "2.6vw",
            color: "rgba(247,243,235,0.85)",
            lineHeight: 1.3,
          }}
        >
          Your Week, Sorted.
        </p>

        <div
          className="mt-[3.5vh]"
          style={{
            width: "4vw",
            height: "0.3vh",
            background: "#D29A22",
            borderRadius: "2px",
          }}
        />

        <p
          className="mt-[2vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 400,
            fontSize: "1.6vw",
            color: "rgba(247,243,235,0.65)",
            lineHeight: 1.5,
          }}
        >
          The calm weekly view for real households.<br />
          <span style={{ color: "rgba(247,243,235,0.45)", fontSize: "1.4vw" }}>AU &amp; UK · iOS</span>
        </p>
      </div>

      {/* Bottom-right: subtle tagline */}
      <p
        className="absolute bottom-[4.5vh] right-[6vw]"
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 300,
          fontSize: "1.3vw",
          color: "rgba(247,243,235,0.3)",
          letterSpacing: "0.08em",
        }}
      >
        Stop feeling ambushed by your own week.
      </p>
    </div>
  );
}
