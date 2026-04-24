import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// MOTOR DE CÁLCULO — Surebets, Cashout e Odds Desreguladas
// ============================================================

const calcSurebet = (odds) => {
  if (!odds || odds.length < 2) return null;
  const impliedProbs = odds.map((o) => 1 / o);
  const totalImplied = impliedProbs.reduce((a, b) => a + b, 0);
  const margin = ((totalImplied - 1) / totalImplied) * 100;
  const isSure = totalImplied < 1;
  const profit = isSure ? ((1 / totalImplied - 1) * 100).toFixed(2) : null;
  const stakes = (stake) =>
    odds.map((o, i) => ({
      odd: o,
      stake: ((stake * (1 / o)) / totalImplied).toFixed(2),
      payout: (((stake * (1 / o)) / totalImplied) * o).toFixed(2),
    }));
  return { isSure, totalImplied, margin: Math.abs(margin).toFixed(2), profit, stakes };
};

const calcCashout = ({ stakeTotal, oddEntry, currentOdd, liability = 0 }) => {
  const backReturn = stakeTotal * oddEntry;
  const cashoutValue = (backReturn / currentOdd).toFixed(2);
  const guaranteedProfit = (cashoutValue - stakeTotal).toFixed(2);
  const profitPct = (((cashoutValue - stakeTotal) / stakeTotal) * 100).toFixed(2);
  return { cashoutValue, guaranteedProfit, profitPct, backReturn: backReturn.toFixed(2) };
};

const detectOddsAnomaly = (odd, avgMarketOdd) => {
  const deviation = ((odd - avgMarketOdd) / avgMarketOdd) * 100;
  if (deviation > 8) return { type: "ACIMA", deviation: deviation.toFixed(1), severity: "high" };
  if (deviation > 4) return { type: "ACIMA", deviation: deviation.toFixed(1), severity: "medium" };
  if (deviation < -8) return { type: "ABAIXO", deviation: Math.abs(deviation).toFixed(1), severity: "high" };
  if (deviation < -4) return { type: "ABAIXO", deviation: Math.abs(deviation).toFixed(1), severity: "medium" };
  return null;
};

// ============================================================
// CASAS DE APOSTAS COM LINKS E CORES
// ============================================================

const BOOKMAKERS_DATA = {
  "Bet365":      { url: "https://www.bet365.com",         color: "#1B7A3E", logo: "B3" },
  "Betano":      { url: "https://www.betano.com.br",      color: "#E40000", logo: "BN" },
  "Betfair":     { url: "https://www.betfair.com",        color: "#F5A623", logo: "BF" },
  "1xBet":       { url: "https://1xbet.com",              color: "#1A66CC", logo: "1X" },
  "Pinnacle":    { url: "https://www.pinnacle.com",       color: "#D4A017", logo: "PI" },
  "William Hill":{ url: "https://www.williamhill.com",   color: "#702082", logo: "WH" },
  "Sportingbet": { url: "https://www.sportingbet.com",    color: "#0066CC", logo: "SB" },
  "KTO":         { url: "https://www.kto.com",            color: "#00C4B4", logo: "KT" },
};

const BOOKMAKERS = Object.keys(BOOKMAKERS_DATA);

// ============================================================
// DADOS SIMULADOS (mercado ao vivo simulado)
// ============================================================

const INITIAL_OPPORTUNITIES = [
  {
    id: 1,
    type: "surebet",
    sport: "⚽ Futebol",
    match: "Arsenal × Chelsea",
    league: "Premier League",
    time: "Ao Vivo 67'",
    score: "1-1",
    selections: [
      { label: "Arsenal Vence", bookmaker: "Bet365", odd: 2.85 },
      { label: "Empate", bookmaker: "Betfair", odd: 3.40 },
      { label: "Chelsea Vence", bookmaker: "1xBet", odd: 2.90 },
    ],
    profit: 4.21,
    status: "ATIVA",
    urgency: "high",
    expiresIn: 180,
  },
  {
    id: 2,
    type: "cashout",
    sport: "🎾 Tênis",
    match: "Djokovic × Alcaraz",
    league: "ATP Masters",
    time: "Ao Vivo Set 2",
    score: "1-0 (6-4)",
    bookmaker: "Bet365",
    oddEntry: 1.95,
    currentOdd: 1.42,
    stake: 200,
    profit: "+R$74,65",
    status: "CASHOUT AGORA",
    urgency: "critical",
    expiresIn: 45,
  },
  {
    id: 3,
    type: "anomaly",
    sport: "🏀 Basquete",
    match: "Lakers × Celtics",
    league: "NBA",
    time: "Ao Vivo Q3",
    score: "78-82",
    selection: "Lakers Vence",
    bookmaker: "Pinnacle",
    odd: 3.20,
    avgMarketOdd: 2.75,
    deviation: "+16.4%",
    status: "ODD DESREGULADA",
    urgency: "medium",
    expiresIn: 300,
  },
  {
    id: 4,
    type: "surebet",
    sport: "⚽ Futebol",
    match: "PSG × Real Madrid",
    league: "Champions League",
    time: "Pre-jogo",
    score: "—",
    selections: [
      { label: "PSG Vence", bookmaker: "Betano", odd: 3.10 },
      { label: "Empate", bookmaker: "Bet365", odd: 3.60 },
      { label: "Real Madrid Vence", bookmaker: "William Hill", odd: 2.40 },
    ],
    profit: 2.87,
    status: "ATIVA",
    urgency: "medium",
    expiresIn: 600,
  },
  {
    id: 5,
    type: "cashout",
    sport: "🏈 Futebol Americano",
    match: "Chiefs × Eagles",
    league: "NFL",
    time: "Ao Vivo Q4",
    score: "21-17",
    bookmaker: "Betano",
    oddEntry: 2.30,
    currentOdd: 1.55,
    stake: 150,
    profit: "+R$52,10",
    status: "CASHOUT AGORA",
    urgency: "high",
    expiresIn: 90,
  },
];

