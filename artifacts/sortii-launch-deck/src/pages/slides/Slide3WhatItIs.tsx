export default function Slide3WhatItIs() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: "#1D6962" }}
    >
      {/* Subtle radial glow — top right */}
      <div
        className="absolute"
        style={{
          top: "-15vh",
          right: "-10vw",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(42,143,136,0.35) 0%, transparent 70%)",
        }}
      />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#D29A22" }} />

      {/* Label */}
      <p
        className="absolute uppercase tracking-widest"
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 600,
          fontSize: "1.1vw",
          color: "#D29A22",
          letterSpacing: "0.22em",
          top: "8vh",
          left: "8vw",
        }}
      >
        What Sortii is
      </p>

      {/* Main headline */}
      <div className="absolute left-[8vw] right-[8vw] top-[17vh]">
        <h2
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 900,
            fontSize: "5.5vw",
            color: "#F7F3EB",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            textWrap: "balance",
          }}
        >
          A calm weekly view
          <br />
          <span style={{ fontStyle: "italic", color: "rgba(247,243,235,0.65)" }}>
            for the moving parts of life.
          </span>
        </h2>

        <div
          className="mt-[3.5vh]"
          style={{
            width: "5vw",
            height: "0.3vh",
            background: "#D29A22",
            borderRadius: "2px",
          }}
        />
      </div>

      {/* Four pillars — bottom half */}
      <div
        className="absolute left-[8vw] right-[8vw] grid gap-[2vw]"
        style={{
          bottom: "7vh",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
        }}
      >
        <div style={{ paddingTop: "2.5vh", borderTop: "2px solid rgba(247,243,235,0.15)" }}>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#F7F3EB",
              marginBottom: "1vh",
              lineHeight: 1.2,
            }}
          >
            Meals
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "rgba(247,243,235,0.6)",
              lineHeight: 1.5,
            }}
          >
            A full week of dinners, planned before the chaos starts.
          </p>
        </div>

        <div style={{ paddingTop: "2.5vh", borderTop: "2px solid rgba(210,154,34,0.4)" }}>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#F7F3EB",
              marginBottom: "1vh",
              lineHeight: 1.2,
            }}
          >
            Budget
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "rgba(247,243,235,0.6)",
              lineHeight: 1.5,
            }}
          >
            Plans built around your household budget, not against it.
          </p>
        </div>

        <div style={{ paddingTop: "2.5vh", borderTop: "2px solid rgba(94,58,76,0.6)" }}>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#F7F3EB",
              marginBottom: "1vh",
              lineHeight: 1.2,
            }}
          >
            Logistics
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "rgba(247,243,235,0.6)",
              lineHeight: 1.5,
            }}
          >
            Kids, appointments, bills — visible, not buried in five apps.
          </p>
        </div>

        <div style={{ paddingTop: "2.5vh", borderTop: "2px solid rgba(42,143,136,0.6)" }}>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#F7F3EB",
              marginBottom: "1vh",
              lineHeight: 1.2,
            }}
          >
            Relief
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "rgba(247,243,235,0.6)",
              lineHeight: 1.5,
            }}
          >
            Not productivity. Not a scoreboard. A soft landing.
          </p>
        </div>
      </div>
    </div>
  );
}
