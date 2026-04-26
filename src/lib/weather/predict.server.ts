import type { AggregatedWeather, ForecastPrediction } from "./types";
import { predictNextHourML, type MLPrediction } from "./ml.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Build a richer feature vector for the LLM. We pre-compute physical hints
 * (diurnal phase, dew point, lapse-cooling clue from clouds + humidity) so the
 * model has explicit priors to reason from instead of inferring them from raw
 * inputs alone.
 */
function buildFeatures(w: AggregatedWeather) {
  const date = new Date(w.timestamp);
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const localHour = (utcHour + w.lon / 15 + 24) % 24;

  // Diurnal phase: temp typically peaks ~14:00, troughs ~05:00 local.
  let diurnalHint: "warming" | "cooling" | "near-peak" | "near-trough";
  if (localHour >= 5 && localHour < 13) diurnalHint = "warming";
  else if (localHour >= 13 && localHour < 16) diurnalHint = "near-peak";
  else if (localHour >= 16 && localHour < 22) diurnalHint = "cooling";
  else diurnalHint = "near-trough";

  // Magnus dew-point approximation
  const a = 17.625;
  const b = 243.04;
  const rh = Math.max(1, Math.min(100, w.humidity));
  const alpha = (a * w.tempC) / (b + w.tempC) + Math.log(rh / 100);
  const dewPointC = (b * alpha) / (a - alpha);

  // Heat sink: high humidity + clouds tends to dampen swings
  const inertia = (w.humidity / 100) * 0.5 + (w.cloudsPct / 100) * 0.5;

  return { localHour, diurnalHint, dewPointC, inertia };
}

/** Fallback when AI is unavailable: return the trained ML prediction alone. */
function mlOnlyPrediction(w: AggregatedWeather, ml: MLPrediction, reason: string): ForecastPrediction {
  return {
    nextHourTempC: ml.nextHourTempC,
    trend: ml.trend,
    rationale: `${reason} ML baseline (ridge regression on diurnal + physical features) used.`,
    confidence: ml.confidence,
    ensemble: {
      mlTempC: ml.nextHourTempC,
      aiTempC: ml.nextHourTempC,
      mlConfidence: ml.confidence,
      aiConfidence: 0,
      topFactors: ml.topFactors,
    },
  };
}