// ============================================================
// COMPONENTES DE UI
// ============================================================

const formatTime = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const UrgencyBadge = ({ level }) => {
  const cfg = {
    critical: { bg: "#FF2D55", label: "URGENTE", pulse: true },
    high: { bg: "#FF9500", label: "ALTO", pulse: false },
    medium: { bg: "#30D158", label: "MÉDIO", pulse: false },
    low: { bg: "#636366", label: "BAIXO", pulse: false },
  }[level] || { bg: "#636366", label: level, pulse: false };

  return (
    <span style={{
      background: cfg.bg,
      color: "#fff",
      fontSize: 9,
      fontWeight: 800,
      padding: "2px 7px",
      borderRadius: 20,
      letterSpacing: 1,
      fontFamily: "'Rajdhani', sans-serif",
      animation: cfg.pulse ? "pulse 1s infinite" : "none",
      display: "inline-block",
    }}>
      {cfg.label}
    </span>
  );
};

const Countdown = ({ seconds }) => {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const color = remaining < 60 ? "#FF2D55" : remaining < 120 ? "#FF9500" : "#30D158";
  return (
    <span style={{ color, fontWeight: 700, fontSize: 11, fontFamily: "monospace" }}>
      ⏱ {formatTime(remaining)}
    </span>
  );
};

// ── Chip clicável para abrir a casa de apostas ──────────────
const BookmakerChip = ({ name, size = "md", showLabel = true }) => {
  const data = BOOKMAKERS_DATA[name] || { url: "#", color: "#636366", logo: "?" };
  const sizes = {
    sm: { fontSize: 9, padding: "2px 7px", iconSize: 13, gap: 4 },
    md: { fontSize: 11, padding: "4px 10px", iconSize: 16, gap: 5 },
    lg: { fontSize: 13, padding: "7px 14px", iconSize: 18, gap: 6 },
  };
  const s = sizes[size] || sizes.md;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        background: `${data.color}22`,
        border: `1px solid ${data.color}55`,
        borderRadius: 20,
        padding: s.padding,
        textDecoration: "none",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${data.color}40`;
        e.currentTarget.style.borderColor = data.color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${data.color}22`;
        e.currentTarget.style.borderColor = `${data.color}55`;
      }}
    >
      <span style={{
        width: s.iconSize,
        height: s.iconSize,
        borderRadius: "50%",
        background: data.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: s.iconSize * 0.5,
        fontWeight: 900,
        color: "#fff",
        fontFamily: "'Rajdhani', sans-serif",
        flexShrink: 0,
      }}>
        {data.logo}
      </span>
      {showLabel && (
        <span style={{
          color: "#FFFFFF",
          fontSize: s.fontSize,
          fontWeight: 700,
          fontFamily: "'Rajdhani', sans-serif",
          whiteSpace: "nowrap",
        }}>
          {name}
        </span>
      )}
      <span style={{ color: data.color, fontSize: s.fontSize - 1, fontWeight: 800 }}>↗</span>
    </a>
  );
};

// Botão "Abrir casa" para uso nos modais
const OpenBookmakerBtn = ({ name }) => {
  const data = BOOKMAKERS_DATA[name] || { url: "#", color: "#636366" };
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: `linear-gradient(135deg, ${data.color}, ${data.color}BB)`,
        borderRadius: 10,
        padding: "8px 14px",
        textDecoration: "none",
        cursor: "pointer",
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 800,
        fontSize: 12,
        color: "#fff",
        letterSpacing: 0.5,
      }}
    >
      🔗 ABRIR {name.toUpperCase()} ↗
    </a>
  );
};

// ============================================================
// CARDS DE OPORTUNIDADE
// ============================================================

