export default function Slide8Closing() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex items-center justify-center"
      style={{ background: "#1D6962" }}
    >
      {/* Top gold accent */}
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#D29A22" }} />

      {/* Background radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(42,143,136,0.5) 0%, transparent 80%)",
        }}
      />

      {/* Subtle bottom circle decoration */}
      <div
        className="absolute"
        style={{
          bottom: "-18vh",
          right: "-10vw",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          border: "1px solid rgba(210,154,34,0.15)",
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: "-25vh",
          right: "-15vw",
          width: "58vw",
          height: "58vw",
          borderRadius: "50%",
          border: "1px solid rgba(247,243,235,0.06)",
        }}
      />

      {/* Centred content */}
      <div className="relative text-center" style={{ maxWidth: "70vw" }}>
        <p
          className="uppercase tracking-widest mb-[4vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            fontSize: "1.1vw",
            color: "#D29A22",
            letterSpacing: "0.25em",
          }}
        >
          Available on iOS · AU &amp; UK
        </p>

        <h2
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 900,
            fontSize: "7.5vw",
            color: "#F7F3EB",
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
          }}
        >
          sort<span style={{ color: "#D29A22" }}>ii</span>.
        </h2>

        <p
          className="mt-[3vh]"
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 400,
            fontStyle: "italic",
            fontSize: "3vw",
            color: "rgba(247,243,235,0.8)",
            lineHeight: 1.3,
          }}
        >
          Dinner… sorted.
        </p>

        <div
          className="mx-auto mt-[4vh]"
          style={{
            width: "6vw",
            height: "0.3vh",
            background: "#D29A22",
            borderRadius: "2px",
          }}
        />

        <p
          className="mt-[3.5vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 400,
            fontSize: "1.7vw",
            color: "rgba(247,243,235,0.55)",
            lineHeight: 1.6,
          }}
        >
          Where life gets lighter, one small untangling at a time.
        </p>
      </div>
    </div>
  );
}