export async function predictNextHour(w: AggregatedWeather): Promise<ForecastPrediction> {
  // Step 1: Always run the trained ML model (fast, deterministic baseline).
  const ml = predictNextHourML(w);

  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) {
    return mlOnlyPrediction(w, ml, "AI key missing —");
  }

  const f = buildFeatures(w);

  const systemPrompt =
    "You are a numerical weather prediction model working alongside a trained ridge-regression baseline. Forecast the air temperature one hour ahead using surface observations and physical priors (diurnal cycle, cloud-radiation balance, humidity inertia, advection from current wind). Be conservative for high-inertia regimes (overcast + humid) and allow larger swings for clear, dry conditions during morning warming or evening cooling. Always respond by calling the predict_temperature tool.";

  const userPrompt = `LOCATION
city: ${w.city}${w.country ? ", " + w.country : ""}
coords: ${w.lat.toFixed(2)}, ${w.lon.toFixed(2)}
local_hour: ${f.localHour.toFixed(2)}
diurnal_phase: ${f.diurnalHint}
is_day: ${w.isDay}

CURRENT (aggregated from ${w.providers.filter((p) => p.ok).length} providers, agreement ${w.confidence}%)
temp_c: ${w.tempC.toFixed(2)}
feels_like_c: ${w.feelsLikeC.toFixed(2)}
dew_point_c: ${f.dewPointC.toFixed(2)}
humidity_pct: ${Math.round(w.humidity)}
wind_ms: ${w.windMs.toFixed(1)}
wind_deg: ${Math.round(w.windDeg)}
pressure_hpa: ${Math.round(w.pressureHpa)}
clouds_pct: ${Math.round(w.cloudsPct)}
visibility_km: ${w.visibilityKm.toFixed(1)}
condition: ${w.condition} (${w.description})
inertia_index: ${f.inertia.toFixed(2)}  // 0=fast swings, 1=very damped

INTER-PROVIDER VARIANCE
temp_var: ${w.variance.tempC.toFixed(2)}
humidity_var: ${w.variance.humidity.toFixed(2)}
wind_var: ${w.variance.windMs.toFixed(2)}

ML BASELINE PREDICTION
ml_next_hour_temp_c: ${ml.nextHourTempC} (delta ${ml.delta >= 0 ? "+" : ""}${ml.delta}°C, trend ${ml.trend}, confidence ${ml.confidence}%)
ml_top_factors: ${ml.topFactors.map((f) => `${f.name}=${f.contribution}`).join(", ")}

Predict next_hour_temp_c. Use the ML baseline as a prior — agree with it unless you have a clear physical reason to diverge (e.g. incoming front, strong advection, condition change).`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "predict_temperature",
              description: "Return the predicted temperature one hour from now.",
              parameters: {
                type: "object",
                properties: {
                  next_hour_temp_c: {
                    type: "number",
                    description: "Predicted air temperature in Celsius one hour from now.",
                  },
                  trend: { type: "string", enum: ["rising", "falling", "steady"] },
                  rationale: {
                    type: "string",
                    description: "One concise sentence of physical reasoning, optionally noting agreement/disagreement with the ML baseline.",
                  },
                  confidence: {
                    type: "number",
                    description: "0-100 confidence in this prediction.",
                  },
                },
                required: ["next_hour_temp_c", "trend", "rationale", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "predict_temperature" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI prediction failed:", res.status, text);
      const reason =
        res.status === 429
          ? "AI rate-limited —"
          : res.status === 402
            ? "AI credits exhausted —"
            : "AI service unavailable —";
      return mlOnlyPrediction(w, ml, reason);
    }

    const data: any = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No tool call in AI response");
    const parsed = JSON.parse(args);

    // Sanity-clamp the AI prediction to ±10°C of current to reject hallucinations.
    const aiRaw = Number(parsed.next_hour_temp_c);
    const aiClamped = +Math.max(w.tempC - 10, Math.min(w.tempC + 10, aiRaw)).toFixed(1);
    const aiConfidence = Math.round(Math.min(100, Math.max(0, Number(parsed.confidence))));

    // ----- Hybrid ensemble -----
    // Weight by each model's confidence (so when AI is unsure, ML carries more).
    const wAI = aiConfidence;
    const wML = ml.confidence;
    const totalW = wAI + wML || 1;
    const ensembleTemp = +((aiClamped * wAI + ml.nextHourTempC * wML) / totalW).toFixed(1);

    // Ensemble confidence: boosted when models agree, penalised when they diverge.
    const disagreement = Math.abs(aiClamped - ml.nextHourTempC); // °C
    const agreementBoost = Math.max(0, 10 - disagreement * 4);   // up to +10
    const blended = Math.round(
      Math.min(100, Math.max(0, (aiConfidence * 0.5 + ml.confidence * 0.3 + w.confidence * 0.2) + agreementBoost))
    );

    const delta = ensembleTemp - w.tempC;
    const trend: ForecastPrediction["trend"] =
      Math.abs(delta) < 0.25 ? "steady" : delta > 0 ? "rising" : "falling";

    return {
      nextHourTempC: ensembleTemp,
      trend,
      rationale: `${parsed.rationale} (AI ${aiClamped}°C vs ML ${ml.nextHourTempC}°C — ensemble weighted by confidence)`,
      confidence: blended,
      ensemble: {
        mlTempC: ml.nextHourTempC,
        aiTempC: aiClamped,
        mlConfidence: ml.confidence,
        aiConfidence,
        topFactors: ml.topFactors,
      },
    };
  } catch (e) {
    console.error("predictNextHour error:", e);
    return mlOnlyPrediction(w, ml, "AI prediction failed —");
  }
}