const SurebetCard = ({ opp, onOpen }) => {
  const result = calcSurebet(opp.selections.map((s) => s.odd));
  return (
    <div onClick={() => onOpen(opp)} style={{
      background: "linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)",
      border: "1px solid #38383A",
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 12,
      cursor: "pointer",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, width: 3, height: "100%",
        background: "linear-gradient(180deg, #30D158, #00D4FF)",
        borderRadius: "3px 0 0 3px",
      }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <span style={{ fontSize: 10, color: "#98989D", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
              {opp.sport} • {opp.league}
            </span>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif", marginTop: 1 }}>
              {opp.match}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <UrgencyBadge level={opp.urgency} />
            <div style={{ marginTop: 4 }}>
              <Countdown seconds={opp.expiresIn} />
            </div>
          </div>
        </div>

        {/* Seleções com chips de casas */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {opp.selections.map((s, i) => (
            <div key={i} style={{
              flex: 1, background: "#3A3A3C", borderRadius: 10, padding: "6px 8px", textAlign: "center",
            }}>
              <div style={{ marginBottom: 3, display: "flex", justifyContent: "center" }}>
                <BookmakerChip name={s.bookmaker} size="sm" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#00D4FF", fontFamily: "'Rajdhani', sans-serif" }}>
                {s.odd.toFixed(2)}
              </div>
              <div style={{ fontSize: 8, color: "#ebebeb", marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              background: "rgba(48, 209, 88, 0.15)", color: "#30D158",
              fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 8,
              fontFamily: "'Rajdhani', sans-serif",
            }}>
              +{opp.profit}% LUCRO
            </span>
            <span style={{ color: "#98989D", fontSize: 10 }}>{opp.time}</span>
          </div>
          <span style={{
            background: "linear-gradient(135deg, #30D158, #00D4FF)",
            color: "#000", fontSize: 11, fontWeight: 800,
            padding: "4px 12px", borderRadius: 20, fontFamily: "'Rajdhani', sans-serif",
          }}>
            CALCULAR →
          </span>
        </div>
      </div>
    </div>
  );
};

const CashoutCard = ({ opp, onOpen }) => {
  const co = calcCashout({ stakeTotal: opp.stake, oddEntry: opp.oddEntry, currentOdd: opp.currentOdd });
  return (
    <div onClick={() => onOpen(opp)} style={{
      background: "linear-gradient(135deg, #1C1C1E 0%, #2C1A0E 100%)",
      border: opp.urgency === "critical" ? "1px solid #FF9500" : "1px solid #38383A",
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 12,
      cursor: "pointer",
      position: "relative",
      overflow: "hidden",
      boxShadow: opp.urgency === "critical" ? "0 0 15px rgba(255,149,0,0.2)" : "none",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, width: 3, height: "100%",
        background: "linear-gradient(180deg, #FF9500, #FF2D55)",
        borderRadius: "3px 0 0 3px",
      }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <span style={{ fontSize: 10, color: "#98989D", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
              {opp.sport} • {opp.league}
            </span>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif", marginTop: 1 }}>
              {opp.match}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <UrgencyBadge level={opp.urgency} />
            <div style={{ marginTop: 4 }}><Countdown seconds={opp.expiresIn} /></div>
          </div>
        </div>

        {/* Casa de apostas com link direto */}
        {opp.bookmaker && (
          <div style={{ marginBottom: 8 }}>
            <BookmakerChip name={opp.bookmaker} size="md" />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {[
            { label: "Odd Entrada", value: opp.oddEntry.toFixed(2), color: "#00D4FF" },
            { label: "Odd Atual", value: opp.currentOdd.toFixed(2), color: "#FF9500" },
            { label: "Stake", value: `R$${opp.stake}`, color: "#FFFFFF" },
            { label: "Cashout", value: `R$${co.cashoutValue}`, color: "#30D158" },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1, background: "#2C2C2E", borderRadius: 10, padding: "6px 4px", textAlign: "center",
            }}>
              <div style={{ fontSize: 8, color: "#98989D", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: "'Rajdhani', sans-serif" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            background: "rgba(255,149,0,0.15)", color: "#FF9500",
            fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 8,
            fontFamily: "'Rajdhani', sans-serif",
          }}>
            +{co.profitPct}% GARANTIDO
          </span>
          <span style={{
            background: "linear-gradient(135deg, #FF9500, #FF2D55)",
            color: "#fff", fontSize: 11, fontWeight: 800,
            padding: "4px 12px", borderRadius: 20, fontFamily: "'Rajdhani', sans-serif",
          }}>
            FAZER CASHOUT →
          </span>
        </div>
      </div>
    </div>
  );
};

const AnomalyCard = ({ opp, onOpen }) => (
  <div onClick={() => onOpen(opp)} style={{
    background: "linear-gradient(135deg, #1C1C1E 0%, #0E1A2C 100%)",
    border: "1px solid #38383A",
    borderRadius: 16,
    padding: "14px 16px",
    marginBottom: 12,
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, width: 3, height: "100%",
      background: "linear-gradient(180deg, #BF5AF2, #00D4FF)",
    }} />
    <div style={{ paddingLeft: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 10, color: "#98989D", fontFamily: "'Rajdhani', sans-serif" }}>
            {opp.sport} • {opp.league}
          </span>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif", marginTop: 1 }}>
            {opp.match}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <UrgencyBadge level={opp.urgency} />
          <div style={{ marginTop: 4 }}><Countdown seconds={opp.expiresIn} /></div>
        </div>
      </div>

      <div style={{ background: "#2C2C2E", borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "#98989D", marginBottom: 3 }}>{opp.selection}</div>
            {/* Casa com link */}
            <BookmakerChip name={opp.bookmaker} size="sm" />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#BF5AF2", fontFamily: "'Rajdhani', sans-serif" }}>
              {opp.odd.toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: "#98989D" }}>Média: {opp.avgMarketOdd.toFixed(2)}</div>
          </div>
          <div style={{
            background: "rgba(191,90,242,0.15)", color: "#BF5AF2",
            fontSize: 18, fontWeight: 900, padding: "4px 10px", borderRadius: 8,
            fontFamily: "'Rajdhani', sans-serif",
          }}>
            {opp.deviation}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#98989D", fontSize: 10 }}>{opp.time} • {opp.score}</span>
        <span style={{
          background: "linear-gradient(135deg, #BF5AF2, #00D4FF)",
          color: "#fff", fontSize: 11, fontWeight: 800,
          padding: "4px 12px", borderRadius: 20, fontFamily: "'Rajdhani', sans-serif",
        }}>
          VER ESTRATÉGIA →
        </span>
      </div>
    </div>
  </div>
);

// ============================================================
// CALCULADORA SUREBET (MODAL)
// ============================================================

const SurebetCalculator = ({ opp, onClose }) => {
  const [stake, setStake] = useState("500");
  const result = calcSurebet(opp.selections.map((s) => s.odd));
  const stakeNum = parseFloat(stake) || 0;
  const breakdown = result?.stakes(stakeNum) || [];

  return (
    <div style={{ padding: "0 0 80px" }}>
      <div style={{
        background: "linear-gradient(135deg, #1a3a1a, #0a2a0a)",
        border: "1px solid #30D158",
        borderRadius: 16, padding: 16, marginBottom: 16,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: "#30D158", marginBottom: 4, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
          LUCRO GARANTIDO
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#30D158", fontFamily: "'Rajdhani', sans-serif" }}>
          +{result?.profit}%
        </div>
        <div style={{ fontSize: 13, color: "#FFFFFF88" }}>
          R$ {((stakeNum * parseFloat(result?.profit || 0)) / 100).toFixed(2)} sobre R$ {stakeNum.toFixed(2)}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "#98989D", display: "block", marginBottom: 6 }}>
          Valor Total para Apostar (R$)
        </label>
        <input
          type="number"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          style={{
            width: "100%", background: "#2C2C2E", border: "1px solid #48484A",
            borderRadius: 12, padding: "12px 16px", color: "#FFFFFF",
            fontSize: 20, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif",
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#98989D", marginBottom: 8, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
          DISTRIBUIÇÃO DE APOSTAS
        </div>
        {opp.selections.map((sel, i) => {
          const b = breakdown[i];
          return (
            <div key={i} style={{
              background: "#2C2C2E", borderRadius: 12, padding: "12px 14px",
              marginBottom: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif" }}>
                    {sel.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#98989D" }}>Odd {sel.odd.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#00D4FF", fontFamily: "'Rajdhani', sans-serif" }}>
                    R$ {b?.stake || "0.00"}
                  </div>
                  <div style={{ fontSize: 10, color: "#30D158" }}>retorno: R$ {b?.payout || "0.00"}</div>
                </div>
              </div>
              {/* Link direto para a casa */}
              <OpenBookmakerBtn name={sel.bookmaker} />
            </div>
          );
        })}
      </div>

      <div style={{
        background: "#2C2C2E", borderRadius: 12, padding: "12px 14px", marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: "#98989D", marginBottom: 8 }}>ANÁLISE DA ARBITRAGEM</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#FFFFFF88", fontSize: 12 }}>Probabilidade implícita total:</span>
          <span style={{ color: result?.isSure ? "#30D158" : "#FF2D55", fontWeight: 700, fontFamily: "'Rajdhani', sans-serif" }}>
            {(result?.totalImplied * 100).toFixed(2)}%
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#FFFFFF88", fontSize: 12 }}>Margem da casa:</span>
          <span style={{ color: "#98989D", fontFamily: "'Rajdhani', sans-serif" }}>
            {result?.margin}%
          </span>
        </div>
      </div>

      <div style={{
        background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.3)",
        borderRadius: 12, padding: "12px 14px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: "#30D158", marginBottom: 4, fontWeight: 700 }}>
          💡 COMO EXECUTAR
        </div>
        <div style={{ fontSize: 12, color: "#FFFFFF99", lineHeight: 1.5 }}>
          Abra as {opp.selections.length} casas simultaneamente em abas diferentes. Aposte os valores indicados em cada casa.
          Independente do resultado, você garante lucro de{" "}
          <strong style={{ color: "#30D158" }}>+{result?.profit}%</strong>.
        </div>
        {/* Atalhos rápidos para todas as casas */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {opp.selections.map((sel, i) => (
            <BookmakerChip key={i} name={sel.bookmaker} size="sm" />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// CALCULADORA CASHOUT (MODAL)
// ============================================================

const CashoutCalculator = ({ opp, onClose }) => {
  const [stake, setStake] = useState(String(opp.stake));
  const [oddEntry, setOddEntry] = useState(String(opp.oddEntry));
  const [currentOdd, setCurrentOdd] = useState(String(opp.currentOdd));

  const co = calcCashout({
    stakeTotal: parseFloat(stake) || 0,
    oddEntry: parseFloat(oddEntry) || 1,
    currentOdd: parseFloat(currentOdd) || 1,
  });

  const isProfit = parseFloat(co.guaranteedProfit) > 0;

  return (
    <div style={{ padding: "0 0 80px" }}>
      <div style={{
        background: isProfit ? "linear-gradient(135deg, #2a2000, #1a1000)" : "linear-gradient(135deg, #2a0000, #1a0000)",
        border: `1px solid ${isProfit ? "#FF9500" : "#FF2D55"}`,
        borderRadius: 16, padding: 16, marginBottom: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: isProfit ? "#FF9500" : "#FF2D55", marginBottom: 4, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
          {isProfit ? "LUCRO GARANTIDO NO CASHOUT" : "PREJUÍZO EVITADO"}
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: isProfit ? "#FF9500" : "#FF2D55", fontFamily: "'Rajdhani', sans-serif" }}>
          R$ {Math.abs(parseFloat(co.guaranteedProfit)).toFixed(2)}
        </div>
        <div style={{ fontSize: 13, color: "#FFFFFF88" }}>
          Valor do cashout: R$ {co.cashoutValue} • {co.profitPct}%
        </div>
      </div>

      {/* Casa de apostas com link de acesso direto */}
      {opp.bookmaker && (
        <div style={{
          background: "#2C2C2E", borderRadius: 12, padding: "12px 14px",
          marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#98989D", marginBottom: 4 }}>REALIZAR CASHOUT EM</div>
            <BookmakerChip name={opp.bookmaker} size="md" />
          </div>
          <OpenBookmakerBtn name={opp.bookmaker} />
        </div>
      )}

      {[
        { label: "Stake Original (R$)", value: stake, setter: setStake },
        { label: "Odd na Entrada", value: oddEntry, setter: setOddEntry },
        { label: "Odd Atual (mercado)", value: currentOdd, setter: setCurrentOdd },
      ].map((field, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#98989D", display: "block", marginBottom: 5 }}>
            {field.label}
          </label>
          <input
            type="number"
            value={field.value}
            onChange={(e) => field.setter(e.target.value)}
            style={{
              width: "100%", background: "#2C2C2E", border: "1px solid #48484A",
              borderRadius: 12, padding: "11px 16px", color: "#FFFFFF",
              fontSize: 18, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      ))}

      <div style={{ background: "#2C2C2E", borderRadius: 12, padding: "14px", marginBottom: 12, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: "#98989D", marginBottom: 10 }}>SIMULAÇÃO COMPLETA</div>
        {[
          { label: "Aposta original", value: `R$ ${parseFloat(stake).toFixed(2)}` },
          { label: "Retorno total esperado", value: `R$ ${co.backReturn}` },
          { label: "Valor ideal de cashout", value: `R$ ${co.cashoutValue}`, highlight: "#FF9500" },
          { label: "Lucro/Prejuízo", value: `R$ ${co.guaranteedProfit}`, highlight: isProfit ? "#30D158" : "#FF2D55" },
          { label: "ROI", value: `${co.profitPct}%`, highlight: isProfit ? "#30D158" : "#FF2D55" },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#FFFFFF88", fontSize: 12 }}>{row.label}</span>
            <span style={{ color: row.highlight || "#FFFFFF", fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", fontSize: 13 }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        background: "rgba(255,149,0,0.1)", border: "1px solid rgba(255,149,0,0.3)",
        borderRadius: 12, padding: "12px 14px",
      }}>
        <div style={{ fontSize: 11, color: "#FF9500", marginBottom: 4, fontWeight: 700 }}>
          💡 ESTRATÉGIA DE CASHOUT
        </div>
        <div style={{ fontSize: 12, color: "#FFFFFF99", lineHeight: 1.6 }}>
          {isProfit
            ? `A odd caiu de ${oddEntry} para ${currentOdd}, o que indica que seu resultado favorecido está mais provável. Ao fazer cashout agora, você garante R$ ${co.cashoutValue} sem risco.`
            : `Apesar de ser um prejuízo, o cashout parcial reduz sua exposição. Compare com a probabilidade atual do evento antes de decidir.`
          }
        </div>
      </div>
    </div>
  );
};

// ============================================================
// TELA DE CALCULADORAS INDEPENDENTES
// ============================================================

const CalculatorScreen = () => {
  const [activeTab, setActiveTab] = useState("surebet");
  const [sb, setSb] = useState({ stake: "1000", odds: ["2.10", "3.50", "4.20"] });
  const [co, setCo] = useState({ stake: "500", oddEntry: "2.80", currentOdd: "1.60" });

  const sbResult = calcSurebet(sb.odds.map(Number).filter((o) => o > 1));
  const coResult = calcCashout({ stakeTotal: parseFloat(co.stake), oddEntry: parseFloat(co.oddEntry), currentOdd: parseFloat(co.currentOdd) });

  const tabStyle = (active) => ({
    flex: 1, padding: "8px 0", textAlign: "center",
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 13,
    background: active ? "linear-gradient(135deg, #00D4FF, #BF5AF2)" : "transparent",
    color: active ? "#000" : "#98989D",
    border: "none", cursor: "pointer", borderRadius: 10,
    WebkitTapHighlightColor: "transparent",
  });

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif", marginBottom: 16 }}>
        Calculadoras
      </div>

      <div style={{ display: "flex", gap: 4, background: "#2C2C2E", borderRadius: 12, padding: 4, marginBottom: 20 }}>
        <button style={tabStyle(activeTab === "surebet")} onClick={() => setActiveTab("surebet")}>⚡ SUREBET</button>
        <button style={tabStyle(activeTab === "cashout")} onClick={() => setActiveTab("cashout")}>💰 CASHOUT</button>
      </div>

      {activeTab === "surebet" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#98989D", display: "block", marginBottom: 5 }}>Stake Total (R$)</label>
            <input type="number" value={sb.stake} onChange={(e) => setSb({ ...sb, stake: e.target.value })}
              style={{ width: "100%", background: "#2C2C2E", border: "1px solid #48484A", borderRadius: 12, padding: "11px 16px", color: "#FFFFFF", fontSize: 18, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", outline: "none", boxSizing: "border-box" }} />
          </div>
          {sb.odds.map((odd, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "#98989D", display: "block", marginBottom: 5 }}>Odd {i + 1} (Resultado {i + 1})</label>
              <input type="number" step="0.01" value={odd}
                onChange={(e) => { const o = [...sb.odds]; o[i] = e.target.value; setSb({ ...sb, odds: o }); }}
                style={{ width: "100%", background: "#2C2C2E", border: "1px solid #48484A", borderRadius: 12, padding: "11px 16px", color: "#00D4FF", fontSize: 18, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setSb({ ...sb, odds: [...sb.odds, "2.00"] })}
              style={{ flex: 1, background: "#3A3A3C", border: "none", borderRadius: 10, padding: "10px", color: "#00D4FF", fontSize: 13, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", cursor: "pointer" }}>
              + Adicionar Odd
            </button>
            {sb.odds.length > 2 && (
              <button onClick={() => setSb({ ...sb, odds: sb.odds.slice(0, -1) })}
                style={{ flex: 1, background: "#3A3A3C", border: "none", borderRadius: 10, padding: "10px", color: "#FF2D55", fontSize: 13, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", cursor: "pointer" }}>
                − Remover
              </button>
            )}
          </div>

          {sbResult && (
            <div style={{
              background: sbResult.isSure ? "rgba(48,209,88,0.1)" : "rgba(255,45,85,0.1)",
              border: `1px solid ${sbResult.isSure ? "#30D158" : "#FF2D55"}`,
              borderRadius: 16, padding: 16,
            }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: sbResult.isSure ? "#30D158" : "#FF2D55", fontFamily: "'Rajdhani', sans-serif", marginBottom: 8 }}>
                {sbResult.isSure ? `✅ SUREBET! +${sbResult.profit}%` : `❌ Sem Surebet (-${sbResult.margin}%)`}
              </div>
              {sbResult.isSure && sbResult.stakes(parseFloat(sb.stake)).map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#FFFFFF88", fontSize: 12 }}>Resultado {i + 1} (Odd {s.odd.toFixed(2)})</span>
                  <span style={{ color: "#00D4FF", fontWeight: 700, fontFamily: "'Rajdhani', sans-serif" }}>R$ {s.stake}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "cashout" && (
        <div>
          {[
            { label: "Stake Original (R$)", key: "stake", color: "#FFFFFF" },
            { label: "Odd na Entrada", key: "oddEntry", color: "#00D4FF" },
            { label: "Odd Atual do Mercado", key: "currentOdd", color: "#FF9500" },
          ].map((field) => (
            <div key={field.key} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#98989D", display: "block", marginBottom: 5 }}>{field.label}</label>
              <input type="number" step="0.01" value={co[field.key]}
                onChange={(e) => setCo({ ...co, [field.key]: e.target.value })}
                style={{ width: "100%", background: "#2C2C2E", border: "1px solid #48484A", borderRadius: 12, padding: "11px 16px", color: field.color, fontSize: 18, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}

          <div style={{
            background: parseFloat(coResult.guaranteedProfit) > 0 ? "rgba(255,149,0,0.1)" : "rgba(255,45,85,0.1)",
            border: `1px solid ${parseFloat(coResult.guaranteedProfit) > 0 ? "#FF9500" : "#FF2D55"}`,
            borderRadius: 16, padding: 16, marginTop: 4,
          }}>
            {[
              { label: "Retorno total esperado", value: `R$ ${coResult.backReturn}` },
              { label: "Valor ideal cashout", value: `R$ ${coResult.cashoutValue}`, c: "#FF9500" },
              { label: "Lucro/Prejuízo", value: `R$ ${coResult.guaranteedProfit}`, c: parseFloat(coResult.guaranteedProfit) > 0 ? "#30D158" : "#FF2D55" },
              { label: "ROI do Cashout", value: `${coResult.profitPct}%`, c: parseFloat(coResult.profitPct) > 0 ? "#30D158" : "#FF2D55" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#FFFFFF88", fontSize: 12 }}>{row.label}</span>
                <span style={{ color: row.c || "#FFFFFF", fontWeight: 800, fontFamily: "'Rajdhani', sans-serif", fontSize: 15 }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// TELA DE ALERTAS
// ============================================================

const AlertsScreen = () => {
  const [alerts, setAlerts] = useState([
    { id: 1, type: "surebet", msg: "Nova Surebet detectada: Arsenal × Chelsea (+4.21%)", time: "agora", read: false },
    { id: 2, type: "cashout", msg: "CASHOUT URGENTE: Djokovic × Alcaraz — R$74 garantidos", time: "2min", read: false },
    { id: 3, type: "anomaly", msg: "Odd desregulada: Lakers Vence a 3.20 (+16.4% acima da média)", time: "5min", read: true },
    { id: 4, type: "surebet", msg: "Surebet expirou: PSG × Barcelona — oportunidade perdida", time: "12min", read: true },
    { id: 5, type: "cashout", msg: "Cashout realizado com sucesso: +R$52.10 assegurados", time: "18min", read: true },
  ]);

  const colors = { surebet: "#30D158", cashout: "#FF9500", anomaly: "#BF5AF2" };
  const icons = { surebet: "⚡", cashout: "💰", anomaly: "🔮" };

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif" }}>
          Alertas
        </div>
        <button onClick={() => setAlerts(alerts.map((a) => ({ ...a, read: true })))}
          style={{ background: "none", border: "none", color: "#00D4FF", fontSize: 12, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif" }}>
          Marcar todos
        </button>
      </div>

      {alerts.map((alert) => (
        <div key={alert.id} onClick={() => setAlerts(alerts.map((a) => a.id === alert.id ? { ...a, read: true } : a))}
          style={{
            background: alert.read ? "#1C1C1E" : "rgba(0,212,255,0.05)",
            border: `1px solid ${alert.read ? "#2C2C2E" : colors[alert.type]}30`,
            borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${colors[alert.type]}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            {icons[alert.type]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: alert.read ? "#98989D" : "#FFFFFF", lineHeight: 1.4, marginBottom: 4 }}>
              {alert.msg}
            </div>
            <div style={{ fontSize: 10, color: "#636366" }}>{alert.time} atrás</div>
          </div>
          {!alert.read && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[alert.type], flexShrink: 0, marginTop: 4 }} />
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================
// TELA DE PERFIL / CONFIGURAÇÕES
// ============================================================

const ProfileScreen = () => {
  const [bankroll, setBankroll] = useState("5000");
  const [minProfit, setMinProfit] = useState("2");
  const [notifications, setNotifications] = useState(true);
  const [liveOnly, setLiveOnly] = useState(false);
  const stats = { totalTrades: 47, winRate: 94, totalProfit: 1847.50, avgProfit: 3.2 };

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{
      width: 46, height: 26, borderRadius: 13, cursor: "pointer",
      background: value ? "#30D158" : "#3A3A3C",
      position: "relative", transition: "background 0.2s",
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", background: "#FFF",
        position: "absolute", top: 2, left: value ? 22 : 2,
        transition: "left 0.2s",
      }} />
    </div>
  );

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif", marginBottom: 16 }}>
        Perfil & Config
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total de Trades", value: stats.totalTrades, suffix: "", color: "#00D4FF" },
          { label: "Taxa de Sucesso", value: `${stats.winRate}`, suffix: "%", color: "#30D158" },
          { label: "Lucro Total", value: `R$${stats.totalProfit.toFixed(0)}`, suffix: "", color: "#FF9500" },
          { label: "Lucro Médio", value: `${stats.avgProfit}`, suffix: "%", color: "#BF5AF2" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#2C2C2E", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#98989D", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Rajdhani', sans-serif" }}>
              {s.value}<span style={{ fontSize: 13 }}>{s.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#2C2C2E", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#98989D", marginBottom: 6 }}>Banca Total (R$)</div>
        <input type="number" value={bankroll} onChange={(e) => setBankroll(e.target.value)}
          style={{ width: "100%", background: "#3A3A3C", border: "none", borderRadius: 10, padding: "10px 14px", color: "#FFFFFF", fontSize: 20, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", outline: "none", boxSizing: "border-box" }} />
        <div style={{ fontSize: 11, color: "#636366", marginTop: 4 }}>
          Stake sugerido por trade: R$ {(parseFloat(bankroll || 0) * 0.02).toFixed(0)} (2%)
        </div>
      </div>

      <div style={{ background: "#2C2C2E", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#98989D", marginBottom: 6 }}>Lucro mínimo para alertar (%)</div>
        <input type="number" step="0.1" value={minProfit} onChange={(e) => setMinProfit(e.target.value)}
          style={{ width: "100%", background: "#3A3A3C", border: "none", borderRadius: 10, padding: "10px 14px", color: "#30D158", fontSize: 20, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", outline: "none", boxSizing: "border-box" }} />
      </div>

      {[
        { label: "Notificações push", desc: "Alertas de surebets e cashouts", value: notifications, setter: setNotifications },
        { label: "Apenas ao vivo", desc: "Filtrar somente jogos em andamento", value: liveOnly, setter: setLiveOnly },
      ].map((item, i) => (
        <div key={i} style={{ background: "#2C2C2E", borderRadius: 16, padding: "14px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "#636366", marginTop: 2 }}>{item.desc}</div>
          </div>
          <Toggle value={item.value} onChange={item.setter} />
        </div>
      ))}

      {/* Casas monitoradas com links clicáveis */}
      <div style={{ background: "#2C2C2E", borderRadius: 16, padding: "14px 16px", marginTop: 12 }}>
        <div style={{ fontSize: 11, color: "#98989D", marginBottom: 12, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
          CASAS DE APOSTAS MONITORADAS
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {BOOKMAKERS.map((b) => (
            <BookmakerChip key={b} name={b} size="md" />
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#48484A", marginTop: 10 }}>
          Toque para abrir a casa de apostas ↗
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MODAL GENÉRICO
// ============================================================

const Modal = ({ opp, onClose }) => {
  if (!opp) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#1C1C1E", borderRadius: "24px 24px 0 0",
        maxHeight: "90vh", overflowY: "auto",
        animation: "slideUp 0.3s ease",
      }}>
        <div style={{ position: "sticky", top: 0, background: "#1C1C1E", zIndex: 10, padding: "12px 16px 0", borderRadius: "24px 24px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#48484A", borderRadius: 2, margin: "0 auto 12px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#98989D", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
                {opp.sport} • {opp.league}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif" }}>
                {opp.match}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "#3A3A3C", border: "none", color: "#FFFFFF", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16 }}>
              ×
            </button>
          </div>
          <div style={{ height: 1, background: "#2C2C2E", marginBottom: 16 }} />
        </div>

        <div style={{ padding: "0 16px" }}>
          {opp.type === "surebet" && <SurebetCalculator opp={opp} onClose={onClose} />}
          {opp.type === "cashout" && <CashoutCalculator opp={opp} onClose={onClose} />}
          {opp.type === "anomaly" && (
            <div style={{ padding: "0 0 80px" }}>
              <div style={{ background: "rgba(191,90,242,0.1)", border: "1px solid #BF5AF2", borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#BF5AF2", marginBottom: 4, fontFamily: "'Rajdhani', sans-serif" }}>ODD DESREGULADA DETECTADA</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#BF5AF2", fontFamily: "'Rajdhani', sans-serif" }}>
                  {opp.odd.toFixed(2)} <span style={{ fontSize: 14, color: "#FFFFFF88" }}>vs média {opp.avgMarketOdd.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#30D158", fontFamily: "'Rajdhani', sans-serif" }}>{opp.deviation} acima do mercado</div>
              </div>
              <div style={{ background: "#2C2C2E", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#98989D", marginBottom: 8 }}>POR QUE É UMA OPORTUNIDADE</div>
                <div style={{ fontSize: 13, color: "#FFFFFF99", lineHeight: 1.6 }}>
                  Quando uma odd está significativamente acima da média do mercado ({opp.deviation}), indica que a casa não atualizou sua precificação corretamente. Isso cria valor esperado positivo (EV+) na aposta.
                </div>
              </div>
              {/* Casa com link no modal de anomalia */}
              <div style={{
                background: "#2C2C2E", borderRadius: 12, padding: "12px 14px",
                marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "#98989D", marginBottom: 4 }}>APOSTAR EM</div>
                  <BookmakerChip name={opp.bookmaker} size="md" />
                </div>
                <OpenBookmakerBtn name={opp.bookmaker} />
              </div>
              <div style={{ background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: "#30D158", marginBottom: 4, fontWeight: 700 }}>💡 RECOMENDAÇÃO</div>
                <div style={{ fontSize: 13, color: "#FFFFFF99", lineHeight: 1.6 }}>
                  Aposte em <strong style={{ color: "#BF5AF2" }}>{opp.selection}</strong> na <strong style={{ color: "#BF5AF2" }}>{opp.bookmaker}</strong> pela odd <strong style={{ color: "#BF5AF2" }}>{opp.odd.toFixed(2)}</strong>. O valor justo estimado é {opp.avgMarketOdd.toFixed(2)}, tornando esta aposta com EV+ de +{opp.deviation}.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// APP PRINCIPAL
// ============================================================

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [filter, setFilter] = useState("all");
  const [opps, setOpps] = useState(INITIAL_OPPORTUNITIES);

  // Simula atualização de oportunidades ao vivo
  useEffect(() => {
    const interval = setInterval(() => {
      setOpps((prev) =>
        prev.map((o) => ({
          ...o,
          expiresIn: Math.max(0, o.expiresIn - 5),
        }))
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredOpps = opps.filter((o) => filter === "all" || o.type === filter);
  const unread = 2;

  const navItems = [
    { id: "home", icon: "⚡", label: "Radar" },
    { id: "calc", icon: "🧮", label: "Calc" },
    { id: "alerts", icon: "🔔", label: "Alertas", badge: unread },
    { id: "profile", icon: "👤", label: "Perfil" },
  ];

  return (
    <div style={{
      background: "#000000",
      minHeight: "100vh",
      maxWidth: 430,
      margin: "0 auto",
      fontFamily: "sans-serif",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* HEADER */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(0,0,0,0.9)", backdropFilter: "blur(20px)",
        padding: "14px 16px 10px",
        borderBottom: "1px solid #1C1C1E",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1 }}>
              TRADE<span style={{ background: "linear-gradient(90deg, #00D4FF, #BF5AF2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>PRO</span>
            </div>
            <div style={{ fontSize: 10, color: "#636366", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 2 }}>
              CONSULTORIA DE TRADE ESPORTIVO
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(48,209,88,0.15)", padding: "4px 10px", borderRadius: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#30D158", animation: "pulse 1.5s infinite" }} />
              <span style={{ color: "#30D158", fontSize: 10, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif" }}>AO VIVO</span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ overflowY: "auto" }}>
        {activeTab === "home" && (
          <div style={{ padding: "12px 16px 100px" }}>
            {/* Stats rápidos */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {[
                { label: "Surebets Ativas", value: opps.filter((o) => o.type === "surebet").length, color: "#30D158" },
                { label: "Cashouts", value: opps.filter((o) => o.type === "cashout").length, color: "#FF9500" },
                { label: "Anomalias", value: opps.filter((o) => o.type === "anomaly").length, color: "#BF5AF2" },
                { label: "Lucro Médio", value: "3.5%", color: "#00D4FF" },
              ].map((s, i) => (
                <div key={i} style={{ flexShrink: 0, background: "#1C1C1E", border: `1px solid ${s.color}30`, borderRadius: 14, padding: "10px 14px", minWidth: 100 }}>
                  <div style={{ fontSize: 9, color: "#98989D", marginBottom: 2, whiteSpace: "nowrap" }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Rajdhani', sans-serif" }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
              {[
                { id: "all", label: "Todos" },
                { id: "surebet", label: "⚡ Surebet" },
                { id: "cashout", label: "💰 Cashout" },
                { id: "anomaly", label: "🔮 Anomalias" },
              ].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 20,
                  border: "none", cursor: "pointer",
                  background: filter === f.id ? "linear-gradient(135deg, #00D4FF, #BF5AF2)" : "#2C2C2E",
                  color: filter === f.id ? "#000" : "#98989D",
                  fontSize: 12, fontWeight: 700, fontFamily: "'Rajdhani', sans-serif",
                  WebkitTapHighlightColor: "transparent",
                }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div style={{ fontSize: 11, color: "#636366", marginBottom: 10, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>
              {filteredOpps.length} OPORTUNIDADES ENCONTRADAS
            </div>
            {filteredOpps.map((opp) => {
              if (opp.type === "surebet") return <SurebetCard key={opp.id} opp={opp} onOpen={setSelectedOpp} />;
              if (opp.type === "cashout") return <CashoutCard key={opp.id} opp={opp} onOpen={setSelectedOpp} />;
              if (opp.type === "anomaly") return <AnomalyCard key={opp.id} opp={opp} onOpen={setSelectedOpp} />;
              return null;
            })}
          </div>
        )}
        {activeTab === "calc" && <CalculatorScreen />}
        {activeTab === "alerts" && <AlertsScreen />}
        {activeTab === "profile" && <ProfileScreen />}
      </div>

      {/* BARRA DE NAVEGAÇÃO */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: "rgba(0,0,0,0.95)", backdropFilter: "blur(20px)",
        borderTop: "1px solid #1C1C1E",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
      }}>
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
            flex: 1, padding: "10px 0 8px", background: "none", border: "none",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            position: "relative",
          }}>
            <span style={{ fontSize: 20, opacity: activeTab === item.id ? 1 : 0.4 }}>{item.icon}</span>
            <span style={{
              fontSize: 9, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: 0.5,
              color: activeTab === item.id ? "#00D4FF" : "#636366",
            }}>
              {item.label}
            </span>
            {item.badge > 0 && (
              <div style={{
                position: "absolute", top: 6, right: "50%", transform: "translateX(8px)",
                background: "#FF2D55", width: 16, height: 16, borderRadius: "50%",
                fontSize: 9, color: "#FFF", fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {item.badge}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* MODAL */}
      {selectedOpp && <Modal opp={selectedOpp} onClose={() => setSelectedOpp(null)} />}
    </div>
  );
}
