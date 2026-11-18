import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type HeroTitleProps = {
  title: string;
  subtitle?: string;
  /** Color of the leading accent characters and the underline. */
  accentColor?: string;
  /** Color of the remaining title characters. Pass the theme's textColor. */
  textColor?: string;
  /** Subtitle color. */
  subtitleColor?: string;
  /**
   * Scrim painted behind the title so it separates from whatever is underneath.
   * Defaults to a dark wash; a light theme must pass a light one, otherwise the
   * scrim darkens the backdrop and cancels out the theme's dark text.
   */
  scrimBackground?: string;
};

const DEFAULT_SCRIM =
  "radial-gradient(ellipse at center, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.55) 100%)";

export const HeroTitle: React.FC<HeroTitleProps> = ({
  title,
  subtitle,
  accentColor = "#22D3EE",
  textColor = "#F8FAFC",
  subtitleColor = "#A78BFA",
  scrimBackground = DEFAULT_SCRIM,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered letter-by-letter spring. Joined scripts (Arabic, Persian, Urdu,
  // Hebrew) must not be split per character — that breaks letter joining and
  // reverses order — so those animate word-by-word, right-to-left.
  const isRtl = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(title);
  const titleChars = isRtl ? title.split(/(\s+)/).filter((w) => w.length > 0) : title.split("");
  const rtlFont = "'Noto Kufi Arabic', 'Noto Naskh Arabic', 'Amiri', system-ui, sans-serif";

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: scrimBackground,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "85%" }}>
        {/* Main title with per-character spring */}
        <div
          style={{
            fontSize: isRtl ? 84 : 72,
            fontWeight: 800,
            fontFamily: isRtl ? rtlFont : "Space Grotesk, Inter, system-ui, sans-serif",
            direction: isRtl ? "rtl" : "ltr",
            lineHeight: 1.2,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 0,
          }}
        >
          {titleChars.map((char, i) => {
            const delay = i * (isRtl ? 4 : 1.2);
            const charSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 12, stiffness: 150 },
            });

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: charSpring,
                  transform: `translateY(${interpolate(charSpring, [0, 1], [30, 0])}px)`,
                  color: (isRtl ? i === 0 : i < 8) ? accentColor : textColor, // Accent first word
                  whiteSpace: char === " " ? "pre" : undefined,
                  minWidth: char === " " ? "0.3em" : undefined,
                }}
              >
                {char}
              </span>
            );
          })}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              marginTop: 20,
              opacity: spring({
                frame: frame - titleChars.length * (isRtl ? 4 : 1.2) - 5,
                fps,
                config: { damping: 20 },
              }),
              fontSize: isRtl ? 36 : 28,
              fontWeight: 400,
              color: subtitleColor,
              fontFamily: isRtl ? rtlFont : "Space Grotesk, Inter, system-ui, sans-serif",
              direction: isRtl ? "rtl" : "ltr",
              letterSpacing: isRtl ? "normal" : "0.1em",
              textTransform: "uppercase",
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Animated underline */}
        <div
          style={{
            margin: "24px auto 0",
            height: 3,
            backgroundColor: accentColor,
            borderRadius: 2,
            width: interpolate(
              spring({
                frame: frame - 15,
                fps,
                config: { damping: 15, stiffness: 60 },
              }),
              [0, 1],
              [0, 400]
            ),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
