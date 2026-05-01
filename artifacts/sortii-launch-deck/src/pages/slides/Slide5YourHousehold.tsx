export default function Slide5YourHousehold() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: "#F7F3EB" }}
    >
      {/* Top-right decorative circle */}
      <div
        className="absolute"
        style={{
          top: "-8vh",
          right: "-6vw",
          width: "38vw",
          height: "38vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(42,143,136,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Left accent */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: "0.5vw", background: "linear-gradient(to bottom, #D29A22, #2A8F88)" }}
      />

      {/* Top label */}
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
        Built around you
      </p>

      {/* Headline */}
      <div className="absolute left-[8vw] right-[8vw] top-[17vh]">
        <h2
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 700,
            fontSize: "4.4vw",
            color: "#2B2B2B",
            lineHeight: 1.15,
            textWrap: "balance",
          }}
        >
          Your household.
          <br />
          <span style={{ fontStyle: "italic", color: "#2A8F88" }}>
            Your rules.
          </span>
        </h2>

        <p
          className="mt-[2.5vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 400,
            fontSize: "1.7vw",
            color: "#5a534a",
            lineHeight: 1.65,
            maxWidth: "48vw",
            textWrap: "pretty",
          }}
        >
          Tell Sortii who you're feeding and what you're working with.
          It does the rest — no browsing, no decision fatigue.
        </p>
      </div>

      {/* Four settings chips */}
      <div
        className="absolute left-[8vw] right-[8vw]"
        style={{ bottom: "8vh", display: "flex", gap: "1.8vw" }}
      >
        <div
          style={{
            background: "#fff",
            border: "1.5px solid #EDE9E1",
            borderRadius: "1vw",
            padding: "2.8vh 2.2vw",
            flex: 1,
            borderBottom: "3px solid #2A8F88",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.2vw",
              color: "#2A8F88",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: "1vh",
            }}
          >
            Household size
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 400,
              fontSize: "1.7vw",
              color: "#2B2B2B",
              lineHeight: 1.3,
            }}
          >
            2 adults · 2 kids. Or just you. It adjusts.
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1.5px solid #EDE9E1",
            borderRadius: "1vw",
            padding: "2.8vh 2.2vw",
            flex: 1,
            borderBottom: "3px solid #D29A22",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.2vw",
              color: "#D29A22",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: "1vh",
            }}
          >
            Budget range
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 400,
              fontSize: "1.7vw",
              color: "#2B2B2B",
              lineHeight: 1.3,
            }}
          >
            Lean week or generous week — Sortii plans accordingly.
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1.5px solid #EDE9E1",
            borderRadius: "1vw",
            padding: "2.8vh 2.2vw",
            flex: 1,
            borderBottom: "3px solid #5E3A4C",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.2vw",
              color: "#5E3A4C",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: "1vh",
            }}
          >
            Dietary needs
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 400,
              fontSize: "1.7vw",
              color: "#2B2B2B",
              lineHeight: 1.3,
            }}
          >
            Kid-friendly, gluten-free, vegetarian — baked in, not bolted on.
          </p>
        </div>
      </div>
    </div>
  );
}
