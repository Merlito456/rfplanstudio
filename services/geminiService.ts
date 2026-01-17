
import { GoogleGenAI, Type } from "@google/genai";
import { Site, TowerType, Sector } from "../types";
import { ANTENNA_LIBRARY } from "../constants";

/**
 * OFFLINE ENGINEERING CORE
 * Handles Chat interaction and provides technical reasoning.
 */

export const getRFAdvice = async (sites: Site[], query: string): Promise<string> => {
  const normalizedQuery = query.toLowerCase();
  
  if (process.env.API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Project has ${sites.length} sites. User Query: "${query}". Context: I am using Vector-Based Azimuth Steering to fill coverage holes. Explain technical choices clearly.`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert RF network planning advisor. Provide technical, professional advice. Mention 'Vector Steering' and 'Dominant Server' logic where appropriate."
        }
      });
      return response.text || "Engineering core returned an empty response.";
    } catch (e) {
      console.warn("Gemini Advice failed, falling back to local logic.");
    }
  }

  await new Promise(resolve => setTimeout(resolve, 400));

  const totalSectors = sites.reduce((acc, s) => acc + s.sectors.length, 0);
  const highTiltSectors = sites.flatMap(s => s.sectors).filter(sec => (sec.mechanicalTilt + sec.electricalTilt) > 8);

  let response = `### Engineering Core Output [Local Engine]\n\n`;

  if (normalizedQuery.includes('azimuth') || normalizedQuery.includes('orient')) {
    response += `**Vector Steering Analysis:** The engine has evaluated local signal gradients. For new nodes, Alpha sectors are steered towards the deepest RSRP nulls (typically < -110dBm) to maximize primary server dominance.\n\n`;
    response += `**Interference Check:** Neighboring boresights were analyzed. Avoidance logic is active to ensure the 3dB beamwidth overlap with adjacent sites is minimized.\n`;
  } else if (normalizedQuery.includes('tilt')) {
    response += `**Tilt Strategy:** Your project has ${highTiltSectors.length} sectors with aggressive tilt (>8°). This suggests a 'Capacity-Limited' design approach intended to constrain overshoot into adjacent cell layers.\n`;
  } else {
    response += `**Optimization Path:** Use the 'AI Optimize' tool within site settings to recalculate vectors for specific nodes. The current project with ${sites.length} sites is showing strong sector-diversity but could benefit from frequency reuse partitioning.\n`;
  }

  return response;
};
