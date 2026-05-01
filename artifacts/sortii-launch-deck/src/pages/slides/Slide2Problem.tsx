export default function Slide2Problem() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex"
      style={{ background: "#F7F3EB" }}
    >
      {/* Left: large teal accent block */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: "0.7vw", background: "linear-gradient(to bottom, #2A8F88, #1D6962)" }}
      />

      {/* Left column — the scenario */}
      <div className="flex flex-col justify-center pl-[8vw] pr-[4vw]" style={{ width: "52%" }}>
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
          Sound familiar?
        </p>

        <h2
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 700,
            fontSize: "4.2vw",
            color: "#2B2B2B",
            lineHeight: 1.15,
            textWrap: "balance",
          }}
        >
          It's 5pm.
          <br />
          <span style={{ fontStyle: "italic", color: "#2A8F88" }}>What's for dinner?</span>
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
          The question lands every single day.
          Scattered apps. Forgotten ingredients.
          Decisions made at the worst possible moment.
        </p>

        <p
          className="mt-[2.5vh]"
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 400,
            fontSize: "1.7vw",
            color: "#5a534a",
            lineHeight: 1.65,
            textWrap: "pretty",
          }}
        >
          The mental load is real, relentless,
          and invisible to everyone except the person carrying it.
        </p>
      </div>

      {/* Right column — three truths */}
      <div
        className="flex flex-col justify-center gap-[3vh] pr-[8vw]"
        style={{ width: "48%", paddingLeft: "3vw" }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "1.2vw",
            padding: "2.8vh 2.4vw",
            borderTop: "3px solid #2A8F88",
          }}
        >
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.9vw",
              color: "#2B2B2B",
              marginBottom: "0.8vh",
            }}
          >
            Recipes in five places.
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
            Screenshots, bookmarks, notebooks — none of it together.
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "1.2vw",
            padding: "2.8vh 2.4vw",
            borderTop: "3px solid #D29A22",
          }}
        >
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.9vw",
              color: "#2B2B2B",
              marginBottom: "0.8vh",
            }}
          >
            Decisions at peak chaos.
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
            After school, after work, already exhausted.
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "1.2vw",
            padding: "2.8vh 2.4vw",
            borderTop: "3px solid #5E3A4C",
          }}
        >
          <p
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontWeight: 700,
              fontSize: "1.9vw",
              color: "#2B2B2B",
              marginBottom: "0.8vh",
            }}
          >
            The week keeps ambushing you.
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
            Bills, logistics, kids, meals — all held in one person's head.
          </p>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[0.4vh]" style={{ background: "#EDE9E1" }} />
    </div>
  );
}
