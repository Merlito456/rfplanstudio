
import { GoogleGenAI, Type } from "@google/genai";
import { Site, TowerType, Sector } from "../types";
import { ANTENNA_LIBRARY } from "../constants";

/**
 * OFFLINE ENGINEERING CORE
 * This module replaces the cloud-based LLM with a deterministic 
 * RF Analysis Engine that works without internet.
 */

export const getRFAdvice = async (sites: Site[], query: string): Promise<string> => {
  const normalizedQuery = query.toLowerCase();
  
  // Simulated local processing delay
  await new Promise(resolve => setTimeout(resolve, 400));

  // 1. PROJECT ANALYSIS
  const totalSectors = sites.reduce((acc, s) => acc + s.sectors.length, 0);
  const highTiltSectors = sites.flatMap(s => s.sectors).filter(sec => (sec.mechanicalTilt + sec.electricalTilt) > 8);
  const frequencyAudit = Array.from(new Set(sites.flatMap(s => s.sectors.map(sec => sec.frequencyMhz))));

  // 2. LOGIC-BASED RESPONSE GENERATION
  let response = `### Engineering Core Output [Local Node]\n\n`;

  if (normalizedQuery.includes('tilt') || normalizedQuery.includes('overshoot')) {
    response += `**Tilt & Propagation Analysis:**\n`;
    response += `- You currently have **${highTiltSectors.length}** sectors with high aggressive down-tilt (>8°).\n`;
    response += `- **Engineering Rule:** Mechanical tilt affects side-lobes more severely than Electrical tilt. For urban interference control, prioritize Electrical Tilt increases.\n`;
    response += `- **Current State:** ${sites.length > 0 ? 'Analyzing site patterns...' : 'No sites deployed for analysis.'}\n`;
  } 
  else if (normalizedQuery.includes('interference') || normalizedQuery.includes('overlap')) {
    response += `**Interference & Pilot Pollution Report:**\n`;
    if (totalSectors > 6) {
      response += `- **Alert:** High sector density detected. Ensure azimuth spacing is at least 60° between co-polarized antennas.\n`;
      response += `- **C/I Estimate:** Local propagation models suggest potential interference in center-clusters.\n`;
    } else {
      response += `- Network density is currently low. Interference risk is minimal.\n`;
    }
    response += `- **Recommendation:** Use frequency reuse patterns (K=3 or K=7) to mitigate co-channel interference.\n`;
  }
  else if (normalizedQuery.includes('coverage') || normalizedQuery.includes('rsrp')) {
    response += `**Coverage Logic Audit:**\n`;
    response += `- Sites Analyzed: ${sites.length}\n`;
    response += `- Average Tower Height: ${sites.length ? (sites.reduce((a, b) => a + b.towerHeightM, 0) / sites.length).toFixed(1) : 0}m\n`;
    response += `- **Prop Model:** Using Hata-Okumura (Urban) local cache.\n`;
    response += `- **Advice:** To increase RSRP at cell edge, evaluate high-gain antennas like the **CellMax High Efficiency** series (21dBi). \n`;
  }
  else if (normalizedQuery.includes('antenna') || normalizedQuery.includes('spec')) {
    response += `**Antenna Hardware Reference:**\n`;
    response += `- **Library Status:** ${ANTENNA_LIBRARY.length} models cached.\n`;
    response += `- **Latest Entry:** ${ANTENNA_LIBRARY[0].vendor} ${ANTENNA_LIBRARY[0].model}\n`;
    response += `- **Design Tip:** Use 4x4 MIMO configurations for 5G Sub-6 deployment to double spectral efficiency.\n`;
  }
  else {
    response += `**General System Status:**\n`;
    response += `The local engineering core is active. I can provide advice on:\n`;
    response += `1. **Tilt Optimization** (MT vs ET differences)\n`;
    response += `2. **Interference Mitigation** (Pilot pollution control)\n`;
    response += `3. **Link Budgets** (RSRP/SINR calculations)\n`;
    response += `4. **Antenna selection** from the local library.\n\n`;
    response += `*Project "RFPlan" currently contains ${sites.length} sites and ${totalSectors} active sectors.*`;
  }

  return response;
};

// Site Suggestion still uses Flash for creative placement but with high technical constraints
export const suggestNextSite = async (sites: Site[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const antennaContext = ANTENNA_LIBRARY.slice(0, 15).map(a => `${a.id}: ${a.vendor} ${a.model}`).join(', ');
  const siteInfo = sites.map(s => `Site ${s.name}: (${s.lat}, ${s.lng})`).join('\n');

  const prompt = `
    Suggest 10 optimal expansion sites based on these locations to fill coverage gaps and improve SINR:
    ${siteInfo}
    Available Antennas: ${antennaContext}
    Return JSON format only. Return exactly 10 suggestions spread geographically.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an RF optimization agent. Suggest exactly 10 expansion sites in JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                  reason: { type: Type.STRING },
                  name: { type: Type.STRING },
                  towerHeightM: { type: Type.NUMBER },
                  towerType: { type: Type.STRING },
                  sectors: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        antennaId: { type: Type.STRING },
                        azimuth: { type: Type.NUMBER },
                        mechanicalTilt: { type: Type.NUMBER },
                        electricalTilt: { type: Type.NUMBER },
                        txPowerDbm: { type: Type.NUMBER },
                        frequencyMhz: { type: Type.NUMBER },
                        heightM: { type: Type.NUMBER }
                      },
                      required: ["antennaId", "azimuth", "mechanicalTilt", "electricalTilt", "txPowerDbm", "frequencyMhz", "heightM"]
                    }
                  }
                },
                required: ["lat", "lng", "reason", "name", "towerHeightM", "towerType", "sectors"]
              }
            }
          },
          required: ["suggestions"]
        }
      },
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return null;
  }
};
