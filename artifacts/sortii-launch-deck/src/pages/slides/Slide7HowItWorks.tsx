export default function Slide7HowItWorks() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: "#F7F3EB" }}
    >
      {/* Left accent */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: "0.5vw", background: "linear-gradient(to bottom, #2A8F88, #D29A22)" }}
      />

      {/* Top: label + headline */}
      <div className="absolute left-[8vw] right-[8vw] top-[8vh]">
        <p
          className="uppercase tracking-widest mb-[2vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            fontSize: "1.1vw",
            color: "#2A8F88",
            letterSpacing: "0.2em",
          }}
        >
          The habit
        </p>

        <h2
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 700,
            fontSize: "4.2vw",
            color: "#2B2B2B",
            lineHeight: 1.15,
          }}
        >
          Open. Glance. Close.
          <br />
          <span style={{ fontStyle: "italic", color: "#7a7167", fontWeight: 400, fontSize: "3vw" }}>
            That's the whole thing.
          </span>
        </h2>
      </div>

      {/* Four-step flow — horizontal */}
      <div
        className="absolute left-[8vw] right-[8vw]"
        style={{
          bottom: "7vh",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "2vw",
        }}
      >
        {/* Step 1 */}
        <div>
          <div
            style={{
              width: "4vw",
              height: "4vw",
              borderRadius: "50%",
              background: "#2A8F88",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "2vh",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontWeight: 700,
                fontSize: "1.9vw",
                color: "#F7F3EB",
              }}
            >
              1
            </span>
          </div>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.2vw",
              color: "#2A8F88",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.8vh",
            }}
          >
            Sun / Mon
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#2B2B2B",
              marginBottom: "1vh",
            }}
          >
            Weekly reset
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "#7a7167",
              lineHeight: 1.5,
            }}
          >
            Glance at the week. Fill gaps. Sort 1–2 things. Done.
          </p>
        </div>

        {/* Step 2 */}
        <div>
          <div
            style={{
              width: "4vw",
              height: "4vw",
              borderRadius: "50%",
              background: "#D29A22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "2vh",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontWeight: 700,
                fontSize: "1.9vw",
                color: "#F7F3EB",
              }}
            >
              2
            </span>
          </div>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.2vw",
              color: "#D29A22",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.8vh",
            }}
          >
            Daily
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#2B2B2B",
              marginBottom: "1vh",
            }}
          >
            Dashboard glance
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "#7a7167",
              lineHeight: 1.5,
            }}
          >
            Open. See the day. One breath. Close.
          </p>
        </div>

        {/* Step 3 */}
        <div>
          <div
            style={{
              width: "4vw",
              height: "4vw",
              borderRadius: "50%",
              background: "#5E3A4C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "2vh",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontWeight: 700,
                fontSize: "1.9vw",
                color: "#F7F3EB",
              }}
            >
              3
            </span>
          </div>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.2vw",
              color: "#5E3A4C",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.8vh",
            }}
          >
            Mid-chaos
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#2B2B2B",
              marginBottom: "1vh",
            }}
          >
            Quick capture
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "#7a7167",
              lineHeight: 1.5,
            }}
          >
            Something lands. Add it. Brain releases it.
          </p>
        </div>

        {/* Step 4 */}
        <div>
          <div
            style={{
              width: "4vw",
              height: "4vw",
              borderRadius: "50%",
              background: "#1D6962",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "2vh",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontWeight: 700,
                fontSize: "1.9vw",
                color: "#F7F3EB",
              }}
            >
              4
            </span>
          </div>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.2vw",
              color: "#1D6962",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.8vh",
            }}
          >
            Overwhelm
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8vw",
              color: "#2B2B2B",
              marginBottom: "1vh",
            }}
          >
            Reset mode
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "#7a7167",
              lineHeight: 1.5,
            }}
          >
            Three tiny steps. Permission to stop. Return Sunday.
          </p>
        </div>
      </div>
    </div>
  );
}
