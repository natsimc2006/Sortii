const base = import.meta.env.BASE_URL;

export default function Slide4PlanAhead() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: "#F7F3EB" }}
    >
      {/* Background image — right half */}
      <div className="absolute right-0 top-0 bottom-0" style={{ width: "46%" }}>
        <img
          src={`${base}planner-flatlay.png`}
          crossOrigin="anonymous"
          alt="Planner flatlay"
          className="w-full h-full object-cover"
          style={{ opacity: 0.55 }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, #F7F3EB 0%, transparent 30%)" }}
        />
      </div>

      {/* Left content */}
      <div
        className="absolute top-0 bottom-0 left-0 flex flex-col justify-center"
        style={{ width: "58%", paddingLeft: "8vw", paddingRight: "4vw" }}
      >
        <p
          className="uppercase tracking-widest mb-[3vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            fontSize: "1.1vw",
            color: "#2A8F88",
            letterSpacing: "0.2em",
          }}
        >
          Always two weeks ahead
        </p>

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
          This Week.
          <br />
          <span style={{ color: "#2A8F88" }}>Next Week.</span>
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 400, fontSize: "3.2vw", color: "#7a7167" }}>
            Both sorted.
          </span>
        </h2>

        <p
          className="mt-[3vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 400,
            fontSize: "1.7vw",
            color: "#5a534a",
            lineHeight: 1.65,
            textWrap: "pretty",
          }}
        >
          Sortii shows you two windows at once — this week's
          plan and next week's — so you can shop at the right
          time and eat well all month without thinking about it.
        </p>

        <div className="mt-[4vh] flex gap-[2vw]">
          <div
            style={{
              background: "#2A8F88",
              borderRadius: "0.8vw",
              padding: "1.8vh 2vw",
              flex: 1,
            }}
          >
            <p
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontWeight: 700,
                fontSize: "1.7vw",
                color: "#F7F3EB",
                marginBottom: "0.5vh",
              }}
            >
              Mon – Sun
            </p>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "1.4vw",
                color: "rgba(247,243,235,0.75)",
              }}
            >
              This Week's plan, front and centre
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1.5px solid #EDE9E1",
              borderRadius: "0.8vw",
              padding: "1.8vh 2vw",
              flex: 1,
            }}
          >
            <p
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontWeight: 700,
                fontSize: "1.7vw",
                color: "#2B2B2B",
                marginBottom: "0.5vh",
              }}
            >
              Next Week
            </p>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "1.4vw",
                color: "#7a7167",
              }}
            >
              Generated. Ready to review when you are.
            </p>
          </div>
        </div>
      </div>

      {/* Left edge accent */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: "0.5vw", background: "linear-gradient(to bottom, #2A8F88, #1D6962)" }}
      />
    </div>
  );
}
