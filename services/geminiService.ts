
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
      const prompt = `Project has ${sites.length} sites. User Query: "${query}". Context: Using Proximity Expansion and Mesh Continuity logic. The algorithm ensures new nodes are placed specifically at the service fringe (-105 to -115 dBm) and within 500m-1200m of neighbor nodes for optimal handovers.`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are a world-class RF planning engineer. Focus on 'Proximity Expansion' and 'Handover Reliability'. Explain that the tool suggests 20 sites specifically near existing neighbor sites (the 'Stitching Zone') to build a robust, continuous network fabric without coverage islands."
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
    response += `**Handover Vector Analysis:** New suggestions are steered to face neighbors at the 1200m boundary. This ensures that the primary serving area overlaps with the neighbor's cell edge for reliable signal re-selection.\n\n`;
    response += `**Interference Control:** Avoidance logic is active to ensure the boresight of new sites does not point directly into the center of existing cells.\n`;
  } else if (normalizedQuery.includes('continuity') || normalizedQuery.includes('signal') || normalizedQuery.includes('handover') || normalizedQuery.includes('suggest') || normalizedQuery.includes('next')) {
    response += `**Proximity Expansion Strategy:** The tool is currently proposing **20 sequential sites** that expand the network footprint while maintaining strict adjacency.\n\n`;
    response += `**The Stitching Zone:** Each suggestion is calculated to be between 500m and 1200m from a dominant neighbor. This creates a high-density 'mesh' that prevents calls from dropping during movement.\n\n`;
    response += `**Growth Potential:** With ${sites.length} current sites, the proposed layer ensures that signal expansion follows a 'ripple' pattern, hardening the core coverage area before pushing into the extreme fringe.\n`;
  } else {
    response += `**System Health:** The current topology is optimized for 'Continuous Service'. Suggesting 20 nodes ensures that the network grows as a cohesive fabric rather than a collection of isolated islands.\n`;
  }

  return response;
};
