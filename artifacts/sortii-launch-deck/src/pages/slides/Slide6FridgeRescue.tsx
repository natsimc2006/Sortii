export default function Slide6FridgeRescue() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: "#1D6962" }}
    >
      {/* Decorative bottom circle */}
      <div
        className="absolute"
        style={{
          bottom: "-20vh",
          left: "-8vw",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(42,143,136,0.4) 0%, transparent 70%)",
        }}
      />

      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#D29A22" }} />

      {/* Left: hero text */}
      <div
        className="absolute top-0 bottom-0 left-0 flex flex-col justify-center"
        style={{ width: "50%", paddingLeft: "8vw", paddingRight: "4vw" }}
      >
        <p
          className="uppercase tracking-widest mb-[2.5vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            fontSize: "1.1vw",
            color: "#D29A22",
            letterSpacing: "0.22em",
          }}
        >
          When the fridge is fighting back
        </p>

        <h2
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 900,
            fontSize: "5.8vw",
            color: "#F7F3EB",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
          }}
        >
          Fridge
          <br />
          <span style={{ color: "#D29A22" }}>Rescue.</span>
        </h2>

        <div
          className="mt-[3vh]"
          style={{
            width: "4vw",
            height: "0.3vh",
            background: "rgba(247,243,235,0.3)",
            borderRadius: "2px",
          }}
        />

        <p
          className="mt-[2.5vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 400,
            fontSize: "1.7vw",
            color: "rgba(247,243,235,0.75)",
            lineHeight: 1.65,
            textWrap: "pretty",
          }}
        >
          Half a bag of pasta. Leftover chicken.
          Some sad-looking spinach.
        </p>
        <p
          className="mt-[1.5vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 400,
            fontSize: "1.7vw",
            color: "rgba(247,243,235,0.75)",
            lineHeight: 1.65,
            textWrap: "pretty",
          }}
        >
          Tell Sortii what you have. It finds what
          to make tonight — no waste, no supermarket run.
        </p>

        <p
          className="mt-[3vh]"
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 400,
            fontStyle: "italic",
            fontSize: "1.9vw",
            color: "rgba(247,243,235,0.5)",
          }}
        >
          "Leftovers count. We support this."
        </p>
      </div>

      {/* Right: visual card stack */}
      <div
        className="absolute top-0 bottom-0 right-0 flex flex-col justify-center"
        style={{ width: "44%", paddingRight: "7vw", gap: "2.2vh" }}
      >
        <div
          style={{
            background: "rgba(247,243,235,0.1)",
            borderRadius: "1.2vw",
            padding: "2.4vh 2.2vw",
            border: "1px solid rgba(247,243,235,0.15)",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.3vw",
              color: "#D29A22",
              marginBottom: "0.7vh",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            You have
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 400,
              fontSize: "1.8vw",
              color: "#F7F3EB",
              lineHeight: 1.4,
            }}
          >
            Chicken, pasta, spinach, garlic, cream
          </p>
        </div>

        <div
          style={{
            background: "#2A8F88",
            borderRadius: "1.2vw",
            padding: "2.4vh 2.2vw",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "1.3vw",
              color: "rgba(247,243,235,0.7)",
              marginBottom: "0.7vh",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Sortii suggests
          </p>
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "2vw",
              color: "#F7F3EB",
              lineHeight: 1.3,
            }}
          >
            Creamy garlic chicken pasta
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "rgba(247,243,235,0.65)",
              marginTop: "0.8vh",
            }}
          >
            30 min · Uses what you have · Kid-friendly
          </p>
        </div>

        <div
          style={{
            background: "rgba(247,243,235,0.06)",
            borderRadius: "1.2vw",
            padding: "2vh 2.2vw",
            border: "1px solid rgba(247,243,235,0.1)",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 400,
              fontSize: "1.5vw",
              color: "rgba(247,243,235,0.5)",
              fontStyle: "italic",
            }}
          >
            Nothing wasted. No extra shopping needed.
          </p>
        </div>
      </div>
    </div>
  );
}
