
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
      const prompt = `Project has ${sites.length} sites. User Query: "${query}". Context: Using Signal Stitching and Mesh Continuity logic for optimal expansion. The tool now suggests 20+ site locations simultaneously to bridge handover boundaries and ensure continuous service coverage.`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are a world-class RF planning engineer. Provide technical, professional advice. Focus on 'Mesh Stitching' and 'Service Continuity'. Explain that the suggestion tool generates at least 20 sites specifically at the service boundary fringe (-105 to -115 dBm) to bridge clusters and ensure a stable handover layer without signal drops."
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
    response += `**Service Signal Stitching:** The engine is evaluating the 'overlap zone' between cell edges. For new suggestions, Alpha sectors are steered towards dominant neighbors to facilitate a reliable handover boundary.\n\n`;
    response += `**Interference Mitigation:** Sidelobe interference is minimized by offsetting boresights from the primary server's back-lobes.\n`;
  } else if (normalizedQuery.includes('continuity') || normalizedQuery.includes('signal') || normalizedQuery.includes('handover') || normalizedQuery.includes('suggest') || normalizedQuery.includes('next')) {
    response += `**Continuous Expansion Strategy:** The expansion algorithm is currently tasked with generating **20 optimal node locations**. \n\n`;
    response += `**Mesh Continuity:** Locations are selected at the handover boundary (nominally -109 dBm) where signal strength is sufficient for session maintenance but low enough to justify new capacity.\n\n`;
    response += `**Optimal Deployment:** These 20 nodes collectively create a continuous coverage fabric, eliminating 'dead zones' and ensuring mobile devices maintain a serving cell throughout the expansion area.\n`;
  } else if (normalizedQuery.includes('tilt')) {
    response += `**Tilt Policy:** Your cluster features ${highTiltSectors.length} sectors with aggressive tilt. This strategy is ideal for 'Mesh Continuity' as it creates clean handover boundaries and reduces inter-site interference.\n`;
  } else {
    response += `**System Health:** The current project has ${sites.length} sites. To ensure optimal signal expansion, use the 'Suggest Expansion' tool to deploy the 20-node growth layer.\n`;
  }

  return response;
};
